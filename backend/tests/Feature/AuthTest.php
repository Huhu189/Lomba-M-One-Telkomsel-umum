<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use App\Sections\Auth\Services\RegisterService;
use App\Sections\Auth\Services\VerifyEmailService;
use Database\Seeders\RolesAndAdminSeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\URL;
use ReflectionProperty;

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
    ], false);

    $this->get($tautanValid)->assertRedirect();
    expect($user->fresh()->hasVerifiedEmail())->toBeTrue()
        ->and($user->fresh()->status)->toBe(UserStatus::Aktif);

    // Tanda tangan dirusak → dialihkan ke halaman frontend (bukan JSON 403 mentah).
    $tautanDirusak = str_replace('&signature=', '&signature=x', (string) $tautanValid);
    $this->get($tautanDirusak)->assertRedirect(config('app.frontend_url').'/verifikasi-email?status=gagal');

    // Tanda tangan VALID tetapi id/hash tidak cocok → controller redirect 'gagal'.
    $tautanHashSalah = URL::temporarySignedRoute('verification.verify', now()->addMinutes(30), [
        'id' => 9999,
        'hash' => 'hashingganda',
    ], false);
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

it('satu kelas di balik satu IP bisa masuk serentak tanpa 429', function () {
    // Sekolah nyata memakai satu alamat IP publik (NAT): satu kelas menekan
    // "Masuk" hampir bersamaan saat jam pelajaran mulai. Batas per IP harus
    // cukup longgar untuk itu, sementara batas per akun tetap ketat (lihat test
    // brute force di atas) supaya menebak sandi satu akun tetap terkunci.
    $sandi = 'kata-sandi-kelas-1';

    foreach (range(1, 30) as $i) {
        User::factory()->muridAktif()->create([
            'email' => "kelas5-{$i}@murid.test",
            'password' => $sandi,
        ]);
    }

    foreach (range(1, 30) as $i) {
        $this->postJson('/api/v1/auth/masuk', [
            'email' => "kelas5-{$i}@murid.test",
            'password' => $sandi,
        ])->assertOk();
    }
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

it('tautan verifikasi tetap valid walau host/port berbeda dari saat email dibuat (regresi Invalid signature)', function () {
    $user = User::factory()->create(['email' => 'proxy@murid.test']);

    $tautan = (new VerifyEmail)->toMail($user)->actionUrl;

    // Simulasi klik lewat proxy Vite (:5173) / host lain: hanya path+query yang dipakai.
    $path = parse_url($tautan, PHP_URL_PATH).'?'.parse_url($tautan, PHP_URL_QUERY);
    $this->get('http://localhost:5173'.$path)->assertRedirect(config('app.frontend_url').'/verifikasi-email?status=berhasil');
    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
});

it('tautan verifikasi kedaluwarsa dialihkan ke halaman frontend, bukan 403', function () {
    $user = User::factory()->create(['email' => 'basi@murid.test']);

    $tautan = URL::temporarySignedRoute('verification.verify', now()->subMinute(), [
        'id' => $user->getKey(),
        'hash' => sha1(mb_strtolower($user->getEmailForVerification())),
    ], false);

    $this->get($tautan)->assertRedirect(config('app.frontend_url').'/verifikasi-email?status=gagal');
    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
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

it('notifikasi reset sandi membangun tautan ke halaman frontend (regresi URL)', function () {
    $user = User::factory()->muridAktif()->create(['email' => 'lupa@murid.test']);
    $token = app('auth.password.broker')->createToken($user);

    // toMail() dipanggil langsung supaya URL benar-benar dibangun. Sebelum diperbaiki,
    // notifikasi bawaan memakai route('password.reset') yang tidak ada di aplikasi ini,
    // lalu galatnya ditelan fail-open → email reset tidak pernah sampai.
    $pesan = (new ResetPassword($token))->toMail($user);
    $dasar = rtrim((string) config('app.frontend_url'), '/');

    expect($pesan->actionUrl)->toStartWith($dasar.'/atur-ulang-sandi')
        ->and($pesan->actionUrl)->toContain('token='.$token)
        ->and($pesan->actionUrl)->toContain(urlencode('lupa@murid.test'));
});

it('callback URL reset sandi terdaftar di provider (tanpa fallback route yang tidak ada)', function () {
    $properti = new ReflectionProperty(ResetPassword::class, 'createUrlCallback');

    expect($properti->getValue())->toBeCallable();
});

it('verifikasi email tidak mengaktifkan akun yang ditangguhkan', function () {
    // Sengaja belum terverifikasi (status suspended + email_verified_at null).
    $user = User::factory()->create([
        'email' => 'tomi@murid.test',
        'status' => UserStatus::Suspended->value,
    ]);

    expect($user->status)->toBe(UserStatus::Suspended)
        ->and($user->hasVerifiedEmail())->toBeFalse();

    app(VerifyEmailService::class)->verifikasi($user);

    // Email tetap tercatat terverifikasi, tetapi penangguhan sekolah tidak dibatalkan.
    expect($user->fresh()->hasVerifiedEmail())->toBeTrue()
        ->and($user->fresh()->status)->toBe(UserStatus::Suspended);
});

it('daftar dengan email terdaftar dijawab 422 — keputusan sadar (lihat laporan A.10)', function () {
    User::factory()->muridAktif()->create(['email' => 'sudah@murid.test']);

    // Trade-off yang disengaja: 422 untuk email terdaftar memang bisa dipakai menebak
    // email. Anti-enumerasi penuh menuntut auto-login setelah daftar dihapus (perilaku
    // yang diminta pengguna), jadi perilaku ini dipertahankan dan dicatat jujur.
    $this->postJson('/api/v1/auth/daftar', [
        'name' => 'Rina Ganda',
        'email' => 'sudah@murid.test',
        'password' => 'kata-sandi-aman-10',
        'password_confirmation' => 'kata-sandi-aman-10',
    ])->assertStatus(422)->assertJsonValidationErrors(['email']);

    expect(User::query()->where('email', 'sudah@murid.test')->count())->toBe(1);
});

it('atur ulang sandi mencabut sesi lama dan token ingat-saya', function () {
    $user = User::factory()->muridAktif()->create([
        'email' => 'cabut@murid.test',
        'remember_token' => 'token-ingat-lama',
    ]);
    $token = app('auth.password.broker')->createToken($user);

    // Simulasi driver sesi produksi + satu sesi aktif di perangkat lain.
    config(['session.driver' => 'database']);
    DB::table('sessions')->insert([
        'id' => 'sesi-perangkat-lain',
        'user_id' => $user->getKey(),
        'payload' => base64_encode(serialize([])),
        'last_activity' => now()->getTimestamp(),
    ]);

    $this->postJson('/api/v1/auth/atur-ulang-sandi', [
        'token' => $token,
        'email' => 'cabut@murid.test',
        'password' => 'sandi-baru-kuat-99',
        'password_confirmation' => 'sandi-baru-kuat-99',
    ])->assertOk();

    expect($user->fresh()->remember_token)->not->toBe('token-ingat-lama')
        ->and(DB::table('sessions')->where('user_id', $user->getKey())->count())->toBe(0);
});

it('kolom role dan role Spatie selalu sinkron di semua jalur pembuatan user', function () {
    $murid = User::factory()->create(['email' => 'sinkron-murid@murid.test']);
    $guru = User::factory()->guru()->create(['email' => 'sinkron-guru@murid.test']);

    expect($murid->role)->toBe('murid')
        ->and($murid->hasRole('murid'))->toBeTrue()
        ->and($guru->role)->toBe('guru')
        ->and($guru->hasRole('guru'))->toBeTrue();

    // Jalur pendaftaran publik (service), bukan lewat factory.
    $daftar = app(RegisterService::class)->daftarMurid([
        'name' => 'Rina Sinkron',
        'email' => 'sinkron-daftar@murid.test',
        'password' => 'kata-sandi-aman-10',
    ])['user'];

    expect($daftar->role)->toBe('murid')
        ->and($daftar->getRoleNames()->all())->toBe(['murid']);
});

it('dua murid boleh memakai nama yang sama', function (): void {
    // Nama anak TIDAK unik di sekolah: di satu kelas bisa ada dua "Ahmad".
    // Yang unik hanya email. Dulu tabel `users` membawa indeks unik sisa
    // scaffold (name, guard_name) — kolom `guard_name` bahkan tidak ada di
    // `users` — sehingga pendaftaran murid kedua meledak jadi 500.
    $this->postJson('/api/v1/auth/daftar', [
        'name' => 'Ahmad',
        'email' => 'ahmad.satu@murid.test',
        'password' => 'kata-sandi-aman-10',
        'password_confirmation' => 'kata-sandi-aman-10',
    ])->assertCreated();

    auth()->forgetGuards();

    $this->postJson('/api/v1/auth/daftar', [
        'name' => 'Ahmad',
        'email' => 'ahmad.dua@murid.test',
        'password' => 'kata-sandi-aman-10',
        'password_confirmation' => 'kata-sandi-aman-10',
    ])->assertCreated();

    expect(User::query()->where('name', 'Ahmad')->count())->toBe(2)
        ->and(User::query()->where('email', 'ahmad.dua@murid.test')->exists())->toBeTrue()
        ->and(Schema::hasIndex('users', 'users_name_guard_name_unique'))->toBeFalse();
});
