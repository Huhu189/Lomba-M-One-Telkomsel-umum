<?php

declare(strict_types=1);

/*
 * Batas host untuk `konten.media` soal (U-01).
 *
 * Gambar soal yang menunjuk host pihak ketiga membocorkan IP dan Referer anak
 * ke server luar. Karena itu media hanya boleh berupa path internal aplikasi
 * (mis. `/media/lingkaran.png`). Bila sekolah memang menyimpan gambar di CDN
 * sendiri, daftarkan host https-nya di sini lewat `MEDIA_HOSTS` (dipisah koma).
 * Host aplikasi sendiri selalu diterima.
 */
return [
    'hosts' => array_values(array_filter(array_map(
        static fn (string $host): string => strtolower(trim($host)),
        explode(',', (string) env('MEDIA_HOSTS', '')),
    ))),
];
