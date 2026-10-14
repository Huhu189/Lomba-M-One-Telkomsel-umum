<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

/**
 * Masuk & daftar lewat Google (14 Oktober 2026).
 *
 * Token Google dibuat sendiri di sini dengan pasangan kunci RSA sekali pakai,
 * dan JWKS-nya disajikan lewat `Http::fake` — jadi tes ini benar-benar menguji
 * pemeriksaan tanda tangan (termasuk perubahan JWK → PEM), bukan hanya bentuk
 * permintaannya. Token yang ditandatangani kunci lain harus ditolak.
 */
const KLIEN_UJI = 'klien-uji.apps.googleusercontent.com';

/** base64url tanpa padding (format segmen JWT). */
function b64urlGoogle(string $biner): string
{
    return rtrim(strtr(base64_encode($biner), '+/', '-_'), '=');
}

/**
 * Pasangan kunci RSA uji + JWK publiknya.
 *
 * @return array{kunci: \OpenSSLAsymmetricKey, kid: string, jwk: array<string, string>}
 */
function kunciGoogleUji(string $kid = 'kunci-uji'): array
{
    $kunci = openssl_pkey_new([
        'private_key_bits' => 2048,
        'private_key_type' => OPENSSL_KEYTYPE_RSA,
    ]);

    expect($kunci)->not->toBeFalse();

    /** @var array{rsa: array{n: string, e: string}} $rincian */
    $rincian = openssl_pkey_get_details($kunci);

    return [
        'kunci' => $kunci,
        'kid' => $kid,
        'jwk' => [
            'kty' => 'RSA',
            'alg' => 'RS256',
            'use' => 'sig',
            'kid' => $kid,
            'n' => b64urlGoogle($rincian['rsa']['n']),
            'e' => b64urlGoogle($rincian['rsa']['e']),
        ],
    ];
}

/**
 * JWKS tiruan berisi kunci uji.
 *
 * @param  array{kunci: \OpenSSLAsymmetricKey, kid: string, jwk: array<string, string>}  $kunci
 */
function pasangJwksGoogle(array $kunci): void
{
    Http::fake([
        'https://www.googleapis.com/oauth2/v3/certs' => Http::response(['keys' => [$kunci['jwk']]]),
    ]);
}

/**
 * Tanda tangani ID token uji (RS256).
 *
 * @param  array<string, mixed>  $ubahKlaim
 * @param  array{kunci: \OpenSSLAsymmetricKey, kid: string}  $kunci
 */
function tokenGoogleUji(array $kunci, array $ubahKlaim = []): string
{
    $klaim = [
        'iss' => 'https://accounts.google.com',
        'aud' => KLIEN_UJI,
        'sub' => '112233445566778899',
        'email' => 'rara@sekolah.sch.id',
        'email_verified' => true,
        'name' => 'Rara',
        'iat' => time() - 10,
        'exp' => time() + 600,
        ...$ubahKlaim,
    ];

    $kepala = b64urlGoogle(json_encode(['alg' => 'RS256', 'kid' => $kunci['kid'], 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
    $isi = b64urlGoogle(json_encode($klaim, JSON_THROW_ON_ERROR));

    openssl_sign($kepala.'.'.$isi, $tandaTangan, $kunci['kunci'], OPENSSL_ALGO_SHA256);

    return $kepala.'.'.$isi.'.'.b64urlGoogle($tandaTangan);
}

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);

    config(['services.google.client_id' => KLIEN_UJI]);
    Cache::flush();

    $this->kunci = kunciGoogleUji();
    pasangJwksGoogle($this->kunci);
});

it('membuat akun murid baru dari email Google dan membuka sesi', function (): void {
    $token = tokenGoogleUji($this->kunci);

    $respons = $this->postJson('/api/v1/auth/google', ['credential' => $token])->assertOk();

    expect($respons->json('baru'))->toBeTrue()
        ->and($respons->json('user.email'))->toBe('rara@sekolah.sch.id')
        ->and($respons->json('user.role'))->toBe('murid')
        ->and($respons->json('user.perluBuatSandi'))->toBeTrue();

    $user = User::query()->where('email', 'rara@sekolah.sch.id')->firstOrFail();

    // Akun Google tetap akun biasa: peran murid, aktif, email terverifikasi
    // (Google sudah membuktikannya), dan punya profil kelas penampung.
    expect($user->google_id)->toBe('112233445566778899')
        ->and($user->status)->toBe(UserStatus::Aktif)
        ->and($user->hasVerifiedEmail())->toBeTrue()
        ->and($user->hasRole('murid'))->toBeTrue()
        ->and($user->perluBuatSandi())->toBeTrue()
        ->and(Murid::query()->where('user_id', $user->id)->exists())->toBeTrue()
        // Sesi dibuka seperti login biasa (guard web).
        ->and(auth()->guard('web')->id())->toBe($user->id);

    // Sekali masuk berikutnya dengan `sub` yang sama TIDAK membuat akun kedua.
    $ulang = $this->postJson('/api/v1/auth/google', ['credential' => $token])->assertOk();

    expect($ulang->json('baru'))->toBeFalse()
        ->and(User::query()->where('email', 'rara@sekolah.sch.id')->count())->toBe(1);
});

it('menautkan Google ke akun yang sudah ada tanpa menggandakan akun dan tanpa mengubah sandinya', function (): void {
    $guru = User::factory()->guru()->create(['email' => 'bu.rina@sekolah.sch.id']);
    $sandiLama = 'password-aman-123';

    $token = tokenGoogleUji($this->kunci, ['sub' => '998877665544332211', 'email' => 'bu.rina@sekolah.sch.id']);

    $respons = $this->postJson('/api/v1/auth/google', ['credential' => $token])->assertOk();

    expect($respons->json('baru'))->toBeFalse()
        ->and($respons->json('user.role'))->toBe('guru');

    $guru->refresh();

    expect($guru->google_id)->toBe('998877665544332211')
        // Perannya tidak berubah jadi murid hanya karena masuk lewat Google.
        ->and($guru->hasRole('guru'))->toBeTrue()
        // Kata sandinya tidak disentuh: guru tetap bisa masuk lewat jalur lama.
        ->and($guru->perluBuatSandi())->toBeFalse();

    auth()->forgetGuards();

    $this->postJson('/api/v1/auth/masuk', ['email' => 'bu.rina@sekolah.sch.id', 'password' => $sandiLama])
        ->assertOk();
});

it('mengaktifkan akun pending yang emailnya sudah dibuktikan Google', function (): void {
    $murid = User::factory()->create(['email' => 'belum@sekolah.sch.id']);

    expect($murid->status)->toBe(UserStatus::Pending);

    $token = tokenGoogleUji($this->kunci, ['sub' => '555000111222333', 'email' => 'belum@sekolah.sch.id']);

    $this->postJson('/api/v1/auth/google', ['credential' => $token])->assertOk();

    $murid->refresh();

    expect($murid->status)->toBe(UserStatus::Aktif)
        ->and($murid->hasVerifiedEmail())->toBeTrue();
});

it('menolak token yang tidak sah: tanda tangan kunci lain, audiens salah, email belum terverifikasi', function (): void {
    $kunciPalsu = kunciGoogleUji('kunci-palsu');
    $salahTandaTangan = tokenGoogleUji(['kunci' => $kunciPalsu['kunci'], 'kid' => $this->kunci['kid']]);

    $this->postJson('/api/v1/auth/google', ['credential' => $salahTandaTangan])
        ->assertStatus(422)
        ->assertJsonValidationErrors('credential');

    $this->postJson('/api/v1/auth/google', ['credential' => tokenGoogleUji($this->kunci, ['aud' => 'aplikasi-lain.apps.googleusercontent.com'])])
        ->assertStatus(422);

    $this->postJson('/api/v1/auth/google', ['credential' => tokenGoogleUji($this->kunci, ['email_verified' => false])])
        ->assertStatus(422);

    $this->postJson('/api/v1/auth/google', ['credential' => tokenGoogleUji($this->kunci, ['exp' => time() - 3600])])
        ->assertStatus(422);

    // Tanpa satu pun yang lolos, tidak ada akun yang lahir dari percobaan itu.
    expect(User::query()->where('email', 'rara@sekolah.sch.id')->exists())->toBeFalse();
});

it('menahan akun Google yang belum bersandi dari rute lain, lalu membukanya setelah sandi dibuat', function (): void {
    $this->postJson('/api/v1/auth/google', ['credential' => tokenGoogleUji($this->kunci)]);

    $user = User::query()->where('email', 'rara@sekolah.sch.id')->firstOrFail();

    auth()->forgetGuards();
    Sanctum::actingAs($user);

    // Lapisan wajib-buat-sandi: rute lain ditolak 403 dengan penanda jelas,
    // sedangkan akun sendiri dan pembuatan sandi tetap boleh.
    $this->getJson('/api/v1/kuis')
        ->assertStatus(403)
        ->assertJson(['perlu_buat_sandi' => true]);
    $this->getJson('/api/v1/auth/saya')->assertOk();

    // Sandi terlalu pendek tetap ditolak aturan yang sama dengan pendaftaran.
    $this->putJson('/api/v1/akun/sandi-pertama', ['password' => 'pendek', 'password_confirmation' => 'pendek'])
        ->assertStatus(422);

    $this->putJson('/api/v1/akun/sandi-pertama', [
        'password' => 'rahasia-rara-2026',
        'password_confirmation' => 'rahasia-rara-2026',
    ])->assertOk()->assertJsonPath('user.perluBuatSandi', false);

    expect(User::query()->where('email', 'rara@sekolah.sch.id')->firstOrFail()->perluBuatSandi())->toBeFalse();

    auth()->forgetGuards();
    Sanctum::actingAs(User::query()->where('email', 'rara@sekolah.sch.id')->firstOrFail());

    $this->getJson('/api/v1/kuis')->assertOk();

    // Rute ini tidak bisa dipakai dua kali: penggantian sandi berikutnya wajib
    // lewat jalur ganti sandi yang meminta sandi lama.
    auth()->forgetGuards();
    Sanctum::actingAs(User::query()->where('email', 'rara@sekolah.sch.id')->firstOrFail());

    $this->putJson('/api/v1/akun/sandi-pertama', [
        'password' => 'rahasia-rara-2027',
        'password_confirmation' => 'rahasia-rara-2027',
    ])->assertStatus(422);
});

it('tidak bisa dimasuki lewat jalur kata sandi sebelum murid membuat sandinya', function (): void {
    $this->postJson('/api/v1/auth/google', ['credential' => tokenGoogleUji($this->kunci)]);

    $user = User::query()->where('email', 'rara@sekolah.sch.id')->firstOrFail();

    auth()->forgetGuards();

    // Sandi acak server (40 karakter) tidak pernah diberitahukan: jalur sandi
    // memang tidak bisa dipakai sebelum murid membuat sandinya sendiri.
    $this->postJson('/api/v1/auth/masuk', ['email' => 'rara@sekolah.sch.id', 'password' => 'apa-saja'])
        ->assertStatus(422);

    // Bahkan bila sandi acaknya entah bagaimana diketahui, akun tanpa sandi
    // sendiri tetap ditolak — tidak ada jalan masuk "beda method".
    $user->forceFill(['password' => 'sandi-acak-yang-diketahui'])->save();

    $this->postJson('/api/v1/auth/masuk', ['email' => 'rara@sekolah.sch.id', 'password' => 'sandi-acak-yang-diketahui'])
        ->assertStatus(422);

    // Sesudah sandinya dibuat, jalur sandi normal kembali berfungsi.
    Sanctum::actingAs($user);
    $this->putJson('/api/v1/akun/sandi-pertama', [
        'password' => 'rahasia-rara-2026',
        'password_confirmation' => 'rahasia-rara-2026',
    ])->assertOk();

    auth()->forgetGuards();

    $this->postJson('/api/v1/auth/masuk', ['email' => 'rara@sekolah.sch.id', 'password' => 'rahasia-rara-2026'])
        ->assertOk()
        ->assertJsonPath('user.email', 'rara@sekolah.sch.id');
});

it('tidak menampilkan tombol Google dan menolak jalur ini bila sekolah belum mengisi client id', function (): void {
    config(['services.google.client_id' => '']);

    $this->getJson('/api/v1/auth/google')->assertOk()->assertJson(['aktif' => false, 'client_id' => '']);

    $this->postJson('/api/v1/auth/google', ['credential' => tokenGoogleUji($this->kunci)])
        ->assertStatus(422);

    // Sekolah tetap ada; yang ditegakkan di sini hanya pintu Google-nya yang tertutup.
    expect(User::query()->where('email', 'rara@sekolah.sch.id')->exists())->toBeFalse()
        ->and(Sekolah::query()->count())->toBeGreaterThan(0);
});
