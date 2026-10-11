<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Models\Jawaban;
use App\Sections\Question\Models\Soal;
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

/*
|--------------------------------------------------------------------------
| Sapuan dasar: setiap tipe soal jalan dari bank soal sampai dinilai
|--------------------------------------------------------------------------
|
| Satu baris dataset = satu tipe soal. Jalur yang ditempuh sama seperti guru
| dan murid sungguhan (lewat HTTP): soal dibuat di /soal, dimasukkan ke kuis,
| murid memulai attempt, payload yang sampai ke murid diperiksa, jawaban BENAR
| dikirim lewat /jawab, lalu attempt dikumpulkan dan nilainya diperiksa.
|
| Registry sudah punya tes per tipe (Slice06Test, Slice11TipeSoalTest). Yang
| dijaga di sini adalah SAMBUNGANNYA: bentuk jawaban yang dikirim renderer
| frontend benar-benar diterima dan dinilai server, dan kunci jawaban tidak
| bocor ke payload murid — bukan sekadar "tidak 500".
|
*/

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '4A', 'tingkat' => 4]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Matematika', 'kode' => 'MAT']);
    $this->guru = User::factory()->guru()->create();
    $this->murid = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);
});

/**
 * Buat soal lewat API sebagai guru.
 *
 * @param  array<string, mixed>  $konten
 * @param  array<string, mixed>  $kunci
 */
function alurSoal(object $ctx, string $tipe, array $konten, array $kunci, int $skor = 4): Soal
{
    auth()->forgetGuards();
    Sanctum::actingAs($ctx->guru);

    $respons = test()->postJson('/api/v1/soal', [
        'subject_id' => $ctx->mapel->id,
        'tipe' => $tipe,
        'konten' => $konten,
        'kunci' => $kunci,
        'skor' => $skor,
    ])->assertCreated();

    return Soal::query()->findOrFail((int) $respons->json('id'));
}

/**
 * Kuis berisi soal yang baru dibuat, milik guru yang sedang masuk.
 *
 * @param  array<int, Soal>  $soal
 */
function alurKuis(object $ctx, array $soal): Kuis
{
    $kuis = Kuis::factory()->untukSekolah($ctx->sekolah, $ctx->mapel, $ctx->kelas)
        ->milik($ctx->guru)->berjalan()->create([
            'acak_soal' => false,
            'acak_opsi' => false,
        ]);

    foreach (array_values($soal) as $urutan => $satu) {
        $kuis->soal()->attach($satu->id, ['urutan' => $urutan + 1]);
    }

    return $kuis->refresh();
}

/**
 * Satu baris dataset: tipe, isi soal, kunci, jawaban BENAR seperti yang
 * dikirim renderer frontend, lalu status & skor yang diharapkan.
 *
 * @return array<string, array{0: string, 1: array<string, mixed>, 2: array<string, mixed>, 3: mixed, 4: string, 5: float}>
 */
dataset('tipe soal dasar', function (): array {
    $teks = ['teks' => 'Soal sapuan dasar.'];

    return [
        'pilihan ganda' => ['pilihan_ganda', [...$teks, 'opsi' => [
            ['id' => 'A', 'teks' => '13'],
            ['id' => 'B', 'teks' => '14'],
            ['id' => 'C', 'teks' => '15'],
            ['id' => 'D', 'teks' => '16'],
        ]], ['jawaban' => 'C'], 'C', 'dinilai', 4.0],

        'benar salah' => ['benar_salah', $teks, ['benar' => true], true, 'dinilai', 4.0],

        'menjodohkan' => ['menjodohkan', [...$teks,
            'kiri' => [['id' => 'k1', 'teks' => '6 x 2'], ['id' => 'k2', 'teks' => '20 - 5']],
            'kanan' => [['id' => 'n1', 'teks' => '12'], ['id' => 'n2', 'teks' => '15']],
        ], ['pasangan' => ['k1' => 'n1', 'k2' => 'n2']], ['k1' => 'n1', 'k2' => 'n2'], 'dinilai', 4.0],

        'mengurutkan' => ['mengurutkan', [...$teks,
            'item' => [['id' => 'i1', 'teks' => '9'], ['id' => 'i2', 'teks' => '3'], ['id' => 'i3', 'teks' => '7']],
        ], ['urutan' => ['i2', 'i3', 'i1']], ['i1' => 3, 'i2' => 1, 'i3' => 2], 'dinilai', 4.0],

        'isian singkat' => ['isian_singkat', $teks, ['jawaban_baku' => ['Jakarta']], 'Jakarta', 'dinilai', 4.0],

        'uraian' => ['uraian', $teks, ['kata_kunci' => [['teks' => 'klorofil', 'bobot' => 1]]],
            'Daun memakai klorofil untuk membuat makanan.', 'dinilai', 4.0],

        'letak kata' => ['letak_kata', [...$teks,
            'kata' => [['id' => 'w1', 'teks' => 'Ibu'], ['id' => 'w2', 'teks' => 'memasak']],
            'posisi' => [['id' => 'p1', 'teks' => 'Subjek'], ['id' => 'p2', 'teks' => 'Predikat']],
        ], ['penempatan' => ['w1' => 'p1', 'w2' => 'p2']], ['w1' => 'p1', 'w2' => 'p2'], 'dinilai', 4.0],

        'hubung kata' => ['hubung_kata', [...$teks,
            'kiri' => [['id' => 'a', 'teks' => 'Besar'], ['id' => 'b', 'teks' => 'Panas']],
            'kanan' => [['id' => 'x', 'teks' => 'Kecil'], ['id' => 'y', 'teks' => 'Dingin']],
        ], ['sambungan' => ['a' => 'x', 'b' => 'y']], ['a' => 'x', 'b' => 'y'], 'dinilai', 4.0],

        'pilihan ganda kompleks' => ['pilihan_ganda_kompleks', [...$teks, 'opsi' => [
            ['id' => 'o1', 'teks' => '4'],
            ['id' => 'o2', 'teks' => '7'],
            ['id' => 'o3', 'teks' => '10'],
            ['id' => 'o4', 'teks' => '15'],
        ]], ['benar' => ['o1', 'o3']], ['o1', 'o3'], 'dinilai', 4.0],

        'benar salah majemuk' => ['benar_salah_majemuk', [...$teks, 'pernyataan' => [
            ['id' => 'p1', 'teks' => '1 + 1 = 2'],
            ['id' => 'p2', 'teks' => '2 + 2 = 5'],
        ]], ['jawaban' => ['p1' => true, 'p2' => false]], ['p1' => true, 'p2' => false], 'dinilai', 4.0],

        'isian angka' => ['isian_angka', [...$teks, 'satuan' => 'cm'],
            ['nilai' => 21, 'toleransi' => 0], '21', 'dinilai', 4.0],

        'pilihan gambar' => ['pilihan_gambar', [...$teks, 'opsi' => [
            ['id' => 'g1', 'media' => '/media/lingkaran.png'],
            ['id' => 'g2', 'media' => '/media/persegi.png'],
        ]], ['benar' => 'g1'], 'g1', 'dinilai', 4.0],

        'urut gambar' => ['urut_gambar', [...$teks, 'item' => [
            ['id' => 'u1', 'media' => '/media/a.png'],
            ['id' => 'u2', 'media' => '/media/b.png'],
            ['id' => 'u3', 'media' => '/media/c.png'],
        ]], ['urutan' => ['u2', 'u1', 'u3']], ['u2', 'u1', 'u3'], 'dinilai', 4.0],

        'susun huruf' => ['susun_huruf', ['petunjuk' => 'Nama hewan mengeong.'],
            ['kata' => 'kucing'], 'kucing', 'dinilai', 4.0],

        'isian rumpang' => ['isian_rumpang', ['teks' => 'Ibu kota Indonesia {{1}} dan 6 x 7 = {{2}}.'],
            ['lubang' => ['1' => ['Jakarta'], '2' => ['42']]], ['1' => 'Jakarta', '2' => '42'], 'dinilai', 4.0],

        'klasifikasi' => ['klasifikasi', [...$teks,
            'item' => [['id' => 'i1', 'teks' => 'kucing'], ['id' => 'i2', 'teks' => 'ayam']],
            'kotak' => [['id' => 'k1', 'label' => 'Mamalia'], ['id' => 'k2', 'label' => 'Unggas']],
        ], ['peta' => ['i1' => 'k1', 'i2' => 'k2']], ['i1' => 'k1', 'i2' => 'k2'], 'dinilai', 4.0],

        'tabel isian' => ['tabel_isian', [...$teks,
            'kolom' => ['Soal', 'Hasil'],
            'baris' => [
                ['id' => 'r1', 'sel' => [['kode' => 'r1c1', 'teks' => '3 x 4'], ['kode' => 'r1c2']]],
                ['id' => 'r2', 'sel' => [['kode' => 'r2c1', 'teks' => '5 x 5'], ['kode' => 'r2c2']]],
            ],
        ], ['sel' => ['r1c2' => ['12'], 'r2c2' => ['25']]], ['r1c2' => '12', 'r2c2' => '25'], 'dinilai', 4.0],

        'garis bilangan' => ['garis_bilangan', [...$teks, 'min' => 0, 'max' => 10, 'langkah' => 1],
            ['nilai' => 7, 'toleransi' => 0], 7, 'dinilai', 4.0],

        'hotspot gambar' => ['hotspot_gambar', [...$teks, 'media' => '/media/bentuk.png', 'area' => [
            ['id' => 'a1', 'x' => 0.0, 'y' => 0.0, 'w' => 0.3, 'h' => 0.3],
            ['id' => 'a2', 'x' => 0.5, 'y' => 0.5, 'w' => 0.2, 'h' => 0.2],
        ]], ['area_benar' => ['a2']], ['x' => 0.6, 'y' => 0.6], 'dinilai', 4.0],

        'baca jam' => ['baca_jam', $teks, ['jam' => 7, 'menit' => 30], ['jam' => 7, 'menit' => 30], 'dinilai', 4.0],

        'teka silang mini' => ['teka_silang_mini', [
            'grid' => [['', '', ''], ['#', '', '#']],
            'mendatar' => [['nomor' => 1, 'teks' => 'Nama hewan mengeong.', 'sel' => ['0,0', '0,1', '0,2']]],
            'menurun' => [['nomor' => 2, 'teks' => 'Di tengah baris kedua.', 'sel' => ['0,1', '1,1']]],
        ], ['sel' => ['0,0' => 'k', '0,1' => 'a', '0,2' => 't', '1,1' => 'i']],
            ['0,0' => 'k', '0,1' => 'a', '0,2' => 't', '1,1' => 'i'], 'dinilai', 4.0],

        // Tugas unggah tidak pernah dinilai otomatis: guru menilai lewat rubrik.
        'tugas unggah' => ['tugas_unggah', [...$teks, 'jenis_berkas' => 'Foto JPG atau PNG'],
            ['rubrik' => [['butir' => 'Langkah lengkap', 'poin' => 3]]],
            'attempt/1/jawaban/lampiran.jpg', 'perlu_tinjau', 0.0],
    ];
});

it('tipe soal :dataset jalan dari bank soal sampai dinilai', function (
    string $tipe,
    array $konten,
    array $kunci,
    mixed $jawaban,
    string $statusHarapan,
    float $skorHarapan,
): void {
    $soal = alurSoal($this, $tipe, $konten, $kunci);
    $kuis = alurKuis($this, [$soal]);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $mulai = $this->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated();
    $attemptId = (int) $mulai->json('id');
    $payload = (array) $mulai->json('soal');

    // 1) Soal tipe ini benar-benar sampai ke murid...
    expect($payload)->toHaveCount(1)
        ->and($payload[0]['tipe'])->toBe($tipe)
        // ...dan kunci jawaban tidak ikut (payload murid ditulis eksplisit di
        // SoalMuridResource/AttemptService; ini pagar terakhirnya).
        ->and($mulai->getContent())->not->toContain('kunci');

    // 2) Jawaban BENAR dari murid (bentuk kiriman renderer) diterima.
    $this->postJson("/api/v1/attempt/{$attemptId}/jawab", [
        'question_id' => $soal->id,
        'jawaban' => $jawaban,
    ])->assertOk();

    $this->postJson("/api/v1/attempt/{$attemptId}/kumpulkan", [
        'idempotency_key' => "sapuan-dasar-{$tipe}",
    ])->assertOk();

    // 3) Baris jawaban benar-benar dinilai, bukan `gagal`/tersangkut `menunggu`.
    $baris = Jawaban::query()
        ->where('attempt_id', $attemptId)
        ->where('question_id', $soal->id)
        ->firstOrFail();

    expect($baris->status->value)->toBe($statusHarapan, "Tipe {$tipe} berakhir '{$baris->status->value}'.")
        ->and($baris->skor)->toBe($skorHarapan, "Tipe {$tipe} mendapat skor {$baris->skor}, seharusnya {$skorHarapan}.");

    // 4) Skor attempt mengikuti skor soal.
    $attempt = Attempt::query()->findOrFail($attemptId);

    expect($attempt->skor)->toBe($skorHarapan)
        ->and($attempt->jumlah_benar)->toBe($skorHarapan > 0 ? 1 : 0);
})->with('tipe soal dasar');
