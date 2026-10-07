<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Services;

use App\Models\User;
use App\Sections\Attempt\Enums\JenisAttempt;
use App\Sections\Attempt\Enums\StatusAttempt;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Models\Jawaban;
use App\Sections\Attempt\Models\RevisiJawaban;
use App\Sections\Cheat\Enums\KategoriKecurangan;
use App\Sections\Cheat\Services\KecuranganService;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Enums\StatusKuis;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Scoring\Enums\StatusPenilaian;
use App\Sections\Scoring\Services\PenilaiAiService;
use App\Sections\Scoring\Services\PenilaiSoal;
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Services\PengaturanService;
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

    public function __construct(
        private readonly PenilaiSoal $penilaian,
        private readonly PengaturanService $pengaturan,
        private readonly KecuranganService $kecurangan,
        private readonly PenilaiAiService $ai,
        private readonly TimService $tim,
    ) {}

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

        // Mode tim (slice 09-C): attempt dimiliki TIM, bukan murid. Satu anggota
        // membuka kuis = semua anggota mengerjakan lembar yang sama.
        $tim = null;

        if ($this->tim->modeTim($kuis)) {
            $tim = $this->tim->timUntukMurid($kuis, (int) $profil->getKey());

            if ($tim === null) {
                throw ValidationException::withMessages([
                    'kuis' => 'Kuis ini mode tim, tetapi kamu belum masuk tim mana pun. Minta gurumu menyusun tim dulu.',
                ]);
            }
        }

        // Satu attempt aktif per murid (atau per tim) per kuis per jenis:
        // mulai ulang = lanjutkan.
        $aktif = Attempt::query()
            ->where('quiz_id', $kuis->getKey())
            ->where('jenis', $jenis->value)
            ->where('aktif', true)
            ->when(
                $tim !== null,
                static fn ($query) => $query->where('team_id', $tim?->getKey()),
                static fn ($query) => $query->where('student_id', $profil->getKey()),
            )
            ->first();

        // Attempt yang ditinggalkan (tab ditutup sebelum waktu habis) ditutup dulu.
        // Tanpa ini murid mentok selamanya: `jawab` menolak (deadline lewat),
        // `kumpulkan` menolak (lewat tenggat keterlambatan), tetapi `aktif` masih
        // terisi sehingga `mulai()` terus mengembalikan attempt mati yang sama.
        if ($aktif !== null && $this->basi($aktif, $sekarang)) {
            $this->tutupBasi($aktif);
            $aktif = null;
        }

        if ($aktif !== null) {
            return $this->muat($aktif);
        }

        // Retry terkontrol: percobaan pertama bebas, ulangan ulang mengikuti
        // saklar `retry` + `batas_percobaan` dari pengaturan tiga lapis.
        $sudahDikumpulkan = Attempt::query()
            ->where('quiz_id', $kuis->getKey())
            ->where('jenis', $jenis->value)
            ->whereNotNull('dikumpulkan_at')
            ->when(
                $tim !== null,
                static fn ($query) => $query->where('team_id', $tim?->getKey()),
                static fn ($query) => $query->where('student_id', $profil->getKey()),
            )
            ->count();

        $nomorPercobaan = $sudahDikumpulkan + 1;

        if ($sudahDikumpulkan > 0) {
            $peta = $this->pengaturan->semua((int) $kuis->school_id, (int) $kuis->class_id, (int) $kuis->getKey())['pengaturan'];
            $retryDiizinkan = (bool) ($peta[KunciPengaturan::Retry->value]['nilai'] ?? KunciPengaturan::Retry->bawaan());
            // Bawaan 3 percobaan (sama dengan nilai bawaan kunci pengaturan).
            $batasPercobaan = (int) ($peta[KunciPengaturan::BatasPercobaan->value]['nilai'] ?? KunciPengaturan::BatasPercobaan->bawaan());

            if (! $retryDiizinkan) {
                throw ValidationException::withMessages(['kuis' => 'Ulangan ulang tidak diizinkan untuk kuis ini.']);
            }

            if ($nomorPercobaan > $batasPercobaan) {
                throw ValidationException::withMessages(['kuis' => 'Batas percobaan untuk kuis ini sudah habis.']);
            }
        }

        $attempt = Attempt::query()->create([
            'school_id' => $kuis->school_id,
            'quiz_id' => $kuis->getKey(),
            // Pencatat attempt: murid pertama yang membuka. Pada mode tim yang
            // menentukan nilai adalah `team_id`, bukan murid ini.
            'student_id' => $profil->getKey(),
            'team_id' => $tim?->getKey(),
            'jenis' => $jenis,
            'attempt_no' => $nomorPercobaan,
            // Skor asli hanya milik percobaan pertama yang resmi (bukan latihan).
            'asli' => $nomorPercobaan === 1 && $jenis->resmi(),
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
        return $attempt->load(['kuis.mapel', 'kuis.kelas', 'kuis.soal', 'jawaban', 'tim.murid.user']);
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
     * `$penjawabId` hanya relevan pada mode tim: jawaban bersama bisa diubah
     * beberapa murid, jadi tiap perubahan dicatat sebagai versi baru (slice 09-C).
     *
     * @throws ValidationException
     */
    public function simpanJawaban(Attempt $attempt, Soal $soal, mixed $jawaban, ?int $penjawabId = null): Jawaban
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

        return DB::transaction(function () use ($attempt, $soal, $jawaban, $penjawabId): Jawaban {
            $baris = Jawaban::query()
                ->where('attempt_id', $attempt->getKey())
                ->where('question_id', $soal->getKey())
                ->lockForUpdate()
                ->first();

            $berubah = $baris === null || json_encode($baris->jawaban) !== json_encode($jawaban);
            $baris ??= new Jawaban(['attempt_id' => $attempt->getKey(), 'question_id' => $soal->getKey()]);

            // Versi hanya bertambah di mode tim dan hanya saat isinya berubah:
            // autosave berulang dengan jawaban sama tidak membanjiri riwayat.
            $versi = (int) ($baris->versi ?? 0);
            $bersama = $attempt->team_id !== null;

            if ($bersama && $berubah) {
                $versi++;
            }

            $baris->forceFill([
                'jawaban' => $jawaban,
                'status' => StatusPenilaian::Menunggu,
                'benar' => null,
                'skor' => 0,
                'dinilai_at' => null,
                'penjawab_id' => $penjawabId ?? $baris->penjawab_id,
                'versi' => $versi,
            ])->save();

            if ($bersama && $berubah) {
                RevisiJawaban::query()->create([
                    'attempt_id' => $attempt->getKey(),
                    'question_id' => $soal->getKey(),
                    'student_id' => $penjawabId,
                    'versi' => $versi,
                    'jawaban' => $jawaban,
                ]);
            }

            return $baris;
        });
    }

    /**
     * Kumpulkan jawaban + nilai. Idempoten: menekan dua kali atau dua tab
     * mengembalikan hasil yang sama tanpa menggandakan penilaian.
     *
     * @throws ValidationException
     */
    public function kumpulkan(Attempt $attempt, string $idempotencyKey): Attempt
    {
        return $this->tutup($attempt, $idempotencyKey, false);
    }

    /**
     * Apakah attempt ini ditinggalkan jauh melewati tenggat keterlambatan?
     */
    public function basi(Attempt $attempt, ?Carbon $sekarang = null): bool
    {
        $sekarang ??= Carbon::now();

        return $attempt->berjalan()
            && $sekarang->greaterThan($attempt->deadline_at->copy()->addSeconds(self::TENGGAT_TERLAMBAT));
    }

    /**
     * Tutup attempt yang ditinggalkan TANPA menolak karena keterlambatan.
     *
     * Jawaban yang sempat tersimpan tetap dinilai seperti pengumpulan biasa,
     * jadi nilainya jujur — bukan dihapus, dan bukan pula dinilai 0 paksa.
     */
    public function tutupBasi(Attempt $attempt): Attempt
    {
        return $this->tutup($attempt, 'basi-'.$attempt->getKey(), true);
    }

    /**
     * Tutup semua attempt berjalan yang sudah melewati tenggat keterlambatan.
     * Dipanggil penjadwal (lihat `TutupAttemptBasi`) supaya layar guru tidak
     * menampilkan murid "sedang mengerjakan" berjam-jam setelah waktunya habis.
     *
     * @return int jumlah attempt yang ditutup
     */
    public function tutupSemuaBasi(): int
    {
        $batas = Carbon::now()->subSeconds(self::TENGGAT_TERLAMBAT);
        $jumlah = 0;

        Attempt::query()
            ->where('aktif', true)
            ->where('status', StatusAttempt::Berjalan->value)
            ->where('deadline_at', '<', $batas)
            ->chunkById(200, function ($daftar) use (&$jumlah): void {
                foreach ($daftar as $satu) {
                    $this->tutupBasi($satu);
                    $jumlah++;
                }
            });

        return $jumlah;
    }

    /**
     * Inti penutupan attempt (dipakai pengumpulan biasa maupun penutupan basi).
     *
     * @throws ValidationException
     */
    private function tutup(Attempt $attempt, string $idempotencyKey, bool $abaikanToleransi): Attempt
    {
        return DB::transaction(function () use ($attempt, $idempotencyKey, $abaikanToleransi): Attempt {
            $terkunci = Attempt::query()->whereKey($attempt->getKey())->lockForUpdate()->firstOrFail();

            // Sudah pernah dikumpulkan: kembalikan hasil lama (aman dobel klik/dua tab).
            if (! $terkunci->berjalan()) {
                return $this->muatHasil($terkunci);
            }

            $sekarang = Carbon::now();
            $terlambat = $sekarang->greaterThan($terkunci->deadline_at);

            if (! $abaikanToleransi && $terlambat && $sekarang->greaterThan($terkunci->deadline_at->copy()->addSeconds(self::TENGGAT_TERLAMBAT))) {
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

            // Mengumpulkan lewat tenggat adalah kejadian yang hanya bisa dilihat
            // server (waktu server), jadi kategorinya turunan server — dan hanya
            // dicatat bila anti-cheat memang dinyalakan guru.
            if ($terlambat && $this->antiCheatAktif($terkunci)) {
                $this->kecurangan->catatTurunan($terkunci, KategoriKecurangan::LateSubmit, [
                    'lewat_detik' => (string) $terkunci->deadline_at->diffInSeconds($sekarang),
                ]);
            }

            // Saran AI menyusul lewat queue: mengumpulkan tidak ikut menunggu
            // layanan pihak ketiga, dan nilainya tidak pernah menimpa skor mesin.
            $this->ai->antre($terkunci);

            return $this->muatHasil($terkunci->refresh());
        });
    }

    /**
     * Apakah anti-cheat dinyalakan untuk kuis attempt ini (pengaturan tiga lapis).
     */
    public function antiCheatAktif(Attempt $attempt): bool
    {
        $kuis = $attempt->kuis;

        $peta = $this->pengaturan->semua(
            (int) $attempt->school_id,
            (int) $kuis->class_id,
            (int) $kuis->getKey(),
        )['pengaturan'];

        return (bool) ($peta[KunciPengaturan::AntiCheat->value]['nilai'] ?? KunciPengaturan::AntiCheat->bawaan());
    }

    /**
     * Saklar anti-cheat rinci untuk satu kuis (dipakai klien lewat payload attempt).
     *
     * @return array<string, bool>
     */
    public function saklarAntiCheat(Kuis $kuis): array
    {
        $peta = $this->pengaturan->semua(
            (int) $kuis->school_id,
            (int) $kuis->class_id,
            (int) $kuis->getKey(),
        )['pengaturan'];

        $induk = (bool) ($peta[KunciPengaturan::AntiCheat->value]['nilai'] ?? KunciPengaturan::AntiCheat->bawaan());
        $saklar = [];

        foreach (KunciPengaturan::cases() as $kunci) {
            if (! $kunci->antiCheat()) {
                continue;
            }

            // Saklar induk mati = tidak ada proteksi aktif, walau saklar rinci
            // pernah dinyalakan sebelum induknya dimatikan lagi.
            $saklar[$kunci->value] = $induk
                && (bool) ($peta[$kunci->value]['nilai'] ?? $kunci->bawaan());
        }

        return $saklar;
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
