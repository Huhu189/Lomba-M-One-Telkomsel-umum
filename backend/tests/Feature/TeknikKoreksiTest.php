<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Attempt\Models\Jawaban;
use App\Sections\Question\Enums\TeknikKoreksi;
use App\Sections\Question\Enums\TipeSoal;
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
| Teknik koreksi per jenis soal (14 Oktober 2026)
|--------------------------------------------------------------------------
|
| Permintaan pemilik produk: guru boleh memilih cara mengoreksi untuk SEMUA
| jenis soal, tetapi sistem harus jujur soal apa yang bisa dikerjakan mesin —
| "banyak yang hanya bisa manual, ada yang bisa manual otomatis, ada yang bisa
| lebih (teks)".
|
| Yang dijaga di sini: tabel pilihan per jenis soal, penolakan pilihan yang
| tidak bisa ditepati, dan akibatnya di penilaian attempt (teknik manual membuat
| jawaban BENAR pun masuk antrean koreksi guru, bukan dinilai 0 diam-diam).
|
| Tabel di `frontend/src/sections/question/teknikKoreksi.js` adalah kembarannya;
| `teknikKoreksi.test.js` menjaga sisi klien.
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
 * Buat soal lewat API (sekaligus menguji validasi registry).
 *
 * @param  array<string, mixed>  $konten
 * @param  array<string, mixed>  $kunci
 */
function tkSoal(object $ctx, string $tipe, array $konten, array $kunci, int $skor = 4): Soal
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
 * @param  array<int, Soal>  $soal
 */
function tkKuis(object $ctx, array $soal): Kuis
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
 * Kerjakan satu soal lalu kembalikan baris jawabannya.
 *
 * @return array{attempt: int, jawaban: Jawaban}
 */
function tkKerjakan(object $ctx, Kuis $kuis, Soal $soal, mixed $jawaban): array
{
    auth()->forgetGuards();
    Sanctum::actingAs($ctx->murid->user);

    $mulai = test()->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated();
    $attemptId = (int) $mulai->json('id');

    test()->postJson("/api/v1/attempt/{$attemptId}/jawab", [
        'question_id' => $soal->id,
        'jawaban' => $jawaban,
    ])->assertOk();

    test()->postJson("/api/v1/attempt/{$attemptId}/kumpulkan", [
        'idempotency_key' => 'teknik-'.$soal->id,
    ])->assertOk();

    return [
        'attempt' => $attemptId,
        'jawaban' => Jawaban::query()
            ->where('attempt_id', $attemptId)
            ->where('question_id', $soal->id)
            ->firstOrFail(),
    ];
}

it('menyediakan pilihan teknik koreksi yang bisa ditepati tiap jenis soal', function (): void {
    // Satu-satunya jenis yang tidak punya penilaian otomatis sama sekali.
    expect(TipeSoal::TugasUnggah->teknikKoreksiTersedia())->toBe([TeknikKoreksi::Manual])
        ->and(TipeSoal::TugasUnggah->teknikKoreksiBawaan())->toBe(TeknikKoreksi::Manual);

    // Jenis berteks: boleh otomatis dengan toleransi teks, atau manual.
    foreach ([TipeSoal::IsianSingkat, TipeSoal::Uraian] as $tipe) {
        expect($tipe->teknikKoreksiTersedia())->toBe([TeknikKoreksi::OtomatisTeks, TeknikKoreksi::Manual])
            ->and($tipe->teknikKoreksiBawaan())->toBe(TeknikKoreksi::OtomatisTeks);
    }

    // Sisanya: kunci pasti, dan manual bila guru ingin menilai sendiri.
    foreach (TipeSoal::cases() as $tipe) {
        if (in_array($tipe, [TipeSoal::TugasUnggah, TipeSoal::IsianSingkat, TipeSoal::Uraian], true)) {
            continue;
        }

        expect($tipe->teknikKoreksiTersedia())->toBe([TeknikKoreksi::Otomatis, TeknikKoreksi::Manual])
            ->and($tipe->teknikKoreksiBawaan())->toBe(TeknikKoreksi::Otomatis);
    }
});

it('menolak teknik koreksi yang tidak bisa dikerjakan jenis soalnya', function (): void {
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $kontenPg = [
        'teks' => 'Berapa 2 + 2?',
        'opsi' => [['id' => 'A', 'teks' => '3'], ['id' => 'B', 'teks' => '4']],
    ];

    // Pilihan ganda tidak punya penilai teks: "otomatis teks" tidak bisa ditepati.
    $this->postJson('/api/v1/soal', [
        'subject_id' => $this->mapel->id,
        'tipe' => 'pilihan_ganda',
        'konten' => $kontenPg,
        'kunci' => ['jawaban' => 'B', 'teknik_koreksi' => 'otomatis_teks'],
        'skor' => 4,
    ])->assertStatus(422)->assertJsonValidationErrors(['konten']);

    // Tugas unggah tidak punya kunci yang bisa dicocokkan mesin.
    $this->postJson('/api/v1/soal', [
        'subject_id' => $this->mapel->id,
        'tipe' => 'tugas_unggah',
        'konten' => ['teks' => 'Unggah fotonya.', 'jenis_berkas' => 'Semua jenis berkas'],
        'kunci' => ['rubrik' => [['butir' => 'Rapi', 'poin' => 3]], 'teknik_koreksi' => 'otomatis'],
        'skor' => 4,
    ])->assertStatus(422)->assertJsonValidationErrors(['konten']);

    // Nilai yang tidak dikenal juga ditolak (bukan diam-diam jadi bawaan).
    $this->postJson('/api/v1/soal', [
        'subject_id' => $this->mapel->id,
        'tipe' => 'pilihan_ganda',
        'konten' => $kontenPg,
        'kunci' => ['jawaban' => 'B', 'teknik_koreksi' => 'otomatis_banget'],
        'skor' => 4,
    ])->assertStatus(422)->assertJsonValidationErrors(['konten']);
});

it('teknik manual membuat jawaban benar pun menunggu koreksi guru', function (): void {
    $soal = tkSoal($this, 'pilihan_ganda', [
        'teks' => 'Berapa 2 + 2?',
        'opsi' => [['id' => 'A', 'teks' => '3'], ['id' => 'B', 'teks' => '4']],
    ], ['jawaban' => 'B', 'teknik_koreksi' => 'manual']);

    $kuis = tkKuis($this, [$soal]);
    $hasil = tkKerjakan($this, $kuis, $soal, 'B');

    // Jawabannya BENAR, tetapi guru memilih menilai sendiri: tidak ada nilai
    // otomatis yang dipaksakan, dan barisnya masuk antrean koreksi.
    expect($hasil['jawaban']->status->value)->toBe('perlu_tinjau')
        ->and((float) $hasil['jawaban']->skor)->toBe(0.0);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $antrean = $this->getJson("/api/v1/kuis/{$kuis->id}/koreksi")->assertOk();

    expect($antrean->json('jumlah'))->toBe(1)
        ->and($antrean->json('item.0.question_id'))->toBe($soal->id)
        ->and($antrean->json('item.0.jawaban'))->toBe('B')
        // Kunci tetap dikirim ke guru, termasuk pilihan tekniknya.
        ->and($antrean->json('item.0.kunci.teknik_koreksi'))->toBe('manual');
});

it('tanpa pilihan teknik, soal lama tetap dinilai otomatis', function (): void {
    $soal = tkSoal($this, 'pilihan_ganda', [
        'teks' => 'Berapa 2 + 2?',
        'opsi' => [['id' => 'A', 'teks' => '3'], ['id' => 'B', 'teks' => '4']],
    ], ['jawaban' => 'B']);

    $kuis = tkKuis($this, [$soal]);
    $hasil = tkKerjakan($this, $kuis, $soal, 'B');

    expect($hasil['jawaban']->status->value)->toBe('dinilai')
        ->and((float) $hasil['jawaban']->skor)->toBe(4.0);
});

it('uraian memakai bawaan otomatis teks, dan bisa dipindah ke manual', function (): void {
    $konten = ['teks' => 'Jelaskan fotosintesis.'];
    $kunci = ['kata_kunci' => [['teks' => 'klorofil', 'bobot' => 1]]];
    $jawaban = 'Daun memakai klorofil untuk membuat makanan.';

    // Bawaan: dinilai mesin dari kata kunci.
    $otomatis = tkSoal($this, 'uraian', $konten, $kunci);
    $hasilOtomatis = tkKerjakan($this, tkKuis($this, [$otomatis]), $otomatis, $jawaban);

    expect($hasilOtomatis['jawaban']->status->value)->toBe('dinilai')
        ->and((float) $hasilOtomatis['jawaban']->skor)->toBe(4.0);

    // Pilihan guru: manual — kata kuncinya tetap tersimpan sebagai bahan, tetapi
    // nilainya ditentukan guru.
    $manual = tkSoal($this, 'uraian', $konten, [...$kunci, 'teknik_koreksi' => 'manual']);
    $hasilManual = tkKerjakan($this, tkKuis($this, [$manual]), $manual, $jawaban);

    expect($hasilManual['jawaban']->status->value)->toBe('perlu_tinjau')
        ->and((float) $hasilManual['jawaban']->skor)->toBe(0.0);
});
