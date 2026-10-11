<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Pest configuration (tanpa test di sini — test ada di berkas *Test.php)
|--------------------------------------------------------------------------
*/

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)->use(RefreshDatabase::class)->in('Feature');

/**
 * Lewati uji yang butuh Redis — atau gagal keras bila `REDIS_WAJIB=1`.
 *
 * Uji presence (P-02) dan kontrak kunci/kanal SSE hanya berarti di Redis
 * sungguhan. Dilewati, keduanya membuat `php artisan test` tetap exit 0, jadi
 * "SEMUA HIJAU" bisa berarti jalur Redis tidak pernah diuji sama sekali.
 * verify.sh menjalankan langkah "Backend Redis wajib" dengan `REDIS_WAJIB=1`
 * supaya keadaan itu menjadi MERAH, bukan hijau palsu.
 */
function lewatiTanpaRedis(string $konteks, Throwable $galat): void
{
    if (getenv('REDIS_WAJIB') === '1') {
        throw new RuntimeException(
            'Redis wajib untuk '.$konteks.' tetapi tidak tersedia: '.$galat->getMessage(),
        );
    }

    test()->markTestSkipped('Redis tidak tersedia untuk '.$konteks.': '.$galat->getMessage());
}
