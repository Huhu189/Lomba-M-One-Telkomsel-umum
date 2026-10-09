<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Attempt\Jobs\SapuUnggahanJawabanYatim;
use App\Sections\Attempt\Models\UnggahanJawaban;
use App\Sections\Attempt\Services\PenyimpananJawaban;
use App\Sections\Question\Models\Soal;
use App\Sections\Question\Models\Tag;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Enums\LingkupPengaturan;
use App\Sections\Settings\Services\PengaturanService;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '4A', 'tingkat' => 4]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'IPA', 'kode' => 'IPA']);
    $this->tag = Tag::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Fotosintesis']);
    $this->guru = User::factory()->guru()->create();
    $this->murid = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);
});

/** PNG asli (bukan magic bytes palsu) supaya encode ulang GD benar-benar diuji. */
function m09Png(int $lebar = 320, int $tinggi = 240): string
{
    $gambar = imagecreatetruecolor($lebar, $tinggi);
    $warna = imagecolorallocate($gambar, 30, 90, 160);
    imagefilledrectangle($gambar, 0, 0, $lebar, $tinggi, $warna);

    ob_start();
    imagepng($gambar);
    $isi = (string) ob_get_clean();
    imagedestroy($gambar);

    return $isi;
}

/** Soal uraian lewat API (lampiran foto paling masuk akal di soal uraian). */
function m09Soal(object $ctx, string $tipe = 'uraian'): Soal
{
    auth()->forgetGuards();
    Sanctum::actingAs($ctx->guru);

    $id = (int) test()->postJson('/api/v1/soal', [
        'subject_id' => $ctx->mapel->id,
        'tag_id' => $ctx->tag->id,
        'tipe' => $tipe,
        'konten' => ['teks' => 'Tuliskan proses fotosintesis lalu foto pekerjaanmu.'],
        'kunci' => ['kata_kunci' => [['teks' => 'klorofil']]],
        'skor' => 4,
    ])->assertCreated()->json('id');

    return Soal::query()->findOrFail($id);
}

function m09Kuis(object $ctx, Soal $soal, int $durasiMenit = 30): Kuis
{
    // Kuis milik guru yang sedang masuk (K-04); soalnya dibuat lewat API sebagai
    // guru itu sendiri, jadi sudah ber-pemilik.
    $kuis = Kuis::factory()->untukSekolah($ctx->sekolah, $ctx->mapel, $ctx->kelas)
        ->milik($ctx->guru)->berjalan()->create([
            'durasi_menit' => $durasiMenit,
            'acak_soal' => false,
            'acak_opsi' => false,
        ]);

    $kuis->soal()->attach($soal->id, ['urutan' => 1]);

    return $kuis->refresh();
}

/**
 * Mulai attempt murid lalu kembalikan id attempt + id soalnya.
 *
 * @return array{attempt: int, soal: int, kuis: Kuis}
 */
function m09Attempt(object $ctx, int $durasiMenit = 30): array
{
    $soal = m09Soal($ctx);
    $kuis = m09Kuis($ctx, $soal, $durasiMenit);

    auth()->forgetGuards();
    Sanctum::actingAs($ctx->murid->user);

    $respons = test()->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated();

    return ['attempt' => (int) $respons->json('id'), 'soal' => $soal->id, 'kuis' => $kuis];
}

/**
 * Unggah lampiran lengkap (semua potongan + gabung).
 *
 * @return array{kode: string, respons: TestResponse}
 */
function m09Unggah(
    object $ctx,
    int $attemptId,
    int $soalId,
    string $isi,
    string $jenis = 'gambar',
    string $nama = 'jawaban.png',
    ?int $durasi = null,
): array {
    auth()->forgetGuards();
    Sanctum::actingAs($ctx->murid->user);

    $mulai = test()->postJson("/api/v1/attempt/{$attemptId}/lampiran", [
        'question_id' => $soalId,
        'jenis' => $jenis,
        'nama' => $nama,
        'ukuran' => strlen($isi),
        'durasi_detik' => $durasi,
    ])->assertCreated();

    $kode = (string) $mulai->json('kode');
    $jumlah = (int) $mulai->json('jumlah_potongan');
    $ukuranPotongan = (int) config('jawaban.chunk_byte');

    for ($indeks = 0; $indeks < $jumlah; $indeks++) {
        $bagian = substr($isi, $indeks * $ukuranPotongan, $ukuranPotongan);

        test()->putJson("/api/v1/lampiran/{$kode}/potongan/{$indeks}", [
            'isi_base64' => base64_encode($bagian),
            'hash' => hash('sha256', $bagian),
        ])->assertOk();
    }

    $respons = test()->postJson("/api/v1/lampiran/{$kode}/selesai")->assertOk();

    return ['kode' => $kode, 'respons' => $respons];
}

it('menerima gambar kanvas dan mengencode ulangnya menjadi PNG', function (): void {
    $ctx = m09Attempt($this);
    $hasil = m09Unggah($this, $ctx['attempt'], $ctx['soal'], m09Png());

    expect($hasil['respons']->json('jenis'))->toBe('gambar')
        ->and($hasil['respons']->json('ekstensi'))->toBe('png')
        ->and($hasil['respons']->json('mime'))->toBe('image/png')
        ->and($hasil['respons']->json('kategori'))->toBe('umum')
        ->and($hasil['respons']->json('tampil_langsung'))->toBeTrue()
        ->and($hasil['respons']->json('url'))->toBeString();

    $unggahan = UnggahanJawaban::query()->where('kode', $hasil['kode'])->firstOrFail();
    $tersimpan = (string) Storage::disk(PenyimpananJawaban::DISK)->get((string) $unggahan->path);

    // Isi berkas adalah PNG hasil server, dan hash-nya cocok dengan yang dicatat.
    expect(str_starts_with($tersimpan, "\x89PNG\r\n\x1a\n"))->toBeTrue()
        ->and($unggahan->hash)->toBe(hash('sha256', $tersimpan))
        ->and(basename((string) $unggahan->path))->toBe($unggahan->kode.'.png');

    // Tanpa sesi: URL bertanda tangan satu-satunya jalan.
    auth()->forgetGuards();

    $respons = $this->get((string) $hasil['respons']->json('url'))->assertOk();

    expect($respons->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($respons->headers->get('Content-Type'))->toBe('image/png')
        ->and((string) $respons->headers->get('Content-Disposition'))->toContain('inline');
});

it('menolak unggahan setelah waktu ulangan habis', function (): void {
    $ctx = m09Attempt($this, durasiMenit: 10);

    // 3 menit lewat deadline — di luar toleransi pengumpulan (Q-10).
    $this->travel(13)->minutes();

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $this->postJson("/api/v1/attempt/{$ctx['attempt']}/lampiran", [
        'question_id' => $ctx['soal'],
        'jenis' => 'gambar',
        'ukuran' => strlen(m09Png()),
    ])->assertStatus(422)->assertJsonValidationErrors(['attempt']);

    expect(UnggahanJawaban::query()->count())->toBe(0);
});

it('menolak potongan yang datang setelah deadline walau sesinya sudah dibuka', function (): void {
    $ctx = m09Attempt($this, durasiMenit: 10);
    $isi = m09Png();

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $mulai = $this->postJson("/api/v1/attempt/{$ctx['attempt']}/lampiran", [
        'question_id' => $ctx['soal'],
        'jenis' => 'gambar',
        'ukuran' => strlen($isi),
    ])->assertCreated();

    // 3 menit lewat deadline — di luar toleransi pengumpulan (Q-10).
    $this->travel(13)->minutes();

    $this->putJson('/api/v1/lampiran/'.$mulai->json('kode').'/potongan/0', [
        'isi_base64' => base64_encode($isi),
    ])->assertStatus(422)->assertJsonValidationErrors(['potongan']);
});

it('menerima potongan lampiran yang telat beberapa detik karena latensi jaringan', function (): void {
    $ctx = m09Attempt($this, durasiMenit: 10);
    $isi = m09Png();

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $mulai = $this->postJson("/api/v1/attempt/{$ctx['attempt']}/lampiran", [
        'question_id' => $ctx['soal'],
        'jenis' => 'gambar',
        'ukuran' => strlen($isi),
    ])->assertCreated();

    // Deadline baru lewat 1 detik: masih di dalam toleransi yang sama dengan
    // pengumpulan, jadi potongan terakhir tidak boleh ditolak 422 (Q-10).
    $this->travel(601)->seconds();

    $this->putJson('/api/v1/lampiran/'.$mulai->json('kode').'/potongan/0', [
        'isi_base64' => base64_encode($isi),
    ])->assertOk();
});

it('hanya mengizinkan rekaman diri bila sekolah menyalakan izinnya', function (): void {
    $ctx = m09Attempt($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    // Izin masih mati (bawaan): rekaman diri ditolak.
    $this->postJson("/api/v1/attempt/{$ctx['attempt']}/lampiran", [
        'question_id' => $ctx['soal'],
        'jenis' => 'rekam',
        'ukuran' => 1024,
        'durasi_detik' => 10,
    ])->assertStatus(422)->assertJsonValidationErrors(['jenis']);

    // Guru menyalakan izin untuk kuis ini.
    app(PengaturanService::class)->simpan(LingkupPengaturan::Kuis, $ctx['kuis']->id, KunciPengaturan::RekamDiri, true);

    $this->postJson("/api/v1/attempt/{$ctx['attempt']}/lampiran", [
        'question_id' => $ctx['soal'],
        'jenis' => 'rekam',
        'ukuran' => 1024,
        'durasi_detik' => 10,
    ])->assertCreated()->assertJsonPath('jenis', 'rekam');

    // Durasi di atas batas tetap ditolak.
    $this->postJson("/api/v1/attempt/{$ctx['attempt']}/lampiran", [
        'question_id' => $ctx['soal'],
        'jenis' => 'rekam',
        'ukuran' => 1024,
        'durasi_detik' => (int) config('jawaban.durasi_rekam_maks_detik') + 1,
    ])->assertStatus(422)->assertJsonValidationErrors(['durasi_detik']);
});

it('menolak berkas melebihi batas ukuran dan lampiran di luar batas jumlah', function (): void {
    $ctx = m09Attempt($this);

    config(['jawaban.ukuran_maks' => 200]);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $this->postJson("/api/v1/attempt/{$ctx['attempt']}/lampiran", [
        'question_id' => $ctx['soal'],
        'jenis' => 'gambar',
        'ukuran' => 400,
    ])->assertStatus(422)->assertJsonValidationErrors(['ukuran']);

    // Batas normal: tiga lampiran boleh, yang keempat ditolak.
    config(['jawaban.ukuran_maks' => 10 * 1024 * 1024]);

    for ($ke = 1; $ke <= 3; $ke++) {
        m09Unggah($this, $ctx['attempt'], $ctx['soal'], m09Png(120, 120), 'gambar', "lembar-{$ke}.png");
    }

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $this->postJson("/api/v1/attempt/{$ctx['attempt']}/lampiran", [
        'question_id' => $ctx['soal'],
        'jenis' => 'gambar',
        'ukuran' => 1000,
    ])->assertStatus(422)->assertJsonValidationErrors(['unggahan']);
});

it('mengarantina berkas berisiko sebagai unduhan .upload', function (): void {
    $ctx = m09Attempt($this);

    $hasil = m09Unggah($this, $ctx['attempt'], $ctx['soal'], "PK\x03\x04".str_repeat('z', 200), 'berkas', 'tugas.zip');

    expect($hasil['respons']->json('kategori'))->toBe('berisiko')
        ->and($hasil['respons']->json('ekstensi'))->toBe('upload')
        ->and($hasil['respons']->json('mime'))->toBe('application/octet-stream')
        ->and($hasil['respons']->json('tampil_langsung'))->toBeFalse();

    auth()->forgetGuards();

    $respons = $this->get((string) $hasil['respons']->json('url'))->assertOk();
    $disposisi = (string) $respons->headers->get('Content-Disposition');

    expect($disposisi)->toContain('attachment')->toContain('.upload');
});

it('menolak potongan dengan hash yang tidak cocok', function (): void {
    $ctx = m09Attempt($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $mulai = $this->postJson("/api/v1/attempt/{$ctx['attempt']}/lampiran", [
        'question_id' => $ctx['soal'],
        'jenis' => 'gambar',
        'ukuran' => 40,
    ])->assertCreated();

    $this->putJson('/api/v1/lampiran/'.$mulai->json('kode').'/potongan/0', [
        'isi_base64' => base64_encode('isi asli'),
        'hash' => hash('sha256', 'isi lain'),
    ])->assertStatus(422)->assertJsonValidationErrors(['potongan']);

    expect(UnggahanJawaban::query()->firstOrFail()->potongan()->count())->toBe(0);
});

it('membuang sesi unggah lampiran yang ditinggalkan beserta potongannya', function (): void {
    $ctx = m09Attempt($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $mulai = $this->postJson("/api/v1/attempt/{$ctx['attempt']}/lampiran", [
        'question_id' => $ctx['soal'],
        'jenis' => 'gambar',
        'ukuran' => 30,
    ])->assertCreated();

    $this->putJson('/api/v1/lampiran/'.$mulai->json('kode').'/potongan/0', [
        'isi_base64' => base64_encode('sebagian'),
    ])->assertOk();

    $unggahan = UnggahanJawaban::query()->where('kode', $mulai->json('kode'))->firstOrFail();
    $direktori = 'jawaban/'.$unggahan->school_id.'/'.$unggahan->kode;

    expect(Storage::disk(PenyimpananJawaban::DISK)->exists($direktori.'/potongan/0.part'))->toBeTrue();

    $this->travel(4)->hours();

    (new SapuUnggahanJawabanYatim)->handle(app(PenyimpananJawaban::class));

    expect(UnggahanJawaban::query()->where('kode', $unggahan->kode)->exists())->toBeFalse()
        ->and(Storage::disk(PenyimpananJawaban::DISK)->exists($direktori))->toBeFalse();
});

it('menolak lampiran murid lain dan menolak guru mengunggah', function (): void {
    $ctx = m09Attempt($this);

    $muridLain = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);

    auth()->forgetGuards();
    Sanctum::actingAs($muridLain->user);

    $this->postJson("/api/v1/attempt/{$ctx['attempt']}/lampiran", [
        'question_id' => $ctx['soal'],
        'jenis' => 'gambar',
        'ukuran' => 100,
    ])->assertStatus(403);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->postJson("/api/v1/attempt/{$ctx['attempt']}/lampiran", [
        'question_id' => $ctx['soal'],
        'jenis' => 'gambar',
        'ukuran' => 100,
    ])->assertStatus(403);

    // Guru boleh MELIHAT lampiran murid (dipakai antrean koreksi).
    $hasil = m09Unggah($this, $ctx['attempt'], $ctx['soal'], m09Png(100, 100));

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->getJson("/api/v1/attempt/{$ctx['attempt']}/lampiran")
        ->assertOk()
        ->assertJsonPath('0.kode', $hasil['kode']);
});

it('menolak URL berkas lampiran yang tanda tangannya kedaluwarsa', function (): void {
    $ctx = m09Attempt($this);
    $hasil = m09Unggah($this, $ctx['attempt'], $ctx['soal'], m09Png(80, 80));

    $kedaluwarsa = URL::temporarySignedRoute('jawaban.berkas', now()->subMinute(), ['kode' => $hasil['kode']], false);

    auth()->forgetGuards();

    $this->get(rtrim((string) config('app.url'), '/').$kedaluwarsa)->assertStatus(403);
});
