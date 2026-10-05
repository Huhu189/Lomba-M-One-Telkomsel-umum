<?php

declare(strict_types=1);

namespace Tests\Arch;

use App\Sections\Auth\Enums\UserRole;
use Illuminate\Support\Facades\DB;

/*
|--------------------------------------------------------------------------
| Arch tests — pagar mutu arsitektur (slice 00)
|--------------------------------------------------------------------------
*/

arch('setiap berkas PHP di app memakai strict_types')
    ->expect('App')
    ->toUseStrictTypes();

arch('tidak ada dd, dump, ray, atau var_dump di kode aplikasi')
    ->expect(['dd', 'dump', 'ray', 'var_dump'])
    ->not->toBeUsed();

arch('controller hanya berbicara dengan service dan lapisan HTTP')
    ->expect('App\Sections\Http\Controllers')
    ->toOnlyUse(['App\Sections', 'App\Http\Controllers', 'Illuminate\Http', 'Illuminate\Routing']);

arch('controller tidak memanggil fasade DB secara langsung')
    ->expect([
        'App\Sections\Auth\Http\Controllers',
        'App\Sections\School\Http\Controllers',
        'App\Sections\Settings\Http\Controllers',
    ])
    ->not->toUse(DB::class);

test('enum UserRole memiliki tiga peran yang diharapkan', function () {
    expect(array_column(UserRole::cases(), 'value'))
        ->toBe(['admin', 'guru', 'murid']);
});
