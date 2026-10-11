<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

/**
 * K-06 — `$request->ip()` harus melihat IP murid, bukan IP proxy, TAPI hanya
 * untuk proxy yang memang milik pengelola aplikasi.
 *
 * Dampaknya nyata dan terukur lewat limiter: `/auth/kirim-ulang-verifikasi-publik`
 * memakai limiter `auth` dengan batas 5/menit per (IP + email) dan 120/menit per
 * IP. Di belakang proxy yang tidak dipercaya, SELURUH sekolah berbagi satu ember
 * — murid ke-6 yang menekan "kirim ulang" ditolak 429 walau ia belum pernah
 * meminta apa pun.
 *
 * Yang diuji di sini dua-duanya: bawaannya TIDAK percaya header (klien tidak bisa
 * memalsukan IP-nya sendiri), dan setelah daftar proxy diatur — jalur yang dipakai
 * `AppServiceProvider::pasangProxyTepercaya()` — header-nya dihormati.
 */
afterEach(function (): void {
    // Middleware ini menyimpan daftarnya sebagai state statik; tanpa dibersihkan,
    // tes berikutnya di proses yang sama ikut mewarisinya.
    TrustProxies::flushState();
    Cache::flush();
});

it('menghormati X-Forwarded-For hanya setelah proxy tepercaya diatur (K-06)', function (): void {
    $kirim = fn (string $ip) => $this->postJson(
        '/api/v1/auth/kirim-ulang-verifikasi-publik',
        ['email' => 'belum-terdaftar@sekolah.test'],
        ['X-Forwarded-For' => $ip],
    );

    // 1) Bawaan: tidak ada proxy tepercaya → header diabaikan. Semua permintaan
    //    berasal dari satu alamat, jadi ember 5/menit penuh dan yang keenam 429.
    foreach (range(1, 5) as $ke) {
        expect($kirim('203.0.113.'.$ke)->status())->not->toBe(429);
    }

    expect($kirim('203.0.113.6')->status())->toBe(429);

    // 2) Setelah daftar proxy diatur (persis yang dilakukan
    //    `pasangProxyTepercaya()`), IP asli murid dipakai: tiap alamat punya
    //    embernya sendiri, jadi tidak ada yang kena 429.
    TrustProxies::at(['127.0.0.1']);

    foreach (range(11, 16) as $ke) {
        expect($kirim('203.0.113.'.$ke)->status())->not->toBe(429);
    }
});
