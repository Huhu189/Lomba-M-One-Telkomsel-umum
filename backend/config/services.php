<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Google (masuk/daftar satu pintu)
    |--------------------------------------------------------------------------
    |
    | Klien memakai Google Identity Services untuk mengambil ID token (JWT
    | bertanda tangan Google), lalu mengirimkannya ke `POST /v1/auth/google`.
    | Server MEMERIKSA tanda tangan token itu sendiri di `GoogleIdTokenVerifier`
    | (kunci publik diunduh dari `jwks_url` dan di-cache), jadi `client_secret`
    | tidak pernah dibutuhkan dan tidak pernah dikirim ke klien.
    |
    | `client_id` wajib: ia dipakai sebagai klaim `aud` — tanpa itu token milik
    | aplikasi Google LAIN bisa dipakai masuk ke aplikasi ini.
    */

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'jwks_url' => env('GOOGLE_JWKS_URL', 'https://www.googleapis.com/oauth2/v3/certs'),
        // Umur simpan kunci publik Google di cache. Kunci dirotasi beberapa hari
        // sekali; verifier menyegarkan sendiri bila `kid` token belum dikenal.
        'jwks_ttl_detik' => 3600,
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
