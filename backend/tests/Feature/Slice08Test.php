<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Material\Enums\StatusMateri;
use App\Sections\Material\Jobs\SapuUnggahanYatim;
use App\Sections\Material\Models\BlokMateri;
use App\Sections\Material\Models\Materi;
use App\Sections\Material\Models\UnggahanMateri;
use App\Sections\Material\Registry\TemaPerjalanan;
use App\Sections\Material\Services\MateriService;
use App\Sections\Material\Services\PenyimpananMateri;
use App\Sections\Question\Models\Soal;
use App\Sections\Question\Models\Tag;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Report\Services\RankingService;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Enums\LingkupPengaturan;
use App\Sections\Settings\Services\PengaturanService;
use Database\Seeders\MasterDataSeeder;
use Database\Seeders\MateriContohSeeder;
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
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '3A', 'tingkat' => 3]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Matematika', 'kode' => 'MAT']);
    $this->tag = Tag::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Penjumlahan']);
    $this->guru = User::factory()->guru()->create();
    $this->murid = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);
});

/** Soal lewat API (sekaligus menguji validasi registry). */
function m08Soal(object $ctx, string $tipe, array $konten, array $kunci, int $skor = 4, ?int $tagId = null): Soal
{
    auth()->forgetGuards();
    Sanctum::actingAs($ctx->guru);

    $respons = test()->postJson('/api/v1/soal', [
        'subject_id' => $ctx->mapel->id,
        'tag_id' => $tagId,
        'tipe' => $tipe,
        'konten' => $konten,
        'kunci' => $kunci,
        'skor' => $skor,
    ])->assertCreated();

    return Soal::query()->findOrFail((int) $respons->json('id'));
}

/**
 * @param  array<int, Soal>  $soal
 */
function m08Kuis(object $ctx, array $soal): Kuis
{
    $kuis = Kuis::factory()->untukSekolah($ctx->sekolah, $ctx->mapel, $ctx->kelas)->berjalan()->create([
        'acak_soal' => false,
        'acak_opsi' => false,
    ]);

    foreach (array_values($soal) as $urutan => $satu) {
        $kuis->soal()->attach($satu->id, ['urutan' => $urutan + 1]);
    }

    return $kuis->refresh();
}

function m08Materi(object $ctx, array $data = []): Materi
{
    auth()->forgetGuards();
    Sanctum::actingAs($ctx->guru);

    $id = (int) test()->postJson('/api/v1/materi', array_merge([
        'judul' => 'Materi Penjumlahan',
        'subject_id' => $ctx->mapel->id,
        'class_id' => $ctx->kelas->id,
        'tag_id' => $ctx->tag->id,
    ], $data))->assertCreated()->json('id');

    return Materi::query()->findOrFail($id);
}

/**
 * Unggah berpotongan lengkap (semua potongan + gabung).
 *
 * @return array{kode: string, respons: TestResponse}
 */
function m08Unggah(object $ctx, Materi $materi, string $nama, string $isi): array
{
    auth()->forgetGuards();
    Sanctum::actingAs($ctx->guru);

    $mulai = test()->postJson("/api/v1/materi/{$materi->id}/unggahan", [
        'nama' => $nama,
        'ukuran' => strlen($isi),
    ])->assertCreated();

    $kode = (string) $mulai->json('kode');
    $jumlah = (int) $mulai->json('jumlah_potongan');
    $ukuranPotongan = (int) config('material.chunk_byte');

    for ($indeks = 0; $indeks < $jumlah; $indeks++) {
        $bagian = substr($isi, $indeks * $ukuranPotongan, $ukuranPotongan);

        test()->putJson("/api/v1/unggahan/{$kode}/potongan/{$indeks}", [
            'isi_base64' => base64_encode($bagian),
            'hash' => hash('sha256', $bagian),
        ])->assertOk();
    }

    $respons = test()->postJson("/api/v1/unggahan/{$kode}/selesai")->assertOk();

    return ['kode' => $kode, 'respons' => $respons];
}

it('mengunggah materi berkategori umum dan murid memuatnya lewat URL bertanda tangan', function (): void {
    $materi = m08Materi($this);
    $isi = "\x89PNG\r\n\x1a\n".str_repeat('a', 300);

    $hasil = m08Unggah($this, $materi, 'peta.png', $isi);

    expect($hasil['respons']->json('kategori'))->toBe('umum')
        ->and($hasil['respons']->json('ekstensi'))->toBe('png')
        ->and($hasil['respons']->json('mime'))->toBe('image/png')
        ->and($hasil['respons']->json('hash'))->toBe(hash('sha256', $isi))
        ->and($hasil['respons']->json('tampil_langsung'))->toBeTrue();

    $unggahan = UnggahanMateri::query()->where('kode', $hasil['kode'])->firstOrFail();

    // Berkas fisik hanya ada di storage privat, tidak di disk publik.
    expect(Storage::disk(PenyimpananMateri::DISK)->exists((string) $unggahan->path))->toBeTrue()
        ->and(Storage::disk('public')->exists((string) $unggahan->path))->toBeFalse();

    // Murid (tanpa sesi) cukup memakai URL bertanda tangan yang diberikan server.
    auth()->forgetGuards();

    $respons = $this->get((string) $hasil['respons']->json('url'))->assertOk();

    expect($respons->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($respons->headers->get('Content-Type'))->toBe('image/png')
        ->and((string) $respons->headers->get('Content-Disposition'))->toContain('inline');
});

it('berkas berisiko diunduh paksa sebagai .upload walau namanya .png', function (): void {
    $materi = m08Materi($this);
    $isi = "PK\x03\x04".str_repeat('z', 120);

    $hasil = m08Unggah($this, $materi, 'tugas.png', $isi);

    expect($hasil['respons']->json('kategori'))->toBe('berisiko')
        ->and($hasil['respons']->json('ekstensi'))->toBe('upload')
        ->and($hasil['respons']->json('mime'))->toBe('application/octet-stream')
        ->and($hasil['respons']->json('tampil_langsung'))->toBeFalse();

    $respons = $this->get((string) $hasil['respons']->json('url'))->assertOk();
    $disposisi = (string) $respons->headers->get('Content-Disposition');

    expect($disposisi)->toContain('attachment')
        ->and($disposisi)->toContain('.upload');
});

it('menerima dokumen kantor (docx/pptx) sebagai dokumen, bukan unduhan .upload', function (): void {
    $materi = m08Materi($this);

    // Kepala paket OOXML: zip yang daftar isinya memuat [Content_Types].xml lalu
    // folder `word/` (bentuk inilah yang dilihat KlasifikasiBerkas).
    $isi = "PK\x03\x04".str_repeat("\0", 26).'[Content_Types].xml'
        .str_repeat("\0", 40).'word/document.xml'
        .str_repeat('a', 400);

    $hasil = m08Unggah($this, $materi, 'Materi Pecahan.docx', $isi);

    expect($hasil['respons']->json('kategori'))->toBe('dokumen')
        ->and($hasil['respons']->json('kategori_label'))->toBe('Dokumen kantor')
        ->and($hasil['respons']->json('ekstensi'))->toBe('docx')
        ->and($hasil['respons']->json('mime'))->toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        ->and($hasil['respons']->json('tampil_langsung'))->toBeTrue()
        ->and($hasil['respons']->json('sajian'))->toBe('dokumen');

    $unggahan = UnggahanMateri::query()->where('kode', $hasil['kode'])->firstOrFail();

    // Berkas tersimpan dengan ekstensi aslinya, bukan `.upload`.
    expect((string) $unggahan->nama_simpan)->toEndWith('.docx')
        ->and((string) $unggahan->nama_asli)->toBe('Materi Pecahan.docx');

    $respons = $this->get((string) $hasil['respons']->json('url'))->assertOk();
    $disposisi = (string) $respons->headers->get('Content-Disposition');

    // Dokumen disajikan apa adanya (nama & tipe asli), tidak dipaksa `attachment`.
    expect($disposisi)->toContain('inline')
        ->and($disposisi)->toContain('.docx')
        ->and($disposisi)->not->toContain('.upload')
        ->and($respons->headers->get('X-Content-Type-Options'))->toBe('nosniff');
});

it('zip biasa tetap berisiko walau berawalan PK', function (): void {
    $materi = m08Materi($this);

    // Arsip tanpa `[Content_Types].xml`: tetap golongan berisiko.
    $isi = "PK\x03\x04".str_repeat('z', 200).'folder/berkas.exe';

    $hasil = m08Unggah($this, $materi, 'arsip.zip', $isi);

    expect($hasil['respons']->json('kategori'))->toBe('berisiko')
        ->and($hasil['respons']->json('ekstensi'))->toBe('upload')
        ->and($hasil['respons']->json('sajian'))->toBe('unduh')
        ->and($hasil['respons']->json('tampil_langsung'))->toBeFalse();
});

it('menolak potongan yang hash-nya tidak cocok', function (): void {
    $materi = m08Materi($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $mulai = $this->postJson("/api/v1/materi/{$materi->id}/unggahan", [
        'nama' => 'gambar.png',
        'ukuran' => 40,
    ])->assertCreated();

    $this->putJson('/api/v1/unggahan/'.$mulai->json('kode').'/potongan/0', [
        'isi_base64' => base64_encode("\x89PNG\r\n\x1a\n rusak"),
        'hash' => hash('sha256', 'isi lain'),
    ])->assertStatus(422)->assertJsonValidationErrors(['potongan']);

    expect(UnggahanMateri::query()->where('kode', $mulai->json('kode'))->firstOrFail()->potongan()->count())->toBe(0);
});

it('menolak potongan materi yang melebihi ukuran berkas yang didaftarkan (K-16)', function (): void {
    $materi = m08Materi($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    // Berkas didaftarkan 10 byte, tetapi yang dikirim 20 byte.
    $mulai = $this->postJson("/api/v1/materi/{$materi->id}/unggahan", [
        'nama' => 'gambar.png',
        'ukuran' => 10,
    ])->assertCreated();

    $kode = (string) $mulai->json('kode');
    $muatan = "\x89PNG\r\n\x1a\n".str_repeat('a', 12);

    $this->putJson('/api/v1/unggahan/'.$kode.'/potongan/0', [
        'isi_base64' => base64_encode($muatan),
        'hash' => hash('sha256', $muatan),
    ])->assertStatus(422)->assertJsonValidationErrors(['potongan']);

    $unggahan = UnggahanMateri::query()->where('kode', $kode)->firstOrFail();

    // Bukan hanya 422-nya yang penting: byte-nya tidak boleh pernah ditulis ke
    // disk (dulu potongan langsung ditulis, totalnya baru diperiksa di `selesai`).
    expect($unggahan->potongan()->count())->toBe(0)
        ->and(Storage::disk(PenyimpananMateri::DISK)
            ->exists('materi/'.$unggahan->school_id.'/'.$kode.'/potongan/0.part'))->toBeFalse();
});

it('menolak isi_base64 materi yang lebih panjang dari satu potongan (K-16)', function (): void {
    $materi = m08Materi($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $mulai = $this->postJson("/api/v1/materi/{$materi->id}/unggahan", [
        'nama' => 'gambar.png',
        'ukuran' => 100,
    ])->assertCreated();

    $chunkByte = (int) config('material.chunk_byte');

    // Dilebihkan jelas di atas satu potongan supaya yang menolak memang aturan
    // panjang permintaan, bukan pemeriksaan ukuran di dalam service.
    $this->putJson('/api/v1/unggahan/'.$mulai->json('kode').'/potongan/0', [
        'isi_base64' => base64_encode(str_repeat('A', $chunkByte + 4096)),
    ])->assertStatus(422)->assertJsonValidationErrors(['isi_base64']);
});

it('menolak URL berkas yang tanda tangannya sudah kedaluwarsa', function (): void {
    $materi = m08Materi($this);
    $hasil = m08Unggah($this, $materi, 'peta.png', "\x89PNG\r\n\x1a\n".str_repeat('a', 50));

    $kedaluwarsa = URL::temporarySignedRoute('materi.berkas', now()->subMinute(), ['kode' => $hasil['kode']], false);

    auth()->forgetGuards();

    $this->get(rtrim((string) config('app.url'), '/').$kedaluwarsa)->assertStatus(403);
});

it('membersihkan sesi unggah yatim beserta potongannya', function (): void {
    $materi = m08Materi($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $mulai = $this->postJson("/api/v1/materi/{$materi->id}/unggahan", [
        'nama' => 'video.mp4',
        'ukuran' => 30,
    ])->assertCreated();

    $this->putJson('/api/v1/unggahan/'.$mulai->json('kode').'/potongan/0', [
        'isi_base64' => base64_encode('isi potongan'),
    ])->assertOk();

    $unggahan = UnggahanMateri::query()->where('kode', $mulai->json('kode'))->firstOrFail();
    $direktori = 'materi/'.$unggahan->school_id.'/'.$unggahan->kode;

    expect(Storage::disk(PenyimpananMateri::DISK)->exists($direktori.'/potongan/0.part'))->toBeTrue();

    // Lewati batas umur yatim (bawaan 180 menit), lalu jalankan sapuan.
    $this->travel(4)->hours();

    (new SapuUnggahanYatim)->handle(app(PenyimpananMateri::class));

    expect(UnggahanMateri::query()->where('kode', $unggahan->kode)->exists())->toBeFalse()
        ->and(Storage::disk(PenyimpananMateri::DISK)->exists($direktori))->toBeFalse();
});

it('membuang berkas pustaka sekaligus klip, media penjelasan, dan video temanya', function (): void {
    $soal = m08Soal($this, 'pilihan_ganda', [
        'teks' => 'Berapa hasil dari 2 + 3?',
        'opsi' => [['id' => 'A', 'teks' => '4'], ['id' => 'B', 'teks' => '5']],
    ], ['jawaban' => 'B'], 4, $this->tag->id);

    $kuis = m08Kuis($this, [$soal]);
    $materi = m08Materi($this);
    $video = m08Unggah($this, $materi, 'latar.mp4', "\x00\x00\x00\x18ftypmp42".str_repeat('a', 300));
    $gambar = m08Unggah($this, $materi, 'peta.png', "\x89PNG\r\n\x1a\n".str_repeat('a', 300));

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    // Dua klip memakai gambar yang sama, satu kuis memakai gambar itu sebagai
    // media penjelasan, dan video dipakai sebagai latar tema.
    $this->putJson("/api/v1/materi/{$materi->id}/blok", [
        'blok' => [
            ['tipe' => 'media', 'wajib' => true, 'isi' => ['unggahan_kode' => $gambar['kode']]],
            ['tipe' => 'media', 'wajib' => false, 'isi' => ['unggahan_kode' => $gambar['kode']]],
            ['tipe' => 'kuis', 'wajib' => true, 'quiz_id' => $kuis->id,
                'isi' => ['penjelasan' => ['teks' => 'Baca ulang bab 3.', 'unggahan_kode' => $gambar['kode']]]],
            ['tipe' => 'kuis', 'wajib' => true, 'quiz_id' => $kuis->id,
                'isi' => ['penjelasan' => ['teks' => '', 'unggahan_kode' => $gambar['kode']]]],
        ],
        'tema' => ['kode' => 'mendaki-gunung', 'nama' => '', 'video_kode' => $video['kode']],
    ])->assertOk();

    // Guru membuang gambar dari pustaka: balasannya menyebut apa saja yang ikut
    // dibersihkan supaya editor bisa memberi tahu dampaknya.
    $this->deleteJson("/api/v1/unggahan/{$gambar['kode']}")
        ->assertOk()
        ->assertJsonPath('klip', 2)
        ->assertJsonPath('penjelasan', 2)
        ->assertJsonPath('tema', 0);

    $direktori = 'materi/'.$this->sekolah->id.'/'.$gambar['kode'];

    expect(UnggahanMateri::query()->where('kode', $gambar['kode'])->exists())->toBeFalse()
        ->and(Storage::disk(PenyimpananMateri::DISK)->exists($direktori))->toBeFalse();

    // Klip medianya dibuang; dua blok kuis tetap ada, urutannya rapat kembali.
    $sisa = BlokMateri::query()->where('material_id', $materi->id)->orderBy('urutan')->get();

    expect($sisa)->toHaveCount(2)
        ->and($sisa->every(fn (BlokMateri $b): bool => $b->tipe->value === 'kuis'))->toBeTrue();

    // Penjelasan berteks tetap utuh tanpa medianya; yang cuma media jadi kosong.
    expect($sisa[0]->isi['penjelasan']['teks'])->toBe('Baca ulang bab 3.')
        ->and($sisa[0]->isi['penjelasan']['unggahan_kode'])->toBeNull()
        ->and($sisa[1]->isi['penjelasan'] ?? null)->toBeNull();

    // Susunan sisa masih bisa disimpan ulang: tidak ada rujukan berkas yang mati.
    $this->putJson("/api/v1/materi/{$materi->id}/blok", [
        'blok' => [
            ['tipe' => 'kuis', 'wajib' => true, 'quiz_id' => $kuis->id,
                'isi' => ['penjelasan' => ['teks' => 'Baca ulang bab 3.', 'unggahan_kode' => null]]],
        ],
    ])->assertOk();

    // Video latar tema dilepas ke animasi bawaan, bukan dibiarkan menunjuk berkas hilang.
    $this->deleteJson("/api/v1/unggahan/{$video['kode']}")->assertOk()->assertJsonPath('tema', 1);

    expect($materi->refresh()->tema['video_kode'])->toBeNull();

    // Murid yang sudah mengerjakan materi tetap bisa membuka ringkasannya.
    $this->postJson("/api/v1/materi/{$materi->id}/publikasi")->assertOk();

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertOk();
});

it('menegakkan urutan blok wajib dan menjalankan kuis sisipan sebagai latihan', function (): void {
    $soal = m08Soal($this, 'pilihan_ganda', [
        'teks' => 'Berapa hasil dari 2 + 3?',
        'opsi' => [
            ['id' => 'A', 'teks' => '4'],
            ['id' => 'B', 'teks' => '5'],
            ['id' => 'C', 'teks' => '6'],
        ],
    ], ['jawaban' => 'B'], 4, $this->tag->id);

    $kuis = m08Kuis($this, [$soal]);
    $materi = m08Materi($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->putJson("/api/v1/materi/{$materi->id}/blok", ['blok' => [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Baca dulu.']],
        ['tipe' => 'kuis', 'wajib' => true, 'quiz_id' => $kuis->id],
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Penutup.']],
    ]])->assertOk()->assertJsonCount(3, 'blok');

    $this->postJson("/api/v1/materi/{$materi->id}/publikasi")
        ->assertOk()->assertJsonPath('status', 'publikasi');

    $blok = BlokMateri::query()->where('material_id', $materi->id)->orderBy('urutan')->get();

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $this->getJson('/api/v1/materi-saya')
        ->assertOk()
        ->assertJsonPath('materi.0.id', $materi->id)
        ->assertJsonPath('materi.0.jumlah_blok', 3);

    // Lompat ke blok kuis sebelum blok wajib pertama selesai: ditolak server.
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok[1]->id}/buka")
        ->assertStatus(422)->assertJsonValidationErrors(['blok']);

    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok[0]->id}/buka")
        ->assertOk()->assertJsonPath('blok.tipe', 'teks');

    // Blok ketiga juga masih tertutup.
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok[2]->id}/buka")
        ->assertStatus(422);

    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok[0]->id}/selesai")
        ->assertOk()->assertJsonPath('blok.status', 'selesai');

    // Blok kuis: server yang membuat attempt latihan lewat mesin kuis.
    $buka = $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok[1]->id}/buka")->assertOk();

    expect($buka->json('attempt.jenis'))->toBe('latihan')
        ->and($buka->json('attempt.asli'))->toBeFalse()
        ->and($buka->json('attempt.attempt_no'))->toBe(1)
        ->and($buka->json('attempt.soal.0.id'))->toBe($soal->id)
        // Kunci jawaban tidak pernah ikut ke klien.
        ->and($buka->json('attempt.soal.0.kunci'))->toBeNull();

    $attemptId = (int) $buka->json('attempt.id');

    // Blok kuis tidak bisa ditutup sebelum latihannya dikumpulkan.
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok[1]->id}/selesai")
        ->assertStatus(422)->assertJsonValidationErrors(['blok']);

    $this->postJson("/api/v1/attempt/{$attemptId}/jawab", ['question_id' => $soal->id, 'jawaban' => 'B'])->assertOk();
    $this->postJson("/api/v1/attempt/{$attemptId}/kumpulkan", ['idempotency_key' => 'latihan-1'])->assertOk();

    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok[1]->id}/selesai")
        ->assertOk()
        ->assertJsonPath('blok.status', 'selesai')
        ->assertJsonPath('blok.skor', 4);

    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok[2]->id}/buka")->assertOk();
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok[2]->id}/selesai")->assertOk();

    // Latihan bukan skor asli dan tidak pernah masuk ranking.
    $attempt = Attempt::query()->findOrFail($attemptId);

    expect($attempt->jenis->value)->toBe('latihan')
        ->and($attempt->asli)->toBeFalse()
        ->and(app(RankingService::class)->semua($kuis->refresh()))->toBe([]);

    // Guru melihat hasilnya di laporan tema materi.
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $laporan = $this->getJson("/api/v1/materi/{$materi->id}/laporan")->assertOk();

    expect($laporan->json('murid.0.blok_selesai'))->toBe(3)
        ->and($laporan->json('murid.0.skor_latihan'))->toEqual(4)
        ->and($laporan->json('murid.0.skor_latihan_maksimal'))->toEqual(4)
        ->and($laporan->json('murid.0.tema.0.tag_nama'))->toBe('Penjumlahan')
        ->and($laporan->json('murid.0.tema.0.jumlah_benar'))->toBe(1);
});

it('menyimpan penempatan timeline (track, mulai, durasi) untuk semua tipe blok', function (): void {
    $soal = m08Soal($this, 'pilihan_ganda', [
        'teks' => 'Berapa hasil dari 2 + 3?',
        'opsi' => [['id' => 'A', 'teks' => '4'], ['id' => 'B', 'teks' => '5']],
    ], ['jawaban' => 'B'], 4, $this->tag->id);

    $kuis = m08Kuis($this, [$soal]);
    $materi = m08Materi($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    // Editor gaya video editor menempatkan klip di track dengan titik mulai dan
    // durasi sendiri; kuis punya penempatan, jadi tidak boleh hilang saat simpan.
    $respons = $this->putJson("/api/v1/materi/{$materi->id}/blok", ['blok' => [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Pembuka.'], 'track' => 0, 'mulai_detik' => 0, 'durasi_detik' => 6],
        ['tipe' => 'kuis', 'wajib' => true, 'quiz_id' => $kuis->id, 'track' => 2, 'mulai_detik' => 12.5, 'durasi_detik' => 30],
    ]])->assertOk();

    expect($respons->json('blok.0.track'))->toBe(0)
        ->and($respons->json('blok.0.durasi_detik'))->toEqual(6.0)
        ->and($respons->json('blok.1.track'))->toBe(2)
        ->and($respons->json('blok.1.mulai_detik'))->toEqual(12.5)
        ->and($respons->json('blok.1.durasi_detik'))->toEqual(30.0);

    // Bertahan setelah dibaca ulang (bukan sekadar gema permintaan).
    $ulang = $this->getJson("/api/v1/materi/{$materi->id}")->assertOk();

    expect($ulang->json('blok.1.track'))->toBe(2)
        ->and($ulang->json('blok.1.mulai_detik'))->toEqual(12.5)
        ->and($ulang->json('blok.1.durasi_detik'))->toEqual(30.0);

    // Blok tanpa penempatan disusun berurutan memakai durasi bawaan.
    $this->putJson("/api/v1/materi/{$materi->id}/blok", ['blok' => [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Satu.']],
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Dua.']],
    ]])->assertOk();

    $baris = BlokMateri::query()->where('material_id', $materi->id)->orderBy('urutan')->get();

    expect($baris[0]->isi['mulai_detik'])->toEqual(0.0)
        ->and($baris[1]->isi['mulai_detik'])->toEqual(MateriService::DURASI_BAWAAN)
        ->and($baris[1]->isi['durasi_detik'])->toEqual(MateriService::DURASI_BAWAAN);
});

it('retry kuis sisipan mengikuti pengaturan tiga lapis', function (): void {
    $soal = m08Soal($this, 'benar_salah', ['teks' => 'Air membeku pada 0 derajat Celsius.'], ['benar' => true], 2);
    $kuis = m08Kuis($this, [$soal]);
    $materi = m08Materi($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->putJson("/api/v1/materi/{$materi->id}/blok", ['blok' => [
        ['tipe' => 'kuis', 'wajib' => true, 'quiz_id' => $kuis->id],
    ]])->assertOk();

    $this->postJson("/api/v1/materi/{$materi->id}/publikasi")->assertOk();

    // Lapis kuis mematikan retry: latihan tidak boleh diulang.
    app(PengaturanService::class)->simpan(LingkupPengaturan::Kuis, $kuis->id, KunciPengaturan::Retry, false);

    $blok = BlokMateri::query()->where('material_id', $materi->id)->firstOrFail();

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $buka = $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok->id}/buka")->assertOk();
    $attemptId = (int) $buka->json('attempt.id');

    $this->postJson("/api/v1/attempt/{$attemptId}/jawab", ['question_id' => $soal->id, 'jawaban' => true])->assertOk();
    $this->postJson("/api/v1/attempt/{$attemptId}/kumpulkan", ['idempotency_key' => 'latihan-2'])->assertOk();
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok->id}/selesai")->assertOk();

    // Buka lagi: attempt pertama sudah dikumpulkan dan retry mati.
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok->id}/buka")
        ->assertStatus(422)->assertJsonValidationErrors(['kuis']);

    expect(Attempt::query()->where('quiz_id', $kuis->id)->count())->toBe(1);
});

it('menolak blok kuis yang memuat soal uraian atau kuis kelas lain', function (): void {
    $uraian = m08Soal($this, 'uraian', ['teks' => 'Jelaskan fotosintesis.'], [
        'kata_kunci' => [['teks' => 'klorofil']],
    ], 4);

    $kuisUraian = m08Kuis($this, [$uraian]);

    $kelasLain = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '4B', 'tingkat' => 4]);
    $kuisKelasLain = Kuis::factory()->untukSekolah($this->sekolah, $this->mapel, $kelasLain)->berjalan()->create([
        'acak_soal' => false,
        'acak_opsi' => false,
    ]);
    $kuisKelasLain->soal()->attach($uraian->id, ['urutan' => 1]);

    $materi = m08Materi($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    // Kuis sisipan tidak boleh berbentuk uraian: latihan anak harus dinilai pasti.
    $this->putJson("/api/v1/materi/{$materi->id}/blok", ['blok' => [
        ['tipe' => 'kuis', 'wajib' => true, 'quiz_id' => $kuisUraian->id],
    ]])->assertStatus(422)->assertJsonValidationErrors(['blok']);

    $this->putJson("/api/v1/materi/{$materi->id}/blok", ['blok' => [
        ['tipe' => 'kuis', 'wajib' => true, 'quiz_id' => $kuisKelasLain->id],
    ]])->assertStatus(422)->assertJsonValidationErrors(['blok']);

    // Blok media tanpa berkas yang sudah selesai juga ditolak.
    $this->putJson("/api/v1/materi/{$materi->id}/blok", ['blok' => [
        ['tipe' => 'media', 'wajib' => true, 'isi' => ['unggahan_kode' => 'kode-tidak-ada']],
    ]])->assertStatus(422)->assertJsonValidationErrors(['blok']);
});

it('daftar dan buat materi tidak 500 (jumlah_blok dihitung tanpa lazy loading)', function (): void {
    $materi = m08Materi($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->putJson("/api/v1/materi/{$materi->id}/blok", ['blok' => [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Satu.']],
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Dua.']],
    ]])->assertOk();

    // Regresi: MateriResource memanggil relasi `blok` yang tidak dimuat.
    $daftar = $this->getJson('/api/v1/materi')->assertOk();

    expect($daftar->json('0.jumlah_blok'))->toBe(2);
    // Rasio bingkai dihapus (14 Oktober 2026): bingkai dikunci 16:9 di CSS.
    $daftar->assertJsonMissingPath('0.rasio');
});

it('menyimpan pengaturan tampilan klip (dinormalkan server)', function (): void {
    $soal = m08Soal($this, 'pilihan_ganda', [
        'teks' => 'Berapa hasil dari 2 + 3?',
        'opsi' => [['id' => 'A', 'teks' => '4'], ['id' => 'B', 'teks' => '5']],
    ], ['jawaban' => 'B'], 4, $this->tag->id);

    $kuis = m08Kuis($this, [$soal]);
    $materi = m08Materi($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $respons = $this->putJson("/api/v1/materi/{$materi->id}/blok", [
        'blok' => [
            ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Pembuka.'], 'tampilan' => ['fit' => 'cover']],
            ['tipe' => 'kuis', 'wajib' => true, 'quiz_id' => $kuis->id, 'mulai_detik' => 12, 'durasi_detik' => 8,
                'tampilan' => ['mode' => 'berjalan', 'tata' => 'horizontal']],
        ],
    ])->assertOk();

    // Teks tidak punya pengaturan tampilan: diabaikan.
    expect($respons->json('blok.0.tampilan'))->toBeNull()
        ->and($respons->json('blok.1.tampilan'))->toBe(['mode' => 'berjalan', 'tata' => 'horizontal']);

    $ulang = $this->getJson("/api/v1/materi/{$materi->id}")->assertOk();

    expect($ulang->json('blok.1.tampilan.tata'))->toBe('horizontal');

    // Bingkai materi dikunci 16:9 di CSS (14 Oktober 2026): rasio tidak lagi ada
    // di payload. Kiriman `rasio` dari klien lama (bundel yang masih tersimpan di
    // peramban) diabaikan — bukan ditolak — supaya guru tidak mendadak gagal
    // menyimpan hanya karena satu kolom yang sudah tidak dipakai.
    $respons->assertJsonMissingPath('rasio');
    $ulang->assertJsonMissingPath('rasio');

    $this->putJson("/api/v1/materi/{$materi->id}/blok", [
        'rasio' => '9:16',
        'blok' => [
            ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Saja.']],
        ],
    ])->assertOk()->assertJsonMissingPath('rasio');

    $this->putJson("/api/v1/materi/{$materi->id}/blok", ['blok' => [
        ['tipe' => 'kuis', 'wajib' => true, 'quiz_id' => $kuis->id, 'tampilan' => ['mode' => 'melayang']],
    ]])->assertStatus(422);
});

it('kuis di dalam video: tidak mengunci dirinya, dan video menunggu kuis wajibnya', function (): void {
    $soal = m08Soal($this, 'pilihan_ganda', [
        'teks' => 'Berapa hasil dari 2 + 3?',
        'opsi' => [['id' => 'A', 'teks' => '4'], ['id' => 'B', 'teks' => '5']],
    ], ['jawaban' => 'B'], 4, $this->tag->id);

    $kuis = m08Kuis($this, [$soal]);
    $materi = m08Materi($this);

    // Berkas video sungguhan lewat jalur unggah (terdeteksi dari tanda `ftyp`).
    $unggah = m08Unggah($this, $materi, 'klip.mp4', "\x00\x00\x00\x18ftypmp42".str_repeat('a', 300));

    expect($unggah['respons']->json('mime'))->toBe('video/mp4');

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    // Urutan simpan SENGAJA dibalik: kuis dibuat lebih dulu dari videonya.
    $this->putJson("/api/v1/materi/{$materi->id}/blok", ['blok' => [
        ['tipe' => 'kuis', 'wajib' => true, 'quiz_id' => $kuis->id, 'track' => 1, 'mulai_detik' => 20, 'durasi_detik' => 10,
            'tampilan' => ['mode' => 'jeda', 'tata' => 'vertikal']],
        ['tipe' => 'media', 'wajib' => true, 'isi' => ['unggahan_kode' => $unggah['kode'], 'keterangan' => ''],
            'track' => 0, 'mulai_detik' => 0, 'durasi_detik' => 60],
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Penutup.'], 'track' => 0, 'mulai_detik' => 70, 'durasi_detik' => 10],
    ]])->assertOk();

    $this->postJson("/api/v1/materi/{$materi->id}/publikasi")->assertOk();

    $blok = BlokMateri::query()->where('material_id', $materi->id)->get()->keyBy(fn (BlokMateri $satu): string => $satu->tipe->value);
    $idKuis = $blok['kuis']->id;
    $idVideo = $blok['media']->id;
    $idTeks = $blok['teks']->id;

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $ringkasan = $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertOk();

    // Tayang menurut timeline, bukan urutan simpan.
    expect(array_column($ringkasan->json('blok'), 'block_id'))->toBe([$idVideo, $idKuis, $idTeks])
        ->and($ringkasan->json('blok.1.host_id'))->toBe($idVideo)
        ->and($ringkasan->json('blok.0.host_id'))->toBeNull()
        ->and($ringkasan->json('blok.0.boleh_dibuka'))->toBeTrue()
        // Kuis di dalam video tidak mensyaratkan videonya selesai.
        ->and($ringkasan->json('blok.1.boleh_dibuka'))->toBeTrue()
        ->and($ringkasan->json('blok.2.boleh_dibuka'))->toBeFalse()
        // Ringkasan murid tidak lagi membawa rasio bingkai.
        ->and(array_key_exists('rasio', (array) $ringkasan->json('materi')))->toBeFalse();

    // Penutup tetap terkunci sampai video dan kuisnya beres.
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$idTeks}/buka")->assertStatus(422);

    $buka = $this->postJson("/api/v1/materi/{$materi->id}/blok/{$idVideo}/buka")->assertOk();

    expect($buka->json('blok.media.mime'))->toBe('video/mp4');

    // Video belum boleh ditutup: kuis wajib di dalamnya belum dijawab.
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$idVideo}/selesai")
        ->assertStatus(422)->assertJsonValidationErrors(['blok']);

    // Murid mencapai titik kuis: dibuka dari pemutar (video belum selesai).
    $kuisBuka = $this->postJson("/api/v1/materi/{$materi->id}/blok/{$idKuis}/buka")->assertOk();
    $attemptId = (int) $kuisBuka->json('attempt.id');

    $this->postJson("/api/v1/attempt/{$attemptId}/jawab", ['question_id' => $soal->id, 'jawaban' => 'B'])->assertOk();
    $this->postJson("/api/v1/attempt/{$attemptId}/kumpulkan", ['idempotency_key' => 'sisipan-1'])->assertOk();
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$idKuis}/selesai")->assertOk();

    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$idVideo}/selesai")->assertOk();

    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$idTeks}/buka")->assertOk();
});

it('menyimpan penjelasan opsional setelah kuis dan menampilkannya ke murid', function (): void {
    $soal = m08Soal($this, 'pilihan_ganda', [
        'teks' => 'Berapa hasil dari 2 + 3?',
        'opsi' => [['id' => 'A', 'teks' => '4'], ['id' => 'B', 'teks' => '5']],
    ], ['jawaban' => 'B'], 4, $this->tag->id);

    $kuis = m08Kuis($this, [$soal]);
    $materi = m08Materi($this);
    $berkas = m08Unggah($this, $materi, 'penjelasan.png', "\x89PNG\r\n\x1a\n".str_repeat('a', 300));

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $respons = $this->putJson("/api/v1/materi/{$materi->id}/blok", [
        'blok' => [
            ['tipe' => 'kuis', 'wajib' => true, 'quiz_id' => $kuis->id,
                'isi' => ['penjelasan' => ['teks' => '  Karena 3/4 lebih besar.  ', 'unggahan_kode' => $berkas['kode']]]],
            ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Penutup.']],
        ],
    ])->assertOk();

    // Teks dirapikan, media disimpan sebagai kode; blok non-kuis tetap null.
    expect($respons->json('blok.0.penjelasan.teks'))->toBe('Karena 3/4 lebih besar.')
        ->and($respons->json('blok.0.penjelasan.unggahan_kode'))->toBe($berkas['kode'])
        ->and($respons->json('blok.1.penjelasan'))->toBeNull();

    // Media penjelasan yang belum selesai diunggah ditolak, bukan dibiarkan kosong.
    $this->putJson("/api/v1/materi/{$materi->id}/blok", [
        'blok' => [
            ['tipe' => 'kuis', 'wajib' => true, 'quiz_id' => $kuis->id,
                'isi' => ['penjelasan' => ['teks' => 'Ada.', 'unggahan_kode' => 'tidak-ada']]],
        ],
    ])->assertStatus(422)->assertJsonValidationErrors(['blok']);

    // Teks kosong + tanpa media = memang tidak ada penjelasan.
    $this->putJson("/api/v1/materi/{$materi->id}/blok", [
        'blok' => [
            ['tipe' => 'kuis', 'wajib' => true, 'quiz_id' => $kuis->id,
                'isi' => ['penjelasan' => ['teks' => '   ', 'unggahan_kode' => null]]],
        ],
    ])->assertOk()->assertJsonPath('blok.0.penjelasan', null);

    // Simpan ulang dengan penjelasan lengkap untuk pemeriksaan sisi murid.
    $this->putJson("/api/v1/materi/{$materi->id}/blok", [
        'blok' => [
            ['tipe' => 'kuis', 'wajib' => true, 'quiz_id' => $kuis->id,
                'isi' => ['penjelasan' => ['teks' => 'Baca ulang bab 3.', 'unggahan_kode' => $berkas['kode']]]],
        ],
    ])->assertOk();

    // Murid hanya melihat materi yang sudah diterbitkan kelasnya.
    $this->postJson("/api/v1/materi/{$materi->id}/publikasi")->assertOk();

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $ringkasan = $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertOk();

    // Murid menerima teks + media bertanda tangan (bukan kunci jawaban).
    expect($ringkasan->json('blok.0.penjelasan.teks'))->toBe('Baca ulang bab 3.')
        ->and($ringkasan->json('blok.0.penjelasan.media.kode'))->toBe($berkas['kode'])
        ->and((string) $ringkasan->json('blok.0.penjelasan.media.url'))->toContain('signature')
        ->and($ringkasan->json('blok.0.penjelasan.media.tampil_langsung'))->toBeTrue();
});

it('penyebaran materi: hanya materi TERBIT kelas murid yang sampai ke perangkatnya', function (): void {
    $materi = m08Materi($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->putJson("/api/v1/materi/{$materi->id}/blok", ['blok' => [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Baca dulu.']],
    ]])->assertOk();

    $kelasLain = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '4B', 'tingkat' => 4]);
    $muridLain = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $kelasLain->id,
    ]);

    // 1) Belum terbit: kelas sendiri pun tidak melihat apa-apa.
    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertStatus(403);
    $this->getJson('/api/v1/materi-saya')->assertOk()->assertJsonCount(0, 'materi');

    // 2) Terbit: kelas yang dituju menerima, kelas lain tidak.
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);
    $this->postJson("/api/v1/materi/{$materi->id}/publikasi")->assertOk();

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);
    $this->getJson('/api/v1/materi-saya')
        ->assertOk()
        ->assertJsonPath('materi.0.id', $materi->id)
        ->assertJsonPath('materi.0.jumlah_blok', 1);
    $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertOk();

    auth()->forgetGuards();
    Sanctum::actingAs($muridLain->user);
    $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertStatus(403);
    $this->getJson('/api/v1/materi-saya')->assertOk()->assertJsonCount(0, 'materi');

    // 3) Guru lain juga tidak membaca progres/isi materi bukan miliknya.
    auth()->forgetGuards();
    Sanctum::actingAs(User::factory()->guru()->create());
    $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertStatus(403);
    $this->getJson("/api/v1/materi/{$materi->id}")->assertStatus(403);
    $this->getJson("/api/v1/materi/{$materi->id}/laporan")->assertStatus(403);
});

it('materi tanpa kelas terbuka untuk semua kelas di sekolahnya, tetapi tidak menyeberang sekolah', function (): void {
    // Kelas tidak lagi wajib: materi pengayaan/remedial sering ditujukan ke
    // seluruh angkatan (15 Oktober 2026). Disimpan sebagai null — bukan kelas
    // palsu — supaya laporan per kelas dan cakupan murid tidak salah hitung.
    $materi = m08Materi($this, ['judul' => 'Materi Pengayaan Tanpa Kelas', 'class_id' => null]);

    expect($materi->class_id)->toBeNull()
        ->and($materi->namaKelas())->toBe('Semua kelas');

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->putJson("/api/v1/materi/{$materi->id}/blok", ['blok' => [
        ['tipe' => 'teks', 'wajib' => true, 'isi' => ['teks' => 'Baca dulu.']],
    ]])->assertOk();
    $this->postJson("/api/v1/materi/{$materi->id}/publikasi")->assertOk();

    // Murid dari kelas LAIN di sekolah yang sama: materinya sampai ke daftarnya.
    $kelasLain = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '5B', 'tingkat' => 5]);
    $muridLain = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $kelasLain->id,
    ]);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);
    $this->getJson('/api/v1/materi-saya')->assertOk()->assertJsonPath('materi.0.id', $materi->id);
    $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertOk();

    auth()->forgetGuards();
    Sanctum::actingAs($muridLain->user);
    $this->getJson('/api/v1/materi-saya')->assertOk()->assertJsonPath('materi.0.id', $materi->id);
    $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertOk();

    // Murid sekolah LAIN: ditolak, walau materinya tidak membatasi kelas.
    // "Semua kelas" berarti semua kelas di sekolah materi itu, bukan semua sekolah.
    $sekolahLain = Sekolah::factory()->create();
    $kelasAsing = Kelas::factory()->untukSekolah($sekolahLain)->create(['nama' => '6A', 'tingkat' => 6]);
    $muridAsing = Murid::factory()->create([
        'school_id' => $sekolahLain->id,
        'class_id' => $kelasAsing->id,
    ]);

    auth()->forgetGuards();
    Sanctum::actingAs($muridAsing->user);
    $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertForbidden();
    $this->getJson('/api/v1/materi-saya')->assertOk()->assertJsonCount(0, 'materi');

    // Laporan materi tanpa kelas memuat murid SELURUH sekolah — dulu `class_id`
    // yang kosong membuat laporannya selalu kosong tanpa penjelasan.
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);
    $laporan = $this->getJson("/api/v1/materi/{$materi->id}/laporan")->assertOk();
    $muridDilaporkan = collect($laporan->json('murid'))->pluck('murid_id')->all();

    expect($muridDilaporkan)->toContain($this->murid->id)->toContain($muridLain->id);
});

/**
 * Materi dengan satu kuis sisipan (satu soal pilihan ganda, kunci B, skor 4)
 * yang saklar layar sesudah kuisnya diatur `$tampilan`, sudah terbit.
 *
 * @param  array<string, mixed>  $tampilan
 * @return array{materi: Materi, blok: BlokMateri, soal: Soal}
 */
function m08MateriDenganSaklar(object $ctx, array $tampilan, ?string $pembahasan = null): array
{
    $soal = m08Soal($ctx, 'pilihan_ganda', [
        'teks' => 'Berapa hasil dari 2 + 3?',
        'opsi' => [['id' => 'A', 'teks' => '4'], ['id' => 'B', 'teks' => '5'], ['id' => 'C', 'teks' => '6']],
    ], ['jawaban' => 'B'], 4, $ctx->tag->id);

    if ($pembahasan !== null) {
        $soal->forceFill(['pembahasan' => $pembahasan])->save();
    }

    $kuis = m08Kuis($ctx, [$soal]);
    $materi = m08Materi($ctx);

    auth()->forgetGuards();
    Sanctum::actingAs($ctx->guru);

    test()->putJson("/api/v1/materi/{$materi->id}/blok", ['blok' => [
        ['tipe' => 'kuis', 'wajib' => true, 'quiz_id' => $kuis->id, 'tampilan' => $tampilan],
    ]])->assertOk();

    test()->postJson("/api/v1/materi/{$materi->id}/publikasi")->assertOk();

    return [
        'materi' => $materi,
        'blok' => BlokMateri::query()->where('material_id', $materi->id)->firstOrFail(),
        'soal' => $soal,
    ];
}

it('saklar ringkasan/kartu/papan hanya tersimpan bila dikirim dan dinormalkan ke 0/1', function (): void {
    $dipakai = m08MateriDenganSaklar($this, ['mode' => 'jeda', 'tata' => 'vertikal', 'ringkasan' => true, 'kartu' => 0]);

    expect($dipakai['blok']->fresh()->isi['tampilan'])
        ->toBe(['mode' => 'jeda', 'tata' => 'vertikal', 'ringkasan' => 1, 'kartu' => 0]);
});

it('ringkasan kuis: ditutup sampai latihan dikumpulkan, lalu membuka soal, kartu, dan pembahasan', function (): void {
    $dipakai = m08MateriDenganSaklar($this, ['ringkasan' => 1, 'kartu' => 1], 'Dua tambah tiga sama dengan lima.');
    $materi = $dipakai['materi'];
    $blok = $dipakai['blok'];
    $soal = $dipakai['soal'];
    $url = "/api/v1/materi/{$materi->id}/blok/{$blok->id}/ringkasan-kuis";

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $buka = $this->postJson("/api/v1/materi/{$materi->id}/blok/{$blok->id}/buka")->assertOk();
    $attemptId = (int) $buka->json('attempt.id');

    // Belum dikumpulkan: kunci tidak boleh bocor.
    $this->getJson($url)->assertStatus(422)->assertJsonValidationErrors(['blok']);

    $this->postJson("/api/v1/attempt/{$attemptId}/jawab", ['question_id' => $soal->id, 'jawaban' => 'A'])->assertOk();
    $this->postJson("/api/v1/attempt/{$attemptId}/kumpulkan", ['idempotency_key' => 'ringkasan-1'])->assertOk();

    $respons = $this->getJson($url)->assertOk();

    expect($respons->json('opsi'))->toBe(['ringkasan' => true, 'kartu' => true, 'papan' => false])
        ->and($respons->json('soal.0.teks'))->toBe('Berapa hasil dari 2 + 3?')
        ->and($respons->json('soal.0.benar'))->toBeFalse()
        ->and($respons->json('soal.0.jawaban_benar'))->toBe('5')
        ->and($respons->json('soal.0.pembahasan'))->toBe('Dua tambah tiga sama dengan lima.')
        ->and($respons->json('kartu.0.depan'))->toBe('Berapa hasil dari 2 + 3?')
        ->and($respons->json('kartu.0.belakang'))->toBe('5')
        ->and($respons->json('papan'))->toBeNull();
});

it('ringkasan kuis: guru yang tidak membukanya mendapat 404, dan murid lain tidak bisa mengintip', function (): void {
    $mati = m08MateriDenganSaklar($this, ['mode' => 'jeda', 'tata' => 'vertikal']);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $this->postJson("/api/v1/materi/{$mati['materi']->id}/blok/{$mati['blok']->id}/buka")->assertOk();
    $this->getJson("/api/v1/materi/{$mati['materi']->id}/blok/{$mati['blok']->id}/ringkasan-kuis")->assertNotFound();
});

it('papan peringkat latihan: terpisah dari ranking resmi dan urut skor', function (): void {
    $dipakai = m08MateriDenganSaklar($this, ['papan' => 1]);
    $materi = $dipakai['materi'];
    $blok = $dipakai['blok'];
    $soal = $dipakai['soal'];

    $kerjakan = function (Murid $murid, string $pilihan, string $kunci) use ($materi, $blok, $soal): void {
        auth()->forgetGuards();
        Sanctum::actingAs($murid->user);

        $attemptId = (int) test()->postJson("/api/v1/materi/{$materi->id}/blok/{$blok->id}/buka")->assertOk()->json('attempt.id');
        test()->postJson("/api/v1/attempt/{$attemptId}/jawab", ['question_id' => $soal->id, 'jawaban' => $pilihan])->assertOk();
        test()->postJson("/api/v1/attempt/{$attemptId}/kumpulkan", ['idempotency_key' => $kunci])->assertOk();
        test()->postJson("/api/v1/materi/{$materi->id}/blok/{$blok->id}/selesai")->assertOk();
    };

    $teman = Murid::factory()->create(['school_id' => $this->sekolah->id, 'class_id' => $this->kelas->id]);

    $kerjakan($teman, 'B', 'papan-teman');
    $kerjakan($this->murid, 'A', 'papan-saya');

    $respons = $this->getJson("/api/v1/materi/{$materi->id}/blok/{$blok->id}/ringkasan-kuis")->assertOk();

    expect($respons->json('papan.peserta'))->toBe(2)
        ->and($respons->json('papan.teratas.0.nama'))->toBe($teman->user->name)
        ->and($respons->json('papan.teratas.0.peringkat'))->toBe(1)
        ->and($respons->json('papan.teratas.0.saya'))->toBeFalse()
        ->and($respons->json('papan.teratas.1.saya'))->toBeTrue()
        ->and($respons->json('papan.teratas.1.peringkat'))->toBe(2)
        // Latihan tidak pernah menjadi skor asli, jadi tidak ada di ranking resmi.
        ->and(Attempt::query()->where('asli', true)->count())->toBe(0);
});

it('menyimpan klip media dari TAUTAN dan menyematkannya lewat alamat resmi server', function (): void {
    // 14 Oktober 2026: klip media boleh bersumber tautan (YouTube/Drive/berkas
    // langsung) tanpa unggahan. Yang diuji di sini bukan cuma "bisa disimpan",
    // tetapi juga dua hal yang dijaga server:
    //  (a) alamat sematan DIHITUNG SERVER (`youtube-nocookie.com`), bukan dari
    //      klien, jadi guru tidak bisa menyelipkan bingkai host sembarang;
    //  (b) tautan yang tidak aman (http / alamat lokal / bukan tautan) DITOLAK.
    $materi = m08Materi($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->putJson("/api/v1/materi/{$materi->id}/blok", ['blok' => [
        // Semua klip opsional supaya tiap blok memang boleh dibuka murid —
        // yang diuji di sini isi payload-nya, bukan urutan wajib (ada tesnya sendiri).
        ['tipe' => 'media', 'wajib' => false, 'isi' => [
            'tautan' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'keterangan' => 'Video pecahan',
        ]],
        ['tipe' => 'media', 'wajib' => false, 'isi' => [
            'tautan' => 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view',
        ]],
        ['tipe' => 'media', 'wajib' => false, 'isi' => [
            'tautan' => 'https://sekolah.example.test/materi/peta-pecahan.mp4',
        ]],
        ['tipe' => 'media', 'wajib' => false, 'isi' => [
            'tautan' => 'https://sekolah.example.test/bank-soal/artikel-pecahan',
        ]],
    ]])->assertOk();

    // Guru membaca kembali apa yang ia tempelkan (alamat ASLI, bukan sematan).
    $blok = $this->getJson("/api/v1/materi/{$materi->id}")->assertOk()->json('blok');

    expect($blok[0]['tautan'])->toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
        ->and($blok[0]['unggahan_kode'])->toBe('');

    // Murid melihat sumbernya sudah lengkap: sematan hanya untuk YouTube/Drive.
    $this->postJson("/api/v1/materi/{$materi->id}/publikasi")->assertOk();

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    // Media memang baru dikirim saat blok DIBUKA (daftar progres sengaja ringan),
    // jadi ambil id bloknya dari daftar lalu buka satu per satu.
    $daftar = $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertOk()->json('blok');

    $media = [];

    foreach ($daftar as $baris) {
        $media[] = $this->postJson("/api/v1/materi/{$materi->id}/blok/{$baris['block_id']}/buka")
            ->assertOk()
            ->json('blok.media');
    }

    expect($media[0]['sumber'])->toBe('tautan')
        ->and($media[0]['jenis'])->toBe('youtube')
        ->and($media[0]['sematan'])->toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
        ->and($media[0]['url'])->toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
        ->and($media[0]['tampil_langsung'])->toBeTrue()
        ->and($media[0]['keterangan'])->toBe('Video pecahan')
        ->and($media[1]['sematan'])->toBe('https://drive.google.com/file/1AbCdEfGhIjKlMnOpQrStUvWxYz/preview')
        ->and($media[2]['sematan'])->toBeNull()
        ->and($media[2]['mime'])->toBe('video/mp4')
        ->and($media[2]['jenis'])->toBe('berkas')
        // Tautan halaman biasa tetap bisa dibuka, tetapi TIDAK disematkan.
        ->and($media[3]['sematan'])->toBeNull()
        ->and($media[3]['tampil_langsung'])->toBeFalse();

    // Tautan tidak aman ditolak, bukan disimpan diam-diam.
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    foreach ([
        'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'javascript:alert(1)',
        'https://192.168.1.10/video.mp4',
        'https://localhost/video.mp4',
    ] as $buruk) {
        $this->putJson("/api/v1/materi/{$materi->id}/blok", ['blok' => [
            ['tipe' => 'media', 'wajib' => true, 'isi' => ['tautan' => $buruk]],
        ]])->assertStatus(422);
    }
});

it('materi contoh bertema gunung siap dipakai murid: video, kuis di dalamnya, dan pos berurutan', function (): void {
    $this->seed(MasterDataSeeder::class);
    $this->seed(MateriContohSeeder::class);

    $materi = Materi::query()->where('judul', MateriContohSeeder::JUDUL)->firstOrFail();

    // Kerangka gunung dipakai utuh: enam pos, satu untuk tiap fase tema bawaan.
    expect($materi->status)->toBe(StatusMateri::Publikasi)
        ->and($materi->tema['kode'] ?? null)->toBe(TemaPerjalanan::BAWAAN)
        ->and($materi->blok()->count())->toBe(6);

    // Kuis buatan seeder wajib punya slug. Klien mensyaratkan `slug` ada dan
    // menjalankan skemanya atas SELURUH daftar, jadi satu baris ber-slug kosong
    // membuat beranda menulis "Gagal memuat jadwal kuis" dan daftar ulangan murid
    // menulis "Gagal memuat ulangan" walau server menjawab 200.
    expect(Kuis::query()->where(function ($q): void {
        $q->whereNull('slug')->orWhere('slug', '');
    })->count())->toBe(0);

    $murid = User::query()->where('email', 'murid4a@sekolah.test')->firstOrFail();

    auth()->forgetGuards();
    Sanctum::actingAs($murid);

    $daftar = $this->getJson('/api/v1/materi-saya')->assertOk();
    expect(collect($daftar->json('materi'))->pluck('judul'))
        ->toContain(MateriContohSeeder::JUDUL);

    $progres = $this->getJson("/api/v1/materi/{$materi->id}/progres")->assertOk();
    $blok = collect($progres->json('blok'));
    $urutan = $blok->pluck('tipe')->all();

    expect($urutan)->toBe(['teks', 'media', 'kuis', 'kuis', 'kuis', 'kuis']);

    // Klip videonya memakai panjang ASLI video yang dirujuk (3 menit 5 detik),
    // supaya pos-pos sesudahnya mulai setelah videonya benar-benar habis.
    $video = $blok->firstWhere('tipe', 'media');
    expect((float) $video['durasi_detik'])->toBe((float) MateriContohSeeder::DURASI_VIDEO)
        ->and((float) $video['durasi_detik'])->toBe(185.0)
        ->and($video['media']['sumber'] ?? null)->toBeNull();

    // Tiga latihannya benar-benar DI DALAM video (host = blok video), bukan bagian
    // terpisah di bawahnya — inilah yang membedakan materi contoh ini dari
    // materi teks biasa. Keduanya bertitik mulai di dalam jendela klip.
    $sisipan = $blok
        ->where('tipe', 'kuis')
        ->filter(static fn (array $satu): bool => $satu['host_id'] !== null)
        ->values();

    expect($sisipan)->toHaveCount(3)
        ->and($sisipan->pluck('host_id')->unique()->all())->toBe([$video['block_id']])
        ->and($sisipan->every(static fn (array $satu): bool => $satu['wajib'] === true))->toBeTrue();

    $mulaiVideo = (float) $video['mulai_detik'];
    $akhirKlip = $mulaiVideo + (float) $video['durasi_detik'];

    foreach ($sisipan as $satu) {
        expect((float) $satu['mulai_detik'])->toBeGreaterThan($mulaiVideo)
            ->toBeLessThan($akhirKlip);
    }

    // Ujian puncaknya di luar klip: mulai tepat saat videonya berakhir.
    $ujianPuncak = $blok->where('tipe', 'kuis')->firstWhere('host_id', null);
    expect((float) $ujianPuncak['mulai_detik'])->toBe($akhirKlip);

    // Pos Puncak belum bisa dibuka sebelum pos wajib sebelumnya selesai: server
    // tetap penentu urutannya, bukan tombol di layar.
    $terakhir = $blok->last();
    expect($terakhir['boleh_dibuka'])->toBeFalse();
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$terakhir['block_id']}/buka")
        ->assertStatus(422);

    // Perjalanan murid dari pos pertama sampai latihan sisipan.
    $posSatu = $blok->first();
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$posSatu['block_id']}/buka")
        ->assertOk()
        ->assertJsonPath('blok.tipe', 'teks');
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$posSatu['block_id']}/selesai")
        ->assertOk();

    // Membuka klip video: server menghitung bingkai sematannya (YouTube), jadi
    // pemutar dan kuis sisipannya hidup di layar murid.
    $bukaVideo = $this->postJson("/api/v1/materi/{$materi->id}/blok/{$video['block_id']}/buka")
        ->assertOk();
    expect($bukaVideo->json('blok.media.sumber'))->toBe('tautan')
        ->and((string) $bukaVideo->json('blok.media.sematan'))->toContain('youtube');

    // Video belum boleh ditutup selama latihan di dalamnya belum dikumpulkan.
    $this->postJson("/api/v1/materi/{$materi->id}/blok/{$video['block_id']}/selesai")
        ->assertStatus(422);

    // Membuka latihan sisipan membuat attempt latihan sungguhan di mesin kuis,
    // dan penjelasan sesudah kuis ikut dikirim (tanpa kunci jawaban).
    $bukaLatihan = $this->postJson("/api/v1/materi/{$materi->id}/blok/{$sisipan[0]['block_id']}/buka")
        ->assertOk();

    expect($bukaLatihan->json('blok.kuis.jumlah_soal'))->toBe(3)
        ->and($bukaLatihan->json('blok.penjelasan.teks'))->toContain('BAHAN fotosintesis')
        ->and($bukaLatihan->json('attempt.id'))->not->toBeNull();
});
