<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Material\Models\BlokMateri;
use App\Sections\Material\Models\Materi;
use App\Sections\Material\Models\UnggahanMateri;
use App\Sections\Material\Registry\TemaPerjalanan;
use App\Sections\Material\Services\MateriService;
use App\Sections\Question\Models\Tag;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

/*
|--------------------------------------------------------------------------
| Slice 12 — tema perjalanan materi (template tema video)
|--------------------------------------------------------------------------
|
| Yang diperiksa di sini adalah janji fiturnya ke guru dan ke murid:
|
| - katalog tema datang dari server (satu sumber kebenaran), bukan disalin klien;
| - guru boleh mengganti nama tema dan nama tiap pos, tapi tidak boleh mengarang
|   kode tema atau menunjuk video milik materi lain;
| - peta murid naik satu pos setiap bagian selesai, dan tingkat (kenaikan) ikut
|   persentase langkah wajib;
| - laporan guru memakai nama pos yang sama dengan yang dilihat anak.
|
*/

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '3A', 'tingkat' => 3]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Matematika', 'kode' => 'MAT']);
    $this->tag = Tag::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Penjumlahan']);
    $this->guru = User::factory()->guru()->create();
    $this->murid = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);
});

function m12Materi(object $ctx, string $judul = 'Perjalanan Kelas 3A'): Materi
{
    auth()->forgetGuards();
    Sanctum::actingAs($ctx->guru);

    $id = (int) test()->postJson('/api/v1/materi', [
        'judul' => $judul,
        'subject_id' => $ctx->mapel->id,
        'class_id' => $ctx->kelas->id,
        'tag_id' => $ctx->tag->id,
    ])->assertCreated()->json('id');

    return Materi::query()->findOrFail($id);
}

/**
 * Blok teks sederhana: cukup untuk menguji peta perjalanan tanpa mesin kuis.
 *
 * @param  array<int, array<string, mixed>>  $blok
 * @return TestResponse
 */
function m12Simpan(object $ctx, Materi $materi, array $blok, ?array $tema = null)
{
    auth()->forgetGuards();
    Sanctum::actingAs($ctx->guru);

    $muatan = ['blok' => $blok];

    if ($tema !== null) {
        $muatan['tema'] = $tema;
    }

    return test()->putJson("/api/v1/materi/{$materi->id}/blok", $muatan);
}

/**
 * Empat blok teks wajib berurutan — bahan uji kenaikan tingkat.
 */
function m12EmpatBlok(object $ctx, Materi $materi): void
{
    m12Simpan($ctx, $materi, [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Bagian satu.']],
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Bagian dua.']],
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Bagian tiga.']],
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Bagian empat.']],
    ])->assertOk();
}

/** Unggah satu berkas lewat jalur berpotongan; mengembalikan kodenya. */
function m12Unggah(object $ctx, Materi $materi, string $nama, string $isi): string
{
    auth()->forgetGuards();
    Sanctum::actingAs($ctx->guru);

    $mulai = test()->postJson("/api/v1/materi/{$materi->id}/unggahan", [
        'nama' => $nama,
        'ukuran' => strlen($isi),
    ])->assertCreated();

    $kode = (string) $mulai->json('kode');
    $ukuranPotongan = (int) config('material.chunk_byte');

    for ($indeks = 0; $indeks < (int) $mulai->json('jumlah_potongan'); $indeks++) {
        $bagian = substr($isi, $indeks * $ukuranPotongan, $ukuranPotongan);

        test()->putJson("/api/v1/unggahan/{$kode}/potongan/{$indeks}", [
            'isi_base64' => base64_encode($bagian),
            'hash' => hash('sha256', $bagian),
        ])->assertOk();
    }

    test()->postJson("/api/v1/unggahan/{$kode}/selesai")->assertOk();

    return $kode;
}

it('mengirim katalog tema dari server dan menolak tamu', function (): void {
    auth()->forgetGuards();

    $this->getJson('/api/v1/materi/tema')->assertUnauthorized();

    Sanctum::actingAs($this->guru);

    $respons = $this->getJson('/api/v1/materi/tema')->assertOk();

    expect($respons->json('bawaan'))->toBe(TemaPerjalanan::BAWAAN)
        ->and($respons->json('tema.0.kode'))->toBe('mendaki-gunung')
        ->and($respons->json('tema.0.nama'))->toBe('Mendaki Gunung')
        ->and($respons->json('tema.0.adegan'))->toBe('gunung')
        ->and($respons->json('tema.0.fase'))->toHaveCount(6)
        ->and($respons->json('tema.0.fase.0.nama'))->toBe('Basecamp')
        ->and($respons->json('tema.0.tingkat.3.nama'))->toBe('Penakluk Puncak')
        // Tema pilihan (putaran A.50): pelayaran harta karun & luar angkasa.
        ->and($respons->json('tema.1.kode'))->toBe('harta-karun')
        ->and($respons->json('tema.1.adegan'))->toBe('pulau')
        ->and($respons->json('tema.1.satuan'))->toBe('pos')
        ->and($respons->json('tema.1.fase'))->toHaveCount(6)
        ->and($respons->json('tema.1.fase.0.nama'))->toBe('Dermaga')
        ->and($respons->json('tema.1.tingkat.3.nama'))->toBe('Penemu Harta')
        ->and($respons->json('tema.2.kode'))->toBe('luar-angkasa')
        ->and($respons->json('tema.2.adegan'))->toBe('angkasa')
        ->and($respons->json('tema.2.fase.0.nama'))->toBe('Landasan Peluncuran')
        ->and($respons->json('tema.2.tingkat.3.nama'))->toBe('Penakluk Galaksi')
        // Pilihan "tanpa peta" ikut ditawarkan, tanpa fase dan tanpa tingkat.
        ->and($respons->json('tema.3.kode'))->toBe(TemaPerjalanan::TANPA)
        ->and($respons->json('tema.3.adegan'))->toBe('polos')
        ->and($respons->json('tema.3.satuan'))->toBe('bagian')
        ->and($respons->json('tema.3.fase'))->toHaveCount(0)
        ->and($respons->json('tema.3.tingkat'))->toHaveCount(0)
        // Katalog tidak menyentuh data murid/guru sama sekali.
        ->and($respons->json('murid'))->toBeNull();
});

it('menyimpan tema perjalanan beserta nama pos yang diganti guru', function (): void {
    $materi = m12Materi($this);

    $respons = m12Simpan($this, $materi, [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Pembuka.'], 'fase' => 'Basecamp Sekolah'],
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Isi.'], 'fase' => ''],
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Penutup.']],
    ], ['kode' => 'mendaki-gunung', 'nama' => 'Petualangan 3A']);

    expect($respons->json('perjalanan.nama'))->toBe('Petualangan 3A')
        ->and($respons->json('perjalanan.kode'))->toBe('mendaki-gunung')
        // Nama pos yang diganti guru ikut tersimpan; yang kosong tetap kosong
        // (server memakai nama bawaan tema saat menggambar peta).
        ->and($respons->json('blok.0.fase'))->toBe('Basecamp Sekolah')
        ->and($respons->json('blok.1.fase'))->toBeNull()
        ->and($respons->json('blok.2.fase'))->toBeNull();

    $ulang = $this->getJson("/api/v1/materi/{$materi->id}")->assertOk();

    expect($ulang->json('tema.nama'))->toBe('Petualangan 3A')
        ->and($ulang->json('tema.kode'))->toBe('mendaki-gunung')
        ->and($ulang->json('perjalanan.fase.1.nama'))->toBe('Jalur Pinus');

    // Sinkron tanpa `tema` tidak menghapus pilihan yang sudah ada (editor lama).
    m12Simpan($this, $materi, [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Saja.']],
    ])->assertOk()->assertJsonPath('perjalanan.nama', 'Petualangan 3A');

    // Nama tema kosong jatuh ke nama bawaan tema, bukan nama kosong.
    m12Simpan($this, $materi, [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Saja.']],
    ], ['kode' => 'mendaki-gunung', 'nama' => ''])->assertOk()
        ->assertJsonPath('perjalanan.nama', 'Mendaki Gunung');
});

it('menolak kode tema yang tidak ada di katalog', function (): void {
    $materi = m12Materi($this);

    m12Simpan($this, $materi, [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Satu.']],
    ], ['kode' => 'terbang-bulan', 'nama' => 'Terbang ke Bulan'])
        ->assertStatus(422)->assertJsonValidationErrors(['tema.kode']);

    // Materi tetap tanpa tema (belum tersimpan), bukan setengah tersimpan.
    expect(Materi::query()->findOrFail($materi->id)->tema)->toBeNull();
});

it('hanya memakai video latar milik materi ini', function (): void {
    $materi = m12Materi($this, 'Materi Punya Video');
    $lain = m12Materi($this, 'Materi Tanpa Video');

    // Video terdeteksi dari tanda `ftyp` di isi berkas, bukan dari nama kiriman.
    $kode = m12Unggah($this, $materi, 'latar.mp4', "\x00\x00\x00\x18ftypmp42".str_repeat('v', 400));

    expect(UnggahanMateri::query()->where('kode', $kode)->firstOrFail()->mime)->toBe('video/mp4');

    m12Simpan($this, $materi, [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Satu.']],
    ], ['kode' => 'mendaki-gunung', 'video_kode' => $kode])->assertOk()
        ->assertJsonPath('perjalanan.video_kode', $kode);

    // Materi lain tidak boleh meminjam berkas materi ini.
    m12Simpan($this, $lain, [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Satu.']],
    ], ['kode' => 'mendaki-gunung', 'video_kode' => $kode])->assertOk()
        ->assertJsonPath('perjalanan.video_kode', null);
});

it('menaikkan posisi dan tingkat murid satu per satu setiap bagian selesai', function (): void {
    $materi = m12Materi($this);
    m12EmpatBlok($this, $materi);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);
    $this->postJson("/api/v1/materi/{$materi->id}/publikasi")->assertOk();

    $blok = BlokMateri::query()->where('material_id', $materi->id)->orderBy('urutan')->get();

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $awal = $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertOk();

    // Peta mengikuti tema bawaan: nama pos pertama adalah nama fase pertama.
    expect($awal->json('perjalanan.nama'))->toBe('Mendaki Gunung')
        ->and($awal->json('perjalanan.adegan'))->toBe('gunung')
        ->and($awal->json('perjalanan.jumlah_langkah'))->toBe(4)
        ->and($awal->json('perjalanan.langkah.0.nama'))->toBe('Basecamp')
        ->and($awal->json('perjalanan.langkah.0.status'))->toBe('belum')
        ->and($awal->json('perjalanan.posisi'))->toBe(1)
        ->and($awal->json('perjalanan.persen'))->toBe(0)
        ->and($awal->json('perjalanan.tingkat.nama'))->toBe('Pendaki Pemula')
        ->and($awal->json('perjalanan.tingkat_berikut.sisa'))->toBe(25)
        ->and($awal->json('perjalanan.tuntas'))->toBeFalse();

    foreach ($blok as $indeks => $satu) {
        $this->postJson("/api/v1/materi/{$materi->id}/blok/{$satu->id}/buka")->assertOk();
        $this->postJson("/api/v1/materi/{$materi->id}/blok/{$satu->id}/selesai")->assertOk();

        $peta = $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertOk()->json('perjalanan');

        expect($peta['selesai'])->toBe($indeks + 1)
            ->and($peta['persen'])->toBe(($indeks + 1) * 25)
            ->and($peta['langkah'][$indeks]['selesai'])->toBeTrue();

        if ($indeks < count($blok) - 1) {
            expect($peta['posisi'])->toBe($indeks + 2)
                ->and($peta['tuntas'])->toBeFalse();
        }
    }

    $akhir = $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertOk()->json('perjalanan');

    expect($akhir['persen'])->toBe(100)
        ->and($akhir['tuntas'])->toBeTrue()
        ->and($akhir['tingkat']['nomor'])->toBe(4)
        ->and($akhir['tingkat']['nama'])->toBe('Penakluk Puncak')
        ->and($akhir['tingkat']['puncak'])->toBeTrue()
        ->and($akhir['tingkat_berikut'])->toBeNull()
        ->and($akhir['posisi'])->toBe(4);
});

it('mengabaikan langkah opsional saat menghitung kenaikan', function (): void {
    $materi = m12Materi($this);

    m12Simpan($this, $materi, [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Wajib satu.']],
        ['tipe' => 'teks', 'wajib' => false, 'isi' => ['teks' => 'Bonus.']],
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Wajib dua.']],
    ])->assertOk();

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);
    $this->postJson("/api/v1/materi/{$materi->id}/publikasi")->assertOk();

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    // Langkah opsional tampil di peta (jalan pintas) walau tidak dihitung.
    $peta = $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertOk()->json('perjalanan');

    expect($peta['jumlah_langkah'])->toBe(3)
        ->and($peta['total'])->toBe(2)
        ->and($peta['langkah'][1]['wajib'])->toBeFalse()
        ->and($peta['persen'])->toBe(0);
});

it('laporan guru memakai nama pos dan tingkat yang sama dengan peta murid', function (): void {
    $materi = m12Materi($this);

    m12Simpan($this, $materi, [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Satu.'], 'fase' => 'Pos Pemberangkatan'],
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Dua.']],
    ], ['kode' => 'mendaki-gunung', 'nama' => 'Ekspedisi 3A'])->assertOk();

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);
    $this->postJson("/api/v1/materi/{$materi->id}/publikasi")->assertOk();

    $blok = BlokMateri::query()->where('material_id', $materi->id)->orderBy('urutan')->firstOrFail();

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok->id}/buka")->assertOk();
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok->id}/selesai")->assertOk();

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $laporan = $this->getJson("/api/v1/materi/{$materi->id}/laporan")->assertOk();

    expect($laporan->json('perjalanan.nama'))->toBe('Ekspedisi 3A')
        ->and($laporan->json('perjalanan.langkah.0.nama'))->toBe('Pos Pemberangkatan')
        ->and($laporan->json('perjalanan.langkah.1.nama'))->toBe('Jalur Pinus')
        ->and($laporan->json('murid.0.perjalanan.posisi'))->toBe(2)
        ->and($laporan->json('murid.0.perjalanan.selesai'))->toBe(1)
        ->and($laporan->json('murid.0.perjalanan.total'))->toBe(2)
        ->and($laporan->json('murid.0.perjalanan.persen'))->toBe(50)
        ->and($laporan->json('murid.0.perjalanan.tingkat_nama'))->toBe('Pendaki Terlatih')
        ->and($laporan->json('murid.0.perjalanan.langkah_aktif'))->toBe('Jalur Pinus')
        // Skor latihan tetap seperti sebelumnya (bukan bagian tema perjalanan).
        ->and($laporan->json('murid.0.skor_latihan_maksimal'))->toBe(0);
});

it('membiarkan materi berjalan tanpa peta (daftar bagian biasa)', function (): void {
    $materi = m12Materi($this, 'Materi Tanpa Peta');

    m12Simpan($this, $materi, [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Satu.']],
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Dua.']],
    ], ['kode' => TemaPerjalanan::TANPA, 'nama' => ''])->assertOk()
        ->assertJsonPath('perjalanan.tanpa', true)
        ->assertJsonPath('perjalanan.satuan', 'bagian')
        ->assertJsonPath('perjalanan.adegan', 'polos')
        ->assertJsonPath('perjalanan.tingkat', [])
        // Nama tema tetap terisi supaya guru tidak melihat nama kosong.
        ->assertJsonPath('perjalanan.nama', 'Tanpa tema');

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);
    $this->postJson("/api/v1/materi/{$materi->id}/publikasi")->assertOk();

    $blok = BlokMateri::query()->where('material_id', $materi->id)->orderBy('urutan')->firstOrFail();

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $peta = $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertOk()->json('perjalanan');

    expect($peta['tanpa'])->toBeTrue()
        ->and($peta['satuan'])->toBe('bagian')
        ->and($peta['jumlah_langkah'])->toBe(2)
        // Nama langkah memakai satuan tema, bukan "Pos n".
        ->and($peta['langkah'][0]['nama'])->toBe('Bagian 1')
        ->and($peta['langkah'][1]['nama'])->toBe('Bagian 2')
        ->and($peta['total'])->toBe(2)
        // Tanpa tingkat: tidak ada kenaikan maupun janji tingkat berikutnya.
        ->and($peta['tingkat']['nomor'])->toBe(1)
        ->and($peta['tingkat']['nama'])->toBe('')
        ->and($peta['tingkat']['puncak'])->toBeFalse()
        ->and($peta['tingkat_berikut'])->toBeNull()
        ->and($peta['video_url'])->toBeNull();

    // Bagian tetap bisa dituntaskan seperti biasa; yang hilang hanya petanya.
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok->id}/buka")->assertOk();
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok->id}/selesai")->assertOk();

    $maju = $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertOk()->json('perjalanan');

    expect($maju['selesai'])->toBe(1)
        ->and($maju['persen'])->toBe(50)
        ->and($maju['posisi'])->toBe(2)
        ->and($maju['tuntas'])->toBeFalse();

    // Laporan guru ikut menandai materi ini tanpa peta.
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $laporan = $this->getJson("/api/v1/materi/{$materi->id}/laporan")->assertOk();

    expect($laporan->json('perjalanan.tanpa'))->toBeTrue()
        ->and($laporan->json('perjalanan.satuan'))->toBe('bagian')
        ->and($laporan->json('perjalanan.langkah.1.nama'))->toBe('Bagian 2')
        ->and($laporan->json('murid.0.perjalanan.tingkat_nama'))->toBe('')
        ->and($laporan->json('murid.0.perjalanan.langkah_aktif'))->toBe('Bagian 2')
        ->and($laporan->json('murid.0.perjalanan.posisi'))->toBe(2);
});

it('menolak murid yang mencoba mengganti tema materi', function (): void {
    $materi = m12Materi($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $this->putJson("/api/v1/materi/{$materi->id}/blok", [
        'blok' => [['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Nakal.']]],
        'tema' => ['kode' => 'mendaki-gunung', 'nama' => 'Punya Murid'],
    ])->assertForbidden();

    expect(Materi::query()->findOrFail($materi->id)->tema)->toBeNull();
});

it('memotong nama pos yang terlalu panjang alih-alih menolak seluruh susunan', function (): void {
    $materi = m12Materi($this);

    // Form request menolak nama fase > 40 karakter (batas keras di API)…
    m12Simpan($this, $materi, [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Satu.'],
            'fase' => str_repeat('a', TemaPerjalanan::MAKS_LANGKAH + 1)],
    ])->assertStatus(422)->assertJsonValidationErrors(['blok.0.fase']);

    // …dan service tetap memangkas nama yang lolos batas (pertahanan berlapis).
    $layanan = app(MateriService::class);
    $data = ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Satu.'], 'fase' => str_repeat('b', 80)];

    $layanan->sinkronBlok($materi, [$data]);

    $blok = BlokMateri::query()->where('material_id', $materi->id)->firstOrFail();

    expect(mb_strlen((string) $blok->isi['fase']))->toBe(TemaPerjalanan::MAKS_LANGKAH);
});
