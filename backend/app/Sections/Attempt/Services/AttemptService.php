<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Services;

use App\Models\User;
use App\Sections\Attempt\Enums\JenisAttempt;
use App\Sections\Attempt\Enums\StatusAttempt;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Models\Jawaban;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Enums\StatusKuis;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Scoring\Enums\StatusPenilaian;
use App\Sections\Scoring\Services\PenilaianObjektif;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Mesin pengerjaan kuis: mulai (satu attempt aktif), jawab, kumpulkan idempoten,
 * dan susun hasil. Dipakai juga oleh kuis sisipan latihan materi (F2, slice-08).
 *
 * Semua keputusan sensitif ada di sini, bukan di klien: waktu (mulai/deadline),
 * urutan soal/opsi (seed), dan skor.
 */
class AttemptService
{
    /** Toleransi keterlambatan mengumpulkan (detik) sebelum ditolak. */
    public const TENGGAT_TERLAMBAT = 120;

    public function __construct(private readonly PenilaianObjektif $penilaian) {}

    /**
     * Mulai (atau lanjutkan) attempt murid untuk sebuah kuis.
     *
     * @throws ValidationException
     */
    public function mulai(Kuis $kuis, User $murid, JenisAttempt $jenis = JenisAttempt::Ulangan): Attempt
    {
        $profil = $murid->murid;

        if ($profil === null) {
            throw ValidationException::withMessages(['kuis' => 'Hanya akun murid yang bisa mengerjakan kuis.']);
        }

        if ($kuis->status !== StatusKuis::Publikasi) {
            throw ValidationException::withMessages(['kuis' => 'Kuis belum diterbitkan oleh guru.']);
        }

        if ((int) $profil->class_id !== (int) $kuis->class_id) {
            throw ValidationException::withMessages(['kuis' => 'Kuis ini bukan untuk kelasmu.']);
        }

        if ($kuis->soal()->count() === 0) {
            throw ValidationException::withMessages(['kuis' => 'Kuis ini belum punya soal.']);
        }

        $sekarang = Carbon::now();

        if ($kuis->mulai_at !== null && $kuis->mulai_at->greaterThan($sekarang)) {
            throw ValidationException::withMessages(['kuis' => 'Kuis belum dimulai.']);
        }

        if ($kuis->selesai_at !== null && $kuis->selesai_at->lessThan($sekarang)) {
            throw ValidationException::withMessages(['kuis' => 'Waktu kuis sudah berakhir.']);
        }

        // Satu attempt aktif per murid per kuis per jenis: mulai ulang = lanjutkan.
        $aktif = Attempt::query()
            ->where('quiz_id', $kuis->getKey())
            ->where('student_id', $profil->getKey())
            ->where('jenis', $jenis->value)
            ->where('aktif', true)
            ->first();

        if ($aktif !== null) {
            return $this->muat($aktif);
        }

        $attempt = Attempt::query()->create([
            'school_id' => $kuis->school_id,
            'quiz_id' => $kuis->getKey(),
            'student_id' => $profil->getKey(),
            'jenis' => $jenis,
            'status' => StatusAttempt::Berjalan,
            'aktif' => true,
            'seed' => random_int(1, 2_147_483_647),
            'mulai_at' => $sekarang,
            'deadline_at' => $sekarang->copy()->addMinutes((int) $kuis->durasi_menit),
            'terlambat' => false,
            'jumlah_soal' => $kuis->soal()->count(),
            'jumlah_benar' => 0,
            'skor_maksimal' => (float) $kuis->soal()->sum('skor'),
        ]);

        return $this->muat($attempt);
    }

    /** Muat relasi yang dibutuhkan resource attempt. */
    public function muat(Attempt $attempt): Attempt
    {
        return $attempt->load(['kuis.mapel', 'kuis.kelas', 'kuis.soal', 'jawaban']);
    }

    /**
     * Jawaban yang sudah tersimpan (dari DB, tanpa kunci) supaya murid bisa
     * melanjutkan setelah muat ulang/kehilangan jaringan.
     *
     * Dikirim sebagai DAFTAR {question_id, jawaban} — bukan peta ber-kunci id —
     * supaya kunci numerik tidak berisiko berubah bentuk saat diserialisasi JSON.
     *
     * @return array<int, array{question_id: int, jawaban: mixed}>
     */
    public function payloadJawaban(Attempt $attempt): array
    {
        if (! $attempt->relationLoaded('jawaban')) {
            $attempt->load('jawaban');
        }

        $jawaban = [];

        foreach ($attempt->jawaban as $baris) {
            if ($baris->jawaban !== null) {
                $jawaban[] = ['question_id' => (int) $baris->question_id, 'jawaban' => $baris->jawaban];
            }
        }

        return $jawaban;
    }

    /** Muat attempt beserta jawabannya (untuk halaman hasil). */
    public function muatHasil(Attempt $attempt): Attempt
    {
        return $attempt->load(['kuis.mapel', 'kuis.kelas', 'kuis.soal', 'jawaban']);
    }

    /**
     * Simpan/ubah jawaban satu soal selama attempt masih berjalan dan belum lewat deadline.
     *
     * @throws ValidationException
     */
    public function simpanJawaban(Attempt $attempt, Soal $soal, mixed $jawaban): Jawaban
    {
        if (! $attempt->berjalan()) {
            throw ValidationException::withMessages(['attempt' => 'Ulangan ini sudah dikumpulkan.']);
        }

        if (Carbon::now()->greaterThan($attempt->deadline_at)) {
            throw ValidationException::withMessages(['attempt' => 'Waktu ulangan sudah habis; jawaban tidak bisa disimpan.']);
        }

        if (! $this->soalMilikKuis($attempt, $soal)) {
            throw ValidationException::withMessages(['question_id' => 'Soal itu bukan bagian dari kuis ini.']);
        }

        return Jawaban::query()->updateOrCreate(
            ['attempt_id' => $attempt->getKey(), 'question_id' => $soal->getKey()],
            ['jawaban' => $jawaban, 'status' => StatusPenilaian::Menunggu, 'benar' => null, 'skor' => 0, 'dinilai_at' => null],
        );
    }

    /**
     * Kumpulkan jawaban + nilai. Idempoten: menekan dua kali atau dua tab
     * mengembalikan hasil yang sama tanpa menggandakan penilaian.
     *
     * @throws ValidationException
     */
    public function kumpulkan(Attempt $attempt, string $idempotencyKey): Attempt
    {
        return DB::transaction(function () use ($attempt, $idempotencyKey): Attempt {
            $terkunci = Attempt::query()->whereKey($attempt->getKey())->lockForUpdate()->firstOrFail();

            // Sudah pernah dikumpulkan: kembalikan hasil lama (aman dobel klik/dua tab).
            if (! $terkunci->berjalan()) {
                return $this->muatHasil($terkunci);
            }

            $sekarang = Carbon::now();
            $terlambat = $sekarang->greaterThan($terkunci->deadline_at);

            if ($terlambat && $sekarang->greaterThan($terkunci->deadline_at->copy()->addSeconds(self::TENGGAT_TERLAMBAT))) {
                throw ValidationException::withMessages([
                    'attempt' => 'Waktu ulangan sudah habis jauh; jawaban tidak bisa dikumpulkan lagi.',
                ]);
            }

            $soal = $this->soalTerurut($terkunci);
            $skor = 0.0;
            $jumlahBenar = 0;

            foreach ($soal as $satu) {
                $hasil = $this->nilaiSatuSoal($terkunci, $satu, $sekarang);
                $skor += $hasil['skor'];

                if ($hasil['benar'] === true) {
                    $jumlahBenar++;
                }
            }

            $terkunci->forceFill([
                'status' => StatusAttempt::Selesai,
                // aktif = NULL melepas batas "satu attempt aktif" (retry di slice 05).
                'aktif' => null,
                'dikumpulkan_at' => $sekarang,
                'terlambat' => $terlambat,
                'skor' => $skor,
                'jumlah_benar' => $jumlahBenar,
                'idempotency_key' => mb_substr($idempotencyKey, 0, 64),
            ])->save();

            return $this->muatHasil($terkunci->refresh());
        });
    }

    /**
     * Soal kuis dalam urutan seed attempt.
     *
     * @return array<int, Soal>
     */
    public function soalTerurut(Attempt $attempt): array
    {
        $kuis = $attempt->kuis;

        if (! $kuis->relationLoaded('soal')) {
            $kuis->load('soal');
        }

        $soal = $kuis->soal->all();

        if (! $kuis->acak_soal) {
            return array_values($soal);
        }

        return Pengacakan::urutSoal($soal, (int) $attempt->seed, (int) $attempt->getKey());
    }

    /**
     * Payload soal untuk layar pengerjaan — DAFTAR PUTIH kolom, tanpa kunci.
     * Opsi diacak di server sesuai seed attempt.
     *
     * @return array<int, array<string, mixed>>
     */
    public function payloadSoal(Attempt $attempt): array
    {
        $kuis = $attempt->kuis;
        $payload = [];

        foreach ($this->soalTerurut($attempt) as $nomor => $soal) {
            $konten = $soal->kontenSebagaiArray();

            /** @var array<string, mixed> $bersih */
            $bersih = ['teks' => $konten['teks'] ?? ''];

            if (isset($konten['media'])) {
                $bersih['media'] = $konten['media'];
            }

            if (isset($konten['matematika'])) {
                $bersih['matematika'] = $konten['matematika'];
            }

            foreach (['opsi', 'kiri', 'kanan', 'item'] as $namaDaftar) {
                $daftar = $konten[$namaDaftar] ?? null;

                if (! is_array($daftar)) {
                    continue;
                }

                /** @var array<int, array<string, mixed>> $baris */
                $baris = array_values(array_filter($daftar, static fn (mixed $satu): bool => is_array($satu)));
                $bersih[$namaDaftar] = Pengacakan::urutOpsi($baris, (int) $attempt->seed, (int) $soal->getKey(), (bool) $kuis->acak_opsi);
            }

            $tipe = $soal->tipeAman();

            $payload[] = [
                'id' => $soal->getKey(),
                'nomor' => $nomor + 1,
                'tipe' => $tipe?->value ?? 'tidak_dikenal',
                'tipe_label' => $tipe?->label() ?? 'Tidak dikenal',
                'konten' => $bersih,
                'skor' => (float) $soal->skor,
            ];
        }

        return $payload;
    }

    /**
     * Hasil per soal untuk halaman hasil murid — tanpa kunci dan tanpa pembahasan.
     *
     * @return array<int, array<string, mixed>>
     */
    public function rincianHasil(Attempt $attempt): array
    {
        $jawaban = $attempt->jawaban->keyBy('question_id');
        $rincian = [];

        foreach ($this->soalTerurut($attempt) as $nomor => $soal) {
            /** @var Jawaban|null $baris */
            $baris = $jawaban->get($soal->getKey());
            $tipe = $soal->tipeAman();
            $status = $baris?->status ?? StatusPenilaian::Menunggu;

            $rincian[] = [
                'question_id' => $soal->getKey(),
                'nomor' => $nomor + 1,
                'tipe' => $tipe?->value ?? 'tidak_dikenal',
                'tipe_label' => $tipe?->label() ?? 'Tidak dikenal',
                'status' => $status->value,
                'status_label' => $status->label(),
                'benar' => $baris?->benar,
                'skor' => (float) ($baris->skor ?? 0),
                'skor_maksimal' => (float) $soal->skor,
                'terjawab' => $baris !== null && $baris->jawaban !== null,
            ];
        }

        return $rincian;
    }

    /**
     * @return array{dinilai: int, perlu_tinjau: int, gagal: int, belum_dijawab: int}
     */
    public function ringkasanPenilaian(Attempt $attempt): array
    {
        $ringkasan = ['dinilai' => 0, 'perlu_tinjau' => 0, 'gagal' => 0, 'belum_dijawab' => 0];

        foreach ($this->rincianHasil($attempt) as $baris) {
            if ($baris['terjawab'] === false) {
                $ringkasan['belum_dijawab']++;
            }

            if ($baris['status'] === StatusPenilaian::Dinilai->value) {
                $ringkasan['dinilai']++;
            } elseif ($baris['status'] === StatusPenilaian::PerluTinjau->value) {
                $ringkasan['perlu_tinjau']++;
            } elseif ($baris['status'] === StatusPenilaian::Gagal->value) {
                $ringkasan['gagal']++;
            }
        }

        return $ringkasan;
    }

    private function soalMilikKuis(Attempt $attempt, Soal $soal): bool
    {
        $kuis = $attempt->kuis;

        if (! $kuis->relationLoaded('soal')) {
            $kuis->load('soal');
        }

        return $kuis->soal->contains(static fn (Soal $satu): bool => (int) $satu->getKey() === (int) $soal->getKey());
    }

    /**
     * Nilai satu soal + simpan baris jawabannya (walau tidak diisi) supaya guru
     * bisa melihat soal mana yang kosong.
     *
     * @return array{status: StatusPenilaian, benar: bool|null, skor: float}
     */
    private function nilaiSatuSoal(Attempt $attempt, Soal $soal, Carbon $sekarang): array
    {
        $baris = Jawaban::query()
            ->where('attempt_id', $attempt->getKey())
            ->where('question_id', $soal->getKey())
            ->first();

        try {
            $hasil = $this->penilaian->nilai($soal, $baris?->jawaban);
        } catch (Throwable) {
            $hasil = ['status' => StatusPenilaian::Gagal, 'benar' => null, 'skor' => 0.0];
        }

        $baris ??= new Jawaban(['attempt_id' => $attempt->getKey(), 'question_id' => $soal->getKey()]);

        $baris->forceFill([
            'status' => $hasil['status'],
            'benar' => $hasil['benar'],
            'skor' => $hasil['skor'],
            'dinilai_at' => $sekarang,
        ])->save();

        return $hasil;
    }
}
