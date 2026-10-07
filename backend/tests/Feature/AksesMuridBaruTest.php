<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
});

/**
 * Daftarkan murid lewat jalur publik /daftar dan kembalikan akunnya.
 * Nama diambil dari email karena `users(name, guard_name)` unik — nama sama
 * untuk dua akun test akan ditolak database.
 */
function akunMuridBaru(string $email): User
{
    test()->postJson('/api/v1/auth/daftar', [
        'name' => 'Murid '.ucfirst(
            str_replace(['@', '.'], [' ', ' '], (string) strstr($email, '@', true)),
        ),
        'email' => $email,
        'password' => 'kata-sandi-aman-10',
        'password_confirmation' => 'kata-sandi-aman-10',
    ])->assertCreated();

    // Simulasi murid mengeklik tautan verifikasi: sesudahnya akun aktif dan
    // semua endpoint murid harus terbuka.
    $murid = User::query()->where('email', $email)->firstOrFail();
    $murid->forceFill(['status' => UserStatus::Aktif, 'email_verified_at' => now()])->save();

    return $murid;
}

it('murid hasil /daftar langsung punya profil: fitur murid terbuka tanpa guru men-setup', function (): void {
    $murid = akunMuridBaru('mandiri@murid.test');

    expect($murid->murid)->not->toBeNull()
        ->and((string) $murid->murid->kelas->nama)->toBe('Tanpa Kelas');

    Sanctum::actingAs($murid);

    $this->getJson('/api/v1/avatar/saya')->assertOk();
    $this->getJson('/api/v1/avatar')->assertOk();
    $this->getJson('/api/v1/progres/saya')->assertOk();
    $this->getJson('/api/v1/badge/saya')->assertOk();

    // POST (alias setara GET, hanya membaca) tidak menabrak 405/403.
    $this->postJson('/api/v1/progres/saya')->assertOk();
    $this->postJson('/api/v1/badge/saya')->assertOk();

    // Unggah avatar tanpa isi → galat validasi, BUKAN 403 otorisasi.
    $this->postJson('/api/v1/avatar', [])->assertStatus(422);
});

it('kelas penampung dibuat satu kali dan murid kedua masuk kelas yang sama', function (): void {
    $satu = akunMuridBaru('pertama@murid.test');
    $dua = akunMuridBaru('kedua@murid.test');

    $kelasPenampung = Kelas::query()
        ->where('school_id', Sekolah::query()->firstOrFail()->id)
        ->where('nama', 'Tanpa Kelas')
        ->get();

    expect($kelasPenampung)->toHaveCount(1)
        ->and((int) $satu->murid->class_id)->toBe((int) $kelasPenampung[0]->id)
        ->and((int) $dua->murid->class_id)->toBe((int) $kelasPenampung[0]->id);
});

it('murid lama tanpa profil disambungkan otomatis saat mengakses fitur murid (bukan 403)', function (): void {
    // Factory user murid TIDAK membuat baris `students` — persis keadaan akun
    // yang mendaftar sebelum kelas penampung ada (mis. dgcam22@gmail.com).
    $murid = User::factory()->muridAktif()->create(['email' => 'lama-tanpa-profil@murid.test']);

    expect(Murid::query()->where('user_id', $murid->getKey())->exists())->toBeFalse();

    Sanctum::actingAs($murid->refresh());

    $this->getJson('/api/v1/avatar')->assertOk();
    $this->getJson('/api/v1/avatar/saya')->assertOk();
    $this->getJson('/api/v1/progres/saya')->assertOk();
    $this->getJson('/api/v1/badge/saya')->assertOk();

    // Profil terbentuk di kelas penampung yang sama dengan murid self-register.
    $profil = Murid::query()->where('user_id', $murid->getKey())->firstOrFail();

    expect($profil->kelas?->nama)->toBe('Tanpa Kelas');
});

it('guru melihat avatar dengan respons rapi (bukan 403) tetapi tetap tidak bisa unggah/progres', function (): void {
    $guru = User::factory()->guru()->create();

    Sanctum::actingAs($guru);

    $saya = $this->getJson('/api/v1/avatar/saya')->assertOk();
    expect($saya->json('avatar'))->toBeNull()
        ->and($saya->json('bawaan'))->toBeTrue()
        ->and($saya->json('tidak_tersedia'))->toBeTrue();

    $this->getJson('/api/v1/avatar')->assertOk()->assertJsonPath('avatar', []);

    // Remember: kebijakan tetap menutup unggah & progres guru (403).
    $this->postJson('/api/v1/avatar', [])->assertStatus(403);
    $this->getJson('/api/v1/progres/saya')->assertStatus(403);
    $this->postJson('/api/v1/progres/saya')->assertStatus(403);
    $this->getJson('/api/v1/badge/saya')->assertStatus(403);
    $this->postJson('/api/v1/badge/saya')->assertStatus(403);
});

it('tautan reset yang sudah dipakai ditandai, token acak tidak', function (): void {
    $murid = User::factory()->muridAktif()->create(['email' => 'sekali-pakai-ui@murid.test']);
    $broker = app('auth.password.broker');
    $token = $broker->createToken($murid);

    $muatan = fn () => [
        'token' => $token,
        'email' => 'sekali-pakai-ui@murid.test',
        'password' => 'sandi-baru-kuat-99',
        'password_confirmation' => 'sandi-baru-kuat-99',
    ];

    $this->postJson('/api/v1/auth/atur-ulang-sandi', $muatan())
        ->assertOk()
        ->assertJsonPath('tautan_dipakai', false);

    // Tautan dipakai lagi — tanpa UI tambahan pun, jawabannya jujur.
    $ulang = $this->postJson('/api/v1/auth/atur-ulang-sandi', $muatan())->assertOk();

    expect($ulang->json('message'))->toContain('sudah pernah dipakai')
        ->and($ulang->json('tautan_dipakai'))->toBeTrue();

    // Token memang tidak pernah ada → bukan "terpakai", cukup "tidak valid".
    $acak = $this->postJson('/api/v1/auth/atur-ulang-sandi', [
        'token' => 'token-ngawur-123456',
        'email' => 'sekali-pakai-ui@murid.test',
        'password' => 'sandi-baru-kuat-99',
        'password_confirmation' => 'sandi-baru-kuat-99',
    ])->assertOk();

    expect($acak->json('message'))->toContain('tidak valid atau sudah pernah dipakai')
        ->and($acak->json('tautan_dipakai'))->toBeFalse();
});
