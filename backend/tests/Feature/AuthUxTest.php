<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use Database\Seeders\RolesAndAdminSeeder;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    // Catatan: Notification TIDAK di-fake di sini supaya test fail-open benar-benar
    // menyentuh pengiriman email; test yang memeriksa pengiriman mem-fake sendiri.
});

/** Muatan pendaftaran murid yang valid. */
function muatanDaftar(string $email): array
{
    return [
        'name' => 'Rina Siswa',
        'email' => $email,
        'password' => 'kata-sandi-aman-10',
        'password_confirmation' => 'kata-sandi-aman-10',
    ];
}

it('murid yang baru daftar langsung masuk dan hanya bisa membuka jalur verifikasi', function (): void {
    $respons = $this->postJson('/api/v1/auth/daftar', muatanDaftar('langsung@murid.test'))
        ->assertCreated();

    expect($respons->json('user.role'))->toBe('murid')
        ->and($respons->json('perlu_verifikasi'))->toBeTrue()
        ->and($respons->json('email_terkirim'))->toBeTrue()
        ->and($respons->json('user.emailTerverifikasi'))->toBeFalse();

    // Sesi aktif tanpa mengetik ulang kata sandi.
    auth()->forgetGuards();
    $this->getJson('/api/v1/auth/saya')
        ->assertOk()
        ->assertJsonPath('email', 'langsung@murid.test');

    // Jalur verifikasi tetap terbuka untuk akun pending.
    $this->postJson('/api/v1/auth/kirim-ulang-verifikasi')
        ->assertOk()
        ->assertJsonPath('email_terkirim', true);

    // Endpoint lain ditolak dan sesinya dihancurkan (aturan keamanan inti tetap).
    $this->getJson('/api/v1/kelas')
        ->assertStatus(403)
        ->assertJsonPath('message', 'Verifikasi email dulu sebelum masuk.');

    auth()->forgetGuards();
    $this->getJson('/api/v1/auth/saya')->assertStatus(401);
});

it('akun pending yang menekan tombol keluar tetap bisa keluar', function (): void {
    $this->postJson('/api/v1/auth/daftar', muatanDaftar('keluar@murid.test'))->assertCreated();
    auth()->forgetGuards();

    $this->postJson('/api/v1/auth/keluar')->assertOk();
    auth()->forgetGuards();
    $this->getJson('/api/v1/auth/saya')->assertStatus(401);
});

it('daftar tetap berhasil walau layanan email mati (fail-open)', function (): void {
    // Mailer rusak: alamat 127.0.0.1:1 tidak mungkin menerima koneksi.
    config([
        'mail.default' => 'smtp',
        'mail.mailers.smtp.host' => '127.0.0.1',
        'mail.mailers.smtp.port' => 1,
        'mail.mailers.smtp.timeout' => 1,
    ]);

    $respons = $this->postJson('/api/v1/auth/daftar', muatanDaftar('smtp-mati@murid.test'))
        ->assertCreated();

    expect($respons->json('email_terkirim'))->toBeFalse()
        ->and($respons->json('perlu_verifikasi'))->toBeTrue();

    // Akun tetap dibuat dan tetap bisa memakai tombol kirim ulang nanti.
    auth()->forgetGuards();
    $this->postJson('/api/v1/auth/kirim-ulang-verifikasi')
        ->assertOk()
        ->assertJsonPath('email_terkirim', false);
});

it('lupa sandi tetap merespons sama walau layanan email mati (anti-enumerasi)', function (): void {
    User::factory()->muridAktif()->create(['email' => 'ada@murid.test']);

    config([
        'mail.default' => 'smtp',
        'mail.mailers.smtp.host' => '127.0.0.1',
        'mail.mailers.smtp.port' => 1,
        'mail.mailers.smtp.timeout' => 1,
    ]);

    $ada = $this->postJson('/api/v1/auth/lupa-sandi', ['email' => 'ada@murid.test'])->assertOk();
    $tidakAda = $this->postJson('/api/v1/auth/lupa-sandi', ['email' => 'hantu@murid.test'])->assertOk();

    expect($ada->json())->toBe($tidakAda->json());
});

it('tautan verifikasi hanya berefek sekali walau diklik dua kali', function (): void {
    $user = User::factory()->create(['email' => 'dua-kali@murid.test']);

    $tautan = URL::temporarySignedRoute('verification.verify', now()->addMinutes(30), [
        'id' => $user->getKey(),
        'hash' => sha1(mb_strtolower($user->getEmailForVerification())),
    ], false);

    $this->get($tautan)->assertRedirect();
    $terverifikasiPertama = $user->fresh()->email_verified_at;

    expect($terverifikasiPertama)->not->toBeNull()
        ->and($user->fresh()->status)->toBe(UserStatus::Aktif);

    // Klik kedua: tidak error, tetapi tidak mengubah apa pun lagi.
    $this->get($tautan)->assertRedirect();

    $setelahKlikKedua = $user->fresh();
    expect($setelahKlikKedua->email_verified_at?->equalTo($terverifikasiPertama))->toBeTrue()
        ->and($setelahKlikKedua->status)->toBe(UserStatus::Aktif)
        ->and($setelahKlikKedua->updated_at?->equalTo($user->refresh()->updated_at))->toBeTrue();
});

it('token lupa sandi dihapus setelah dipakai (sekali pakai di database)', function (): void {
    $user = User::factory()->muridAktif()->create(['email' => 'sekali-pakai@murid.test']);
    $broker = app('auth.password.broker');
    $token = $broker->createToken($user);

    expect(DB::table('password_reset_tokens')->where('email', 'sekali-pakai@murid.test')->exists())
        ->toBeTrue();

    $this->postJson('/api/v1/auth/atur-ulang-sandi', [
        'token' => $token,
        'email' => 'sekali-pakai@murid.test',
        'password' => 'sandi-baru-kuat-99',
        'password_confirmation' => 'sandi-baru-kuat-99',
    ])->assertOk();

    expect(Hash::check('sandi-baru-kuat-99', $user->fresh()->password))->toBeTrue()
        ->and(DB::table('password_reset_tokens')->where('email', 'sekali-pakai@murid.test')->exists())
        ->toBeFalse();

    // Pakai ulang token yang sama: gagal dan kata sandi tidak berubah lagi.
    $ulang = $this->postJson('/api/v1/auth/atur-ulang-sandi', [
        'token' => $token,
        'email' => 'sekali-pakai@murid.test',
        'password' => 'sandi-lagi-kuat-88',
        'password_confirmation' => 'sandi-lagi-kuat-88',
    ])->assertOk();

    expect($ulang->json('message'))->toContain('sudah pernah dipakai')
        ->and(Hash::check('sandi-lagi-kuat-88', $user->fresh()->password))->toBeFalse();
});

it('notifikasi verifikasi tetap terkirim untuk murid baru', function (): void {
    Notification::fake();

    $this->postJson('/api/v1/auth/daftar', muatanDaftar('verifikasi@murid.test'))->assertCreated();

    $user = User::query()->where('email', 'verifikasi@murid.test')->firstOrFail();
    Notification::assertSentTo($user, VerifyEmail::class);
});
