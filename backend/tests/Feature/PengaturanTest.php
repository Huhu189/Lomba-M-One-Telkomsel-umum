<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Sekolah;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6A', 'tingkat' => 6]);
    $this->guru = User::factory()->guru()->create();
    $this->murid = User::factory()->muridAktif()->create();
});

it('nilai bawaan tersedia sebelum ada pengaturan tersimpan', function (): void {
    Sanctum::actingAs($this->murid);

    $this->getJson('/api/v1/pengaturan')->assertOk()
        ->assertJsonPath('pengaturan.retry.nilai', true)
        ->assertJsonPath('pengaturan.retry.sumber', 'bawaan')
        ->assertJsonPath('pengaturan.batas_percobaan.nilai', 3)
        ->assertJsonPath('pengaturan.mode_tim.nilai', false)
        // Anti-cheat default MATI (chunk anticheat): instalasi baru tidak
        // memasang sensor apa pun sebelum guru memintanya.
        ->assertJsonPath('pengaturan.anti_cheat.nilai', false);
});

it('guru mengubah pengaturan sekolah dan murid melihat nilainya', function (): void {
    Sanctum::actingAs($this->guru);

    $this->putJson('/api/v1/pengaturan', ['lingkup' => 'sekolah', 'kunci' => 'retry', 'nilai' => false])
        ->assertOk()
        ->assertJsonPath('pengaturan.retry.nilai', false)
        ->assertJsonPath('pengaturan.retry.sumber', 'sekolah');

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid);

    $this->getJson('/api/v1/pengaturan')->assertOk()->assertJsonPath('pengaturan.retry.nilai', false);
});

it('resolusi tiga lapis kuis > kelas > sekolah; lock sekolah mengalahkan semua', function (): void {
    Sanctum::actingAs($this->guru);

    // Kelas menimpa sekolah.
    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kelas', 'lingkup_id' => $this->kelas->id, 'kunci' => 'retry', 'nilai' => true,
    ])->assertOk();

    $res = $this->getJson('/api/v1/pengaturan?kelas_id='.$this->kelas->id)->assertOk();
    expect($res->json('pengaturan.retry.nilai'))->toBeTrue()
        ->and($res->json('pengaturan.retry.sumber'))->toBe('kelas');

    // Kuis menimpa kelas.
    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis', 'lingkup_id' => 777, 'kunci' => 'retry', 'nilai' => false,
    ])->assertOk();

    $res = $this->getJson('/api/v1/pengaturan?kelas_id='.$this->kelas->id.'&kuis_id=777')->assertOk();
    expect($res->json('pengaturan.retry.nilai'))->toBeFalse()
        ->and($res->json('pengaturan.retry.sumber'))->toBe('kuis');

    // Sekolah mengunci → lapis bawah diabaikan.
    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'sekolah', 'kunci' => 'retry', 'nilai' => true, 'terkunci' => true,
    ])->assertOk();

    $res = $this->getJson('/api/v1/pengaturan?kelas_id='.$this->kelas->id.'&kuis_id=777')->assertOk();
    expect($res->json('pengaturan.retry.nilai'))->toBeTrue()
        ->and($res->json('pengaturan.retry.sumber'))->toBe('sekolah')
        ->and($res->json('pengaturan.retry.terkunci'))->toBeTrue();
});

it('cache pengaturan ter-invalidasi saat nilai berubah', function (): void {
    Sanctum::actingAs($this->guru);

    // Isi cache dengan nilai awal.
    $this->getJson('/api/v1/pengaturan')->assertOk()->assertJsonPath('pengaturan.retry.nilai', true);

    $this->putJson('/api/v1/pengaturan', ['lingkup' => 'sekolah', 'kunci' => 'retry', 'nilai' => false])->assertOk();

    // Bila cache tidak diinvalidasi, nilai lama (true) akan tersaji lagi.
    $this->getJson('/api/v1/pengaturan')->assertOk()->assertJsonPath('pengaturan.retry.nilai', false);
});

it('murid tidak boleh mengubah pengaturan', function (): void {
    Sanctum::actingAs($this->murid);

    $this->putJson('/api/v1/pengaturan', ['lingkup' => 'sekolah', 'kunci' => 'retry', 'nilai' => false])
        ->assertStatus(403);
});

it('validasi menolak tipe nilai yang salah', function (): void {
    Sanctum::actingAs($this->guru);

    $this->putJson('/api/v1/pengaturan', ['lingkup' => 'sekolah', 'kunci' => 'retry', 'nilai' => 'bukan-bool'])
        ->assertStatus(422)->assertJsonValidationErrors(['nilai']);

    $this->putJson('/api/v1/pengaturan', ['lingkup' => 'sekolah', 'kunci' => 'batas_percobaan', 'nilai' => 2.5])
        ->assertStatus(422)->assertJsonValidationErrors(['nilai']);
});
