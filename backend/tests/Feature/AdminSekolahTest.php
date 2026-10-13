<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Attempt\Enums\JenisAttempt;
use App\Sections\Attempt\Enums\StatusAttempt;
use App\Sections\Auth\Enums\UserStatus;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use App\Sections\Scoring\Services\TokenKonfirmasiService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

/*
|--------------------------------------------------------------------------
| Panel admin sekolah (14 Okt 2026)
|--------------------------------------------------------------------------
|
| Admin sekolah mendapat dua hal yang sebelumnya tidak ada: dasbor skala sekolah
| (berapa murid/guru yang benar-benar aktif, berapa ulangan berjalan) dan jalur
| memperbaiki akun guru/murid — email salah ketik, sandi lupa — tanpa menunggu
| email reset yang sering tidak sampai ke orang tua murid SD.
|
| Karena jalur kedua menyentuh cara orang masuk, ujinya mengunci pagar mutasi
| sensitif: hanya admin, bukan akunnya sendiri, bukan admin lain, wajib alasan,
| token sekali pakai yang terikat sasaran, audit append-only, dan sandi baru
| tidak pernah kembali di respons.
|
*/

it('admin melihat dasbor skala sekolah', function (): void {
    $sekolah = Sekolah::factory()->create();
    $kelas = Kelas::factory()->untukSekolah($sekolah)->create(['nama' => 'Kelas 5A']);

    $guru = User::factory()->guru()->create();

    $murid = User::factory()->muridAktif()->create();
    Murid::factory()->untuk($sekolah, $kelas, $murid)->create();

    // Akun murid yang belum diverifikasi tidak dihitung "aktif" walau profilnya ada.
    $pending = User::factory()->create();
    Murid::factory()->untuk($sekolah, $kelas, $pending)->create();

    $kuis = Kuis::factory()->untukSekolah($sekolah, null, $kelas)->berjalan()->milik($guru)
        ->create(['judul' => 'Ulangan Matematika']);

    DB::table('attempts')->insert([
        'school_id' => $sekolah->getKey(),
        'quiz_id' => $kuis->getKey(),
        'student_id' => $murid->id,
        'jenis' => JenisAttempt::Ulangan->value,
        'attempt_no' => 1,
        'status' => StatusAttempt::Berjalan->value,
        'aktif' => true,
        'seed' => 1,
        'mulai_at' => now()->subMinutes(5),
        'deadline_at' => now()->addMinutes(25),
        'jumlah_soal' => 10,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    Sanctum::actingAs(User::factory()->admin()->create());

    $this->getJson('/api/v1/admin/monitor')
        ->assertOk()
        // Dua baris `students` ada, tetapi hanya satu akunnya benar-benar aktif.
        ->assertJsonPath('murid.total', 2)
        ->assertJsonPath('murid.aktif', 1)
        ->assertJsonPath('murid.mengerjakan', 1)
        ->assertJsonPath('murid.belum_verifikasi', 1)
        ->assertJsonPath('guru.total', 1)
        ->assertJsonPath('guru.aktif', 1)
        ->assertJsonPath('kuis.aktif', 1)
        ->assertJsonPath('kuis.attempt_hari_ini', 1)
        ->assertJsonPath('kuis_berjalan.0.judul', 'Ulangan Matematika')
        ->assertJsonPath('kelas.total', 1)
        ->assertJsonPath('kelas.daftar.0.jumlah_murid', 2)
        // Kartu angka selalu delapan dan berisi kunci yang dipakai dasbor.
        ->assertJsonCount(8, 'angka');

    $kartu = collect($this->getJson('/api/v1/admin/monitor')->json('angka'))->keyBy('kunci');

    expect($kartu['murid_aktif']['nilai'])->toBe(1)
        ->and($kartu['guru_aktif']['nilai'])->toBe(1)
        ->and($kartu['kuis_aktif']['nilai'])->toBe(1);
});

it('guru dan murid ditolak dari panel admin', function (): void {
    Sanctum::actingAs(User::factory()->guru()->create());

    $this->getJson('/api/v1/admin/monitor')->assertForbidden();
    $this->getJson('/api/v1/admin/akun')->assertForbidden();

    Sanctum::actingAs(User::factory()->muridAktif()->create());

    $this->getJson('/api/v1/admin/monitor')->assertForbidden();
    $this->getJson('/api/v1/admin/akun')->assertForbidden();
});

it('daftar akun memuat guru & murid, bukan admin dan bukan siswa tamu', function (): void {
    $sekolah = Sekolah::factory()->create();
    $kelas = Kelas::factory()->untukSekolah($sekolah)->create(['nama' => 'Kelas 5A']);

    $admin = User::factory()->admin()->create();
    User::factory()->guru()->create(['name' => 'Bu Rina']);

    $murid = User::factory()->muridAktif()->create(['name' => 'Ana']);
    Murid::factory()->untuk($sekolah, $kelas, $murid)->create(['nis' => '1001']);

    User::factory()->tamu()->muridAktif()->create(['name' => 'Siswa Tamu']);

    Sanctum::actingAs($admin);

    $respons = $this->getJson('/api/v1/admin/akun?sort=name')->assertOk();

    expect($respons->json('meta.total'))->toBe(2);

    $nama = array_column($respons->json('data'), 'nama');

    expect($nama)->toContain('Bu Rina')
        ->and($nama)->toContain('Ana')
        // Akun admin tidak dikelola dari panel ini (AkunSekolahPolicy).
        ->and($nama)->not->toContain($admin->name)
        // Siswa tamu tidak punya kata sandi dan tidak pernah dipakai masuk.
        ->and($nama)->not->toContain('Siswa Tamu');

    $ano = collect($respons->json('data'))->firstWhere('nama', 'Ana');

    expect($ano['kelas_nama'])->toBe('Kelas 5A')
        ->and($ano['nis'])->toBe('1001')
        ->and($ano['peran_label'])->toBe('Murid')
        ->and($ano['status_label'])->toBe('Aktif')
        // Tanpa kolom sensitif apa pun.
        ->and($ano)->not->toHaveKey('password')
        ->and($ano)->not->toHaveKey('remember_token');
});

it('daftar akun bisa disaring per peran dan dicari nama/email', function (): void {
    User::factory()->guru()->create(['name' => 'Bu Rina', 'email' => 'rina@sekolah.test']);
    User::factory()->guru()->create(['name' => 'Pak Budi', 'email' => 'budi@sekolah.test']);
    User::factory()->muridAktif()->create(['name' => 'Ana', 'email' => 'ana@sekolah.test']);

    Sanctum::actingAs(User::factory()->admin()->create());

    $this->getJson('/api/v1/admin/akun?filter[role]=guru')
        ->assertOk()
        ->assertJsonPath('meta.total', 2);

    $this->getJson('/api/v1/admin/akun?filter[cari]=rina')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.nama', 'Bu Rina');

    $this->getJson('/api/v1/admin/akun?filter[cari]=ana@sekolah.test')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.nama', 'Ana');

    // Status akun juga bisa disaring (dipakai dasbor untuk melihat akun ditangguhkan).
    $this->getJson('/api/v1/admin/akun?filter[status]=suspended')
        ->assertOk()
        ->assertJsonPath('meta.total', 0);

    expect($this->getJson('/api/v1/admin/akun?filter[cari]=%25')->json('meta.total'))->toBe(0);
});

it('admin mengubah email guru lewat token konfirmasi sekali pakai', function (): void {
    $admin = User::factory()->admin()->create();
    $guru = User::factory()->guru()->create(['email' => 'salah.ketik@sekolah.test']);

    Sanctum::actingAs($admin);

    $token = $this->postJson("/api/v1/admin/akun/{$guru->id}/token", [
        'alasan' => 'Email guru salah ketik saat undangan akun',
    ])->assertOk()->json('token');

    expect($token)->toBeString()->not->toBe('');

    $this->putJson("/api/v1/admin/akun/{$guru->id}/email", [
        'email' => 'Guru.Benar@Sekolah.Test',
        'alasan' => 'Email guru salah ketik saat undangan akun',
        'token' => $token,
    ])->assertOk()
        ->assertJsonPath('akun.email', 'guru.benar@sekolah.test')
        ->assertJsonPath('akun.terverifikasi', true);

    $segar = $guru->fresh();

    // Email dinormalkan ke huruf kecil dan langsung dianggap terverifikasi:
    // admin sekolah sudah memastikan alamatnya, dan membiarkannya belum
    // terverifikasi akan mengunci akun itu dari semua jalur masuk.
    expect($segar->email)->toBe('guru.benar@sekolah.test')
        ->and($segar->hasVerifiedEmail())->toBeTrue();

    // Audit append-only: siapa, apa, dan alasannya.
    $this->assertDatabaseHas('activity_log', [
        'log_name' => 'kelola_akun',
        'event' => 'email',
        'causer_id' => $admin->id,
        'subject_id' => $guru->id,
    ]);

    // Token sekali pakai: percobaan kedua ditolak.
    $this->putJson("/api/v1/admin/akun/{$guru->id}/email", [
        'email' => 'lain@sekolah.test',
        'alasan' => 'Percobaan memakai ulang token',
        'token' => $token,
    ])->assertStatus(422)->assertJsonValidationErrors(['token']);

    expect($guru->fresh()->email)->toBe('guru.benar@sekolah.test');
});

it('token milik akun lain tidak bisa dipakai untuk sasaran berbeda', function (): void {
    $admin = User::factory()->admin()->create();
    $muridA = User::factory()->muridAktif()->create(['email' => 'a@sekolah.test']);
    $muridB = User::factory()->muridAktif()->create(['email' => 'b@sekolah.test']);

    Sanctum::actingAs($admin);

    $token = $this->postJson("/api/v1/admin/akun/{$muridA->id}/token", [
        'alasan' => 'Perbaiki email murid pertama',
    ])->json('token');

    $this->putJson("/api/v1/admin/akun/{$muridB->id}/email", [
        'email' => 'b.baru@sekolah.test',
        'alasan' => 'Perbaiki email murid pertama',
        'token' => $token,
    ])->assertStatus(422)->assertJsonValidationErrors(['token']);

    expect($muridB->fresh()->email)->toBe('b@sekolah.test');
});

it('email yang sudah dipakai akun lain ditolak', function (): void {
    $admin = User::factory()->admin()->create();
    User::factory()->muridAktif()->create(['email' => 'sudah.dipakai@sekolah.test']);
    $murid = User::factory()->muridAktif()->create();

    Sanctum::actingAs($admin);

    $token = $this->postJson("/api/v1/admin/akun/{$murid->id}/token", [
        'alasan' => 'Ganti email murid ke email yang sudah dipakai',
    ])->json('token');

    $this->putJson("/api/v1/admin/akun/{$murid->id}/email", [
        'email' => 'sudah.dipakai@sekolah.test',
        'alasan' => 'Ganti email murid ke email yang sudah dipakai',
        'token' => $token,
    ])->assertStatus(422)->assertJsonValidationErrors(['email']);
});

it('alasan wajib dan minimal 10 karakter di setiap langkah', function (): void {
    $admin = User::factory()->admin()->create();
    $murid = User::factory()->muridAktif()->create();

    Sanctum::actingAs($admin);

    $this->postJson("/api/v1/admin/akun/{$murid->id}/token", [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['alasan']);

    $this->postJson("/api/v1/admin/akun/{$murid->id}/token", ['alasan' => 'pendek'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['alasan']);

    // Alasan terlalu pendek juga ditolak saat token dipakai — bukan hanya saat diminta.
    $token = $this->postJson("/api/v1/admin/akun/{$murid->id}/token", [
        'alasan' => 'Alasan yang cukup panjang',
    ])->json('token');

    $this->putJson("/api/v1/admin/akun/{$murid->id}/status", [
        'status' => 'suspended',
        'alasan' => 'pendek',
        'token' => $token,
    ])->assertStatus(422)->assertJsonValidationErrors(['alasan']);
});

it('setel ulang sandi mengubah sandi, mengakhiri sesi, dan tidak membocorkan sandi', function (): void {
    // Driver sesi produksi (database) supaya pembersihan sesi benar-benar jalan.
    config()->set('session.driver', 'database');

    $admin = User::factory()->admin()->create();
    $murid = User::factory()->muridAktif()->create(['password' => 'sandi-lama-aman-10']);

    DB::table('sessions')->insert([
        ['id' => 'sesi-lab-murid', 'user_id' => $murid->getKey(), 'payload' => '', 'last_activity' => now()->timestamp],
        ['id' => 'sesi-orang-lain', 'user_id' => null, 'payload' => '', 'last_activity' => now()->timestamp],
    ]);

    Sanctum::actingAs($admin);

    $token = $this->postJson("/api/v1/admin/akun/{$murid->id}/token", [
        'alasan' => 'Murid lupa sandi, minta disetel ulang',
    ])->json('token');

    $respons = $this->putJson("/api/v1/admin/akun/{$murid->id}/sandi", [
        'password' => 'sandi-baru-aman-10',
        'password_confirmation' => 'sandi-baru-aman-10',
        'alasan' => 'Murid lupa sandi, minta disetel ulang',
        'token' => $token,
    ])->assertOk();

    // Sandi baru tidak pernah dikembalikan ke klien.
    $respons->assertJsonMissing(['sandi-baru-aman-10']);

    expect(Hash::check('sandi-baru-aman-10', (string) $murid->fresh()->password))->toBeTrue()
        ->and(Hash::check('sandi-lama-aman-10', (string) $murid->fresh()->password))->toBeFalse();

    // Sesi akun itu diakhiri (termasuk sesi lab tempat sandi lama mungkin tercecer),
    // sedangkan sesi pengguna lain tidak tersentuh.
    expect(DB::table('sessions')->pluck('id')->all())->toBe(['sesi-orang-lain']);

    // Audit tidak memuat sandi, lama maupun baru.
    $properti = (string) DB::table('activity_log')->where('event', 'sandi')->value('properties');

    expect($properti)->not->toContain('sandi-baru-aman-10')
        ->and($properti)->not->toContain('sandi-lama-aman-10');
});

it('sandi baru minimal 10 karakter dan harus diketik dua kali', function (): void {
    $admin = User::factory()->admin()->create();
    $murid = User::factory()->muridAktif()->create();

    Sanctum::actingAs($admin);

    $token = $this->postJson("/api/v1/admin/akun/{$murid->id}/token", [
        'alasan' => 'Setel ulang sandi untuk uji validasi',
    ])->json('token');

    $this->putJson("/api/v1/admin/akun/{$murid->id}/sandi", [
        'password' => 'pendek',
        'password_confirmation' => 'pendek',
        'alasan' => 'Setel ulang sandi untuk uji validasi',
        'token' => $token,
    ])->assertStatus(422)->assertJsonValidationErrors(['password']);

    $this->putJson("/api/v1/admin/akun/{$murid->id}/sandi", [
        'password' => 'sandi-baru-aman-10',
        'password_confirmation' => 'beda-sekali-aman-10',
        'alasan' => 'Setel ulang sandi untuk uji validasi',
        'token' => $token,
    ])->assertStatus(422)->assertJsonValidationErrors(['password']);
});

it('penangguhan akun berlaku seketika dan bisa diaktifkan kembali', function (): void {
    config()->set('session.driver', 'database');

    $admin = User::factory()->admin()->create();
    $murid = User::factory()->muridAktif()->create();

    DB::table('sessions')->insert([
        ['id' => 'sesi-murid', 'user_id' => $murid->getKey(), 'payload' => '', 'last_activity' => now()->timestamp],
    ]);

    Sanctum::actingAs($admin);

    $alasan = 'Murid memakai akun teman saat ulangan';

    $token = $this->postJson("/api/v1/admin/akun/{$murid->id}/token", ['alasan' => $alasan])->json('token');

    $this->putJson("/api/v1/admin/akun/{$murid->id}/status", [
        'status' => 'suspended',
        'alasan' => $alasan,
        'token' => $token,
    ])->assertOk()->assertJsonPath('akun.status', 'suspended');

    expect($murid->fresh()->status)->toBe(UserStatus::Suspended)
        ->and(DB::table('sessions')->count())->toBe(0);

    $tokenAktif = $this->postJson("/api/v1/admin/akun/{$murid->id}/token", [
        'alasan' => 'Pemeriksaan selesai, akun diaktifkan lagi',
    ])->json('token');

    $this->putJson("/api/v1/admin/akun/{$murid->id}/status", [
        'status' => 'aktif',
        'alasan' => 'Pemeriksaan selesai, akun diaktifkan lagi',
        'token' => $tokenAktif,
    ])->assertOk()->assertJsonPath('akun.status', 'aktif');
});

it('status di luar aktif/ditangguhkan ditolak', function (): void {
    $admin = User::factory()->admin()->create();
    $murid = User::factory()->muridAktif()->create();

    Sanctum::actingAs($admin);

    $this->putJson("/api/v1/admin/akun/{$murid->id}/status", [
        'status' => 'dihapus',
        'alasan' => 'Mencoba menghapus akun dari satu tombol',
        'token' => 'token-apa-saja',
    ])->assertStatus(422)->assertJsonValidationErrors(['status']);

    expect($murid->fresh()->status)->toBe(UserStatus::Aktif);
});

it('admin tidak bisa menyentuh akunnya sendiri atau admin lain', function (): void {
    $admin = User::factory()->admin()->create();
    $adminLain = User::factory()->admin()->create();

    Sanctum::actingAs($admin);

    $this->postJson("/api/v1/admin/akun/{$admin->id}/token", [
        'alasan' => 'Mencoba mengubah akun sendiri',
    ])->assertForbidden();

    $this->putJson("/api/v1/admin/akun/{$adminLain->id}/status", [
        'status' => 'suspended',
        'alasan' => 'Mencoba menangguhkan admin lain',
        'token' => 'token-apa-saja',
    ])->assertForbidden();

    expect($adminLain->fresh()->status)->toBe(UserStatus::Aktif);
});

it('akun siswa tamu tidak bisa dikelola dari panel admin', function (): void {
    $admin = User::factory()->admin()->create();
    $tamu = User::factory()->tamu()->muridAktif()->create();

    Sanctum::actingAs($admin);

    $this->postJson("/api/v1/admin/akun/{$tamu->id}/token", [
        'alasan' => 'Mencoba menyetel sandi akun tamu',
    ])->assertForbidden();
});

it('token untuk tujuan lain tidak diterima di jalur kelola akun', function (): void {
    $admin = User::factory()->admin()->create();
    $murid = User::factory()->muridAktif()->create();

    Sanctum::actingAs($admin);

    // Token koreksi nilai untuk sasaran yang sama tidak boleh membuka jalur akun.
    $asing = app(TokenKonfirmasiService::class)->terbitkan(
        $admin,
        TokenKonfirmasiService::TUJUAN_KOREKSI,
        ['sasaran_id' => $murid->getKey()],
    );

    $this->putJson("/api/v1/admin/akun/{$murid->id}/status", [
        'status' => 'suspended',
        'alasan' => 'Percobaan memakai token tujuan lain',
        'token' => $asing['token'],
    ])->assertStatus(422)->assertJsonValidationErrors(['token']);

    expect($murid->fresh()->status)->toBe(UserStatus::Aktif);
});
