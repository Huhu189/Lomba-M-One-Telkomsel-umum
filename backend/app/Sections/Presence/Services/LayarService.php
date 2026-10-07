<?php

declare(strict_types=1);

namespace App\Sections\Presence\Services;

use App\Models\User;
use App\Sections\Presence\Enums\ModeLayar;
use App\Sections\Presence\Models\LayarKuis;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Services\PengaturanService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Layar guru → perangkat murid (slice 10).
 *
 * Guru menyiapkan **satu keadaan layar per kuis** (kosong / pengumuman / sorot
 * soal / instruksi setelah ulangan), lalu setiap perubahan disiarkan lewat kanal
 * kuis yang sudah dipakai Live Monitor. Perangkat murid mengikuti keadaan itu
 * dengan SSE, dan bila SSE tidak tersedia cukup memanggil ulang endpoint yang
 * sama (polling) — jadi layar kelas tidak pernah macet karena Redis mati.
 *
 * Dua pagar penting:
 * - **kunci jawaban tidak pernah ikut**: payload soal memakai kolom eksplisit
 *   (id, nomor, tipe, konten, skor) tanpa `kunci`/`pembahasan`;
 * - **saklar `layar_guru`**: begitu sekolah/guru mematikannya (pengaturan tiga
 *   lapis), guru tidak bisa mengubah layar dan murid tidak menerima apa pun.
 */
class LayarService
{
    /** Panjang maksimum bahan tulisan guru (karakter). */
    public const MAKS_JUDUL = 120;

    public const MAKS_ISI = 1000;

    /** Jumlah soal yang ditawarkan di pemilih guru. */
    public const MAKS_PILIHAN_SOAL = 100;

    public function __construct(
        private readonly PenyiarRealtime $penyiar,
        private readonly PengaturanService $pengaturan,
    ) {}

    /**
     * Saklar layar guru untuk konteks kuis ini (sekolah > kelas > kuis).
     */
    public function aktif(Kuis $kuis): bool
    {
        $peta = $this->pengaturan->semua(
            (int) $kuis->school_id,
            $kuis->class_id === null ? null : (int) $kuis->class_id,
            (int) $kuis->getKey(),
        )['pengaturan'];

        return (bool) ($peta[KunciPengaturan::LayarGuru->value]['nilai'] ?? KunciPengaturan::LayarGuru->bawaan());
    }

    /**
     * Keadaan layar sekarang.
     *
     * `$untukGuru` menambahkan hal yang hanya berguna bagi pengendali layar
     * (siapa yang terakhir mengubah + daftar soal untuk dipilih). Untuk murid
     * payloadnya sengaja tetap kecil: perangkat murid hanya menampilkan.
     *
     * @return array<string, mixed>
     */
    public function baca(Kuis $kuis, bool $untukGuru): array
    {
        $baris = LayarKuis::query()->where('quiz_id', (int) $kuis->getKey())->first();

        return $this->susunPayload($kuis, $baris, $untukGuru);
    }

    /**
     * Ubah keadaan layar lalu siarkan ke kanal kuis.
     *
     * @return array<string, mixed> keadaan terbaru (payload guru)
     *
     * @throws ValidationException
     */
    public function ubah(
        User $pengguna,
        Kuis $kuis,
        ModeLayar $mode,
        ?string $judul,
        ?string $isi,
        ?int $soalId,
    ): array {
        if (! $this->aktif($kuis)) {
            abort(403, 'Layar guru sedang dimatikan di pengaturan.');
        }

        $judul = $this->bersihkan($judul, self::MAKS_JUDUL);
        $isi = $this->bersihkan($isi, self::MAKS_ISI);

        if ($mode->butuhTulisan() && ($judul === null && $isi === null)) {
            throw ValidationException::withMessages([
                'judul' => 'Tulis judul atau isi pengumuman dulu supaya murid tahu maksudnya.',
            ]);
        }

        $soal = $mode->butuhSoal() ? $this->soalDalamKuis($kuis, $soalId) : null;

        if ($mode->butuhSoal() && $soal === null) {
            throw ValidationException::withMessages([
                'question_id' => 'Pilih soal yang mau disorot — pastikan soal itu memang bagian dari kuis ini.',
            ]);
        }

        $kuisId = (int) $kuis->getKey();

        $baris = LayarKuis::query()->firstOrNew(['quiz_id' => $kuisId]);
        $baris->fill([
            'mode' => $mode->value,
            'judul' => $judul,
            'isi' => $isi,
            'question_id' => $soal?->getKey(),
            'versi' => (int) ($baris->versi ?? 0) + 1,
            'diubah_oleh' => (int) $pengguna->getKey(),
        ])->save();

        // Versi naik = validation check bagi klien: salinan lama tidak dipakai lagi.
        $this->penyiar->siarkan($this->penyiar->kanalKuis($kuisId), [
            'jenis' => 'layar',
            'kuis_id' => $kuisId,
            'mode' => $mode->value,
            'versi' => (int) $baris->versi,
            'diperbarui_at' => $baris->updated_at?->toIso8601String(),
        ]);

        return $this->susunPayload($kuis, $baris, true);
    }

    /**
     * @return array<string, mixed>
     */
    private function susunPayload(Kuis $kuis, ?LayarKuis $baris, bool $untukGuru): array
    {
        $kuisId = (int) $kuis->getKey();
        $mode = $baris?->modeAman() ?? ModeLayar::Kosong;
        $soal = $baris?->question_id === null
            ? null
            : Soal::query()->find((int) $baris->question_id);

        $payload = [
            'kuis_id' => $kuisId,
            'aktif' => $this->aktif($kuis),
            'mode' => $mode->value,
            'mode_label' => $mode->label(),
            'judul' => $baris?->judul,
            'isi' => $baris?->isi,
            'soal' => $soal === null ? null : $this->soalRingkas($kuisId, $soal),
            'versi' => (int) ($baris?->versi ?? 0),
            'diperbarui_at' => $baris?->updated_at?->toIso8601String(),
        ];

        if (! $untukGuru) {
            return $payload;
        }

        $kuis->loadMissing('kelas');

        $payload['diubah_oleh'] = $baris->diubah_oleh ?? null;
        $payload['kelas_nama'] = $kuis->kelas?->nama;
        $payload['judul_kuis'] = (string) $kuis->judul;
        $payload['maks_judul'] = self::MAKS_JUDUL;
        $payload['maks_isi'] = self::MAKS_ISI;
        $payload['daftar_soal'] = $this->daftarSoal($kuisId);
        // Label mode ikut dikirim supaya frontend tidak menyimpan salinan
        // kedua dari daftar mode (yang bisa berbeda diam-diam).
        $payload['daftar_mode'] = array_map(
            static fn (ModeLayar $mode): array => ['nilai' => $mode->value, 'label' => $mode->label()],
            ModeLayar::cases(),
        );

        return $payload;
    }

    /**
     * Potongan soal yang aman dikirim ke perangkat murid: tanpa kunci dan
     * tanpa pembahasan (kolom ditulis eksplisit, bukan menyaring hasil cast).
     *
     * @return array<string, mixed>
     */
    private function soalRingkas(int $kuisId, Soal $soal): array
    {
        $tipe = $soal->tipeAman();

        return [
            'id' => (int) $soal->getKey(),
            'nomor' => $this->nomorSoal($kuisId, (int) $soal->getKey()) ?? 0,
            'tipe' => $tipe?->value ?? 'tidak_dikenal',
            'tipe_label' => $tipe?->label() ?? 'Tipe tidak dikenal',
            'konten' => $soal->kontenSebagaiArray(),
            'skor' => (int) $soal->skor,
        ];
    }

    /**
     * Daftar soal kuis (nomor + ringkasan teks) untuk pemilih di layar guru.
     *
     * @return list<array{id: int, nomor: int, ringkas: string}>
     */
    private function daftarSoal(int $kuisId): array
    {
        $baris = DB::table('quiz_questions')
            ->join('questions', 'questions.id', '=', 'quiz_questions.question_id')
            ->where('quiz_questions.quiz_id', $kuisId)
            ->orderBy('quiz_questions.urutan')
            ->limit(self::MAKS_PILIHAN_SOAL)
            ->get(['questions.id', 'questions.konten', 'quiz_questions.urutan']);

        $daftar = [];

        foreach ($baris as $indeks => $satu) {
            /** @var string|null $konten */
            $konten = $satu->konten;
            $isi = json_decode((string) $konten, true);
            $teks = is_array($isi) && isset($isi['teks']) ? (string) $isi['teks'] : '';

            $daftar[] = [
                'id' => (int) $satu->id,
                'nomor' => $this->nomorSoal($kuisId, (int) $satu->id) ?? $indeks + 1,
                'ringkas' => Str::limit(trim($teks), 60, '…'),
            ];
        }

        return $daftar;
    }

    /**
     * Nomor (urutan) satu soal di dalam kuis; null bila soal tidak dipakai kuis.
     */
    private function nomorSoal(int $kuisId, int $soalId): ?int
    {
        $urutan = DB::table('quiz_questions')
            ->where('quiz_id', $kuisId)
            ->orderBy('urutan')
            ->pluck('question_id')
            ->values();

        $posisi = $urutan->search($soalId);

        return $posisi === false ? null : $posisi + 1;
    }

    /**
     * Soal yang boleh disorot: harus benar-benar dipakai kuis ini.
     */
    private function soalDalamKuis(Kuis $kuis, ?int $soalId): ?Soal
    {
        if ($soalId === null) {
            return null;
        }

        $ada = DB::table('quiz_questions')
            ->where('quiz_id', (int) $kuis->getKey())
            ->where('question_id', $soalId)
            ->exists();

        return $ada ? Soal::query()->find($soalId) : null;
    }

    /**
     * Rapikan tulisan guru: buang spasi pinggir, anggap kosong sebagai null, dan
     * batasi panjangnya. Baris baru DIPERTAHANKAN — pengumuman sering butuh
     * dipisah per baris supaya terbaca dari belakang kelas.
     */
    private function bersihkan(?string $teks, int $maks): ?string
    {
        if ($teks === null) {
            return null;
        }

        $rapi = trim($teks);

        return $rapi === '' ? null : Str::limit($rapi, $maks, '');
    }
}
