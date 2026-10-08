<?php

declare(strict_types=1);

namespace App\Sections\Cache\Services;

use App\Sections\Cache\Contracts\LapisanCache;
use Illuminate\Support\Facades\Cache;

/**
 * L2: cache store Laravel (Redis di produksi, array/database di dev & test).
 *
 * Lapisan inilah yang bertahan antar proses dan antar node, jadi dialah yang
 * diinvalidasi lebih dulu sebelum L1 (slice 10).
 */
final class LapisanL2 implements LapisanCache
{
    /**
     * Umur maksimal satu salinan L2 (detik) — jaring pengaman, bukan penentu.
     *
     * Invalidasi eksplisit tetap cara utama membuang salinan. Umur ini hanya
     * penjaga terakhir: bila satu invalidasi tidak sampai ke node/proses ini
     * (publish pub/sub hilang, proses mati tepat setelah menaikkan versi),
     * salinan lama tetap tidak boleh dilayani selamanya — dulu `Cache::forever`
     * membuat pengaturan anti-cheat yang sudah diubah guru bisa bertahan tanpa
     * batas (I-01).
     */
    public const TTL_DETIK = 1800;

    public function __construct(private readonly int $ttlDetik = self::TTL_DETIK) {}

    public function nama(): string
    {
        return 'redis';
    }

    public function tersedia(): bool
    {
        return true;
    }

    /**
     * @return array{muatan: mixed, versi: int}|null
     */
    public function ambil(string $kunci): ?array
    {
        $isi = Cache::get($kunci);

        if (! is_array($isi) || ! array_key_exists('muatan', $isi)) {
            return null;
        }

        return ['muatan' => $isi['muatan'], 'versi' => (int) ($isi['versi'] ?? 0)];
    }

    public function simpan(string $kunci, mixed $muatan, int $versi): void
    {
        // Invalidasi eksplisit yang menentukan kapan data ini basi; umur cache
        // hanya jaring pengaman supaya kebasian tak bertahan selamanya.
        Cache::put($kunci, ['muatan' => $muatan, 'versi' => $versi], $this->ttlDetik);
    }

    public function lupakan(string $kunci): void
    {
        Cache::forget($kunci);
    }

    public function lupakanRuang(string $ruang): void
    {
        // Cache store tidak punya penghapusan berawalan; satu ruang dibuang
        // dengan melupakan kunci-kunci yang tercatat. Untuk pengaturan, kuncinya
        // sudah diketahui pemanggil sehingga `lupakan()` per kunci cukup.
        Cache::forget($ruang);
    }
}
