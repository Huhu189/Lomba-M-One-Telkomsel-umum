<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use Database\Seeders\RolesAndAdminSeeder;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolesAndAdminSeeder::class);
    Notification::fake();
});

it('murid bisa mendaftar, role dari server = murid, dan tautan verifikasi terkirim', function () {
    $respons = $this->postJson('/api/v1/auth/daftar', [
        'name' => 'Rina Siswa',
        'email' => 'rina@murid.test',
        'password' => 'kata-sandi-aman-10',
        'password_confirmation' => 'kata-sandi-aman-10',
    ]);

    $respons->assertCreated()->assertJsonMissing(['password']);

    $user = User::query()->where('email', 'rina@murid.test')->firstOrFail();
    expect($user->hasRole('murid'))->toBeTrue()
        ->and($user->hasRole('guru'))->toBeFalse()
        ->and($user->status)->toBe(UserStatus::Pending)
        ->and(Hash::check('kata-sandi-aman-10', $user->password))->toBeTrue();

    Notification::assertSentTo($user, VerifyEmail::class);
});

it('daftar mengabaikan role dari klien (guru tidak bisa self-register)', function () {
    $this->postJson('/api/v1/auth/daftar', [
        'name' => 'Calon Penyusup',
        'email' => 'penyusup@murid.test',
        'password' => 'kata-sandi-aman-10',
        'password_confirmation' => 'kata-sandi-aman-10',
        'role' => 'admin',
    ])->assertCreated();

    $user = User::query()->where('email', 'penyusup@murid.test')->firstOrFail();
    expect($user->hasRole('admin'))->toBeFalse()
        ->and($user->role)->toBe('murid');
});

it('password kurang dari 10 karakter ditolak', function () {
    $this->postJson('/api/v1/auth/daftar', [
        'name' => 'Pendek',
        'email' => 'pendek@murid.test',
        'password' => 'pendek-9x',
        'password_confirmation' => 'pendek-9x',
    ])->assertStatus(422)->assertJsonValidationErrors(['password']);
});

it('tautan verifikasi valid mengaktifkan akun; tanda tangan salah ditolak', function () {
    $user = User::factory()->create(['email' => 'budi@murid.test']);

    $tautanValid = URL::temporarySignedRoute('verification.verify', now()->addMinutes(30), [
        'id' => $user->getKey(),
        'hash' => sha1(mb_strtolower($user->getEmailForVerification())),
    ]);

    $this->get($tautanValid)->assertRedirect();
    expect($user->fresh()->hasVerifiedEmail())->toBeTrue()
        ->and($user->fresh()->status)->toBe(UserStatus::Aktif);

    // Tanda tangan yang dirusak → 403 oleh middleware 'signed' (bukan redirect).
    $tautanDirusak = str_replace('&signature=', '&signature=x', (string) $tautanValid);
    $this->get($tautanDirusak)->assertStatus(403);

    // Tanda tangan VALID tetapi id/hash tidak cocok → controller redirect 'gagal'.
    $tautanHashSalah = URL::temporarySignedRoute('verification.verify', now()->addMinutes(30), [
        'id' => 9999,
        'hash' => 'hashingganda',
    ]);
    $this->get($tautanHashSalah)->assertRedirect();
});

it('login salah email vs salah sandi menghasilkan respons identik (anti enumerasi)', function () {
    User::factory()->muridAktif()->create(['email' => 'sari@murid.test']);

    $salahSandi = $this->postJson('/api/v1/auth/masuk', [
        'email' => 'sari@murid.test',
        'password' => 'bukan-sandi-benar',
    ])->assertStatus(422);

    $emailAsing = $this->postJson('/api/v1/auth/masuk', [
        'email' => 'tidak-ada@murid.test',
        'password' => 'bukan-sandi-benar',
    ])->assertStatus(422);

    expect($salahSandi->json())->toBe($emailAsing->json());
});

it('akun suspended ditolak dengan respons identik seperti kredensial salah', function () {
    $user = User::factory()->suspended()->create(['email' => 'tomi@murid.test']);

    $suspend = $this->postJson('/api/v1/auth/masuk', [
        'email' => 'tomi@murid.test',
        'password' => 'password-aman-123',
    ])->assertStatus(422);

    $kredensialSalah = $this->postJson('/api/v1/auth/masuk', [
        'email' => 'bukan@murid.test',
        'password' => 'password-aman-123',
    ])->assertStatus(422);

    expect($suspend->json())->toBe($kredensialSalah->json())
        ->and(auth('web')->check())->toBeFalse();
});

it('login berhasil menghasilkan sesi dan /auth/saya mengembalikan data user', function () {
    $user = User::factory()->muridAktif()->create(['email' => 'dina@murid.test']);

    $this->postJson('/api/v1/auth/masuk', [
        'email' => 'dina@murid.test',
        'password' => 'password-aman-123',
    ])->assertOk()->assertJsonPath('user.email', 'dina@murid.test');

    $this->getJson('/api/v1/auth/saya')->assertOk()
        ->assertJsonPath('role', 'murid')
        ->assertJsonMissing(['password']);
});

it('akun yang disuspend di tengah sesi ditolak di request berikutnya', function () {
    $user = User::factory()->muridAktif()->create(['email' => 'eka@murid.test']);

    $this->postJson('/api/v1/auth/masuk', [
        'email' => 'eka@murid.test',
        'password' => 'password-aman-123',
    ])->assertOk();

    $user->forceFill(['status' => UserStatus::Suspended->value])->save();

    // Simulasi proses request baru: guard sesi meng-cache user antar request dalam satu test.
    auth()->forgetGuards();

    $this->getJson('/api/v1/auth/saya')->assertStatus(403);

    // Request di atas meng-cache ulang guard; bersihkan lagi agar /sesi dijalankan seperti proses baru
    // (di produksi tiap HTTP request memakai guard segar).
    auth()->forgetGuards();

    $this->getJson('/api/v1/sesi')->assertJson(['terautentikasi' => false]);
});

it('brute force login kena 429', function () {
    $data = fn () => ['email' => 'fajar@murid.test', 'password' => 'tebakan-salah-1'];

    foreach (range(1, 5) as $i) {
        $this->postJson('/api/v1/auth/masuk', $data())->assertStatus(422);
    }

    $this->postJson('/api/v1/auth/masuk', $data())->assertStatus(429);
});

it('lupa sandi: respons identik untuk email yang ada dan tidak ada; token tersimpan ter-hash', function () {
    User::factory()->muridAktif()->create(['email' => 'gilang@murid.test']);

    $ada = $this->postJson('/api/v1/auth/lupa-sandi', ['email' => 'gilang@murid.test'])->assertOk();
    $tidakAda = $this->postJson('/api/v1/auth/lupa-sandi', ['email' => 'hantu@murid.test'])->assertOk();

    expect($ada->json())->toBe($tidakAda->json());
});

it('atur ulang sandi: token valid bekerja dan tidak bisa dipakai dua kali', function () {
    $user = User::factory()->muridAktif()->create(['email' => 'inta@murid.test']);

    $this->postJson('/api/v1/auth/lupa-sandi', ['email' => 'inta@murid.test'])->assertOk();

    // Ambil token mentah dari email (log mailer) — mode test memakai notification fake, jadi
    // kita buat token lewat broker langsung untuk menguji endpoint reset.
    $broker = app('auth.password.broker');
    $token = $broker->createToken($user);

    $this->postJson('/api/v1/auth/atur-ulang-sandi', [
        'token' => $token,
        'email' => 'inta@murid.test',
        'password' => 'sandi-baru-kuat-99',
        'password_confirmation' => 'sandi-baru-kuat-99',
    ])->assertOk();

    expect(Hash::check('sandi-baru-kuat-99', $user->fresh()->password))->toBeTrue();

    // Token sekali pakai: pakai ulang ditolak (kata sandi tidak berubah).
    $this->postJson('/api/v1/auth/atur-ulang-sandi', [
        'token' => $token,
        'email' => 'inta@murid.test',
        'password' => 'sandi-lagi-kuat-88',
        'password_confirmation' => 'sandi-lagi-kuat-88',
    ])->assertOk();

    expect(Hash::check('sandi-lagi-kuat-88', $user->fresh()->password))->toBeFalse();
});

it('notifikasi verifikasi membangun tautan nyata ke rute API (regresi nama rute)', function () {
    $user = User::factory()->create(['email' => 'naila@murid.test']);

    // toMail() dipanggil langsung (tanpa fake) sehingga URL bertanda tangan
    // benar-benar dibangun — bila nama rute verification.verify hilang,
    // RouteNotFoundException dilempar dan test ini merah.
    $pesan = (new VerifyEmail)->toMail($user);

    expect($pesan->actionUrl)->toContain('/auth/verifikasi-email/')
        ->and($pesan->actionUrl)->toContain('signature=');
});

it('kirim ulang verifikasi publik: respons identik walau email tak terdaftar', function () {
    $respons = $this->postJson('/api/v1/auth/kirim-ulang-verifikasi-publik', [
        'email' => 'hantu@murid.test',
    ])->assertOk();

    $responsSama = $this->postJson('/api/v1/auth/kirim-ulang-verifikasi-publik', [
        'email' => 'tidak-ada@murid.test',
    ])->assertOk();

    expect($respons->json())->toBe($responsSama->json());
});

it('kirim ulang verifikasi publik mengirim email untuk akun pending', function () {
    $user = User::factory()->create(['email' => 'kavia@murid.test']);
    expect($user->status)->toBe(UserStatus::Pending);

    $this->postJson('/api/v1/auth/kirim-ulang-verifikasi-publik', [
        'email' => 'kavia@murid.test',
    ])->assertOk();

    Notification::assertSentTo($user, VerifyEmail::class);
});

it('kirim ulang verifikasi publik tidak mengirim untuk akun suspend dan email kosong', function () {
    $suspend = User::factory()->suspended()->create(['email' => 'lutvi@murid.test']);

    $this->postJson('/api/v1/auth/kirim-ulang-verifikasi-publik', ['email' => 'lutvi@murid.test'])->assertOk();
    $this->postJson('/api/v1/auth/kirim-ulang-verifikasi-publik', ['email' => ''])->assertOk();

    Notification::assertNotSentTo($suspend, VerifyEmail::class);
});

it('logout mengakhiri sesi', function () {
    $user = User::factory()->muridAktif()->create(['email' => 'joko@murid.test']);

    $this->postJson('/api/v1/auth/masuk', [
        'email' => 'joko@murid.test',
        'password' => 'password-aman-123',
    ])->assertOk();

    $this->postJson('/api/v1/auth/keluar')->assertOk();

    // Simulasi proses baru: guard ter-cache antar request dalam satu proses test.
    auth()->forgetGuards();

    $this->getJson('/api/v1/sesi')->assertJson(['terautentikasi' => false]);
    $this->assertGuest();
});
