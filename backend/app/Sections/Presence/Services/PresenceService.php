<?php

declare(strict_types=1);

namespace App\Sections\Presence\Services;

use App\Sections\Attempt\Enums\StatusAttempt;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Cheat\Enums\KategoriKecurangan;
use App\Sections\Cheat\Services\KecuranganService;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Presence tanpa heartbeat berat (chunk slice-07).
 *
 * Prinsipnya: kehadiran dihitung dari **aktivitas normal murid**, bukan dari
 * detak jantung yang terus dikirim. Setiap request murid yang memang sudah
 * terjadi (memuat attempt, menyimpan jawaban) memperpanjang `last_seen`; klien
 * hanya perlu mengirim satu ping kecil bila 15 detik berlalu tanpa request lain.
 *
 * Penyimpanan: **satu peta per kuis** (`presence:kuis:{id}`) berisi attempt →
 * {student_id, sesi, terakhir}. Peta ini dibaca sekali untuk seluruh Live
 * Monitor (satu round-trip untuk 40 murid, bukan 40 kunci terpisah), dan tetap
 * cocok dengan Redis di produksi maupun driver cache yang dipakai di dev/test.
 * Kesegaran ditentukan ambang 45 detik; `sapu()` membuang entri yang sudah
 * basi. Tab yang disembunyikan tetap dianggap online — itu memang bukan alasan
 * menuduh anak pergi.
 */
class PresenceService
{
    /** Umur kesegaran kehadiran (detik). */
    public const AMBANG_SEGAR = 45;

    /** Setelah sekian detik tanpa aktivitas, murid dicatat "lama tidak aktif". */
    public const AMBANG_LAMA_OFFLINE = 120;

    /** Masa simpan peta kuis di cache (detik). */
    private const TTL_PETA = 10800;

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

        $peta = $this->peta($kuisId);
        $sebelum = $peta[$attemptId] ?? null;

        // Sesi ganda: sesi lain yang MASIH segar untuk attempt yang sama.
        // Ini satu-satunya kategori kecurangan yang bisa dilihat server sendiri
        // tanpa menanyai perangkat murid.
        if (
            is_array($sebelum)
            && $sesi !== null
            && isset($sebelum['sesi'])
            && $sebelum['sesi'] !== $sesi
            && $this->segar($sebelum['terakhir'] ?? null, $sekarang)
        ) {
            $this->kecurangan->catatTurunan($attempt, KategoriKecurangan::DuplicateSession, [
                'sesi_sebelum' => (string) $sebelum['sesi'],
            ]);
        }

        $peta[$attemptId] = [
            'student_id' => (int) $attempt->student_id,
            'sesi' => $sesi,
            'terakhir' => $sekarang->toIso8601String(),
        ];

        Cache::put($this->kunciKuis($kuisId), $peta, self::TTL_PETA);

        $indeks = $this->indeksKuis();
        if (! in_array($kuisId, $indeks, true)) {
            $indeks[] = $kuisId;
            Cache::put($this->kunciIndeks(), $indeks, self::TTL_PETA);
        }
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

        foreach ($this->peta((int) $kuis->getKey()) as $attemptId => $entri) {
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
        $dibuang = 0;

        foreach ($this->indeksKuis() as $kuisId) {
            $peta = $this->peta((int) $kuisId);

            if ($peta === []) {
                continue;
            }

            foreach ($peta as $attemptId => $entri) {
                if (! is_array($entri)) {
                    unset($peta[$attemptId]);
                    $dibuang++;

                    continue;
                }

                if ($this->segar($entri['terakhir'] ?? null, $sekarang)) {
                    continue;
                }

                $terakhir = $this->parse($entri['terakhir'] ?? null);

                if ($terakhir === null || $terakhir->diffInSeconds($sekarang, false) <= self::AMBANG_LAMA_OFFLINE) {
                    continue;
                }

                $this->catatLamaOffline((int) $attemptId, $entri);

                unset($peta[$attemptId]);
                $dibuang++;
            }

            if ($peta === []) {
                Cache::forget($this->kunciKuis((int) $kuisId));
            } else {
                Cache::put($this->kunciKuis((int) $kuisId), $peta, self::TTL_PETA);
            }
        }

        return $dibuang;
    }

    /** Lupakan kehadiran satu attempt (dipakai saat attempt dikumpulkan). */
    public function lupakan(Attempt $attempt): void
    {
        $kuisId = (int) $attempt->quiz_id;
        $peta = $this->peta($kuisId);

        unset($peta[(int) $attempt->getKey()]);

        Cache::put($this->kunciKuis($kuisId), $peta, self::TTL_PETA);
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

        Cache::put($penanda, true, self::TTL_PETA);

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
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function peta(int $kuisId): array
    {
        $peta = Cache::get($this->kunciKuis($kuisId));

        return is_array($peta) ? $peta : [];
    }

    /**
     * @return array<int, int>
     */
    private function indeksKuis(): array
    {
        $indeks = Cache::get($this->kunciIndeks());

        return is_array($indeks) ? array_values(array_map('intval', $indeks)) : [];
    }

    private function kunciKuis(int $kuisId): string
    {
        return 'presence:kuis:'.$kuisId;
    }

    private function kunciIndeks(): string
    {
        return 'presence:indeks';
    }
}
