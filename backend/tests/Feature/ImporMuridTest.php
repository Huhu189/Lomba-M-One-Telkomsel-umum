<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

/**
 * Berkas CSV palsu untuk test impor.
 */
function buatBerkasCsv(string $isi): UploadedFile
{
    return UploadedFile::fake()->createWithContent('murid.csv', $isi);
}

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();

    Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6A', 'tingkat' => 6]);
    Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6B', 'tingkat' => 6]);

    Sanctum::actingAs(User::factory()->guru()->create());
});

it('impor CSV valid membuat akun murid beserta profil dan kelasnya', function (): void {
    $csv = "nama,email,nis,nisn,kelas\n"
        ."Ayu Lestari,ayu@murid.test,1001,0012345678,6A\n"
        ."Budi Santoso,budi@murid.test,1002,0012345679,6B\n";

    $this->post('/api/v1/murid/impor', ['file' => buatBerkasCsv($csv)], ['Accept' => 'application/json'])
        ->assertOk()
        ->assertJsonPath('laporan.sukses', 2)
        ->assertJsonPath('laporan.gagal', 0);

    $ayu = User::query()->where('email', 'ayu@murid.test')->firstOrFail();

    expect(Murid::query()->count())->toBe(2)
        ->and($ayu->hasRole('murid'))->toBeTrue()
        ->and($ayu->status->value)->toBe('aktif')
        ->and($ayu->murid->kelas->nama)->toBe('6A');
});

it('impor melaporkan galat per baris dan tetap memproses baris valid', function (): void {
    $csv = "nama,email,nis,kelas\n"
        ."Baris Valid,valid@murid.test,1001,6A\n"
        ."Email Salah,bukan-email,1002,6A\n"
        ."Kelas Hilang,ketiga@murid.test,1003,9Z\n";

    $respons = $this->post('/api/v1/murid/impor', ['file' => buatBerkasCsv($csv)], ['Accept' => 'application/json'])
        ->assertOk();

    expect($respons->json('laporan.sukses'))->toBe(1)
        ->and($respons->json('laporan.gagal'))->toBe(2)
        ->and($respons->json('laporan.galat.0.baris'))->toBe(3)
        ->and($respons->json('laporan.galat.1.baris'))->toBe(4)
        ->and(Murid::query()->count())->toBe(1);
});

it('impor berhenti setelah 100 galat', function (): void {
    $baris = ['nama,email,kelas'];
    for ($i = 0; $i < 150; $i++) {
        $baris[] = "Nama {$i},bukan-email-{$i},6A";
    }

    $respons = $this->post(
        '/api/v1/murid/impor',
        ['file' => buatBerkasCsv(implode("\n", $baris))],
        ['Accept' => 'application/json'],
    )->assertOk();

    expect($respons->json('laporan.gagal'))->toBe(100)
        ->and($respons->json('laporan.dihentikan'))->toBeTrue()
        ->and($respons->json('laporan.batas_galat'))->toBe(100)
        ->and(count($respons->json('laporan.galat')))->toBe(100);
});

it('impor 500 baris meng-upsert dalam batch tanpa duplikasi', function (): void {
    $baris = ['nama,email,nis,kelas'];
    for ($i = 1; $i <= 500; $i++) {
        $baris[] = "Murid {$i},murid{$i}@murid.test,{$i},6A";
    }
    $csv = implode("\n", $baris)."\n";

    $pertama = $this->post('/api/v1/murid/impor', ['file' => buatBerkasCsv($csv)], ['Accept' => 'application/json'])
        ->assertOk();

    expect($pertama->json('laporan.sukses'))->toBe(500)
        ->and(Murid::query()->count())->toBe(500);

    // Impor ulang = upsert: tidak menambah baris atau akun baru.
    $this->post('/api/v1/murid/impor', ['file' => buatBerkasCsv($csv)], ['Accept' => 'application/json'])
        ->assertOk();

    expect(Murid::query()->count())->toBe(500)
        ->and(User::query()->where('role', 'murid')->count())->toBe(500);
});

it('ekspor CSV mengamankan sel berawalan = + - @', function (): void {
    $kelas = Kelas::query()->where('nama', '6A')->firstOrFail();
    $user = User::factory()->muridAktif()->create(['name' => '=SUM(A1:A2)', 'email' => 'aman@murid.test']);

    Murid::query()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $kelas->id,
        'user_id' => $user->id,
        'nis' => '+2800',
        'nisn' => '@x',
    ]);

    $respons = $this->get('/api/v1/murid/ekspor', ['Accept' => 'text/csv'])->assertOk();
    $isi = $respons->streamedContent();

    expect($isi)->toContain("'=SUM(A1:A2)")
        ->and($isi)->toContain("'+2800")
        ->and($isi)->toContain("'@x");
});

it('impor tanpa kolom wajib ditolak 422', function (): void {
    $this->post('/api/v1/murid/impor', [
        'file' => buatBerkasCsv("nama,kelas\nAyu,6A\n"),
    ], ['Accept' => 'application/json'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['file']);
});

it('murid tidak boleh mengimpor murid', function (): void {
    Sanctum::actingAs(User::factory()->muridAktif()->create());

    $this->post('/api/v1/murid/impor', [
        'file' => buatBerkasCsv("nama,email,kelas\nAyu,ayu@murid.test,6A\n"),
    ], ['Accept' => 'application/json'])
        ->assertStatus(403);
});
