<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
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
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Matematika', 'kode' => 'MTK']);
    $this->guru = User::factory()->guru()->create();
});

it('kuis baru dibuat dengan slug acak, bukan id berurutan', function (): void {
    Sanctum::actingAs($this->guru);

    $respons = $this->postJson('/api/v1/kuis', [
        'judul' => 'Ulangan Berslug',
        'subject_id' => $this->mapel->id,
        'class_id' => $this->kelas->id,
        'durasi_menit' => 20,
    ])->assertCreated();

    $slug = (string) $respons->json('slug');
    $id = (int) $respons->json('id');

    // 8 huruf/angka kecil: alamat yang tidak bisa ditebak dari id.
    expect($slug)->toMatch('/^[a-z0-9]{8}$/')
        ->and($slug)->not->toBe((string) $id);

    // Alamat resmi: slug.
    $this->getJson("/api/v1/kuis/{$slug}")
        ->assertOk()
        ->assertJsonPath('id', $id)
        ->assertJsonPath('slug', $slug);

    // Tautan lama (angka) tetap hidup sebagai cadangan.
    $this->getJson("/api/v1/kuis/{$id}")
        ->assertOk()
        ->assertJsonPath('slug', $slug);

    // Dua kuis tidak pernah berbagi slug.
    $lain = Kuis::factory()->untukSekolah($this->sekolah, $this->mapel, $this->kelas)->create();

    expect($lain->slug)->toMatch('/^[a-z0-9]{8}$/')
        ->and($lain->slug)->not->toBe($slug);
});

it('slug tidak menggantikan otorisasi: kuis guru lain tetap 403', function (): void {
    $guruLain = User::factory()->guru()->create();

    $kuisGuruLain = Kuis::factory()
        ->untukSekolah($this->sekolah, $this->mapel, $this->kelas)
        ->milik($guruLain)
        ->create();

    Sanctum::actingAs($this->guru);

    // Slug memang tidak bisa ditebak, tetapi yang menahan bukan itu: guru lain
    // tetap ditolak walaupun slug-nya sudah diketahui.
    $this->getJson("/api/v1/kuis/{$kuisGuruLain->slug}")->assertStatus(403);
    $this->putJson("/api/v1/kuis/{$kuisGuruLain->slug}", ['judul' => 'Bajakan'])->assertStatus(403);
    $this->deleteJson("/api/v1/kuis/{$kuisGuruLain->slug}")->assertStatus(403);
});
