<?php

declare(strict_types=1);

/**
 * Cache L1 — salinan sementara di SQLite tmpfs (slice 10).
 *
 * Lapisannya: L1 (SQLite di tmpfs) → L2 (Redis/cache store Laravel) → L3 (database).
 * L1 HANYA dipakai saat lalu lintas satu ruang sedang padat (mis. semua murid
 * membaca pengaturan di detik yang sama) dan dibuang lagi saat lalu lintas
 * reda, supaya RAM server tidak dipakai untuk data yang tidak sedang panas.
 *
 * Bawaannya MATI: tanpa L1 aplikasi tetap benar (langsung ke Redis + database),
 * jadi instalasi kecil tidak perlu tmpfs sama sekali.
 */
return [
    /** Saklar induk cache L1. */
    'aktif' => (bool) env('CACHE_L1_AKTIF', false),

    /**
     * Jalur berkas SQLite. Kosong = pilih otomatis: `/dev/shm` bila ada
     * (tmpfs, hilang saat restart — memang itu yang diinginkan), kalau tidak
     * jatuh ke `storage/framework/cache`.
     */
    'jalur' => env('CACHE_L1_JALUR'),

    /** Umur maksimal satu salinan L1 (detik). */
    'ttl_detik' => (int) env('CACHE_L1_TTL', 3600),

    /** Jendela pengukuran lalu lintas (detik) untuk menghitung req/s. */
    'jendela_detik' => (int) env('CACHE_L1_JENDELA', 5),

    /** Lalu lintas di atas angka ini → L1 dinyalakan. */
    'ambang_aktif_per_detik' => (float) env('CACHE_L1_AMBANG_AKTIF', 10),

    /** Lalu lintas di bawah angka ini → L1 dimatikan dan salinannya dibuang. */
    'ambang_mati_per_detik' => (float) env('CACHE_L1_AMBANG_MATI', 2),

    /**
     * Kanal pub/sub Redis untuk memberi tahu proses lain (termasuk service
     * realtime) bahwa satu kunci sudah berubah. Kosong = tidak menyiarkan.
     */
    'kanal' => env('CACHE_L1_KANAL', ''),
];
