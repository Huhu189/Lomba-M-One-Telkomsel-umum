<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Question\Enums\TipeSoal;
use App\Sections\Question\Models\Soal;
use App\Sections\Question\Models\Tag;
use App\Sections\Question\Registry\RegistryTipeSoal;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
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
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6A', 'tingkat' => 6]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Matematika', 'kode' => 'MTK']);
    $this->guru = User::factory()->guru()->create();
});

/** Konten pilihan ganda valid untuk dipakai beberapa test. */
function kontenPilihanGanda(): array
{
    return [
        'teks' => 'Berapa hasil dari 4 + 5?',
        'opsi' => [
            ['id' => 'A', 'teks' => '8'],
            ['id' => 'B', 'teks' => '9'],
        ],
    ];
}

it('guru dapat menambah, mengubah, dan menghapus tag', function (): void {
    Sanctum::actingAs($this->guru);

    $buat = $this->postJson('/api/v1/tag', ['nama' => 'Pecahan', 'deskripsi' => 'Tema pecahan'])
        ->assertCreated()->assertJsonPath('nama', 'Pecahan');
    $id = (int) $buat->json('id');

    $this->putJson("/api/v1/tag/{$id}", ['nama' => 'Pecahan Sederhana'])
        ->assertOk()->assertJsonPath('nama', 'Pecahan Sederhana');

    $this->getJson('/api/v1/tag')->assertOk()->assertJsonCount(1);
    $this->deleteJson("/api/v1/tag/{$id}")->assertOk();
    expect(Tag::query()->whereKey($id)->exists())->toBeFalse();
});

it('nama tag harus unik di dalam satu sekolah', function (): void {
    Sanctum::actingAs($this->guru);

    $this->postJson('/api/v1/tag', ['nama' => 'Pecahan'])->assertCreated();
    $this->postJson('/api/v1/tag', ['nama' => 'Pecahan'])
        ->assertStatus(422)->assertJsonValidationErrors(['nama']);
});

it('guru membuat soal pilihan ganda dan melihat kuncinya di bank soal', function (): void {
    Sanctum::actingAs($this->guru);

    $buat = $this->postJson('/api/v1/soal', [
        'subject_id' => $this->mapel->id,
        'tipe' => 'pilihan_ganda',
        'konten' => kontenPilihanGanda(),
        'kunci' => ['jawaban' => 'B'],
        'skor' => 2,
    ])->assertCreated();

    expect($buat->json('tipe'))->toBe('pilihan_ganda')
        ->and($buat->json('kunci.jawaban'))->toBe('B')
        ->and($buat->json('mapel_nama'))->toBe('Matematika');

    // Bank soal memakai paginasi (bisa ratusan soal), jadi kuncinya ada di data[].
    $this->getJson('/api/v1/soal')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.kunci.jawaban', 'B')
        ->assertJsonPath('data.0.tipe_label', 'Pilihan ganda');
});

it('registry menolak struktur soal yang tidak lengkap', function (): void {
    Sanctum::actingAs($this->guru);

    $this->postJson('/api/v1/soal', [
        'subject_id' => $this->mapel->id,
        'tipe' => 'pilihan_ganda',
        'konten' => ['teks' => 'Soal tanpa opsi'],
        'kunci' => ['jawaban' => 'A'],
    ])->assertStatus(422)->assertJsonValidationErrors(['konten']);

    $this->postJson('/api/v1/soal', [
        'subject_id' => $this->mapel->id,
        'tipe' => 'pilihan_ganda',
        'konten' => kontenPilihanGanda(),
        'kunci' => ['jawaban' => 'Z'],
    ])->assertStatus(422)->assertJsonValidationErrors(['konten']);

    // Sejak slice 06 isian/uraian/letak/hubung kata sudah didukung; yang ditolak
    // adalah tipe yang tidak dikenal sama sekali.
    $this->postJson('/api/v1/soal', [
        'subject_id' => $this->mapel->id,
        'tipe' => 'entah_apa',
        'konten' => ['teks' => 'Ibu kota Indonesia?'],
        'kunci' => ['jawaban' => 'Jakarta'],
    ])->assertStatus(422)->assertJsonValidationErrors(['tipe']);

    // Kunci isian yang salah bentuk (tanpa jawaban_baku) tetap ditolak registry.
    $this->postJson('/api/v1/soal', [
        'subject_id' => $this->mapel->id,
        'tipe' => 'isian_singkat',
        'konten' => ['teks' => 'Ibu kota Indonesia?'],
        'kunci' => ['jawaban' => 'Jakarta'],
    ])->assertStatus(422)->assertJsonValidationErrors(['konten']);
});

it('media soal hanya boleh path internal atau host https yang diizinkan', function (): void {
    Sanctum::actingAs($this->guru);

    $dasar = [
        'subject_id' => $this->mapel->id,
        'tipe' => 'pilihan_ganda',
        'kunci' => ['jawaban' => 'B'],
    ];

    // Path internal aplikasi diterima (bentuk yang dipakai editor soal).
    $this->postJson('/api/v1/soal', [
        ...$dasar,
        'konten' => [...kontenPilihanGanda(), 'media' => '/media/lingkaran.png'],
    ])->assertCreated();

    // Host luar, skema http, data URI, dan javascript: ditolak: alamat pihak
    // ketiga membocorkan IP/Referer anak ke server lain (U-01).
    foreach ([
        'https://situs-luar.example/gambar.png',
        'http://situs-luar.example/gambar.png',
        '//situs-luar.example/gambar.png',
        'data:image/png;base64,AAAA',
        'javascript:alert(1)',
    ] as $nakal) {
        $this->postJson('/api/v1/soal', [
            ...$dasar,
            'konten' => [...kontenPilihanGanda(), 'media' => $nakal],
        ])->assertStatus(422)->assertJsonValidationErrors(['konten']);
    }

    // Host yang didaftarkan sekolah (CDN sendiri) tetap diterima lewat https.
    config(['media.hosts' => ['cdn.sekolah.test']]);

    $this->postJson('/api/v1/soal', [
        ...$dasar,
        'konten' => [...kontenPilihanGanda(), 'media' => 'https://cdn.sekolah.test/gambar.png'],
    ])->assertCreated();
});

it('penilai registry benar untuk empat jenis soal objektif', function (): void {
    $pilihanGanda = kontenPilihanGanda();

    expect(RegistryTipeSoal::nilai(TipeSoal::PilihanGanda, $pilihanGanda, ['jawaban' => 'B'], 'B'))->toBeTrue()
        ->and(RegistryTipeSoal::nilai(TipeSoal::PilihanGanda, $pilihanGanda, ['jawaban' => 'B'], 'A'))->toBeFalse()
        ->and(RegistryTipeSoal::nilai(TipeSoal::BenarSalah, [], ['benar' => true], true))->toBeTrue()
        ->and(RegistryTipeSoal::nilai(TipeSoal::BenarSalah, [], ['benar' => true], false))->toBeFalse()
        ->and(RegistryTipeSoal::nilai(
            TipeSoal::Menjodohkan,
            [],
            ['pasangan' => ['k1' => 'n1', 'k2' => 'n2']],
            ['k1' => 'n1', 'k2' => 'n2'],
        ))->toBeTrue()
        ->and(RegistryTipeSoal::nilai(
            TipeSoal::Menjodohkan,
            [],
            ['pasangan' => ['k1' => 'n1', 'k2' => 'n2']],
            ['k1' => 'n1', 'k2' => 'n1'],
        ))->toBeFalse()
        ->and(RegistryTipeSoal::nilai(TipeSoal::Mengurutkan, [], ['urutan' => ['a', 'b']], ['a', 'b']))->toBeTrue()
        ->and(RegistryTipeSoal::nilai(TipeSoal::Mengurutkan, [], ['urutan' => ['a', 'b']], ['b', 'a']))->toBeFalse();
});

it('penilai menjodohkan dan mengurutkan menolak jawaban berisi array tanpa melempar', function (): void {
    // Murid bisa mengirim jawaban berbentuk apa pun. Elemen berupa array dulu
    // dipaksa `(string)` sehingga PHP memunculkan warning "Array to string
    // conversion" yang Laravel ubah jadi ErrorException — soal jadi berstatus
    // gagal dan guru kebanjiran antrean tinjauan (Q-19). Jawaban bersalah
    // bentuk harus dinilai salah biasa, bukan melempar.
    expect(RegistryTipeSoal::nilai(
        TipeSoal::Menjodohkan,
        [],
        ['pasangan' => ['k1' => 'n1', 'k2' => 'n2']],
        ['k1' => ['nakal'], 'k2' => 'n2'],
    ))->toBeFalse()
        ->and(RegistryTipeSoal::nilai(
            TipeSoal::Mengurutkan,
            [],
            ['urutan' => ['a', 'b']],
            [['nakal'], 'b'],
        ))->toBeFalse()
        ->and(RegistryTipeSoal::nilai(
            TipeSoal::Mengurutkan,
            [],
            ['urutan' => ['a', 'b']],
            ['a', ['nakal']],
        ))->toBeFalse();
});

it('publikasi kuis ditolak bila belum lengkap', function (): void {
    Sanctum::actingAs($this->guru);

    $kuis = Kuis::factory()->untukSekolah($this->sekolah, $this->mapel, $this->kelas)->create();

    // Belum ada soal dan belum ada jadwal.
    $this->postJson("/api/v1/kuis/{$kuis->id}/publikasi")
        ->assertStatus(422)
        ->assertJsonValidationErrors(['soal', 'jadwal']);

    $soal = Soal::factory()->untukSekolah($this->sekolah, $this->mapel)->create();
    $this->putJson("/api/v1/kuis/{$kuis->id}/soal", ['soal' => [$soal->id]])->assertOk();

    // Sudah ada soal, jadwal masih kurang.
    $this->postJson("/api/v1/kuis/{$kuis->id}/publikasi")
        ->assertStatus(422)
        ->assertJsonValidationErrors(['jadwal']);

    $this->putJson("/api/v1/kuis/{$kuis->id}", [
        'judul' => 'Ulangan Matematika',
        'subject_id' => $this->mapel->id,
        'class_id' => $this->kelas->id,
        'durasi_menit' => 30,
        'mulai_at' => now()->addMinutes(5)->toIso8601String(),
        'selesai_at' => now()->addMinutes(65)->toIso8601String(),
    ])->assertOk();

    $this->postJson("/api/v1/kuis/{$kuis->id}/publikasi")
        ->assertOk()
        ->assertJsonPath('status', 'publikasi')
        ->assertJsonPath('jumlah_soal', 1);
});

it('soal terkunci saat kuis pemakainya sedang berjalan', function (): void {
    Sanctum::actingAs($this->guru);

    $soalTerpakai = Soal::factory()->untukSekolah($this->sekolah, $this->mapel)->create();
    $soalBebas = Soal::factory()->untukSekolah($this->sekolah, $this->mapel)->create();

    $kuis = Kuis::factory()->untukSekolah($this->sekolah, $this->mapel, $this->kelas)->berjalan()->create();
    $kuis->soal()->attach($soalTerpakai->id, ['urutan' => 1]);

    $this->putJson("/api/v1/soal/{$soalTerpakai->id}", [
        'subject_id' => $this->mapel->id,
        'tipe' => 'pilihan_ganda',
        'konten' => kontenPilihanGanda(),
        'kunci' => ['jawaban' => 'A'],
    ])->assertStatus(422)->assertJsonValidationErrors(['soal']);

    $this->deleteJson("/api/v1/soal/{$soalTerpakai->id}")
        ->assertStatus(422)->assertJsonValidationErrors(['soal']);

    // Susunan soal kuis yang sedang berjalan juga tidak boleh diubah.
    $this->putJson("/api/v1/kuis/{$kuis->id}/soal", ['soal' => [$soalBebas->id]])
        ->assertStatus(422)->assertJsonValidationErrors(['soal']);

    // Soal yang tidak dipakai kuis berjalan tetap bisa diubah.
    $this->putJson("/api/v1/soal/{$soalBebas->id}", [
        'subject_id' => $this->mapel->id,
        'tipe' => 'benar_salah',
        'konten' => ['teks' => '1 + 1 = 2.'],
        'kunci' => ['benar' => true],
    ])->assertOk()->assertJsonPath('tipe', 'benar_salah');

    expect($soalTerpakai->refresh()->kunci)->toBe(['jawaban' => 'B']);
});

it('murid melihat kuis terbit kelasnya tanpa kunci jawaban', function (): void {
    $murid = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);

    $soal = Soal::factory()->untukSekolah($this->sekolah, $this->mapel)->create();
    $kuis = Kuis::factory()->untukSekolah($this->sekolah, $this->mapel, $this->kelas)->berjalan()->create();
    $kuis->soal()->attach($soal->id, ['urutan' => 1]);

    // Kuis kelas lain dan kuis draf tidak boleh muncul.
    $kelasLain = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '5A', 'tingkat' => 5]);
    Kuis::factory()->untukSekolah($this->sekolah, $this->mapel, $kelasLain)->berjalan()->create();
    Kuis::factory()->untukSekolah($this->sekolah, $this->mapel, $this->kelas)->create();

    auth()->forgetGuards();
    Sanctum::actingAs($murid->user);

    $daftar = $this->getJson('/api/v1/kuis')->assertOk();
    expect($daftar->json())->toHaveCount(1)
        ->and($daftar->json('0.judul'))->toBe($kuis->judul)
        ->and($daftar->json('0.sedang_berjalan'))->toBeTrue();

    $detail = $this->getJson("/api/v1/kuis/{$kuis->id}")->assertOk();
    expect($detail->json('soal.0.konten.teks'))->toBe('Berapa hasil dari 2 + 3?')
        ->and($detail->json('soal.0'))->not->toHaveKey('kunci')
        ->and($detail->json('soal.0'))->not->toHaveKey('pembahasan');
    expect($detail->getContent())->not->toContain('"kunci"');

    // Bank soal guru tetap tertutup untuk murid.
    $this->getJson('/api/v1/soal')->assertStatus(403);
    $this->postJson('/api/v1/tag', ['nama' => 'Curang'])->assertStatus(403);
    $this->postJson('/api/v1/kuis', [
        'judul' => 'Kuis murid',
        'subject_id' => $this->mapel->id,
        'class_id' => $this->kelas->id,
        'durasi_menit' => 10,
    ])->assertStatus(403);
});

it('kuis draf dan kuis kelas lain tidak bisa dibuka murid', function (): void {
    $murid = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);

    $kelasLain = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '4A', 'tingkat' => 4]);
    $kuisDraf = Kuis::factory()->untukSekolah($this->sekolah, $this->mapel, $this->kelas)->create();
    $kuisKelasLain = Kuis::factory()->untukSekolah($this->sekolah, $this->mapel, $kelasLain)->berjalan()->create();

    auth()->forgetGuards();
    Sanctum::actingAs($murid->user);

    $this->getJson("/api/v1/kuis/{$kuisDraf->id}")->assertStatus(403);
    $this->getJson("/api/v1/kuis/{$kuisKelasLain->id}")->assertStatus(403);
});
