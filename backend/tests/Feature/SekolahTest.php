<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Database\Seeders\MasterDataSeeder;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
});

it('murid dapat membaca sekolah, kelas, dan mapel', function (): void {
    $this->seed(MasterDataSeeder::class);
    Sanctum::actingAs(User::factory()->muridAktif()->create());

    $this->getJson('/api/v1/sekolah')->assertOk()->assertJsonPath('nama', $this->sekolah->nama);
    $this->getJson('/api/v1/kelas')->assertOk()->assertJsonCount(3);
    $this->getJson('/api/v1/mapel')->assertOk()->assertJsonCount(3);
});

it('murid tidak boleh mengubah data induk (policy)', function (): void {
    Sanctum::actingAs(User::factory()->muridAktif()->create());

    $this->postJson('/api/v1/kelas', ['nama' => '1A', 'tingkat' => 1])->assertStatus(403);
    $this->postJson('/api/v1/mapel', ['nama' => 'Seni Budaya'])->assertStatus(403);
    $this->putJson('/api/v1/sekolah', ['nama' => 'Berubah'])->assertStatus(403);
});

it('guru dapat menambah, mengubah, dan menghapus kelas', function (): void {
    Sanctum::actingAs(User::factory()->guru()->create());

    $buat = $this->postJson('/api/v1/kelas', ['nama' => '4A', 'tingkat' => 4])->assertCreated();
    $id = (int) $buat->json('id');

    $this->putJson("/api/v1/kelas/{$id}", ['nama' => '4B', 'tingkat' => 4])
        ->assertOk()->assertJsonPath('nama', '4B');

    $this->deleteJson("/api/v1/kelas/{$id}")->assertOk();
    expect(Kelas::query()->whereKey($id)->exists())->toBeFalse();
});

it('guru dapat menambah, mengubah, dan menghapus mapel', function (): void {
    Sanctum::actingAs(User::factory()->guru()->create());

    $buat = $this->postJson('/api/v1/mapel', ['nama' => 'Seni Budaya', 'kode' => 'sbd'])
        ->assertCreated()->assertJsonPath('kode', 'SBD');
    $id = (int) $buat->json('id');

    $this->putJson("/api/v1/mapel/{$id}", ['nama' => 'Seni Musik', 'kode' => 'SBM'])
        ->assertOk()->assertJsonPath('nama', 'Seni Musik');

    $this->deleteJson("/api/v1/mapel/{$id}")->assertOk();
    expect(Mapel::query()->whereKey($id)->exists())->toBeFalse();
});

it('guru dapat menambah, mengubah, dan menghapus murid tunggal', function (): void {
    $kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6A', 'tingkat' => 6]);
    Sanctum::actingAs(User::factory()->guru()->create());

    $buat = $this->postJson('/api/v1/murid', [
        'nama' => 'Zaki Pratama',
        'email' => 'zaki@murid.test',
        'class_id' => $kelas->id,
        'nis' => '9001',
    ])->assertCreated();

    expect($buat->json('nama'))->toBe('Zaki Pratama')
        ->and($buat->json('kelas_nama'))->toBe('6A');

    $id = (int) $buat->json('id');
    // P-01: daftar murid berpaginasi, jadi barisnya ada di `data[]`.
    $this->getJson('/api/v1/murid')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.nama', 'Zaki Pratama');

    $this->putJson("/api/v1/murid/{$id}", [
        'nama' => 'Zaki Baru',
        'email' => 'zaki@murid.test',
        'class_id' => $kelas->id,
        'nis' => '9002',
    ])->assertOk()->assertJsonPath('nama', 'Zaki Baru');

    $this->deleteJson("/api/v1/murid/{$id}")->assertOk();
    expect(Murid::query()->whereKey($id)->exists())->toBeFalse();
});

it('daftar murid berpaginasi dan membatasi jumlah per halaman', function (): void {
    $kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6B', 'tingkat' => 6]);
    Murid::factory()->count(5)->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $kelas->id,
    ]);

    Sanctum::actingAs(User::factory()->guru()->create());

    // Halaman pertama: 2 dari 5, dan metadata total lengkap.
    $this->getJson('/api/v1/murid?per_page=2')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('meta.total', 5)
        ->assertJsonPath('meta.last_page', 3)
        ->assertJsonPath('meta.current_page', 1);

    // Halaman terakhir memuat sisanya.
    $this->getJson('/api/v1/murid?per_page=2&page=3')
        ->assertOk()
        ->assertJsonCount(1, 'data');

    // `per_page` besar dipangkas ke batas 200 supaya tak bisa diminta semua lagi.
    $this->getJson('/api/v1/murid?per_page=1000')
        ->assertOk()
        ->assertJsonPath('meta.per_page', 200);
});

it('pencarian murid menyaring satu sekolah: nama, NIS, NISN, dan email', function (): void {
    $kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6E', 'tingkat' => 6]);
    Sanctum::actingAs(User::factory()->guru()->create());

    $muridUji = [
        ['nama' => 'Rina Aulia', 'email' => 'rina.aulia@murid.test', 'nis' => '7001', 'nisn' => '0070011111'],
        ['nama' => 'Budi Santoso', 'email' => 'budi.santoso@murid.test', 'nis' => '7002', 'nisn' => '0070022222'],
        // Murid yang belum diberi NIS: pencarian nama harus tetap menemukannya.
        ['nama' => 'Citra Dewi', 'email' => 'citra.dewi@murid.test'],
    ];

    foreach ($muridUji as $data) {
        $this->postJson('/api/v1/murid', $data + ['class_id' => $kelas->id])->assertCreated();
    }

    // Nama: sebagian kata saja, dan tidak peduli huruf besar/kecil.
    $this->getJson('/api/v1/murid?filter[cari]=rina')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.nama', 'Rina Aulia')
        ->assertJsonPath('meta.total', 1);

    $this->getJson('/api/v1/murid?filter[cari]=AULIA')->assertOk()->assertJsonPath('meta.total', 1);

    // Email, NIS, dan NISN terjangkau dari kotak yang sama.
    $this->getJson('/api/v1/murid?filter[cari]=budi.santoso@')->assertOk()->assertJsonPath('meta.total', 1);
    $this->getJson('/api/v1/murid?filter[cari]=7002')->assertOk()->assertJsonPath('meta.total', 1);
    $this->getJson('/api/v1/murid?filter[cari]=0070011111')->assertOk()->assertJsonPath('meta.total', 1);
    $this->getJson('/api/v1/murid?filter[cari]=citra')->assertOk()->assertJsonPath('meta.total', 1);

    // Kata kunci tanpa hasil berarti kosong — bukan "tampilkan semuanya".
    $this->getJson('/api/v1/murid?filter[cari]=zzz')
        ->assertOk()
        ->assertJsonCount(0, 'data')
        ->assertJsonPath('meta.total', 0);

    // Pencarian digabung penyaring kelas yang sudah ada.
    $kelasLain = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6F', 'tingkat' => 6]);
    $this->getJson("/api/v1/murid?filter[class_id]={$kelasLain->id}&filter[cari]=rina")
        ->assertOk()
        ->assertJsonCount(0, 'data');

    $this->getJson("/api/v1/murid?filter[class_id]={$kelas->id}&filter[cari]=rina")
        ->assertOk()
        ->assertJsonPath('meta.total', 1);

    // `%` yang diketik guru di-escape: tidak boleh berubah jadi wildcard yang
    // mengembalikan seluruh murid.
    $this->getJson('/api/v1/murid?filter[cari]=%25')->assertOk()->assertJsonCount(0, 'data');

    // Kotak kosong = daftar seperti biasa, bukan pencarian spasi.
    $this->getJson('/api/v1/murid?filter[cari]=+++')->assertOk()->assertJsonPath('meta.total', 3);
});

it('pencarian tetap menemukan satu murid di antara ribuan dan tetap berpaginasi', function (): void {
    $kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6Z', 'tingkat' => 6]);

    // Lebih dari seribu murid: satu halaman mana pun tidak memuat semuanya, jadi
    // pencarian HARUS menyaring di server — bukan menelusuri baris yang tampil.
    Murid::factory()->count(1200)->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $kelas->id,
    ]);

    // Jarum: satu murid dengan nama & NIS yang khas di antara ribuan.
    $userJarum = User::factory()->muridAktif()->create(['name' => 'Zulfikar Nusantara']);
    Murid::factory()->untuk($this->sekolah, $kelas, $userJarum)->create([
        'nis' => 'ZUL-01',
        'nisn' => null,
    ]);

    Sanctum::actingAs(User::factory()->guru()->create());

    // Total > 1000, tetapi satu halaman tetap dibatasi (default 50).
    $this->getJson('/api/v1/murid')
        ->assertOk()
        ->assertJsonCount(50, 'data')
        ->assertJsonPath('meta.per_page', 50)
        ->assertJsonPath('meta.total', 1201);

    // Mencari jarum mengembalikan tepat satu baris walau ribuan lain ada.
    $this->getJson('/api/v1/murid?filter[cari]=zulfikar')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.nama', 'Zulfikar Nusantara');

    $this->getJson('/api/v1/murid?filter[cari]=ZUL-01')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('meta.total', 1);

    // 1201 baris = 24 halaman penuh + 1 sisa; halaman terakhir tetap memuat sisa.
    $this->getJson('/api/v1/murid?page=25')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('meta.last_page', 25);
});

it('validasi menolak tingkat di luar 1-6 dan nama kelas duplikat', function (): void {
    Sanctum::actingAs(User::factory()->guru()->create());

    $this->postJson('/api/v1/kelas', ['nama' => '1A', 'tingkat' => 9])
        ->assertStatus(422)->assertJsonValidationErrors(['tingkat']);

    $this->postJson('/api/v1/kelas', ['nama' => '1A', 'tingkat' => 1])->assertCreated();

    $this->postJson('/api/v1/kelas', ['nama' => '1A', 'tingkat' => 1])
        ->assertStatus(422)->assertJsonValidationErrors(['nama']);
});

it('penolakan nama kelas terbaca sebabnya dalam bahasa Indonesia', function (): void {
    Sanctum::actingAs(User::factory()->guru()->create());

    $this->postJson('/api/v1/kelas', ['nama' => '6A', 'tingkat' => 6])->assertCreated();

    // "6A" adalah nama contoh di formulir DAN nama yang sudah ada di data bawaan,
    // jadi penolakannya harus menyebut sebabnya serta jalan keluarnya. Sebelumnya
    // jawabannya "The nama has already been taken." — guru tidak tahu bahwa yang
    // salah cuma namanya, dan menyimpulkan halaman kelas rusak.
    $ulang = $this->postJson('/api/v1/kelas', ['nama' => '6A', 'tingkat' => 6])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['nama']);

    expect($ulang->json('errors.nama.0'))->toContain('sudah dipakai')
        ->and($ulang->json('message'))->not->toContain('already been taken');

    $tingkat = $this->postJson('/api/v1/kelas', ['nama' => '6C', 'tingkat' => 9])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['tingkat']);

    expect($tingkat->json('errors.tingkat.0'))->toContain('Tingkat kelas paling tinggi 6');

    // Nama yang belum dipakai tetap diterima walau percobaan sebelumnya gagal.
    $this->postJson('/api/v1/kelas', ['nama' => '6C', 'tingkat' => 6])->assertCreated();
});

it('permintaan tak terautentikasi ke API merespons 401 JSON walau Accept bukan JSON', function (): void {
    auth()->forgetGuards();

    $this->get('/api/v1/murid/ekspor', ['Accept' => 'text/csv'])
        ->assertStatus(401)
        ->assertJsonPath('message', 'Unauthenticated.');
});

it('guru dapat memperbarui data sekolah', function (): void {
    Sanctum::actingAs(User::factory()->guru()->create());

    $this->putJson('/api/v1/sekolah', ['nama' => 'SD Contoh Baru', 'tahun_ajaran' => '2026/2027'])
        ->assertOk()->assertJsonPath('nama', 'SD Contoh Baru');
});
