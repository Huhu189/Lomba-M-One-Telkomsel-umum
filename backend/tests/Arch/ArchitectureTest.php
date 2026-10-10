<?php

declare(strict_types=1);

namespace Tests\Arch;

use App\Sections\Auth\Enums\UserRole;
use App\Sections\Question\Enums\TipeSoal;
use App\Sections\Question\Registry\PenanganTipeSoal;
use App\Sections\Question\Registry\RegistryTipeSoal;
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

/*
|--------------------------------------------------------------------------
| Registry tipe soal (Objektif 1A)
|--------------------------------------------------------------------------
|
| Dua pagar: (1) setiap tipe yang dikenal enum punya penangan di registry,
| (2) setiap penangan memenuhi kontrak lengkap — termasuk `bobot()` yang baru
| ditambahkan. Tanpa pagar ini, menambah case enum tanpa penangan baru terlihat
| sebagai galat `match` yang tidak enak dibaca saat guru menyimpan soal.

*/

test('setiap tipe soal di enum punya penangan di registry', function (): void {
    $semua = [];

    foreach (TipeSoal::cases() as $tipe) {
        $semua[$tipe->value] = RegistryTipeSoal::penangan($tipe)::class;
    }

    expect($semua)->toHaveCount(count(TipeSoal::cases()))
        ->and(array_unique($semua))->toHaveCount(count(TipeSoal::cases()))
        // Registry dan enum tidak boleh berbeda pendapat soal daftar tipe.
        ->and(RegistryTipeSoal::semuaNilai())->toBe(array_keys($semua));
});

test('setiap penangan punya metode kontrak lengkap, termasuk bobot()', function (): void {
    $wajib = ['validasiKonten', 'validasiKunci', 'nilai', 'bobot'];

    foreach (TipeSoal::cases() as $tipe) {
        $penangan = RegistryTipeSoal::penangan($tipe);
        $refleksi = new \ReflectionClass($penangan);

        expect($penangan)->toBeInstanceOf(PenanganTipeSoal::class);

        foreach ($wajib as $metode) {
            expect($refleksi->hasMethod($metode))->toBeTrue(
                "Penangan {$refleksi->getShortName()} tidak punya {$metode}().",
            );
        }
    }
});

test('tipe lama tetap dinilai biner: bobot() sama dengan nilai()', function (): void {
    // Bobot 0/1 untuk delapan tipe lama: menambah `bobot()` sama sekali tidak
    // boleh mengubah nilai soal yang sudah ada.
    $pilihan = [
        'konten' => ['teks' => 'Berapa 7 + 8?', 'opsi' => [['id' => 'A', 'teks' => '15'], ['id' => 'B', 'teks' => '16']]],
        'kunci' => ['jawaban' => 'A'],
    ];

    expect(RegistryTipeSoal::bobot(TipeSoal::PilihanGanda, $pilihan['konten'], $pilihan['kunci'], 'A'))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::PilihanGanda, $pilihan['konten'], $pilihan['kunci'], 'B'))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::PilihanGanda, $pilihan['konten'], $pilihan['kunci'], null))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::BenarSalah, ['teks' => 'Bumi bulat.'], ['benar' => true], true))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::BenarSalah, ['teks' => 'Bumi bulat.'], ['benar' => true], false))->toBe(0.0);
});
