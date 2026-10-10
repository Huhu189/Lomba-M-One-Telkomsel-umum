<?php

declare(strict_types=1);

namespace App\Sections\Presence\Services;

use App\Sections\Attempt\Enums\StatusAttempt;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Cheat\Enums\KategoriKecurangan;
use App\Sections\Cheat\Services\KecuranganService;
use App\Sections\Presence\Contracts\GudangPresence;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Cache\RedisStore;
use Illuminate\Cache\Repository;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * Presence tanpa heartbeat berat (chunk slice-07).
 *
 * Prinsipnya: kehadiran dihitung dari **aktivitas normal murid**, bukan dari
 * detak jantung yang terus dikirim. Setiap request murid yang memang sudah
 * terjadi (memuat attempt, menyimpan jawaban) memperpanjang `last_seen`; klien
 * hanya perlu mengirim satu ping kecil bila 15 detik berlalu tanpa request lain.
 *
 * Penyimpanan diserahkan ke `GudangPresence` (P-02): dengan Redis, satu request
 * hanya menyentuh satu entri milik murid itu (HSET/HGET), bukan membaca-menulis
 * seluruh peta kelas. Kesegaran ditentukan ambang 45 detik; `sapu()` membuang
 * entri yang sudah basi. Tab yang disembunyikan tetap dianggap online — itu
 * memang bukan alasan menuduh anak pergi.
 */
class PresenceService
{
    /** Umur kesegaran kehadiran (detik). */
    public const AMBANG_SEGAR = 45;

    /** Setelah sekian detik tanpa aktivitas, murid dicatat "lama tidak aktif". */
    public const AMBANG_LAMA_OFFLINE = 120;

    /** Gudang yang terpilih (di-cache per proses supaya tidak diperiksa ulang). */
    private ?GudangPresence $gudang = null;

    public function __construct(private readonly KecuranganService $kecurangan) {}

    /**
     * Tandai murid hadir pada attempt ini. Dipanggil dari request yang memang
     * sudah terjadi (bukan dari endpoint terpisah), dan dari ping klien.
     */
    public function tandaiHadir(Attempt $attempt, ?string $sesi = null): void
    {
        $sekarang = Carbon::now();
        $kuisId = (int) $attempt->quiz_id;
        $attemptId = (int) $attempt->getKey();
        $gudang = $this->gudang();

        $sebelum = $gudang->entri($kuisId, $attemptId);

        // Sesi ganda: sesi lain yang MASIH segar untuk attempt yang sama.
        // Ini satu-satunya kategori kecurangan yang bisa dilihat server sendiri
        // tanpa menanyai perangkat murid.
        //
        // Mode tim dikecualikan (Q-14): satu attempt tim memang dipakai bersama
        // beberapa anggota, dan tiap anggota masuk dari perangkat/sesi sendiri.
        // Tanpa pengecualian ini, setiap rekan setim yang membuka lembar yang
        // sama dicatat sebagai "sesi ganda" berisiko 8 — anak dituduh curang
        // hanya karena mengerjakan tugas kelompoknya.
        if (
            $attempt->team_id === null
            && is_array($sebelum)
            && $sesi !== null
            && isset($sebelum['sesi'])
            && $sebelum['sesi'] !== $sesi
            && $this->segar($sebelum['terakhir'] ?? null, $sekarang)
        ) {
            $this->kecurangan->catatTurunan($attempt, KategoriKecurangan::DuplicateSession, [
                'sesi_sebelum' => (string) $sebelum['sesi'],
            ]);
        }

        $gudang->simpan($kuisId, $attemptId, [
            'student_id' => (int) $attempt->student_id,
            'sesi' => $sesi,
            'terakhir' => $sekarang->toIso8601String(),
        ]);
    }

    /**
     * Daftar kehadiran satu kuis untuk Live Monitor (guru).
     *
     * @return array<int, array{attempt_id: int, student_id: int, sesi: string|null, terakhir: string|null, detik_terakhir: int|null, online: bool}>
     */
    public function daftar(Kuis $kuis): array
    {
        $sekarang = Carbon::now();
        $hasil = [];

        foreach ($this->gudang()->semua((int) $kuis->getKey()) as $attemptId => $entri) {
            if (! is_array($entri)) {
                continue;
            }

            $terakhir = $this->parse($entri['terakhir'] ?? null);

            $hasil[] = [
                'attempt_id' => (int) $attemptId,
                'student_id' => (int) ($entri['student_id'] ?? 0),
                'sesi' => isset($entri['sesi']) ? (string) $entri['sesi'] : null,
                'terakhir' => $terakhir?->toIso8601String(),
                'detik_terakhir' => $terakhir === null ? null : (int) $terakhir->diffInSeconds($sekarang, false),
                'online' => $this->segar($entri['terakhir'] ?? null, $sekarang),
            ];
        }

        return $hasil;
    }

    /**
     * Buang entri basi dan catat "lama tidak aktif" untuk attempt yang masih
     * berjalan. Dijalankan berkala (lihat `SapuPresence`).
     *
     * @return int jumlah entri yang dibuang
     */
    public function sapu(): int
    {
        $sekarang = Carbon::now();
        $gudang = $this->gudang();
        $dibuang = 0;

        foreach ($gudang->kuis() as $kuisId) {
            $rusak = [];
            $basi = [];

            foreach ($gudang->semua($kuisId) as $attemptId => $entri) {
                // Entri rusak (nilai tak terbaca) dibuang seperti sebelumnya,
                // tanpa dicatat sebagai kejadian curang.
                if (! is_array($entri)) {
                    $rusak[] = $attemptId;

                    continue;
                }

                if ($this->segar($entri['terakhir'] ?? null, $sekarang)) {
                    continue;
                }

                $terakhir = $this->parse($entri['terakhir'] ?? null);

                if ($terakhir === null || $terakhir->diffInSeconds($sekarang, false) <= self::AMBANG_LAMA_OFFLINE) {
                    continue;
                }

                $this->catatLamaOffline($attemptId, $entri);

                $basi[] = $attemptId;
            }

            $buang = [...$rusak, ...$basi];

            if ($buang !== []) {
                $gudang->buang($kuisId, $buang);
                $dibuang += count($buang);
            }
        }

        return $dibuang;
    }

    /** Lupakan kehadiran satu attempt (dipakai saat attempt dikumpulkan). */
    public function lupakan(Attempt $attempt): void
    {
        $this->gudang()->buang((int) $attempt->quiz_id, [(int) $attempt->getKey()]);
    }

    /** Nama gudang yang aktif (`redis`/`peta`) — untuk jejak saat memeriksa produksi. */
    public function namaGudang(): string
    {
        return $this->gudang()->nama();
    }

    /**
     * Gudang yang dipakai proses ini.
     *
     * Redis dipilih bila cache aplikasi memang store Redis — di sanalah hash
     * per kuis bisa dipakai sehingga satu request murid tidak perlu membaca
     * seluruh kelas (P-02). Driver lain (array/database) memakai peta seperti
     * semula supaya perilaku dev/test tidak berubah.
     *
     * Pemeriksaan store dibungkus supaya konfigurasi cache yang salah tidak
     * menjatuhkan jalur ujian: presence itu pelengkap, bukan penentu nilai.
     */
    private function gudang(): GudangPresence
    {
        if ($this->gudang !== null) {
            return $this->gudang;
        }

        try {
            $toko = Cache::store();
        } catch (Throwable $galat) {
            report($galat);

            return $this->gudang = new GudangPeta;
        }

        // Laravel membungkus store-nya dengan `Repository`, jadi yang diperiksa
        // adalah store di belakangnya (`RedisStore` atau bukan).
        $belakang = $toko instanceof Repository ? $toko->getStore() : $toko;

        return $this->gudang = $belakang instanceof RedisStore
            ? new GudangRedis($belakang)
            : new GudangPeta;
    }

    /** Catat sekali saja per attempt supaya sapuan berkala tidak menumpuk catatan. */
    private function catatLamaOffline(int $attemptId, array $entri): void
    {
        $penanda = 'presence:offline-dicatat:'.$attemptId;

        if (Cache::get($penanda) !== null) {
            return;
        }

        $attempt = Attempt::query()->find($attemptId);

        if ($attempt === null || $attempt->status !== StatusAttempt::Berjalan) {
            return;
        }

        Cache::put($penanda, true, GudangPeta::TTL_DETIK);

        $this->kecurangan->catatTurunan($attempt, KategoriKecurangan::LongOffline, [
            'sesi' => isset($entri['sesi']) ? (string) $entri['sesi'] : '',
        ]);
    }

    private function segar(mixed $terakhir, Carbon $sekarang): bool
    {
        $waktu = $this->parse($terakhir);

        if ($waktu === null) {
            return false;
        }

        return $waktu->diffInSeconds($sekarang, false) <= self::AMBANG_SEGAR;
    }

    private function parse(mixed $nilai): ?Carbon
    {
        if (! is_string($nilai) || $nilai === '') {
            return null;
        }

        try {
            return Carbon::parse($nilai);
        } catch (Throwable) {
            return null;
        }
    }
}
