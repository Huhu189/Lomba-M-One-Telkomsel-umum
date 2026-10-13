<?php

declare(strict_types=1);

namespace App\Sections\Admin\Services;

use App\Sections\Auth\Enums\UserStatus;
use App\Sections\Quiz\Enums\StatusKuis;
use App\Sections\School\Services\SekolahService;
use App\Sections\Scoring\Enums\StatusPenilaian;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Dasbor skala sekolah untuk admin (permintaan 14 Okt 2026).
 *
 * Beranda admin sebelumnya memakai beranda guru apa adanya, padahal pertanyaan
 * admin sekolah berbeda: bukan "kuis apa yang harus saya pantau", melainkan
 * "bagaimana keadaan sekolah ini sekarang" — berapa murid & guru yang benar-benar
 * aktif, berapa ulangan yang sedang berjalan, dan apa yang baru saja berubah.
 *
 * Seluruh hitungan di sini read-only dan dijalankan dengan beberapa query
 * agregat (bukan satu query per baris), karena jumlah murid satu sekolah bisa
 * ribuan — pola yang sama dengan paginasi daftar murid (P-01).
 */
class MonitorSekolahService
{
    /**
     * Jendela "sedang online" (menit).
     *
     * Bersumber dari tabel `sessions` (driver sesi aplikasi ini memang
     * `database`): sesi yang berdenyut dalam rentang ini dianggap masih terbuka.
     * Bukan "login terakhir" — guru yang meninggalkan tab terbuka pun terhitung
     * online, jadi angkanya dipakai sebagai perkiraan beban, bukan bukti kehadiran.
     */
    public const MENIT_ONLINE = 10;

    /** Banyaknya baris aktivitas terbaru yang ditampilkan di dasbor. */
    public const BATAS_AKTIVITAS = 8;

    public function __construct(private readonly SekolahService $sekolah) {}

    /**
     * @return array<string, mixed>
     */
    public function snapshot(): array
    {
        $sekolah = $this->sekolah->tunggal();
        $schoolId = (int) $sekolah->getKey();

        $sekarang = Carbon::now();
        $awalHari = $sekarang->copy()->startOfDay();
        $batasOnline = $sekarang->copy()->subMinutes(self::MENIT_ONLINE);

        $murid = $this->ringkasMurid($schoolId, $awalHari, $batasOnline);
        $guru = $this->ringkasGuru($batasOnline);
        $kuis = $this->ringkasKuis($schoolId, $sekarang, $awalHari);
        $kelas = $this->ringkasKelas($schoolId);

        return [
            'sekolah' => [
                'nama' => $sekolah->nama,
                'npsn' => $sekolah->npsn,
                'tahun_ajaran' => $sekolah->tahun_ajaran,
            ],
            'server_now' => $sekarang->toIso8601String(),
            'menit_online' => self::MENIT_ONLINE,
            'murid' => $murid,
            'guru' => $guru,
            'kelas' => [
                'total' => count($kelas),
                'daftar' => $kelas,
            ],
            'kuis' => $kuis,
            'angka' => $this->angka($murid, $guru, $kuis, count($kelas)),
            'kuis_berjalan' => $this->kuisBerjalan($schoolId, $sekarang),
            'aktivitas' => $this->aktivitas(),
        ];
    }

    /**
     * Kartu angka di kepala dasbor — urutannya sengaja: yang bergerak hari ini
     * lebih dulu, lalu jumlah tetap (murid/guru/kelas) sebagai konteks.
     *
     * @param  array<string, mixed>  $murid
     * @param  array<string, mixed>  $guru
     * @param  array<string, mixed>  $kuis
     * @return array<int, array<string, mixed>>
     */
    private function angka(array $murid, array $guru, array $kuis, int $jumlahKelas): array
    {
        return [
            [
                'kunci' => 'murid_aktif',
                'label' => 'Murid aktif',
                'nilai' => $murid['aktif'],
                'ket' => 'dari '.$murid['total'].' akun murid',
            ],
            [
                'kunci' => 'murid_online',
                'label' => 'Murid online',
                'nilai' => $murid['online'],
                'ket' => self::MENIT_ONLINE.' menit terakhir',
            ],
            [
                'kunci' => 'sedang_mengerjakan',
                'label' => 'Sedang mengerjakan',
                'nilai' => $murid['mengerjakan'],
                'ket' => 'ulangan berjalan',
            ],
            [
                'kunci' => 'guru_aktif',
                'label' => 'Guru aktif',
                'nilai' => $guru['aktif'],
                'ket' => 'dari '.$guru['total'].' akun guru',
            ],
            [
                'kunci' => 'kuis_aktif',
                'label' => 'Ulangan aktif',
                'nilai' => $kuis['aktif'],
                'ket' => 'terbit & dalam jadwal',
            ],
            // Labelnya sengaja berbahasa Indonesia seperti seluruh teks lain di
            // antarmuka: "attempt" hanyalah nama tabel di dalam kode, bukan kata
            // yang dipakai guru/admin. Kunci JSON-nya tetap `attempt_hari_ini`
            // supaya kontrak API tidak berubah hanya karena teksnya diperbaiki.
            [
                'kunci' => 'attempt_hari_ini',
                'label' => 'Pengerjaan hari ini',
                'nilai' => $kuis['attempt_hari_ini'],
                'ket' => 'satu baris per murid per percobaan, sejak 00:00',
            ],
            [
                'kunci' => 'koreksi_menunggu',
                'label' => 'Menunggu koreksi',
                'nilai' => $kuis['koreksi_menunggu'],
                'ket' => 'jawaban perlu ditinjau',
            ],
            [
                'kunci' => 'kelas',
                'label' => 'Kelas',
                'nilai' => $jumlahKelas,
                'ket' => 'seluruh sekolah',
            ],
        ];
    }

    /**
     * @return array<string, int>
     */
    private function ringkasMurid(int $schoolId, Carbon $awalHari, Carbon $batasOnline): array
    {
        $total = (int) DB::table('students')->where('school_id', $schoolId)->count();

        $akun = DB::table('users')
            ->where('role', 'murid')
            // Akun siswa tamu ikut berperan 'murid' tetapi bukan murid sekolah:
            // tanpa penyaringan ini jumlah "akun murid" membengkak oleh tamu.
            ->where('is_tamu', false);

        $aktif = (int) (clone $akun)->where('status', UserStatus::Aktif->value)->count();
        $belumVerifikasi = (int) (clone $akun)->whereNull('email_verified_at')->count();
        $ditangguhkan = (int) (clone $akun)->where('status', UserStatus::Suspended->value)->count();

        return [
            'total' => $total,
            'akun' => $total,
            'aktif' => $aktif,
            'online' => $this->jumlahOnline($batasOnline, 'murid'),
            'mengerjakan' => (int) DB::table('attempts')
                ->where('school_id', $schoolId)
                ->where('status', 'berjalan')
                ->count(),
            'belum_verifikasi' => $belumVerifikasi,
            'ditangguhkan' => $ditangguhkan,
        ];
    }

    /**
     * @return array<string, int>
     */
    private function ringkasGuru(Carbon $batasOnline): array
    {
        $akun = DB::table('users')->where('role', 'guru');
        $admin = (int) DB::table('users')->where('role', 'admin')->count();

        return [
            'total' => (int) (clone $akun)->count(),
            'aktif' => (int) (clone $akun)->where('status', UserStatus::Aktif->value)->count(),
            'online' => $this->jumlahOnline($batasOnline, 'guru'),
            'ditangguhkan' => (int) (clone $akun)->where('status', UserStatus::Suspended->value)->count(),
            'admin' => $admin,
        ];
    }

    /**
     * Jumlah akun berperan `$peran` yang sesinya masih berdenyut.
     *
     * Driver sesi non-database tidak punya tabel untuk dibaca ⇒ 0, bukan galat:
     * dasbor tetap tampil walau instalasi memakai driver file/redis.
     */
    private function jumlahOnline(Carbon $batasOnline, string $peran): int
    {
        if (config('session.driver') !== 'database') {
            return 0;
        }

        return (int) DB::table('sessions')
            ->join('users', 'users.id', '=', 'sessions.user_id')
            ->where('users.role', $peran)
            ->where('users.is_tamu', false)
            ->where('sessions.last_activity', '>=', $batasOnline->getTimestamp())
            ->distinct()
            ->count('sessions.user_id');
    }

    /**
     * @return array<string, int>
     */
    private function ringkasKuis(int $schoolId, Carbon $sekarang, Carbon $awalHari): array
    {
        $kuis = DB::table('quizzes')->where('school_id', $schoolId);

        return [
            'total' => (int) (clone $kuis)->count(),
            'terbit' => (int) (clone $kuis)->where('status', StatusKuis::Publikasi->value)->count(),
            'draf' => (int) (clone $kuis)->where('status', StatusKuis::Draf->value)->count(),
            'arsip' => (int) (clone $kuis)->where('status', StatusKuis::Arsip->value)->count(),
            'aktif' => (int) $this->kueriBerjalan($schoolId, $sekarang)->count(),
            'attempt_hari_ini' => (int) DB::table('attempts')
                ->where('school_id', $schoolId)
                ->where('created_at', '>=', $awalHari)
                ->count(),
            'dikumpulkan_hari_ini' => (int) DB::table('attempts')
                ->where('school_id', $schoolId)
                ->whereNotNull('dikumpulkan_at')
                ->where('dikumpulkan_at', '>=', $awalHari)
                ->count(),
            'koreksi_menunggu' => (int) DB::table('answers')
                ->join('attempts', 'attempts.id', '=', 'answers.attempt_id')
                ->where('attempts.school_id', $schoolId)
                ->whereNotNull('attempts.dikumpulkan_at')
                ->whereIn('answers.status', [StatusPenilaian::PerluTinjau->value, StatusPenilaian::Gagal->value])
                ->count(),
            'kejadian_hari_ini' => (int) DB::table('cheat_events')
                ->where('school_id', $schoolId)
                ->where('created_at', '>=', $awalHari)
                ->count(),
        ];
    }

    /**
     * Kuis terbit yang jadwalnya sedang berjalan.
     *
     * Syaratnya sama persis dengan `Kuis::sedangBerjalan()` — ulangan yang belum
     * mulai dan yang sudah lewat `selesai_at` tidak dihitung — tetapi ditulis
     * sebagai kueri supaya jumlah kuis berjalan bisa dihitung tanpa memuat semua
     * baris kuis ke memori.
     *
     * @return Builder
     */
    private function kueriBerjalan(int $schoolId, Carbon $sekarang)
    {
        return DB::table('quizzes')
            ->where('school_id', $schoolId)
            ->where('status', StatusKuis::Publikasi->value)
            ->where(function ($kueri) use ($sekarang): void {
                $kueri->whereNull('mulai_at')->orWhere('mulai_at', '<=', $sekarang);
            })
            ->where(function ($kueri) use ($sekarang): void {
                $kueri->whereNull('selesai_at')->orWhere('selesai_at', '>=', $sekarang);
            });
    }

    /**
     * Daftar ulangan yang sedang berjalan + seberapa jauh kelasnya mengerjakan.
     *
     * @return array<int, array<string, mixed>>
     */
    private function kuisBerjalan(int $schoolId, Carbon $sekarang): array
    {
        $kuis = $this->kueriBerjalan($schoolId, $sekarang)
            ->orderByDesc('mulai_at')
            ->limit(10)
            // `slug` ikut dikirim supaya dasbor bisa menautkan ke Monitor Ulangan:
            // guru/admin berpindah lewat slug, dan dasbor tidak perlu memanggil
            // ulang daftar kuis hanya untuk tahu alamatnya.
            ->get(['id', 'slug', 'judul', 'class_id', 'mulai_at', 'selesai_at']);

        if ($kuis->isEmpty()) {
            return [];
        }

        $idKuis = $kuis->pluck('id')->map(static fn ($id): int => (int) $id)->all();

        $namaKelas = DB::table('classes')
            ->whereIn('id', $kuis->pluck('class_id')->filter()->unique()->all())
            ->pluck('nama', 'id');

        $progres = DB::table('attempts')
            ->whereIn('quiz_id', $idKuis)
            ->selectRaw('quiz_id, COUNT(*) as peserta, SUM(CASE WHEN dikumpulkan_at IS NULL THEN 1 ELSE 0 END) as berjalan')
            ->groupBy('quiz_id')
            ->get()
            ->keyBy('quiz_id');

        $hasil = [];

        foreach ($kuis as $satu) {
            $ringkas = $progres->get($satu->id);
            $peserta = (int) ($ringkas->peserta ?? 0);
            $berjalan = (int) ($ringkas->berjalan ?? 0);

            $hasil[] = [
                'id' => (int) $satu->id,
                'slug' => $satu->slug,
                'judul' => $satu->judul,
                'kelas_nama' => $satu->class_id === null ? null : ($namaKelas[$satu->class_id] ?? null),
                'peserta' => $peserta,
                'mengerjakan' => $berjalan,
                'selesai' => max(0, $peserta - $berjalan),
                'persen_selesai' => $peserta === 0 ? 0 : (int) round(($peserta - $berjalan) / $peserta * 100),
                'mulai_at' => $satu->mulai_at === null ? null : Carbon::parse((string) $satu->mulai_at)->toIso8601String(),
            ];
        }

        return $hasil;
    }

    /**
     * Angka per kelas: berapa murid, berapa akun yang baru online, berapa kuis
     * yang sedang berjalan di kelas itu.
     *
     * @return array<int, array<string, mixed>>
     */
    private function ringkasKelas(int $schoolId): array
    {
        $kelas = DB::table('classes')
            ->where('school_id', $schoolId)
            ->orderBy('tingkat')
            ->orderBy('nama')
            ->get(['id', 'nama', 'tingkat']);

        $jumlahMurid = DB::table('students')
            ->where('school_id', $schoolId)
            ->selectRaw('class_id, COUNT(*) as jumlah')
            ->groupBy('class_id')
            ->pluck('jumlah', 'class_id');

        $kuisKelas = DB::table('quizzes')
            ->where('school_id', $schoolId)
            ->where('status', StatusKuis::Publikasi->value)
            ->whereNotNull('class_id')
            ->selectRaw('class_id, COUNT(*) as jumlah')
            ->groupBy('class_id')
            ->pluck('jumlah', 'class_id');

        $hasil = [];

        foreach ($kelas as $satu) {
            $id = (int) $satu->id;

            $hasil[] = [
                'id' => $id,
                'nama' => $satu->nama,
                'tingkat' => (int) $satu->tingkat,
                'jumlah_murid' => (int) ($jumlahMurid[$id] ?? 0),
                'jumlah_kuis_terbit' => (int) ($kuisKelas[$id] ?? 0),
            ];
        }

        return $hasil;
    }

    /**
     * Jejak audit terbaru (append-only, spatie/laravel-activitylog).
     *
     * Hanya `alasan` yang diambil dari `properties`; sisanya sengaja tidak
     * dikirim supaya isi audit mentah (mis. kunci jawaban pada koreksi) tidak
     * berjalan ke klien hanya karena ikut tersimpan di tabel yang sama.
     *
     * @return array<int, array<string, mixed>>
     */
    private function aktivitas(): array
    {
        $baris = DB::table('activity_log')
            ->orderByDesc('id')
            ->limit(self::BATAS_AKTIVITAS)
            ->get(['id', 'log_name', 'description', 'event', 'subject_type', 'subject_id', 'causer_id', 'created_at', 'properties']);

        if ($baris->isEmpty()) {
            return [];
        }

        $idPelaku = $baris->pluck('causer_id')->filter()->unique()->all();
        $namaPelaku = $idPelaku === []
            ? collect()
            : DB::table('users')->whereIn('id', $idPelaku)->pluck('name', 'id');

        return $baris->map(function ($satu) use ($namaPelaku): array {
            $properti = json_decode((string) $satu->properties, true);

            return [
                'id' => (int) $satu->id,
                'jenis' => (string) $satu->log_name,
                'judul' => (string) $satu->description,
                'peristiwa' => $satu->event,
                'pelaku' => $satu->causer_id === null ? null : ($namaPelaku[$satu->causer_id] ?? 'Akun terhapus'),
                'alasan' => is_array($properti) && isset($properti['alasan']) ? (string) $properti['alasan'] : null,
                'waktu' => Carbon::parse((string) $satu->created_at)->toIso8601String(),
            ];
        })->all();
    }
}
