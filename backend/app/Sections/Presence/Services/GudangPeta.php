<?php

declare(strict_types=1);

namespace App\Sections\Presence\Services;

use App\Sections\Presence\Contracts\GudangPresence;
use Illuminate\Support\Facades\Cache;

/**
 * Gudang peta: satu peta utuh per kuis di cache Laravel (perilaku lama, slice 07).
 *
 * Bentuknya `presence:kuis:{id}` → `attempt_id => {student_id, sesi, terakhir}`,
 * plus `presence:indeks` berisi daftar id kuis yang punya peta. Satu round-trip
 * per pembacaan monitor, tetapi setiap **penulisan** harus membaca ulang peta
 * itu, mengubah satu entri, lalu menulis seluruhnya — biaya O(N) per request
 * murid, dan dua request bersamaan bisa saling menimpa (P-02).
 *
 * Karena itu gudang ini sekarang hanya cadangan untuk driver cache yang tidak
 * punya struktur hash (array/database); produksi memakai `GudangRedis`.
 */
final class GudangPeta implements GudangPresence
{
    /** Masa simpan peta kuis di cache (detik). */
    public const TTL_DETIK = 10800;

    public function nama(): string
    {
        return 'peta';
    }

    public function entri(int $kuisId, int $attemptId): ?array
    {
        $entri = $this->peta($kuisId)[$attemptId] ?? null;

        return is_array($entri) ? $entri : null;
    }

    public function simpan(int $kuisId, int $attemptId, array $entri): void
    {
        $peta = $this->peta($kuisId);
        $peta[$attemptId] = $entri;

        Cache::put($this->kunciKuis($kuisId), $peta, self::TTL_DETIK);

        $indeks = $this->kuis();

        if (! in_array($kuisId, $indeks, true)) {
            $indeks[] = $kuisId;
            Cache::put($this->kunciIndeks(), $indeks, self::TTL_DETIK);
        }
    }

    public function semua(int $kuisId): array
    {
        // Nilai yang bukan array (data rusak) tetap dikembalikan sebagai apa
        // adanya supaya `sapu()` bisa membuangnya, sama seperti perilaku lama.
        return $this->peta($kuisId);
    }

    public function buang(int $kuisId, array $attemptIds): void
    {
        if ($attemptIds === []) {
            return;
        }

        $peta = $this->peta($kuisId);

        foreach ($attemptIds as $attemptId) {
            unset($peta[(int) $attemptId]);
        }

        if ($peta === []) {
            $this->lupakanKuis($kuisId);

            return;
        }

        Cache::put($this->kunciKuis($kuisId), $peta, self::TTL_DETIK);
    }

    public function kuis(): array
    {
        $indeks = Cache::get($this->kunciIndeks());

        return is_array($indeks) ? array_values(array_map('intval', $indeks)) : [];
    }

    public function lupakanKuis(int $kuisId): void
    {
        Cache::forget($this->kunciKuis($kuisId));

        $indeks = array_values(array_filter(
            $this->kuis(),
            static fn (int $satu): bool => $satu !== $kuisId,
        ));

        if ($indeks === []) {
            Cache::forget($this->kunciIndeks());

            return;
        }

        Cache::put($this->kunciIndeks(), $indeks, self::TTL_DETIK);
    }

    /**
     * @return array<int, mixed>
     */
    private function peta(int $kuisId): array
    {
        $peta = Cache::get($this->kunciKuis($kuisId));

        return is_array($peta) ? $peta : [];
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
