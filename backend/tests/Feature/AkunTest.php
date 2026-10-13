<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Auth\Services\AkunService;
use Database\Seeders\RolesAndAdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

/*
|--------------------------------------------------------------------------
| Setelan akun sendiri (halaman /pengaturan)
|--------------------------------------------------------------------------
|
| Halaman /pengaturan dulu tempat setelan **per ulangan**; sejak 13 Oktober 2026
| halaman itu milik akun (nama, sandi, tampilan), sedangkan proteksi/waktu/
| penilaian diatur di tiap kuis. Uji di sini menjaga dua jalur akun yang baru:
| ubah nama dan ganti kata sandi sendiri.
|
*/

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
});

it('guru mengubah namanya sendiri', function (): void {
    $guru = User::factory()->guru()->create(['name' => 'Guru Lama']);
    Sanctum::actingAs($guru);

    $this->putJson('/api/v1/akun', ['name' => '  Guru Baru  '])
        ->assertOk()
        ->assertJsonPath('name', 'Guru Baru')
        ->assertJsonMissing(['password']);

    expect($guru->fresh()->name)->toBe('Guru Baru');
});

it('ubah nama menolak nama kosong dan nama terlalu panjang', function (): void {
    Sanctum::actingAs(User::factory()->guru()->create());

    $this->putJson('/api/v1/akun', ['name' => '   '])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['name']);

    $this->putJson('/api/v1/akun', ['name' => str_repeat('a', 61)])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['name']);
});

it('email tidak bisa diubah lewat halaman akun', function (): void {
    $guru = User::factory()->guru()->create(['email' => 'guru@sekolah.test']);
    Sanctum::actingAs($guru);

    $this->putJson('/api/v1/akun', [
        'name' => 'Guru Tetap',
        'email' => 'orang.lain@sekolah.test',
    ])->assertOk();

    // Email adalah alamat verifikasi & pemulihan akun, jadi ia hanya bisa berubah
    // lewat alur verifikasi tersendiri — bukan dengan menyelipkannya di muatan ini.
    expect($guru->fresh()->email)->toBe('guru@sekolah.test');
});

it('ganti kata sandi sendiri wajib menyertakan sandi lama yang benar', function (): void {
    $murid = User::factory()->muridAktif()->create();
    Sanctum::actingAs($murid);

    $this->putJson('/api/v1/akun/sandi', [
        'sandi_sekarang' => 'sandi-lama-salah',
        'password' => 'sandi-baru-aman-10',
        'password_confirmation' => 'sandi-baru-aman-10',
    ])->assertStatus(422)->assertJsonValidationErrors(['sandi_sekarang']);

    // Sandi bawaan UserFactory: `password-aman-123`.
    expect(Hash::check('password-aman-123', (string) $murid->fresh()->password))->toBeTrue();
});

it('ganti kata sandi menyimpan hash sandi baru dan mengacak remember_token', function (): void {
    $murid = User::factory()->muridAktif()->create(['password' => 'sandi-lama-aman-10']);
    $tokenLama = $murid->remember_token;
    Sanctum::actingAs($murid);

    $this->putJson('/api/v1/akun/sandi', [
        'sandi_sekarang' => 'sandi-lama-aman-10',
        'password' => 'sandi-baru-aman-10',
        'password_confirmation' => 'sandi-baru-aman-10',
    ])->assertOk()->assertJsonPath('user.name', $murid->name);

    $segar = $murid->fresh();

    expect(Hash::check('sandi-baru-aman-10', (string) $segar->password))->toBeTrue()
        ->and(Hash::check('sandi-lama-aman-10', (string) $segar->password))->toBeFalse()
        // Cookie "ingat saya" lama tidak boleh lagi memulihkan sesi.
        ->and($segar->remember_token)->not->toBe($tokenLama);
});

it('ganti kata sandi menolak sandi baru di bawah 10 karakter dan konfirmasi yang beda', function (): void {
    $murid = User::factory()->muridAktif()->create(['password' => 'sandi-lama-aman-10']);
    Sanctum::actingAs($murid);

    $this->putJson('/api/v1/akun/sandi', [
        'sandi_sekarang' => 'sandi-lama-aman-10',
        'password' => 'pendek-9x',
        'password_confirmation' => 'pendek-9x',
    ])->assertStatus(422)->assertJsonValidationErrors(['password']);

    $this->putJson('/api/v1/akun/sandi', [
        'sandi_sekarang' => 'sandi-lama-aman-10',
        'password' => 'sandi-baru-aman-10',
        'password_confirmation' => 'sandi-baru-lain-10',
    ])->assertStatus(422)->assertJsonValidationErrors(['password']);
});

it('sandi baru benar-benar bisa dipakai masuk, sandi lama tidak', function (): void {
    // Uji lewat jalur masuk sungguhan: tanpa ini, "sandi tersimpan" bisa berarti
    // hash-nya benar padahal kolom yang dipakai login ternyata lain.
    $murid = User::factory()->muridAktif()->create([
        'email' => 'rina@murid.test',
        'password' => 'sandi-lama-aman-10',
    ]);
    Sanctum::actingAs($murid);

    $this->putJson('/api/v1/akun/sandi', [
        'sandi_sekarang' => 'sandi-lama-aman-10',
        'password' => 'sandi-baru-aman-10',
        'password_confirmation' => 'sandi-baru-aman-10',
    ])->assertOk();

    $this->postJson('/api/v1/auth/masuk', [
        'email' => 'rina@murid.test',
        'password' => 'sandi-lama-aman-10',
    ])->assertStatus(422);

    $this->postJson('/api/v1/auth/masuk', [
        'email' => 'rina@murid.test',
        'password' => 'sandi-baru-aman-10',
    ])->assertOk();
});

it('sesi lain diakhiri, sesi yang sedang dipakai tetap hidup', function (): void {
    // Driver sesi basis data yang memang dipakai di produksi; pada driver lain
    // pembersihan sesi dilewati (lihat AkunService::akhiriSesiLain).
    config()->set('session.driver', 'database');

    $murid = User::factory()->muridAktif()->create(['password' => 'sandi-lama-aman-10']);
    Sanctum::actingAs($murid);

    DB::table('sessions')->insert([
        ['id' => 'sesi-lab-lain', 'user_id' => $murid->getKey(), 'payload' => '', 'last_activity' => now()->timestamp],
        ['id' => 'sesi-yang-dipakai', 'user_id' => $murid->getKey(), 'payload' => '', 'last_activity' => now()->timestamp],
        ['id' => 'sesi-orang-lain', 'user_id' => null, 'payload' => '', 'last_activity' => now()->timestamp],
    ]);

    app(AkunService::class)->gantiSandi($murid, 'sandi-lama-aman-10', 'sandi-baru-aman-10', 'sesi-yang-dipakai');

    $sisa = DB::table('sessions')->pluck('id')->all();

    expect($sisa)->toContain('sesi-yang-dipakai')
        ->and($sisa)->not->toContain('sesi-lab-lain')
        // Sesi pengguna lain tidak boleh ikut terhapus.
        ->and($sisa)->toContain('sesi-orang-lain');
});

it('akun siswa tamu tidak punya setelan akun', function (): void {
    // Tamu sungguhan berstatus aktif + email terverifikasi (lihat TamuService::masuk),
    // jadi yang menolaknya memang aturan "tamu tidak punya setelan akun" — bukan
    // middleware `akun-aktif`.
    Sanctum::actingAs(User::factory()->tamu()->muridAktif()->create());

    $this->putJson('/api/v1/akun', ['name' => 'Nama Baru'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['akun']);

    $this->putJson('/api/v1/akun/sandi', [
        'sandi_sekarang' => 'apa-saja-10',
        'password' => 'sandi-baru-aman-10',
        'password_confirmation' => 'sandi-baru-aman-10',
    ])->assertStatus(422)->assertJsonValidationErrors(['akun']);
});

it('tanpa sesi, setelan akun ditolak', function (): void {
    $this->putJson('/api/v1/akun', ['name' => 'Tanpa Sesi'])->assertStatus(401);
    $this->putJson('/api/v1/akun/sandi', [
        'sandi_sekarang' => 'apa-saja-10',
        'password' => 'sandi-baru-aman-10',
        'password_confirmation' => 'sandi-baru-aman-10',
    ])->assertStatus(401);
});
