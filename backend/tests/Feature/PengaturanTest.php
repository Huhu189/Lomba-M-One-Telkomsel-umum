<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Quiz\Models\Kuis;
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
    $this->admin = User::query()->where('email', 'admin@sekolah.test')->firstOrFail();
});

it('nilai bawaan tersedia sebelum ada pengaturan tersimpan', function (): void {
    Sanctum::actingAs($this->guru);

    $this->getJson('/api/v1/pengaturan')->assertOk()
        ->assertJsonPath('pengaturan.retry.nilai', true)
        ->assertJsonPath('pengaturan.retry.sumber', 'bawaan')
        ->assertJsonPath('pengaturan.batas_percobaan.nilai', 3)
        ->assertJsonPath('pengaturan.mode_tim.nilai', false)
        // Anti-cheat default MATI (chunk anticheat): instalasi baru tidak
        // memasang sensor apa pun sebelum guru memintanya.
        ->assertJsonPath('pengaturan.anti_cheat.nilai', false);
});

it('hanya admin yang mengubah pengaturan sekolah; guru dan murid ditolak', function (): void {
    // Lingkup sekolah berlaku untuk SELURUH sekolah (anti-cheat, batas
    // percobaan, retry), jadi bukan hak satu guru untuk mengubahnya (K-05).
    Sanctum::actingAs($this->guru);

    $this->putJson('/api/v1/pengaturan', ['lingkup' => 'sekolah', 'kunci' => 'retry', 'nilai' => false])
        ->assertStatus(403);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid);

    $this->putJson('/api/v1/pengaturan', ['lingkup' => 'sekolah', 'kunci' => 'retry', 'nilai' => false])
        ->assertStatus(403);

    auth()->forgetGuards();
    Sanctum::actingAs($this->admin);

    $this->putJson('/api/v1/pengaturan', ['lingkup' => 'sekolah', 'kunci' => 'retry', 'nilai' => false])
        ->assertOk()
        ->assertJsonPath('pengaturan.retry.nilai', false)
        ->assertJsonPath('pengaturan.retry.sumber', 'sekolah');

    // Guru tetap boleh MEMBACA aturan yang berlaku (termasuk yang ditetapkan admin).
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->getJson('/api/v1/pengaturan')->assertOk()->assertJsonPath('pengaturan.retry.nilai', false);
});

it('murid tidak boleh membaca pengaturan sama sekali', function (): void {
    // Murid yang tahu persis proteksi mana yang menyala bisa memetakannya lebih
    // dulu, jadi jalur baca ini ditutup (K-05). Saklar yang mengikatnya tetap
    // sampai lewat payload attempt.
    Sanctum::actingAs($this->murid);

    $this->getJson('/api/v1/pengaturan')->assertStatus(403);
});

it('resolusi tiga lapis kuis > kelas > sekolah; lock sekolah mengalahkan semua', function (): void {
    // Lapis sekolah/kelas hanya admin (K-05), lapis kuis tetap diuji lewat
    // pemilik kuisnya supaya jalur kepemilikan (S-05) benar-benar diuji.
    Sanctum::actingAs($this->admin);

    // Kelas menimpa sekolah.
    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kelas', 'lingkup_id' => $this->kelas->id, 'kunci' => 'retry', 'nilai' => true,
    ])->assertOk();

    $res = $this->getJson('/api/v1/pengaturan?kelas_id='.$this->kelas->id)->assertOk();
    expect($res->json('pengaturan.retry.nilai'))->toBeTrue()
        ->and($res->json('pengaturan.retry.sumber'))->toBe('kelas');

    // Kuis menimpa kelas. Kuisnya harus benar-benar ada dan milik guru ini:
    // pengaturan lingkup kuis diperiksa kepemilikannya (S-05), jadi id karangan
    // seperti 777 tidak lagi cukup.
    $kuis = Kuis::factory()->untukSekolah($this->sekolah, null, $this->kelas)->create([
        'dibuat_oleh' => $this->guru->id,
    ]);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis', 'lingkup_id' => $kuis->id, 'kunci' => 'retry', 'nilai' => false,
    ])->assertOk();

    $res = $this->getJson('/api/v1/pengaturan?kelas_id='.$this->kelas->id.'&kuis_id='.$kuis->id)->assertOk();
    expect($res->json('pengaturan.retry.nilai'))->toBeFalse()
        ->and($res->json('pengaturan.retry.sumber'))->toBe('kuis');

    // Sekolah mengunci → lapis bawah diabaikan.
    auth()->forgetGuards();
    Sanctum::actingAs($this->admin);

    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'sekolah', 'kunci' => 'retry', 'nilai' => true, 'terkunci' => true,
    ])->assertOk();

    $res = $this->getJson('/api/v1/pengaturan?kelas_id='.$this->kelas->id.'&kuis_id='.$kuis->id)->assertOk();
    expect($res->json('pengaturan.retry.nilai'))->toBeTrue()
        ->and($res->json('pengaturan.retry.sumber'))->toBe('sekolah')
        ->and($res->json('pengaturan.retry.terkunci'))->toBeTrue();
});

it('cache pengaturan ter-invalidasi saat nilai berubah', function (): void {
    Sanctum::actingAs($this->admin);

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
    Sanctum::actingAs($this->admin);

    $this->putJson('/api/v1/pengaturan', ['lingkup' => 'sekolah', 'kunci' => 'retry', 'nilai' => 'bukan-bool'])
        ->assertStatus(422)->assertJsonValidationErrors(['nilai']);

    $this->putJson('/api/v1/pengaturan', ['lingkup' => 'sekolah', 'kunci' => 'batas_percobaan', 'nilai' => 2.5])
        ->assertStatus(422)->assertJsonValidationErrors(['nilai']);
});
