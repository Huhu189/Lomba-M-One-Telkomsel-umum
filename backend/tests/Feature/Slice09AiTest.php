<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Models\Jawaban;
use App\Sections\Question\Enums\TipeSoal;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use App\Sections\Scoring\Jobs\NilaiAiAttempt;
use App\Sections\Scoring\Services\PenilaiAiService;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

/** Kunci uji: harus muncul hanya di header Authorization, tidak di body/log. */
const AI09_KUNCI = 'RAHASIA-UJI-AI-9B';

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '5A', 'tingkat' => 5]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'IPA', 'kode' => 'IPA']);
    $this->guru = User::factory()->guru()->create();
    $this->murid = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);
});

/** Nyalakan penilaian AI untuk satu test. */
function ai09Nyalakan(int $maksSoal = 5): void
{
    config([
        'ai.aktif' => true,
        'ai.kunci' => AI09_KUNCI,
        'ai.url' => 'https://ai.contoh.test/v1/chat/completions',
        'ai.model' => 'model-uji',
        'ai.timeout_detik' => 5,
        'ai.maks_soal_per_permintaan' => $maksSoal,
    ]);
}

/** Balasan model yang valid (JSON di dalam content), sesuai urutan nomor. */
function ai09Balas(array $penilaian, int $status = 200)
{
    return Http::response([
        'choices' => [
            ['message' => ['content' => (string) json_encode(['penilaian' => $penilaian])]],
        ],
    ], $status);
}

function ai09Soal(object $ctx, float $skor = 4): Soal
{
    return Soal::factory()->untukSekolah($ctx->sekolah, $ctx->mapel)->create([
        'tipe' => TipeSoal::Uraian,
        'konten' => ['teks' => 'Jelaskan proses fotosintesis.'],
        'kunci' => ['kata_kunci' => [['teks' => 'fotosintesis'], ['teks' => 'klorofil']], 'ambang_lulus' => 0.6],
        'skor' => $skor,
    ]);
}

/**
 * @param  array<int, Soal>  $soal
 */
function ai09Kuis(object $ctx, array $soal): Kuis
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

/**
 * Kerjakan kuis lewat API (submit ikut memicu antrean saran AI kalau menyala).
 *
 * @param  array<int, mixed>  $jawaban  peta question_id => jawaban
 */
function ai09Kerjakan(object $ctx, Kuis $kuis, array $jawaban): Attempt
{
    auth()->forgetGuards();
    Sanctum::actingAs($ctx->murid->user);

    $attemptId = (int) test()->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated()->json('id');

    foreach ($jawaban as $soalId => $nilai) {
        test()->postJson("/api/v1/attempt/{$attemptId}/jawab", ['question_id' => $soalId, 'jawaban' => $nilai])->assertOk();
    }

    test()->postJson("/api/v1/attempt/{$attemptId}/kumpulkan", ['idempotency_key' => 'ai-'.uniqid()])->assertOk();

    return Attempt::query()->findOrFail($attemptId);
}

function ai09Baris(Attempt $attempt, Soal $soal): Jawaban
{
    return Jawaban::query()
        ->where('attempt_id', $attempt->getKey())
        ->where('question_id', $soal->getKey())
        ->firstOrFail();
}

it('bawaannya mati: mengumpulkan tidak memanggil AI sama sekali', function (): void {
    Http::fake();

    $uraian = ai09Soal($this);
    $kuis = ai09Kuis($this, [$uraian]);
    $attempt = ai09Kerjakan($this, $kuis, [$uraian->id => 'Belum tahu.']);

    Http::assertNothingSent();

    $baris = ai09Baris($attempt, $uraian);

    expect(config('ai.aktif'))->toBeFalse()
        ->and($baris->status->value)->toBe('perlu_tinjau')
        ->and($baris->skor_ai)->toBeNull()
        ->and($baris->ai_status)->toBeNull();
});

it('saran AI dipotong ke rentang soal dan tidak pernah menimpa nilai final', function (): void {
    ai09Nyalakan();

    $kecil = ai09Soal($this, 4);
    $besar = ai09Soal($this, 6);

    Http::fake([
        'ai.contoh.test/*' => ai09Balas([
            // Model sengaja berlebihan dan di luar rentang: harus diklamp server.
            ['nomor' => 1, 'skor' => 999, 'alasan' => 'Jawaban lengkap dan tepat.'],
            ['nomor' => 2, 'skor' => -5, 'alasan' => 'Jawaban belum menjawab pertanyaan.'],
        ]),
    ]);

    $kuis = ai09Kuis($this, [$kecil, $besar]);
    $attempt = ai09Kerjakan($this, $kuis, [$kecil->id => 'Belum tahu.', $besar->id => 'Tidak tahu.']);

    $barisKecil = ai09Baris($attempt, $kecil);
    $barisBesar = ai09Baris($attempt, $besar);

    expect($barisKecil->skor_ai)->toEqual(4.0)
        ->and($barisBesar->skor_ai)->toEqual(0.0)
        ->and($barisKecil->ai_status->value)->toBe('saran')
        ->and($barisKecil->alasan_ai)->toBe('Jawaban lengkap dan tepat.');

    // Nilai final tetap milik mesin + guru: skor 0, status tetap perlu ditinjau.
    expect($barisKecil->skor)->toEqual(0.0)
        ->and($barisKecil->status->value)->toBe('perlu_tinjau')
        ->and($barisKecil->dinilai_manual)->toBeFalse()
        ->and($attempt->refresh()->skor)->toEqual(0.0);

    // Jejak audit saran AI, terpisah dari audit koreksi guru.
    $audit = DB::table('activity_log')->where('log_name', 'penilaian_ai')->get();

    expect($audit)->toHaveCount(2)
        ->and($audit->first()->event)->toBe('saran_ai')
        ->and((string) $audit->first()->properties)->toContain('skor_ai');
});

it('satu permintaan per ulangan, dipecah bila soalnya lebih banyak dari batas', function (): void {
    ai09Nyalakan();

    $soal = [ai09Soal($this), ai09Soal($this), ai09Soal($this)];

    Http::fake(['ai.contoh.test/*' => ai09Balas([
        ['nomor' => 1, 'skor' => 1, 'alasan' => 'Sebagian benar.'],
        ['nomor' => 2, 'skor' => 1, 'alasan' => 'Sebagian benar.'],
        ['nomor' => 3, 'skor' => 1, 'alasan' => 'Sebagian benar.'],
    ])]);

    $kuis = ai09Kuis($this, $soal);
    $attempt = ai09Kerjakan($this, $kuis, [
        $soal[0]->id => 'Belum tahu.',
        $soal[1]->id => 'Tidak tahu.',
        $soal[2]->id => 'Kurang tahu.',
    ]);

    // Tiga soal, batas lima → cukup satu permintaan untuk satu ulangan.
    Http::assertSentCount(1);

    // Jawaban murid dikirim sebagai data di dalam pembatas, dan kunci API tidak
    // pernah ikut ke body permintaan (hanya header Authorization).
    Http::assertSent(function (Request $permintaan): bool {
        $pesan = $permintaan->data()['messages'][1]['content'] ?? '';

        return is_string($pesan)
            && str_contains($pesan, PenilaiAiService::PEMBATAS_BUKA)
            && str_contains($pesan, PenilaiAiService::PEMBATAS_TUTUP)
            && str_contains($pesan, 'Belum tahu.')
            && str_contains($pesan, 'fotosintesis')
            // Kunci API hanya di header: tidak pernah ikut ke isi permintaan.
            && ! str_contains($permintaan->body(), AI09_KUNCI)
            && $permintaan->hasHeader('Authorization', 'Bearer '.AI09_KUNCI);
    });

    // Batas dua soal per permintaan → dua panggilan untuk tiga soal.
    Http::fake(['ai.contoh.test/*' => ai09Balas([
        ['nomor' => 1, 'skor' => 1, 'alasan' => 'Sebagian benar.'],
        ['nomor' => 2, 'skor' => 1, 'alasan' => 'Sebagian benar.'],
    ])]);

    config(['ai.maks_soal_per_permintaan' => 2]);

    NilaiAiAttempt::dispatchSync((int) $attempt->getKey());

    Http::assertSentCount(2);
});

it('gagal atau timeout AI berarti perlu ditinjau, bukan nilai nol diam-diam', function (): void {
    ai09Nyalakan();

    $uraian = ai09Soal($this, 4);

    Http::fake([
        'ai.contoh.test/*' => fn () => throw new ConnectionException('Waktu tunggu habis.'),
    ]);

    $kuis = ai09Kuis($this, [$uraian]);
    $attempt = ai09Kerjakan($this, $kuis, [$uraian->id => 'Belum tahu.']);

    $baris = ai09Baris($attempt, $uraian);

    expect($baris->ai_status->value)->toBe('gagal')
        ->and($baris->skor_ai)->toBeNull()
        ->and($baris->status->value)->toBe('perlu_tinjau')
        ->and($baris->skor)->toEqual(0.0)
        ->and($attempt->refresh()->skor)->toEqual(0.0);
});

it('balasan di luar skema atau status non-2xx dianggap gagal', function (): void {
    ai09Nyalakan();

    $uraian = ai09Soal($this, 4);

    // Balasan bukan JSON sama sekali.
    Http::fake([
        'ai.contoh.test/*' => Http::response([
            'choices' => [['message' => ['content' => 'Maaf, saya tidak bisa menilai.']]],
        ]),
    ]);

    $kuis = ai09Kuis($this, [$uraian]);
    $attempt = ai09Kerjakan($this, $kuis, [$uraian->id => 'Belum tahu.']);

    expect(ai09Baris($attempt, $uraian)->ai_status->value)->toBe('gagal');

    // Balasan JSON yang valid tapi bukan skema kita.
    Http::fake([
        'ai.contoh.test/*' => Http::response([
            'choices' => [['message' => ['content' => '{"hasil":"tidak tahu"}']]],
        ]),
    ]);

    $attemptKedua = ai09Kerjakan($this, $kuis, [$uraian->id => 'Tetap belum tahu.']);

    expect(ai09Baris($attemptKedua, $uraian)->ai_status->value)->toBe('gagal');
});

it('alasan mentah AI hanya untuk guru dan tidak pernah sampai ke murid', function (): void {
    ai09Nyalakan();

    $uraian = ai09Soal($this, 4);

    Http::fake([
        'ai.contoh.test/*' => ai09Balas([
            ['nomor' => 1, 'skor' => 2.5, 'alasan' => 'ALASAN-MENTAH-RAHASIA-9B'],
        ]),
    ]);

    $kuis = ai09Kuis($this, [$uraian]);
    $attempt = ai09Kerjakan($this, $kuis, [$uraian->id => 'Belum tahu.']);

    // Murid membuka hasilnya sendiri: tidak ada saran, tidak ada alasan mentah.
    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $hasil = $this->getJson("/api/v1/attempt/{$attempt->id}/hasil")->assertOk();

    expect((string) $hasil->getContent())->not->toContain('ALASAN-MENTAH-RAHASIA-9B')
        ->and((string) $hasil->getContent())->not->toContain('skor_ai');

    // Guru melihat saran itu di antrean koreksi.
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $antrean = $this->getJson("/api/v1/kuis/{$kuis->id}/koreksi")->assertOk();

    expect($antrean->json('ai_aktif'))->toBeTrue()
        ->and($antrean->json('item.0.saran_ai'))->toEqual(2.5)
        ->and($antrean->json('item.0.alasan_ai'))->toBe('ALASAN-MENTAH-RAHASIA-9B')
        ->and($antrean->json('item.0.ai_status'))->toBe('saran')
        ->and($antrean->json('item.0.skor_sekarang'))->toEqual(0.0);
});

it('koreksi guru tidak pernah ditimpa saran AI', function (): void {
    ai09Nyalakan();

    $uraian = ai09Soal($this, 4);
    $kuis = ai09Kuis($this, [$uraian]);

    Http::fake(['ai.contoh.test/*' => ai09Balas([['nomor' => 1, 'skor' => 1, 'alasan' => 'Kurang lengkap.']])]);

    $attempt = ai09Kerjakan($this, $kuis, [$uraian->id => 'Belum tahu.']);

    // Saran pertama sudah tersimpan saat mengumpulkan (queue sync di test).
    expect(ai09Baris($attempt, $uraian)->skor_ai)->toEqual(1.0);

    // Guru mengoreksi manual: nilai final 4 dan baris jadi `dinilai`.
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $alasan = 'Murid menjelaskan secara lisan dengan benar saat ditanya.';
    $token = (string) $this->postJson("/api/v1/attempt/{$attempt->id}/koreksi/token", [
        'question_id' => $uraian->id,
        'alasan' => $alasan,
    ])->assertOk()->json('token');

    $this->postJson("/api/v1/attempt/{$attempt->id}/koreksi", [
        'question_id' => $uraian->id,
        'skor' => 4,
        'alasan' => $alasan,
        'token' => $token,
    ])->assertOk();

    // Saran AI yang datang belakangan dibuang: nilainya sudah diputuskan guru,
    // jadi saran lama pun tidak ditimpa saran baru.
    Http::fake(['ai.contoh.test/*' => ai09Balas([['nomor' => 1, 'skor' => 3.5, 'alasan' => 'Saran baru.']])]);

    NilaiAiAttempt::dispatchSync((int) $attempt->getKey());

    $baris = ai09Baris($attempt, $uraian);

    expect($baris->skor)->toEqual(4.0)
        ->and($baris->dinilai_manual)->toBeTrue()
        ->and($baris->skor_ai)->toEqual(1.0)
        ->and($baris->alasan_ai)->toBe('Kurang lengkap.')
        ->and($baris->status->value)->toBe('dinilai')
        ->and($attempt->refresh()->skor)->toEqual(4.0)
        ->and($attempt->refresh()->jumlah_benar)->toBe(1);
});

it('hanya guru pemilik kuis yang boleh meminta saran AI', function (): void {
    ai09Nyalakan();
    Http::fake(['ai.contoh.test/*' => ai09Balas([['nomor' => 1, 'skor' => 1, 'alasan' => 'Sebagian.']])]);

    $uraian = ai09Soal($this);
    $kuis = ai09Kuis($this, [$uraian]);
    $attempt = ai09Kerjakan($this, $kuis, [$uraian->id => 'Belum tahu.']);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $this->postJson("/api/v1/attempt/{$attempt->id}/nilai-ai")->assertStatus(403);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $respons = $this->postJson("/api/v1/attempt/{$attempt->id}/nilai-ai")->assertOk();

    expect($respons->json('aktif'))->toBeTrue()
        ->and($respons->json('terantre'))->toBe(1);

    // Saat AI dimatikan, endpoint menjawab apa adanya dan tidak memanggil API.
    config(['ai.aktif' => false]);
    Http::fake();

    $mati = $this->postJson("/api/v1/attempt/{$attempt->id}/nilai-ai")->assertOk();

    expect($mati->json('aktif'))->toBeFalse()
        ->and($mati->json('terantre'))->toBe(0);

    Http::assertNothingSent();
});
