<?php

declare(strict_types=1);

namespace App\Sections\Presence\Services;

use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Models\Jawaban;
use App\Sections\Attempt\Services\AttemptService;
use App\Sections\Cheat\Services\KecuranganService;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Snapshot Live Monitor untuk guru (slice 07).
 *
 * Satu panggilan mengembalikan seluruh yang dibutuhkan layar guru: siapa yang
 * sedang mengerjakan, sejauh mana, dan catatan kejadian apa yang perlu
 * ditanyakan. Snapshot inilah yang pertama dikirim, lalu aliran SSE melanjutkan
 * pembaruannya; tanpa SSE, guru cukup memanggil ulang endpoint ini (polling).
 *
 * Sejak 15 Oktober 2026 monitor juga bisa membuka **lembar jawaban satu murid**
 * (`lembarJawaban`): guru yang melihat satu anak berhenti di soal 7 tidak perlu
 * lagi berjalan ke mejanya untuk tahu apa yang sudah ditulis anak itu.
 */
class MonitorService
{
    /**
     * Panjang teks soal yang dikirim ke lembar jawaban (karakter).
     *
     * Monitor cuma perlu tahu SOAL MANA yang dijawab, bukan seluruh isinya:
     * naskah lengkap (media, matematika, papan teka silang) ada di halaman kuis
     * dan lembar ini dipanggil berulang tiap 5–20 detik selama panelnya terbuka.
     */
    private const PANJANG_TEKS = 200;

    /** Panjang teks satu pilihan jawaban (karakter). */
    private const PANJANG_OPSI = 100;

    public function __construct(
        private readonly PresenceService $presence,
        private readonly KecuranganService $kecurangan,
        private readonly DenyutProteksiService $denyut,
        private readonly AttemptService $attempts,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function snapshot(Kuis $kuis): array
    {
        // Sapuan sekali setiap guru membuka monitor: penjadwal cron tidak bisa
        // lebih rapat dari satu menit, sedangkan status yang dilihat guru harus
        // segar saat itu juga. Denyut proteksi (2D) ikut disapu supaya catatan
        // "sensor berhenti" muncul saat guru melihat monitor, bukan menit depan.
        $this->presence->sapu();
        $this->denyut->sapu();

        $kuisId = (int) $kuis->getKey();
        $hadir = $this->presence->daftar($kuis);
        $petaHadir = [];

        foreach ($hadir as $entri) {
            $petaHadir[$entri['attempt_id']] = $entri;
        }

        $ringkasanKecurangan = $this->kecurangan->ringkasan($kuis);

        $attempt = Attempt::query()
            ->tanpaSnapshot()
            ->where('quiz_id', $kuisId)
            ->with(['murid.user'])
            ->orderBy('attempt_no')
            ->get();

        $progres = $this->progres($kuisId);

        $murid = [];

        foreach ($attempt as $satu) {
            $id = (int) $satu->getKey();
            $kehadiran = $petaHadir[$id] ?? null;
            $jumlahDijawab = $progres[$id] ?? 0;
            $jumlahSoal = max(1, (int) $satu->jumlah_soal);

            $murid[] = [
                'attempt_id' => $id,
                'student_id' => (int) $satu->student_id,
                'nama' => $satu->murid?->user?->name,
                'attempt_no' => (int) $satu->attempt_no,
                'status' => $satu->status->value,
                'status_label' => $satu->status->label(),
                'dijawab' => $jumlahDijawab,
                'jumlah_soal' => (int) $satu->jumlah_soal,
                'persen' => (int) round($jumlahDijawab / $jumlahSoal * 100),
                'online' => $kehadiran['online'] ?? false,
                'detik_terakhir' => $kehadiran['detik_terakhir'] ?? null,
                'skor' => $satu->skor,
                'kecurangan' => $ringkasanKecurangan[$id] ?? [
                    'jumlah' => 0,
                    'skor_tertinggi' => 0,
                    'belum_ditinjau' => 0,
                ],
            ];
        }

        return [
            'kuis' => [
                'id' => $kuisId,
                'judul' => $kuis->judul,
                'status' => $kuis->status->value,
                'kelas_nama' => $kuis->namaKelas(),
            ],
            'murid' => $murid,
            'jumlah_online' => count(array_filter($murid, static fn (array $m): bool => $m['online'] === true)),
            'server_now' => Carbon::now()->toIso8601String(),
            // Ambang ini dikirim supaya klien bisa menampilkan status
            // online/offline tanpa menebak sendiri.
            'ambang_segar_detik' => PresenceService::AMBANG_SEGAR,
        ];
    }

    /**
     * Lembar jawaban satu murid: satu baris per soal, urut seperti urutan soal
     * yang benar-benar dikerjakan murid itu (snapshot attempt).
     *
     * ATURAN YANG DITEGAKKAN DI SINI
     * - **Tanpa kunci dan tanpa penilaian.** Yang ikut ke payload hanya jawaban
     *   murid (`jawaban`), bukan `kunci`, bukan `benar`, bukan `skor` per soal.
     *   Kenapa: layar monitor terbuka di depan kelas, dan kunci yang bocor dari
     *   satu layar guru membatalkan seluruh ulangan. Nilai per soal tetap milik
     *   halaman koreksi, yang memang punya policy sendiri (`koreksi`) dan
     *   menyimpan alasan tiap perubahan.
     * - **Bentuk jawaban apa adanya.** Nilai dikirim mentah (bukan disimpulkan
     *   di sini) karena tiap tipe soal punya bentuk berbeda dan ringkasannya
     *   sudah punya satu sumber di klien (`ringkasNilai`).
     * - **Soal yang belum dijawab tetap tampil** sebagai `terjawab: false`:
     *   pertanyaan guru "anak ini sudah sampai mana?" justru dijawab oleh soal
     *   yang masih kosong.
     *
     * @return array<string, mixed>
     */
    public function lembarJawaban(Attempt $attempt): array
    {
        $attempt->loadMissing(['murid.user', 'jawaban.penjawab.user', 'kuis']);

        $jawaban = $attempt->jawaban->keyBy(static fn (Jawaban $satu): string => (string) $satu->question_id);
        $soal = [];

        foreach ($this->attempts->soalTerurut($attempt) as $nomor => $satu) {
            /** @var Jawaban|null $baris */
            $baris = $jawaban->get((string) $satu->getKey());
            $tipe = $satu->tipeAman();

            $soal[] = [
                'question_id' => (int) $satu->getKey(),
                'nomor' => $nomor + 1,
                'tipe' => $tipe?->value ?? 'tidak_dikenal',
                'tipe_label' => $tipe?->label() ?? 'Tidak dikenal',
                ...$this->kontenRingkas($satu),
                'terjawab' => $baris !== null && $baris->jawaban !== null,
                'jawaban' => $baris?->jawaban,
                // Mode tim (slice 09-C): jawaban bersama bisa ditulis beberapa
                // anggota, jadi guru perlu tahu siapa yang terakhir menulis dan
                // sudah berapa kali isinya berubah.
                'versi' => (int) ($baris->versi ?? 0),
                'penjawab' => $baris?->penjawab?->user?->name,
                'diperbarui_at' => $baris?->updated_at?->toIso8601String(),
            ];
        }

        $terjawab = 0;

        foreach ($soal as $satu) {
            if ($satu['terjawab'] === true) {
                $terjawab++;
            }
        }

        $jumlahSoal = count($soal);

        return [
            'attempt' => [
                'attempt_id' => (int) $attempt->getKey(),
                'student_id' => (int) $attempt->student_id,
                'nama' => $attempt->murid?->user?->name,
                'attempt_no' => (int) $attempt->attempt_no,
                'status' => $attempt->status->value,
                'status_label' => $attempt->status->label(),
                'terjawab' => $terjawab,
                'jumlah_soal' => $jumlahSoal,
                // Skor total sengaja ikut (monitor memang sudah menampilkannya);
                // yang tidak ikut hanya nilai per soal.
                'skor' => $attempt->skor,
                'deadline_at' => $attempt->deadline_at?->toIso8601String(),
                'dikumpulkan_at' => $attempt->dikumpulkan_at?->toIso8601String(),
            ],
            'soal' => $soal,
            'server_now' => Carbon::now()->toIso8601String(),
        ];
    }

    /**
     * Isi soal seperlunya untuk membaca jawaban: teks (dipotong) + daftar opsi.
     *
     * Opsi ikut karena jawaban pilihan ganda disimpan sebagai **id opsi** (`B`),
     * dan "B" tanpa teks opsinya tidak bisa dibaca guru. Kolom berat (media,
     * matematika, papan teka silang) sengaja tidak ikut — itu urusan halaman kuis,
     * bukan monitor yang disegarkan terus-menerus.
     *
     * @return array<string, mixed>
     */
    private function kontenRingkas(Soal $soal): array
    {
        $konten = $soal->kontenSebagaiArray();
        $teks = $konten['teks'] ?? null;

        $hasil = ['teks' => is_string($teks) ? $this->potong($teks, self::PANJANG_TEKS) : ''];
        $opsi = $konten['opsi'] ?? null;

        if (! is_array($opsi)) {
            return $hasil;
        }

        $bersih = [];

        foreach ($opsi as $satu) {
            if (! is_array($satu)) {
                continue;
            }

            $id = $satu['id'] ?? null;
            $teksOpsi = $satu['teks'] ?? null;

            if (! is_scalar($id)) {
                continue;
            }

            $bersih[] = [
                'id' => (string) $id,
                'teks' => is_string($teksOpsi) ? $this->potong($teksOpsi, self::PANJANG_OPSI) : '',
            ];
        }

        if ($bersih !== []) {
            $hasil['opsi'] = $bersih;
        }

        return $hasil;
    }

    /** Potong teks panjang (dipakai teks soal & opsi di lembar jawaban). */
    private function potong(string $teks, int $batas): string
    {
        return mb_strlen($teks) <= $batas ? $teks : mb_substr($teks, 0, $batas - 1).'…';
    }

    /**
     * Jumlah soal terjawab per attempt (satu query untuk seluruh kuis).
     *
     * @return array<int, int>
     */
    private function progres(int $kuisId): array
    {
        $baris = DB::table('answers')
            ->join('attempts', 'attempts.id', '=', 'answers.attempt_id')
            ->where('attempts.quiz_id', $kuisId)
            ->whereNotNull('answers.jawaban')
            ->selectRaw('answers.attempt_id, COUNT(*) as jumlah')
            ->groupBy('answers.attempt_id')
            ->get();

        $hasil = [];

        foreach ($baris as $satu) {
            $hasil[(int) $satu->attempt_id] = (int) $satu->jumlah;
        }

        return $hasil;
    }
}
