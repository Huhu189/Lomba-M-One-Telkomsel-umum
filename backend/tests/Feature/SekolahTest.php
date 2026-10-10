<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Database\Seeders\MasterDataSeeder;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
});

it('murid dapat membaca sekolah, kelas, dan mapel', function (): void {
    $this->seed(MasterDataSeeder::class);
    Sanctum::actingAs(User::factory()->muridAktif()->create());

    $this->getJson('/api/v1/sekolah')->assertOk()->assertJsonPath('nama', $this->sekolah->nama);
    $this->getJson('/api/v1/kelas')->assertOk()->assertJsonCount(3);
    $this->getJson('/api/v1/mapel')->assertOk()->assertJsonCount(3);
});

it('murid tidak boleh mengubah data induk (policy)', function (): void {
    Sanctum::actingAs(User::factory()->muridAktif()->create());

    $this->postJson('/api/v1/kelas', ['nama' => '1A', 'tingkat' => 1])->assertStatus(403);
    $this->postJson('/api/v1/mapel', ['nama' => 'Seni Budaya'])->assertStatus(403);
    $this->putJson('/api/v1/sekolah', ['nama' => 'Berubah'])->assertStatus(403);
});

it('guru dapat menambah, mengubah, dan menghapus kelas', function (): void {
    Sanctum::actingAs(User::factory()->guru()->create());

    $buat = $this->postJson('/api/v1/kelas', ['nama' => '4A', 'tingkat' => 4])->assertCreated();
    $id = (int) $buat->json('id');

    $this->putJson("/api/v1/kelas/{$id}", ['nama' => '4B', 'tingkat' => 4])
        ->assertOk()->assertJsonPath('nama', '4B');

    $this->deleteJson("/api/v1/kelas/{$id}")->assertOk();
    expect(Kelas::query()->whereKey($id)->exists())->toBeFalse();
});

it('guru dapat menambah, mengubah, dan menghapus mapel', function (): void {
    Sanctum::actingAs(User::factory()->guru()->create());

    $buat = $this->postJson('/api/v1/mapel', ['nama' => 'Seni Budaya', 'kode' => 'sbd'])
        ->assertCreated()->assertJsonPath('kode', 'SBD');
    $id = (int) $buat->json('id');

    $this->putJson("/api/v1/mapel/{$id}", ['nama' => 'Seni Musik', 'kode' => 'SBM'])
        ->assertOk()->assertJsonPath('nama', 'Seni Musik');

    $this->deleteJson("/api/v1/mapel/{$id}")->assertOk();
    expect(Mapel::query()->whereKey($id)->exists())->toBeFalse();
});

it('guru dapat menambah, mengubah, dan menghapus murid tunggal', function (): void {
    $kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6A', 'tingkat' => 6]);
    Sanctum::actingAs(User::factory()->guru()->create());

    $buat = $this->postJson('/api/v1/murid', [
        'nama' => 'Zaki Pratama',
        'email' => 'zaki@murid.test',
        'class_id' => $kelas->id,
        'nis' => '9001',
    ])->assertCreated();

    expect($buat->json('nama'))->toBe('Zaki Pratama')
        ->and($buat->json('kelas_nama'))->toBe('6A');

    $id = (int) $buat->json('id');
    // P-01: daftar murid berpaginasi, jadi barisnya ada di `data[]`.
    $this->getJson('/api/v1/murid')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.nama', 'Zaki Pratama');

    $this->putJson("/api/v1/murid/{$id}", [
        'nama' => 'Zaki Baru',
        'email' => 'zaki@murid.test',
        'class_id' => $kelas->id,
        'nis' => '9002',
    ])->assertOk()->assertJsonPath('nama', 'Zaki Baru');

    $this->deleteJson("/api/v1/murid/{$id}")->assertOk();
    expect(Murid::query()->whereKey($id)->exists())->toBeFalse();
});

it('daftar murid berpaginasi dan membatasi jumlah per halaman', function (): void {
    $kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6B', 'tingkat' => 6]);
    Murid::factory()->count(5)->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $kelas->id,
    ]);

    Sanctum::actingAs(User::factory()->guru()->create());

    // Halaman pertama: 2 dari 5, dan metadata total lengkap.
    $this->getJson('/api/v1/murid?per_page=2')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('meta.total', 5)
        ->assertJsonPath('meta.last_page', 3)
        ->assertJsonPath('meta.current_page', 1);

    // Halaman terakhir memuat sisanya.
    $this->getJson('/api/v1/murid?per_page=2&page=3')
        ->assertOk()
        ->assertJsonCount(1, 'data');

    // `per_page` besar dipangkas ke batas 200 supaya tak bisa diminta semua lagi.
    $this->getJson('/api/v1/murid?per_page=1000')
        ->assertOk()
        ->assertJsonPath('meta.per_page', 200);
});

it('validasi menolak tingkat di luar 1-6 dan nama kelas duplikat', function (): void {
    Sanctum::actingAs(User::factory()->guru()->create());

    $this->postJson('/api/v1/kelas', ['nama' => '1A', 'tingkat' => 9])
        ->assertStatus(422)->assertJsonValidationErrors(['tingkat']);

    $this->postJson('/api/v1/kelas', ['nama' => '1A', 'tingkat' => 1])->assertCreated();

    $this->postJson('/api/v1/kelas', ['nama' => '1A', 'tingkat' => 1])
        ->assertStatus(422)->assertJsonValidationErrors(['nama']);
});

it('permintaan tak terautentikasi ke API merespons 401 JSON walau Accept bukan JSON', function (): void {
    auth()->forgetGuards();

    $this->get('/api/v1/murid/ekspor', ['Accept' => 'text/csv'])
        ->assertStatus(401)
        ->assertJsonPath('message', 'Unauthenticated.');
});

it('guru dapat memperbarui data sekolah', function (): void {
    Sanctum::actingAs(User::factory()->guru()->create());

    $this->putJson('/api/v1/sekolah', ['nama' => 'SD Contoh Baru', 'tahun_ajaran' => '2026/2027'])
        ->assertOk()->assertJsonPath('nama', 'SD Contoh Baru');
});
