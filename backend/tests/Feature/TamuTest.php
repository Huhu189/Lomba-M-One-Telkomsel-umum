<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use App\Sections\Tamu\Services\TamuService;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

/*
|--------------------------------------------------------------------------
| Siswa tamu (mode tamu tanpa login)
|--------------------------------------------------------------------------
|
| Guru membuka kuis untuk siswa tanpa akun lewat pengaturan `izinkan_tamu`;
| tamu cukup mengetik nama. Yang diuji di sini bukan hanya "bisa masuk", tetapi
| juga pagar-pagarnya: default mati, kuis draf tidak pernah terlihat, tamu tidak
| bisa menyentuh kuis yang tidak dibuka, dan murid berkelas lain tetap ditolak
| walau izin tamu menyala.
|
*/

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6B', 'tingkat' => 6]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Bahasa', 'kode' => 'BIN6']);
    $this->guru = User::factory()->guru()->create();
    $this->admin = User::query()->where('email', 'admin@sekolah.test')->firstOrFail();
});

/** Masuk sebagai satu pengguna (Sanctum mode SPA). */
function t04Masuk(User $user): void
{
    auth()->forgetGuards();
    Sanctum::actingAs($user);
}

/**
 * Nyalakan/matikan izin tamu lewat API pengaturan (lapis kuis milik guru).
 */
function t04SetIzin(object $ctx, User $oleh, Kuis $kuis, bool $nilai = true): void
{
    t04Masuk($oleh);

    test()->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis',
        'lingkup_id' => $kuis->id,
        'kunci' => 'izinkan_tamu',
        'nilai' => $nilai,
    ])->assertOk();
}

/** Kuis terbit yang sedang berjalan, milik guru, dengan dua soal pilihan ganda. */
function t04Kuis(object $ctx, array $ubah = []): Kuis
{
    $kuis = Kuis::factory()->untukSekolah($ctx->sekolah, $ctx->mapel, $ctx->kelas)
        ->milik($ctx->guru)->berjalan()->create([
            'acak_soal' => false,
            'acak_opsi' => false,
            ...$ubah,
        ]);

    foreach ([1, 2] as $urutan) {
        $soal = Soal::factory()
            ->untukSekolah($ctx->sekolah, $ctx->mapel)->milik($ctx->guru)->create(['skor' => 5]);

        $kuis->soal()->attach($soal->id, ['urutan' => $urutan]);
    }

    return $kuis->refresh();
}

/**
 * Masuk sebagai siswa tamu lewat HTTP (sesi cookie, seperti peramban).
 *
 * `$kode` adalah kode perangkat: klien membuatnya sekali lalu mengirimkannya
 * lagi setiap kali masuk. Bawaannya satu kode tetap supaya panggilan berulang di
 * dalam satu test tetap dianggap perangkat yang sama.
 */
function t04MasukTamu(string $nama, string $kode = 'perangkat-uji-0001'): void
{
    auth()->forgetGuards();

    test()->postJson('/api/v1/auth/tamu', [
        'nama' => $nama,
        'kode_perangkat' => $kode,
    ])->assertCreated();
}

it('mode tamu mati secara bawaan dan formulirnya tidak ditawarkan', function (): void {
    $kuis = t04Kuis($this);

    $this->getJson('/api/v1/tamu')->assertOk()->assertJsonPath('diizinkan', false);

    // Bahkan saat kuisnya sudah terbit: tanpa izin guru, tidak ada pintu tamu.
    $this->postJson('/api/v1/auth/tamu', ['nama' => 'Rara'])
        ->assertStatus(422)->assertJsonValidationErrors(['nama']);

    expect(User::query()->where('is_tamu', true)->count())->toBe(0)
        ->and($kuis->status->value)->toBe('publikasi');
});

it('guru membuka kuisnya untuk tamu lewat pengaturan kuis, lalu pintunya terbuka', function (): void {
    $kuis = t04Kuis($this);

    t04SetIzin($this, $this->guru, $kuis);

    $this->getJson('/api/v1/tamu')->assertOk()->assertJsonPath('diizinkan', true);
});

it('masuk sebagai tamu cukup dengan nama: akun tamu + profil kelas penampung + sesi aktif', function (): void {
    $kuis = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuis);

    auth()->forgetGuards();

    $respons = $this->postJson('/api/v1/auth/tamu', ['nama' => 'Rara'])->assertCreated();

    $respons->assertJsonPath('user.name', 'Rara')
        ->assertJsonPath('user.role', 'murid')
        ->assertJsonPath('user.isTamu', true)
        ->assertJsonPath('user.emailTerverifikasi', true);

    $tamu = User::query()->where('is_tamu', true)->firstOrFail();

    // Relasi sengaja dibaca lewat query, bukan `$tamu->murid`: pemuatan malas
    // dimatikan di non-produksi (`shouldBeStrict`), jadi membaca relasi tanpa
    // memuatnya lebih dulu justru melempar galat — bukan bukti profilnya ada.
    $profil = Murid::query()->where('user_id', $tamu->getKey())->first();
    $kelasTamu = Kelas::query()->where('nama', TamuService::NAMA_KELAS)->first();

    expect($tamu->isTamu())->toBeTrue()
        // Akun tamu tidak pernah punya kata sandi yang bisa dipakai masuk.
        ->and($tamu->isMurid())->toBeTrue()
        ->and($profil)->not->toBeNull()
        ->and($kelasTamu)->not->toBeNull()
        ->and((int) $profil->class_id)->toBe((int) $kelasTamu->getKey());

    // Sesi benar-benar terbuka: akun tamu tidak tertahan middleware `akun-aktif`
    // (email tidak diverifikasi karena tidak ada kotak surat). Statusnya
    // diperiksa `assertSuccessful` — bukan 200 pasti — karena guard sesi di dalam
    // satu proses test masih memegang model yang baru dibuat, dan Laravel
    // menjawab 201 untuk resource yang `wasRecentlyCreated`; di produksi setiap
    // request membaca user dari sesi dan jawabannya 200.
    $this->getJson('/api/v1/auth/saya')->assertSuccessful()->assertJsonPath('isTamu', true);
});

it('nama tamu dirapikan dan perangkat yang sama tetap satu akun', function (): void {
    $kuis = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuis);

    auth()->forgetGuards();

    // Spasi ganda + tab/baris baru dirapikan sebelum disimpan.
    $this->postJson('/api/v1/auth/tamu', [
        'nama' => "  Rara \t Sari \n",
        'kode_perangkat' => 'perangkat-uji-0001',
    ])->assertCreated()->assertJsonPath('user.name', 'Rara Sari');

    auth()->forgetGuards();

    // Perangkat yang sama, ejaan nama diperbaiki: akunnya tetap satu, nama
    // tampilannya yang diperbarui.
    $this->postJson('/api/v1/auth/tamu', [
        'nama' => 'rara sari',
        'kode_perangkat' => 'perangkat-uji-0001',
    ])->assertCreated()->assertJsonPath('user.name', 'rara sari');

    expect(User::query()->where('is_tamu', true)->count())->toBe(1);
});

it('nama tamu yang kosong atau terlalu panjang ditolak', function (): void {
    $kuis = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuis);

    auth()->forgetGuards();

    // Spasi saja = nama kosong setelah dirapikan (bukan lolos sebagai 2 huruf).
    $this->postJson('/api/v1/auth/tamu', ['nama' => '  '])
        ->assertStatus(422)->assertJsonValidationErrors(['nama']);

    $this->postJson('/api/v1/auth/tamu', ['nama' => str_repeat('a', 61)])
        ->assertStatus(422)->assertJsonValidationErrors(['nama']);

    expect(User::query()->where('is_tamu', true)->count())->toBe(0);
});

it('perangkat yang sama masuk lagi memakai akun dan attempt yang sama', function (): void {
    $kuis = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuis);

    t04MasukTamu('Budi');
    $pertama = User::query()->where('is_tamu', true)->firstOrFail();

    $attemptId = (int) $this->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated()->json('id');

    // Halaman dimuat ulang di perangkat yang sama: kode yang tersimpan membuat
    // anak itu kembali ke akunnya, bukan dibuatkan murid baru.
    t04MasukTamu('Budi', 'perangkat-uji-0001');
    $kedua = User::query()->where('is_tamu', true)->firstOrFail();

    $this->getJson("/api/v1/attempt/{$attemptId}")->assertOk();

    expect($kedua->getKey())->toBe($pertama->getKey())
        ->and(User::query()->where('is_tamu', true)->count())->toBe(1)
        ->and(Attempt::query()->count())->toBe(1);
});

it('nama yang sama di perangkat berbeda tetap dua akun — tidak ada nama yang bisa diambil alih', function (): void {
    $kuis = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuis);

    // Anak pertama mengetik "Rara" di perangkatnya.
    t04MasukTamu('Rara', 'perangkat-anak-1');
    $pertama = User::query()->where('is_tamu', true)->firstOrFail();
    $pertamaId = (int) $pertama->getKey();

    // Anak kedua mengetik nama yang sama dari perangkat lain: dulu dia masuk ke
    // akun yang sama tanpa kata sandi (bisa melanjutkan pekerjaan orang lain),
    // sekarang dia mendapat akunnya sendiri.
    auth()->forgetGuards();
    $respons = $this->postJson('/api/v1/auth/tamu', [
        'nama' => 'Rara',
        'kode_perangkat' => 'perangkat-anak-2',
    ])->assertCreated();

    $keduaId = (int) $respons->json('user.id');

    expect($keduaId)->not->toBe($pertamaId)
        ->and(User::query()->where('is_tamu', true)->count())->toBe(2);

    // Akun pertama tidak ikut berubah nama pemiliknya.
    expect((string) User::query()->findOrFail($pertamaId)->name)
        ->toBe((string) $pertama->name);
});

it('nama beremoji atau non-Latin tetap dapat akun sendiri', function (): void {
    $kuis = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuis);

    // Slug ASCII dari kedua nama ini kosong, sehingga akun tamu berbasis nama
    // dulu membuat mereka berbagi satu akun `tamu+tamu@` — dan anak yang menulis
    // namanya dengan emoji tidak terdaftar sebagai dirinya sendiri.
    t04MasukTamu('🦖🦖', 'perangkat-emoji-1');
    t04MasukTamu('李雷', 'perangkat-emoji-2');

    $email = User::query()->where('is_tamu', true)->pluck('email')->all();

    expect(User::query()->where('is_tamu', true)->count())->toBe(2)
        ->and(array_unique($email))->toHaveCount(2)
        // Kode perangkat tidak pernah tersimpan mentah di kolom email.
        ->and(implode(' ', $email))->not->toContain('perangkat-emoji');
});

it('satu kelas di balik satu IP bisa masuk tamu serentak tanpa 429 (T1)', function (): void {
    $kuis = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuis);

    // Enam anak, satu alamat IP sekolah (semua permintaan test datang dari IP yang
    // sama). Dulu semuanya berbagi kunci limiter `ip|` di jalur auth sehingga
    // murid ke-6 ditolak 429 sebelum sempat menulis namanya.
    for ($anak = 1; $anak <= 6; $anak++) {
        auth()->forgetGuards();

        $this->postJson('/api/v1/auth/tamu', [
            'nama' => 'Anak '.$anak,
            'kode_perangkat' => 'perangkat-kelas-6a-'.$anak,
        ])->assertCreated();
    }

    expect(User::query()->where('is_tamu', true)->count())->toBe(6);
});

it('satu perangkat yang menembak berulang tetap dibatasi 5 per menit', function (): void {
    $kuis = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuis);

    // Batas per pengunjung tetap ada: yang longgar hanya batas per alamat sekolah.
    for ($ke = 1; $ke <= 5; $ke++) {
        t04MasukTamu('Rara', 'perangkat-boros-0001');
    }

    auth()->forgetGuards();

    $this->postJson('/api/v1/auth/tamu', [
        'nama' => 'Rara',
        'kode_perangkat' => 'perangkat-boros-0001',
    ])->assertStatus(429);

    expect(User::query()->where('is_tamu', true)->count())->toBe(1);
});

it('kode perangkat yang bentuknya aneh ditolak validasi, bukan dipakai sebagai identitas', function (): void {
    $kuis = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuis);

    auth()->forgetGuards();

    foreach (['pendek', 'spasi tidak boleh', str_repeat('a', 129), 'emoji-🦖-disini'] as $kode) {
        $this->postJson('/api/v1/auth/tamu', [
            'nama' => 'Rara',
            'kode_perangkat' => $kode,
        ])->assertStatus(422)->assertJsonValidationErrors(['kode_perangkat']);
    }

    expect(User::query()->where('is_tamu', true)->count())->toBe(0);
});

it('klien tanpa kode perangkat dapat akun baru, bukan menumpang akun orang lain', function (): void {
    $kuis = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuis);

    auth()->forgetGuards();

    $kodeKlien = 'perangkat-klien-lama-01';

    t04MasukTamu('Rara', $kodeKlien);
    $sebelum = (int) User::query()->where('is_tamu', true)->firstOrFail()->getKey();

    // Klien lama (atau penyimpanan diblokir) tidak mengirim kode: respons tetap
    // membawa kode yang dibuat server supaya klien bisa menyimpannya — dan
    // pemanggil itu dapat akun BARU, bukan menumpang akun yang namanya sama.
    auth()->forgetGuards();
    $respons = $this->postJson('/api/v1/auth/tamu', ['nama' => 'Rara'])->assertCreated();

    $kodeBaru = (string) $respons->json('kode_perangkat');

    expect(mb_strlen($kodeBaru))->toBeGreaterThanOrEqual(8)
        ->and((int) $respons->json('user.id'))->not->toBe($sebelum)
        ->and(User::query()->where('is_tamu', true)->count())->toBe(2);
});

it('tamu hanya melihat kuis yang dibuka untuknya — kuis draf tidak pernah muncul', function (): void {
    $terbuka = t04Kuis($this, ['judul' => 'Terbuka untuk tamu']);
    $tertutup = t04Kuis($this, ['judul' => 'Hanya murid']);
    $draf = t04Kuis($this, ['judul' => 'Masih draf', 'status' => 'draf', 'publikasi_at' => null]);

    t04SetIzin($this, $this->guru, $terbuka);
    t04SetIzin($this, $this->guru, $draf);

    t04MasukTamu('Rara');

    $respons = $this->getJson('/api/v1/kuis')->assertOk();

    $judul = array_column($respons->json(), 'judul');

    expect($judul)->toBe(['Terbuka untuk tamu'])
        ->and($judul)->not->toContain('Hanya murid')
        ->and($judul)->not->toContain('Masih draf');

    // Kuis yang tidak dibuka: bahkan membukanya per id ditolak.
    $this->getJson("/api/v1/kuis/{$tertutup->id}")->assertStatus(403);
    $this->getJson("/api/v1/kuis/{$draf->id}")->assertStatus(403);
    $this->getJson("/api/v1/kuis/{$terbuka->id}")->assertOk()->assertJsonPath('judul', 'Terbuka untuk tamu');
});

it('tamu mengerjakan kuis yang dibuka sampai selesai dan nilainya tercatat', function (): void {
    $kuis = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuis);

    t04MasukTamu('Rara');

    $respons = $this->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated();
    $attemptId = (int) $respons->json('id');

    // Kunci jawaban tetap tidak pernah ikut ke klien.
    expect($respons->getContent())->not->toContain('kunci');

    $soal = (array) $respons->json('soal');
    expect($soal)->toHaveCount(2);

    // Kedua soal adalah pilihan ganda dengan kunci 'B' (SoalFactory).
    foreach ($soal as $satu) {
        $this->postJson("/api/v1/attempt/{$attemptId}/jawab", [
            'question_id' => $satu['id'],
            'jawaban' => 'B',
        ])->assertOk();
    }

    $hasil = $this->postJson("/api/v1/attempt/{$attemptId}/kumpulkan", [
        'idempotency_key' => 'tamu-rara-1',
    ])->assertOk();

    $attempt = Attempt::query()->findOrFail($attemptId);
    $tamu = User::query()->where('is_tamu', true)->firstOrFail();
    $profil = Murid::query()->where('user_id', $tamu->getKey())->firstOrFail();

    expect($attempt->status->value)->toBe('selesai')
        ->and((int) $attempt->student_id)->toBe((int) $profil->getKey())
        ->and($attempt->skor_maksimal)->toEqual(10.0)
        // Tamu dinilai oleh mesin yang sama seperti murid — tidak ada jalur nilai terpisah.
        ->and($hasil->json('skor'))->toEqual(10.0)
        ->and($hasil->json('ringkasan_penilaian.dinilai'))->toBe(2);
});

it('tamu ditolak pada kuis yang tidak dibuka guru, tanpa bocoran apa pun', function (): void {
    // Pintu tamu menyala untuk SATU kuis saja; kuis lain di sekolah yang sama
    // tetap tertutup untuk tamu (bahkan metadatanya).
    $kuisTerbuka = t04Kuis($this, ['judul' => 'Boleh ditamu']);
    $kuisTertutup = t04Kuis($this, ['judul' => 'Khusus murid']);

    t04SetIzin($this, $this->guru, $kuisTerbuka);
    t04MasukTamu('Rara');

    $this->postJson("/api/v1/kuis/{$kuisTertutup->id}/mulai")->assertStatus(403);
    $this->getJson("/api/v1/kuis/{$kuisTertutup->id}")->assertStatus(403);

    // Kuis yang dibuka: sisanya urusan AttemptService, bukan policy.
    $this->postJson("/api/v1/kuis/{$kuisTerbuka->id}/mulai")->assertCreated();

    expect(Attempt::query()->count())->toBe(1);
});

it('murid berkelas lain tetap ditolak walau izin tamu menyala', function (): void {
    // Pagar kelas murid tidak boleh ikut longgar hanya karena tamu dibolehkan.
    $kuis = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuis);

    $kelasLain = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6C', 'tingkat' => 6]);
    $muridLain = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $kelasLain->id,
    ]);

    t04Masuk($muridLain->user);

    // Ditolak di pintu policy (bukan sampai service): kuisnya memang bukan kelasnya.
    $this->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertStatus(403);
    $this->getJson("/api/v1/kuis/{$kuis->id}")->assertStatus(403);

    expect(Attempt::query()->count())->toBe(0);
});

it('kuis mode tim ditolak untuk tamu dengan pesan yang jelas', function (): void {
    $kuis = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuis);

    // Mode tim hanya bisa dinyalakan admin di lapis sekolah/kelas, jadi di sini
    // dipakai lapis kuis milik guru (sama seperti izin tamu).
    t04Masuk($this->guru);
    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis', 'lingkup_id' => $kuis->id, 'kunci' => 'mode_tim', 'nilai' => true,
    ])->assertOk();

    t04MasukTamu('Rara');

    $this->postJson("/api/v1/kuis/{$kuis->id}/mulai")
        ->assertStatus(422)
        ->assertJsonPath('errors.kuis.0', 'Kuis ini mode tim, jadi tidak bisa diikuti siswa tamu. Minta gurumu menyiapkan tim atau pakai akun murid.');

    expect(Attempt::query()->count())->toBe(0);
});

it('akun tamu tidak bisa masuk ke jalur guru', function (): void {
    $kuis = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuis);

    t04MasukTamu('Rara');

    // Bacaan guru ditolak untuk akun berperan murid.
    $this->getJson('/api/v1/pengaturan')->assertStatus(403);
    $this->getJson("/api/v1/kuis/{$kuis->id}/laporan")->assertStatus(403);
    $this->getJson("/api/v1/kuis/{$kuis->id}/koreksi")->assertStatus(403);
    $this->getJson('/api/v1/soal')->assertStatus(403);

    // Menghapus murid = aksi guru; tamu ditolak, bukan diperlakukan sebagai murid biasa.
    $muridLain = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);

    $this->deleteJson("/api/v1/murid/{$muridLain->id}")->assertStatus(403);
});

it('guru pemilik kuis melihat hasil siswa tamunya; guru lain dan tamu sendiri tidak', function (): void {
    $kuis = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuis);

    t04MasukTamu('Rara');
    $attemptId = (int) $this->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated()->json('id');

    foreach ((array) $this->getJson("/api/v1/attempt/{$attemptId}")->json('soal') as $satu) {
        $this->postJson("/api/v1/attempt/{$attemptId}/jawab", [
            'question_id' => $satu['id'], 'jawaban' => 'B',
        ])->assertOk();
    }

    $this->postJson("/api/v1/attempt/{$attemptId}/kumpulkan", ['idempotency_key' => 'tamu-rara-9'])->assertOk();

    // Guru pemiliknya: melihat daftar tamu lengkap dengan nilainya.
    t04Masuk($this->guru);

    $respons = $this->getJson("/api/v1/kuis/{$kuis->id}/tamu")->assertOk();

    expect($respons->json('izin_tamu'))->toBeTrue()
        ->and($respons->json('jumlah'))->toBe(1)
        ->and($respons->json('tamu.0.nama'))->toBe('Rara')
        ->and($respons->json('tamu.0.skor'))->toEqual(10.0);

    // Guru lain: bukan kuisnya, bukan nilainya (K-04).
    t04Masuk(User::factory()->guru()->create());
    $this->getJson("/api/v1/kuis/{$kuis->id}/tamu")->assertStatus(403);

    // Siswa tamu sendiri tidak membuka panel guru.
    t04MasukTamu('Rara');
    $this->getJson("/api/v1/kuis/{$kuis->id}/tamu")->assertStatus(403);
});

it('tamu tidak masuk peringkat kelas dan tidak boleh membuka layar peringkat', function (): void {
    $kuis = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuis);

    // Ranking dinyalakan supaya keterlihatan bukan alasan kosongnya daftar.
    t04Masuk($this->guru);
    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis', 'lingkup_id' => $kuis->id, 'kunci' => 'ranking', 'nilai' => true,
    ])->assertOk();

    // Murid kelas kuis ini mengerjakan lebih dulu.
    $muridKelas = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);
    t04Masuk($muridKelas->user);
    $attemptMurid = (int) $this->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated()->json('id');
    $this->postJson("/api/v1/attempt/{$attemptMurid}/kumpulkan", ['idempotency_key' => 'murid-kelas-1'])->assertOk();

    t04MasukTamu('Rara');
    $attemptTamu = (int) $this->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated()->json('id');
    $this->postJson("/api/v1/attempt/{$attemptTamu}/kumpulkan", ['idempotency_key' => 'tamu-rara-2'])->assertOk();

    // Tamu tidak membuka layar peringkat kelas …
    $this->getJson("/api/v1/kuis/{$kuis->id}/ranking")->assertStatus(403);

    // … dan barisnya tidak ikut masuk peringkat yang dilihat murid.
    t04Masuk($muridKelas->user);
    $respons = $this->getJson("/api/v1/kuis/{$kuis->id}/ranking")->assertOk();

    $nama = array_column((array) $respons->json('peringkat'), 'nama');

    expect($respons->json('tampil'))->toBeTrue()
        ->and($nama)->toBe([$muridKelas->user->name])
        ->and($nama)->not->toContain('Rara');
});

it('tamu tidak bisa mengerjakan kuis guru lain yang tidak dibuka, walau kuisnya sejenis', function (): void {
    // Batas kepemilikan guru (K-04) tidak boleh bocor lewat mode tamu: izin tamu
    // dibaca per kuis, bukan "ada kuis lain yang terbuka = semua terbuka".
    $guruLain = User::factory()->guru()->create();
    $kuisGuruLain = Kuis::factory()->untukSekolah($this->sekolah, $this->mapel, $this->kelas)
        ->milik($guruLain)->berjalan()->create();

    $kuisTerbuka = t04Kuis($this);
    t04SetIzin($this, $this->guru, $kuisTerbuka);

    t04MasukTamu('Rara');

    $this->getJson('/api/v1/kuis')->assertOk()->assertJsonCount(1);
    $this->postJson("/api/v1/kuis/{$kuisGuruLain->id}/mulai")->assertStatus(403);
});
