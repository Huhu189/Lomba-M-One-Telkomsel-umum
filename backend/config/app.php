<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Nama Aplikasi
    |--------------------------------------------------------------------------
    */

    'name' => env('APP_NAME', 'Laravel'),

    /*
    |--------------------------------------------------------------------------
    | Lingkungan Aplikasi
    |--------------------------------------------------------------------------
    */

    'env' => env('APP_ENV', 'production'),

    /*
    |--------------------------------------------------------------------------
    | Debug Aplikasi
    |--------------------------------------------------------------------------
    */

    'debug' => (bool) env('APP_DEBUG', false),

    /*
    |--------------------------------------------------------------------------
    | URL Aplikasi
    |--------------------------------------------------------------------------
    */

    'url' => env('APP_URL', 'http://localhost'),
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),

    /*
    |--------------------------------------------------------------------------
    | Proxy Tepercaya (K-06)
    |--------------------------------------------------------------------------
    |
    | Daftar IP/CIDR proxy yang boleh menyetel header X-Forwarded-* (mis. nginx
    | atau Cloudflare di depan aplikasi), dipisah koma. Selama daftar ini kosong,
    | Laravel memakai alamat koneksi apa adanya.
    |
    | Mengapa penting: seluruh limiter (`auth` 120/menit per IP, `verifikasi`
    | 3/menit per IP, `berkas`) dan sinyal anti-cheat "IP sama" membaca
    | `$request->ip()`. Di belakang proxy tanpa daftar ini, SELURUH sekolah terlihat
    | sebagai satu IP — limit bersama jadi menolak murid yang sah, dan semua murid
    | dituduh satu alamat. Salah satu tidak boleh ditebak: percaya SEMUA proxy
    | membuat IP bisa dipalsukan klien, jadi isi hanya alamat proxy milikmu.
    |
    | Contoh: TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12
    */

    'trusted_proxies' => env('TRUSTED_PROXIES'),

    'timezone' => 'UTC',

    'locale' => env('APP_LOCALE', 'id'),
    'fallback_locale' => env('APP_FALLBACK_LOCALE', 'en'),
    'faker_locale' => env('APP_FAKER_LOCALE', 'id_ID'),

    /*
    |--------------------------------------------------------------------------
    | Kunci Enkripsi
    |--------------------------------------------------------------------------
    */

    'cipher' => 'AES-256-CBC',
    'key' => env('APP_KEY'),

    'previous_keys' => [
        ...array_filter(explode(',', (string) env('APP_PREVIOUS_KEYS', ''))),
    ],

    /*
    |--------------------------------------------------------------------------
    | Perawatan / Mode Perbaikan
    |--------------------------------------------------------------------------
    */

    'maintenance' => [
        'store' => env('APP_MAINTENANCE_STORE', 'database'),
    ],

];
