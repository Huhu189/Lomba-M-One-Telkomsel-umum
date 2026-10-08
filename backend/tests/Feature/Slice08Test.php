<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Material\Jobs\SapuUnggahanYatim;
use App\Sections\Material\Models\BlokMateri;
use App\Sections\Material\Models\Materi;
use App\Sections\Material\Models\UnggahanMateri;
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
