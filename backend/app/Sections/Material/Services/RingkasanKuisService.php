<?php

declare(strict_types=1);

namespace App\Sections\Material\Services;

use App\Models\User;
use App\Sections\Attempt\Enums\JenisAttempt;
use App\Sections\Attempt\Enums\StatusAttempt;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Services\AttemptService;
use App\Sections\Material\Enums\StatusProgres;
use App\Sections\Material\Models\BlokMateri;
use App\Sections\Material\Models\Materi;
use App\Sections\Material\Models\ProgresMateri;
use App\Sections\Question\Models\Soal;
use App\Sections\Question\Registry\RangkumKunci;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Isi layar SESUDAH kuis sisipan: ringkasan soal, kartu ingat (flashcard), dan
 * papan peringkat latihan.
 *
 * Tiga hal ini DIBUKA GURU per blok kuis (`isi.tampilan.ringkasan|kartu|papan`,
 * bawaan mati). Aturan yang ditegakkan di sini, bukan di klien:
 *
 * - Kunci jawaban baru dikirim setelah attempt latihan MILIK murid itu sendiri
 *   berstatus selesai. Soal yang belum dikumpulkan tidak pernah bocor.
 * - Yang dikirim hanya rangkuman teks kunci (`RangkumKunci`), bukan struktur
 *   kunci mentah; jenis soal yang kuncinya tidak bisa dirangkum jatuh ke
 *   pembahasan guru.
 * - Papan peringkat latihan TERPISAH dari ranking resmi ulangan (aturan F2:
 *   latihan tidak pernah menyentuh ranking asli). Siswa tamu tidak ikut, sama
 *   seperti ranking resmi.
 *
 * Catatan operasional: karena kuis sisipan memakai bank soal yang sama dengan
 * ulangan, guru yang membuka ringkasan sebaiknya tidak memakai kuis yang sama
 * sebagai ulangan resmi yang belum berlangsung.
 */
class RingkasanKuisService
{
    public const TOP_PAPAN = 10;

    public function __construct(
        private readonly AttemptService $attempt,
    ) {}

    /**
     * @return array{ringkasan: bool, kartu: bool, papan: bool}
     */
    public static function opsi(BlokMateri $blok): array
    {
        $isi = is_array($blok->isi) ? $blok->isi : [];
        $tampilan = is_array($isi['tampilan'] ?? null) ? $isi['tampilan'] : [];

        return [
            'ringkasan' => (int) ($tampilan['ringkasan'] ?? 0) === 1,
            'kartu' => (int) ($tampilan['kartu'] ?? 0) === 1,
            'papan' => (int) ($tampilan['papan'] ?? 0) === 1,
        ];
    }

    /**
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function untuk(Materi $materi, BlokMateri $blok, User $murid): array
    {
        $profil = $murid->murid;

        if ($profil === null) {
            throw ValidationException::withMessages(['materi' => 'Hanya akun murid yang bisa menempuh materi.']);
        }

        if ((int) $blok->material_id !== (int) $materi->getKey() || ! $blok->tipe->berkuis()) {
            throw ValidationException::withMessages(['blok' => 'Blok ini bukan kuis sisipan materi ini.']);
        }

        $opsi = self::opsi($blok);

        if (! $opsi['ringkasan'] && ! $opsi['kartu'] && ! $opsi['papan']) {
            abort(404, 'Guru tidak membuka ringkasan untuk kuis ini.');
        }

        $progres = ProgresMateri::query()
            ->where('block_id', $blok->getKey())
            ->where('student_id', $profil->getKey())
            ->first();

        $latihan = $progres?->attempt_id === null ? null : Attempt::query()->find($progres->attempt_id);

        if (
            $latihan === null
            || (int) $latihan->student_id !== (int) $profil->getKey()
            || $latihan->jenis !== JenisAttempt::Latihan
            || $latihan->status !== StatusAttempt::Selesai
        ) {
            throw ValidationException::withMessages([
                'blok' => 'Kumpulkan latihannya dulu, baru ringkasan dibuka.',
            ]);
        }

        $hasil = ['opsi' => $opsi];

        if ($opsi['ringkasan'] || $opsi['kartu']) {
            $soal = $this->barisSoal($latihan);

            $hasil['soal'] = $opsi['ringkasan'] ? $soal : [];
            $hasil['kartu'] = $opsi['kartu'] ? $this->kartu($soal) : [];
        }

        if ($opsi['papan']) {
            $hasil['papan'] = $this->papan($blok, (int) $profil->getKey(), (float) $latihan->skor_maksimal);
        }

        return $hasil;
    }

    /**
     * Satu baris per soal: apa yang ditanyakan, benar/salahnya milik murid ini,
     * dan rangkuman jawaban benar + pembahasan guru.
     *
     * @return array<int, array<string, mixed>>
     */
    private function barisSoal(Attempt $latihan): array
    {
        $latihan = $this->attempt->muat($latihan);
        $daftar = $this->attempt->soalTerurut($latihan);
        $jawaban = $latihan->jawaban->keyBy('question_id');

        // Pembahasan tidak ikut snapshot attempt, jadi dibaca terpisah.
        $pembahasan = Soal::query()
            ->whereIn('id', array_map(static fn (Soal $s): int => (int) $s->getKey(), $daftar))
            ->pluck('pembahasan', 'id');

        $baris = [];

        foreach ($daftar as $indeks => $soal) {
            $tipe = $soal->tipeAman();
            $konten = $soal->kontenSebagaiArray();
            $kunci = $soal->kunciSebagaiArray();
            $punya = $jawaban->get($soal->getKey());
            $catatan = $pembahasan->get($soal->getKey());

            $baris[] = [
                'question_id' => (int) $soal->getKey(),
                'nomor' => $indeks + 1,
                'tipe' => $tipe?->value ?? 'tidak_dikenal',
                'tipe_label' => $tipe?->label() ?? 'Tidak dikenal',
                'teks' => RangkumKunci::teksSoal($konten),
                'terjawab' => $punya !== null && $punya->jawaban !== null,
                'benar' => $punya?->benar,
                'skor' => (float) ($punya->skor ?? 0),
                'skor_maksimal' => (float) $soal->skor,
                'jawaban_benar' => RangkumKunci::rangkum($tipe, $konten, $kunci),
                'pembahasan' => is_string($catatan) && trim($catatan) !== '' ? trim($catatan) : null,
            ];
        }

        return $baris;
    }

    /**
     * Kartu ingat dari baris soal. Soal yang tidak punya apa pun untuk dibalik
     * (tanpa rangkuman dan tanpa pembahasan) tidak dijadikan kartu.
     *
     * @param  array<int, array<string, mixed>>  $soal
     * @return array<int, array<string, mixed>>
     */
    private function kartu(array $soal): array
    {
        $kartu = [];

        foreach ($soal as $satu) {
            if ($satu['jawaban_benar'] === null && $satu['pembahasan'] === null) {
                continue;
            }

            $kartu[] = [
                'question_id' => $satu['question_id'],
                'nomor' => $satu['nomor'],
                'depan' => $satu['teks'],
                'belakang' => $satu['jawaban_benar'],
                'catatan' => $satu['pembahasan'],
                // Dipakai klien untuk menaruh kartu yang tadi salah lebih dulu.
                'benar' => $satu['benar'],
            ];
        }

        return $kartu;
    }

    /**
     * Papan peringkat latihan untuk satu blok kuis di kelas materinya.
     *
     * Urut: skor tertinggi, lalu yang lebih dulu menyelesaikan, lalu nama.
     * Hanya baris berstatus selesai; siswa tamu tidak ikut.
     *
     * @return array<string, mixed>
     */
    private function papan(BlokMateri $blok, int $muridId, float $skorMaksimal): array
    {
        $baris = DB::table('material_progress as p')
            ->join('students as s', 's.id', '=', 'p.student_id')
            ->join('users as u', 'u.id', '=', 's.user_id')
            ->where('p.block_id', $blok->getKey())
            ->where('p.status', StatusProgres::Selesai->value)
            ->where('u.is_tamu', false)
            ->orderByDesc('p.skor')
            ->orderBy('p.selesai_at')
            ->orderBy('u.name')
            ->get(['p.student_id', 'p.skor', 'p.selesai_at', 'u.name']);

        $semua = [];
        $peringkat = 0;
        $skorSebelumnya = null;

        foreach ($baris as $urutan => $satu) {
            // Skor sama = peringkat sama (1, 2, 2, 4), supaya seri tidak terasa tidak adil.
            if ($skorSebelumnya === null || (float) $satu->skor !== $skorSebelumnya) {
                $peringkat = $urutan + 1;
                $skorSebelumnya = (float) $satu->skor;
            }

            $semua[] = [
                'peringkat' => $peringkat,
                'nama' => (string) $satu->name,
                'skor' => (float) $satu->skor,
                'saya' => (int) $satu->student_id === $muridId,
            ];
        }

        $teratas = array_slice($semua, 0, self::TOP_PAPAN);
        $saya = null;

        foreach ($semua as $satu) {
            if ($satu['saya']) {
                $saya = $satu;
                break;
            }
        }

        return [
            'skor_maksimal' => $skorMaksimal,
            'peserta' => count($semua),
            'teratas' => $teratas,
            // Murid di luar sepuluh besar tetap melihat posisinya sendiri.
            'saya' => $saya !== null && ! in_array($saya, $teratas, true) ? $saya : null,
        ];
    }
}
