<?php

declare(strict_types=1);

namespace Tests\Arch;

use App\Sections\Auth\Enums\UserRole;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/*
|--------------------------------------------------------------------------
| Arch tests — pagar mutu arsitektur (slice 00)
|--------------------------------------------------------------------------
|
| Catatan perbaikan: sebelumnya berkas ini memakai namespace
| 'App\Sections\Http\Controllers' yang TIDAK ada (controller sebenarnya ada di
| 'App\Sections\{Section}\Http\Controllers'), sehingga test "controller hanya
| berbicara dengan service" lolos tanpa memeriksa apa pun. Daftar namespace kini
| dibaca dari struktur folder supaya section baru otomatis ikut diperiksa.
|
*/

/**
 * @return array<int, string>
 *
 * Dibaca dari folder (bukan `app_path()`) karena berkas test ini dimuat sebelum
 * container aplikasi siap.
 */
function namespaceController(): array
{
    $folder = glob(dirname(__DIR__, 2).'/app/Sections/*/Http/Controllers', GLOB_ONLYDIR) ?: [];

    return array_map(
        static fn (string $satu): string => 'App\\Sections\\'.basename(dirname(dirname($satu))).'\\Http\\Controllers',
        $folder,
    );
}

arch('setiap berkas PHP di app memakai strict_types')
    ->expect('App')
    ->toUseStrictTypes();

arch('tidak ada dd, dump, ray, atau var_dump di kode aplikasi')
    ->expect(['dd', 'dump', 'ray', 'var_dump'])
    ->not->toBeUsed();

test('namespace controller terdeteksi (pagar arsitektur tidak kosong)', function (): void {
    expect(namespaceController())->toContain('App\Sections\Auth\Http\Controllers')
        ->and(namespaceController())->toContain('App\Sections\Scoring\Http\Controllers');
});

arch('controller tidak memanggil fasade DB atau fasade efek samping langsung')
    ->expect(namespaceController())
    ->not->toUse([DB::class, Cache::class, Log::class, Schema::class]);

test('enum UserRole memiliki tiga peran yang diharapkan', function () {
    expect(array_column(UserRole::cases(), 'value'))
        ->toBe(['admin', 'guru', 'murid']);
});
