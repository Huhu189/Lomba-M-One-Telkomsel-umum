<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Services;

use App\Sections\Attempt\Models\AnggotaAttempt;
use App\Sections\Attempt\Models\AnggotaTim;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Models\Tim;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Murid;
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Services\PengaturanService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Tim kuis mode kelompok (slice 09-C).
 *
 * Guru menyusun tim **sebelum** kuis dijalankan. Aturan yang dijaga di sini:
 * - Mode tim mengikuti pengaturan tiga lapis (`mode_tim`, bawaan mati).
 * - Satu murid hanya boleh ada di satu tim pada satu kuis (juga dijaga unique
 *   index di basis data, bukan hanya oleh pemeriksaan aplikasi).
 * - Susunan tim tidak boleh diubah setelah ada attempt tim berjalan/mengumpul,
 *   supaya tidak ada anggota yang tiba-tiba kehilangan nilainya di tengah jalan.
 */
class TimService
{
    public const MAKS_TIM = 20;

    public const MIN_ANGGOTA = 2;

    public function __construct(private readonly PengaturanService $pengaturan) {}

    /** Apakah kuis ini berjalan mode tim (pengaturan tiga lapis, bawaan mati). */
    public function modeTim(Kuis $kuis): bool
    {
        $peta = $this->pengaturan
            ->semua((int) $kuis->school_id, (int) $kuis->class_id, (int) $kuis->getKey())['pengaturan'];

        return (bool) ($peta[KunciPengaturan::ModeTim->value]['nilai'] ?? KunciPengaturan::ModeTim->bawaan());
    }

    /**
     * Tim beserta anggotanya untuk layar guru.
     *
     * @return array<string, mixed>
     */
    public function daftar(Kuis $kuis): array
    {
        $kuis->loadMissing(['kelas', 'mapel']);

        $tim = Tim::query()
            ->where('quiz_id', $kuis->getKey())
            ->with(['murid.user'])
            ->orderBy('nama')
            ->get();

        return [
            'kuis_id' => $kuis->getKey(),
            'judul_kuis' => $kuis->judul,
            'kelas_nama' => $kuis->kelas?->nama,
            'mapel_nama' => $kuis->mapel?->nama,
            'mode_tim' => $this->modeTim($kuis),
            'ada_attempt' => $this->adaAttemptTim($kuis),
            'jumlah_tim' => $tim->count(),
            'tim' => $tim->map(fn (Tim $satu): array => $this->ringkas($satu))->all(),
            'murid_kelas' => $this->muridKelas($kuis),
        ];
    }

    /**
     * Murid kelas kuis ini (untuk pemilih anggota).
     *
     * @return array<int, array{murid_id: int, nama: string, tim_id: int|null, tim_nama: string|null}>
     */
    public function muridKelas(Kuis $kuis): array
    {
        $murid = Murid::query()
            ->where('class_id', $kuis->class_id)
            ->with(['user', 'keanggotaanTim'])
            ->get();

        $hasil = [];

        foreach ($murid as $satu) {
            $anggota = $satu->keanggotaanTim->firstWhere('quiz_id', $kuis->getKey());

            $hasil[] = [
                'murid_id' => (int) $satu->getKey(),
                'nama' => (string) $satu->user?->name,
                'tim_id' => $anggota !== null ? (int) $anggota->team_id : null,
                'tim_nama' => $anggota !== null ? $this->namaTim((int) $anggota->team_id) : null,
            ];
        }

        usort($hasil, static fn (array $a, array $b): int => strcmp($a['nama'], $b['nama']));

        return $hasil;
    }

    /**
     * @return array{id: int, nama: string, jumlah_anggota: int, anggota: array<int, array{murid_id: int, nama: string}>}
     */
    public function ringkas(Tim $tim): array
    {
        $anggota = [];

        foreach ($tim->murid as $murid) {
            $anggota[] = [
                'murid_id' => (int) $murid->getKey(),
                'nama' => (string) $murid->user?->name,
            ];
        }

        usort($anggota, static fn (array $a, array $b): int => strcmp($a['nama'], $b['nama']));

        return [
            'id' => (int) $tim->getKey(),
            'nama' => $tim->nama,
            'jumlah_anggota' => count($anggota),
            'anggota' => $anggota,
        ];
    }

    /**
     * Nama anggota semua tim pada satu kuis, dikumpulkan sekali jalan supaya
     * halaman peringkat tidak menembak satu query per tim.
     *
     * @return array<int, array<int, string>> peta team_id → daftar nama
     */
    public function anggotaPerTim(Kuis $kuis): array
    {
        // Utamakan SNAPSHOT attempt (Q-18): daftar anggota yang benar-benar
        // mengerjakan, tahan terhadap perubahan susunan tim atau akun murid
        // setelah ujian. Attempt lama tanpa snapshot memakai anggota hidup.
        $snapshot = AnggotaAttempt::query()
            ->join('attempts', 'attempts.id', '=', 'attempt_members.attempt_id')
            ->where('attempts.quiz_id', $kuis->getKey())
            ->whereNotNull('attempt_members.team_id')
            ->get(['attempt_members.team_id', 'attempt_members.nama']);

        $peta = [];

        if ($snapshot->isNotEmpty()) {
            foreach ($snapshot as $satu) {
                $peta[(int) $satu->team_id][] = (string) $satu->nama;
            }
        } else {
            $anggota = AnggotaTim::query()
                ->where('quiz_id', $kuis->getKey())
                ->with('murid.user')
                ->get();

            foreach ($anggota as $satu) {
                $peta[(int) $satu->team_id][] = (string) ($satu->murid?->user?->name ?? 'Murid');
            }
        }

        foreach ($peta as $timId => $nama) {
            sort($nama);
            $peta[$timId] = $nama;
        }

        return $peta;
    }

    /** Tim milik seorang murid pada kuis ini (null bila belum masuk tim). */
    public function timUntukMurid(Kuis $kuis, int $muridId): ?Tim
    {
        $tim = Tim::query()
            ->where('quiz_id', $kuis->getKey())
            ->whereHas('keanggotaan', static fn ($query) => $query->where('student_id', $muridId))
            ->first();

        return $tim;
    }

    /**
     * Ringkasan tim untuk layar murid: nama tim + rekan satu tim.
     *
     * @return array<string, mixed>|null
     */
    public function ringkasUntukMurid(Kuis $kuis, Murid $murid): ?array
    {
        $tim = $this->timUntukMurid($kuis, (int) $murid->getKey());

        if ($tim === null) {
            return null;
        }

        $tim->loadMissing(['murid.user']);

        $anggota = $this->ringkas($tim);
        $anggota['rekan'] = array_values(array_map(
            static fn (array $satu): string => $satu['nama'],
            array_filter($anggota['anggota'], static fn (array $satu): bool => $satu['murid_id'] !== (int) $murid->getKey()),
        ));

        return $anggota;
    }

    /**
     * Simpan satu tim (baru atau ubah nama/anggota).
     *
     * @param  array<int, int>  $muridIds
     * @return array<string, mixed> ringkasan tim
     *
     * @throws ValidationException
     */
    public function simpan(Kuis $kuis, ?Tim $tim, string $nama, array $muridIds): array
    {
        $nama = trim($nama);

        if ($nama === '') {
            throw ValidationException::withMessages(['nama' => 'Nama tim wajib diisi.']);
        }

        $muridIds = array_values(array_unique(array_map('intval', $muridIds)));

        if (count($muridIds) < self::MIN_ANGGOTA) {
            throw ValidationException::withMessages([
                'murid' => 'Satu tim minimal berisi '.self::MIN_ANGGOTA.' murid supaya benar-benar bisa bekerja bersama.',
            ]);
        }

        $this->pastikanBelumAdaAttempt($kuis, $tim);

        $muridKelas = $this->idMuridKelas($kuis);

        foreach ($muridIds as $muridId) {
            if (! in_array($muridId, $muridKelas, true)) {
                throw ValidationException::withMessages(['murid' => 'Hanya murid kelas kuis ini yang bisa masuk tim.']);
            }
        }

        $bentrok = AnggotaTim::query()
            ->where('quiz_id', $kuis->getKey())
            ->whereIn('student_id', $muridIds)
            ->when($tim !== null, static fn ($query) => $query->where('team_id', '!=', $tim->getKey()))
            ->with('murid.user')
            ->get();

        if ($bentrok->isNotEmpty()) {
            $nama0 = $bentrok->first()?->murid?->user?->name ?? 'Seorang murid';

            throw ValidationException::withMessages([
                'murid' => "{$nama0} sudah masuk tim lain pada kuis ini.",
            ]);
        }

        return DB::transaction(function () use ($kuis, $tim, $nama, $muridIds): array {
            $tersimpan = $tim ?? new Tim(['school_id' => $kuis->school_id, 'quiz_id' => $kuis->getKey()]);
            $tersimpan->forceFill(['nama' => $nama])->save();

            AnggotaTim::query()->where('team_id', $tersimpan->getKey())->delete();

            foreach ($muridIds as $muridId) {
                AnggotaTim::query()->create([
                    'team_id' => $tersimpan->getKey(),
                    'quiz_id' => $kuis->getKey(),
                    'student_id' => $muridId,
                ]);
            }

            $tersimpan->load('murid.user');

            return $this->ringkas($tersimpan);
        });
    }

    /**
     * Bagi seluruh murid kelas menjadi beberapa tim secara acak merata
     * (bergiliran, jadi murid yang berdekatan di daftar tidak menumpuk).
     *
     * @return array<string, mixed> ringkasan daftar tim
     *
     * @throws ValidationException
     */
    public function bagiOtomatis(Kuis $kuis, int $jumlahTim): array
    {
        if ($jumlahTim < 2 || $jumlahTim > self::MAKS_TIM) {
            throw ValidationException::withMessages(['jumlah_tim' => 'Jumlah tim harus antara 2 dan '.self::MAKS_TIM.'.']);
        }

        if ($this->adaAttemptTim($kuis)) {
            throw ValidationException::withMessages(['tim' => 'Sudah ada tim yang mengerjakan kuis ini; susunan tim tidak bisa dibagi ulang.']);
        }

        $murid = Murid::query()
            ->where('class_id', $kuis->class_id)
            ->with('user')
            ->get()
            ->map(static fn (Murid $satu): array => ['id' => (int) $satu->getKey(), 'nama' => (string) $satu->user?->name])
            ->all();

        usort($murid, static fn (array $a, array $b): int => strcmp($a['nama'], $b['nama']));

        if (count($murid) < $jumlahTim * self::MIN_ANGGOTA) {
            throw ValidationException::withMessages([
                'jumlah_tim' => 'Murid di kelas ini belum cukup untuk '.$jumlahTim.' tim berisi minimal '.self::MIN_ANGGOTA.' anak.',
            ]);
        }

        DB::transaction(function () use ($kuis, $jumlahTim, $murid): void {
            // Susunan lama dibuang: pembagian ini menggantikan, bukan menambah.
            Tim::query()->where('quiz_id', $kuis->getKey())->delete();

            $keranjang = [];
            $namaTim = [];

            for ($i = 1; $i <= $jumlahTim; $i++) {
                $nama = 'Tim '.$i;
                $tim = Tim::query()->create([
                    'school_id' => $kuis->school_id,
                    'quiz_id' => $kuis->getKey(),
                    'nama' => $nama,
                ]);
                $keranjang[$i - 1] = $tim->getKey();
                $namaTim[$i - 1] = $nama;
            }

            foreach ($murid as $indeks => $satu) {
                AnggotaTim::query()->create([
                    'team_id' => $keranjang[$indeks % $jumlahTim],
                    'quiz_id' => $kuis->getKey(),
                    'student_id' => $satu['id'],
                ]);
            }
        });

        return $this->daftar($kuis);
    }

    /**
     * Hapus satu tim (hanya sebelum ada attempt tim pada kuis ini).
     *
     * @throws ValidationException
     */
    public function hapus(Kuis $kuis, Tim $tim): void
    {
        if ((int) $tim->quiz_id !== (int) $kuis->getKey()) {
            throw ValidationException::withMessages(['tim' => 'Tim itu bukan milik kuis ini.']);
        }

        if ($this->adaAttemptTim($kuis)) {
            throw ValidationException::withMessages(['tim' => 'Tim tidak bisa dihapus setelah kuis mulai dikerjakan.']);
        }

        $tim->delete();
    }

    /** Apakah sudah ada attempt tim pada kuis ini (berjalan atau sudah dikumpulkan). */
    public function adaAttemptTim(Kuis $kuis): bool
    {
        return Attempt::query()
            ->where('quiz_id', $kuis->getKey())
            ->whereNotNull('team_id')
            ->exists();
    }

    /**
     * @return array<int, int>
     */
    private function idMuridKelas(Kuis $kuis): array
    {
        return Murid::query()->where('class_id', $kuis->class_id)->pluck('id')->map('intval')->all();
    }

    /**
     * @throws ValidationException
     */
    private function pastikanBelumAdaAttempt(Kuis $kuis, ?Tim $tim): void
    {
        if ($tim !== null && (int) $tim->quiz_id !== (int) $kuis->getKey()) {
            throw ValidationException::withMessages(['tim' => 'Tim itu bukan milik kuis ini.']);
        }

        if ($this->adaAttemptTim($kuis)) {
            throw ValidationException::withMessages([
                'tim' => 'Kuis ini sudah dikerjakan, jadi susunan tim tidak bisa diubah lagi.',
            ]);
        }
    }

    private function namaTim(int $timId): ?string
    {
        return Tim::query()->whereKey($timId)->value('nama');
    }
}
