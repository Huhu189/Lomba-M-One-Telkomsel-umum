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
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

/*
|--------------------------------------------------------------------------
| Lembar jawaban per murid di Monitor Ulangan (15 Oktober 2026)
|--------------------------------------------------------------------------
|
| Guru yang melihat satu anak berhenti di soal 7 sekarang bisa membuka apa yang
| sudah ditulis anak itu dari layar monitor, tanpa berjalan ke mejanya.
|
| Dua hal yang dijaga tes ini, dan keduanya soal keamanan — bukan sekadar bentuk
| respons:
|
| 1. **Kunci jawaban tidak pernah ikut.** Layar monitor terbuka di depan kelas;
|    satu kunci yang bocor dari sana membatalkan seluruh ulangan. Karena itu
|    `kunci`, `benar`, dan `skor` per soal TIDAK ADA di payload, dan tes ini
|    mengeceknya sebagai ketiadaan kunci — bukan sekadar "ada jawaban murid".
| 2. **Batas bacanya sama dengan monitor (K-04).** Pemilik kuis dan kepala
|    sekolah (mengawasi) boleh; guru lain dan murid tidak. Attempt milik kuis
|    lain dijawab 404 supaya id attempt kuis orang lain tidak bisa ditebak lewat
|    monitor sendiri.
|
*/

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);

    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6A', 'tingkat' => 6]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'MTK', 'kode' => 'MTK6']);
    $this->guru = User::factory()->guru()->create();
    $this->guruLain = User::factory()->guru()->create();
    $this->kepala = User::query()->where('email', 'admin@sekolah.test')->firstOrFail();

    $this->murid = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);

    Cache::flush();
});

/** Kuis berjalan dua soal pilihan ganda (kunci: B) milik guru yang sedang diuji. */
function kuisUntukLembarJawaban(object $ctx, ?User $pemilik = null): Kuis
{
    $kuis = Kuis::factory()->untukSekolah($ctx->sekolah, $ctx->mapel, $ctx->kelas)
        ->milik($pemilik ?? $ctx->guru)->berjalan()->create([
            'acak_soal' => false,
            'acak_opsi' => false,
        ]);

    foreach ([1, 2] as $nomor) {
        $soal = Soal::factory()->untukSekolah($ctx->sekolah, $ctx->mapel)->milik($pemilik ?? $ctx->guru)->create([
            'tipe' => 'pilihan_ganda',
            'konten' => [
                'teks' => 'Soal nomor '.$nomor,
                'opsi' => [['id' => 'A', 'teks' => 'Salah'], ['id' => 'B', 'teks' => 'Benar']],
            ],
            'kunci' => ['jawaban' => 'B'],
            'skor' => 4,
        ]);

        $kuis->soal()->attach($soal->id, ['urutan' => $nomor]);
    }

    return $kuis->refresh();
}

/** Mulai attempt sebagai murid (sesi cookie Sanctum), seperti klien sungguhan. */
function mulaiAttemptLembarJawaban(Murid $murid, Kuis $kuis): Attempt
{
    auth()->forgetGuards();
    Sanctum::actingAs($murid->user);

    $respons = test()->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated();

    return Attempt::query()->findOrFail((int) $respons->json('id'));
}

it('guru pemilik membuka lembar jawaban murid — jawaban per soal, tanpa kunci', function (): void {
    $kuis = kuisUntukLembarJawaban($this);
    $attempt = mulaiAttemptLembarJawaban($this->murid, $kuis);
    $soalPertama = (int) $kuis->soal()->firstOrFail()->id;

    $this->postJson("/api/v1/attempt/{$attempt->id}/jawab", [
        'question_id' => $soalPertama,
        'jawaban' => 'B',
    ])->assertOk();

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $respons = $this->getJson("/api/v1/kuis/{$kuis->id}/monitor/{$attempt->id}/jawaban")
        ->assertOk()
        ->assertJsonPath('attempt.attempt_id', $attempt->id)
        ->assertJsonPath('attempt.nama', $this->murid->user->name)
        ->assertJsonPath('attempt.attempt_no', 1)
        ->assertJsonPath('attempt.terjawab', 1)
        ->assertJsonPath('attempt.jumlah_soal', 2)
        ->assertJsonPath('soal.0.nomor', 1)
        ->assertJsonPath('soal.0.question_id', $soalPertama)
        ->assertJsonPath('soal.0.tipe', 'pilihan_ganda')
        ->assertJsonPath('soal.0.teks', 'Soal nomor 1')
        ->assertJsonPath('soal.0.terjawab', true)
        ->assertJsonPath('soal.0.jawaban', 'B')
        ->assertJsonPath('soal.0.opsi.1.id', 'B')
        ->assertJsonPath('soal.0.opsi.1.teks', 'Benar')
        // Soal kedua belum dijawab, tetapi tetap tampil: pertanyaan guru
        // "anak ini sudah sampai mana?" justru dijawab oleh soal yang kosong.
        ->assertJsonPath('soal.1.terjawab', false)
        ->assertJsonPath('soal.1.jawaban', null);

    expect($respons->json('server_now'))->toBeString();

    // Ketiadaan kunci & penilaian per soal — inilah pagar sebenarnya.
    $respons->assertJsonMissingPath('soal.0.kunci')
        ->assertJsonMissingPath('soal.1.kunci')
        ->assertJsonMissingPath('soal.0.benar')
        ->assertJsonMissingPath('soal.0.skor')
        ->assertJsonMissingPath('soal.1.benar')
        ->assertJsonMissingPath('soal.1.skor');

    expect($respons->getContent())->not->toContain('"kunci"');
});

it('jawaban murid yang sudah dikumpulkan tetap terbaca apa adanya', function (): void {
    $kuis = kuisUntukLembarJawaban($this);
    $attempt = mulaiAttemptLembarJawaban($this->murid, $kuis);
    $soalPertama = (int) $kuis->soal()->firstOrFail()->id;

    $this->postJson("/api/v1/attempt/{$attempt->id}/jawab", [
        'question_id' => $soalPertama,
        'jawaban' => 'B',
    ])->assertOk();

    $this->postJson("/api/v1/attempt/{$attempt->id}/kumpulkan", [
        'idempotency_key' => 'lembar-jawaban-selesai',
    ])->assertOk();

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->getJson("/api/v1/kuis/{$kuis->id}/monitor/{$attempt->id}/jawaban")
        ->assertOk()
        ->assertJsonPath('attempt.status', 'selesai')
        ->assertJsonPath('soal.0.jawaban', 'B')
        ->assertJsonPath('attempt.terjawab', 1);
});

it('guru lain dan murid ditolak membuka lembar jawaban', function (): void {
    $kuis = kuisUntukLembarJawaban($this);
    $attempt = mulaiAttemptLembarJawaban($this->murid, $kuis);

    // Guru lain: kunci soal dan tulisan anak bukan miliknya (K-04).
    auth()->forgetGuards();
    Sanctum::actingAs($this->guruLain);
    $this->getJson("/api/v1/kuis/{$kuis->id}/monitor/{$attempt->id}/jawaban")->assertStatus(403);

    // Murid: monitor memuat keadaan seluruh kelas, bukan miliknya sendiri.
    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);
    $this->getJson("/api/v1/kuis/{$kuis->id}/monitor/{$attempt->id}/jawaban")->assertStatus(403);

    // Pemiliknya tetap boleh — 403 di atas bukan karena jalurnya mati.
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);
    $this->getJson("/api/v1/kuis/{$kuis->id}/monitor/{$attempt->id}/jawaban")->assertOk();
});

it('kepala sekolah boleh membaca lembar jawaban seperti ia membaca monitor', function (): void {
    $kuis = kuisUntukLembarJawaban($this);
    $attempt = mulaiAttemptLembarJawaban($this->murid, $kuis);

    auth()->forgetGuards();
    Sanctum::actingAs($this->kepala);

    $this->getJson("/api/v1/kuis/{$kuis->id}/monitor/{$attempt->id}/jawaban")
        ->assertOk()
        ->assertJsonPath('attempt.attempt_id', $attempt->id);
});

it('attempt dari kuis lain dijawab 404, bukan 403', function (): void {
    $kuis = kuisUntukLembarJawaban($this);
    $kuisLain = kuisUntukLembarJawaban($this);

    $attemptLain = mulaiAttemptLembarJawaban($this->murid, $kuisLain);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    // Id attempt kuis lain tidak boleh bisa "dipinjam" lewat monitor kuis ini.
    $this->getJson("/api/v1/kuis/{$kuis->id}/monitor/{$attemptLain->id}/jawaban")->assertNotFound();
});
