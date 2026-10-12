<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Cheat\Models\KejadianKecurangan;
use App\Sections\Presence\Services\DenyutProteksiService;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use App\Sections\Settings\Enums\KunciPengaturan;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

/*
|--------------------------------------------------------------------------
| Denyut proteksi ber-nonce (2D)
|--------------------------------------------------------------------------
|
| Bedanya dengan kehadiran: kehadiran menjawab "murid masih ada", denyut
| menjawab "sensor di perangkatnya masih hidup". Tes di sini menjaga tiga sisi
| yang mudah salah: (1) nonce yang salah/diulang tidak menyegarkan liveness,
| (2) sapuan hanya menuduh saat denyut benar-benar berhenti, sekali saja, dan
| (3) attempt yang sudah selesai/lewat deadline tidak ikut dituduh.
|
*/

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '5C', 'tingkat' => 5]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'IPA', 'kode' => 'IPA']);
    $this->guru = User::factory()->guru()->create();
    $this->murid = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);
    $this->muridLain = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);
    Cache::flush();
});

/** Kuis berjalan berisi satu soal, siap dikerjakan. */
function kuisBerjalanD2(object $ctx): Kuis
{
    $kuis = Kuis::factory()->untukSekolah($ctx->sekolah, $ctx->mapel, $ctx->kelas)
        ->milik($ctx->guru)->berjalan()->create([
            'acak_soal' => false,
            'acak_opsi' => false,
        ]);

    $soal = Soal::factory()->untukSekolah($ctx->sekolah, $ctx->mapel)->milik($ctx->guru)->create([
        'tipe' => 'pilihan_ganda',
        'konten' => [
            'teks' => 'Soal denyut',
            'opsi' => [['id' => 'A', 'teks' => 'Salah'], ['id' => 'B', 'teks' => 'Benar']],
        ],
        'kunci' => ['jawaban' => 'B'],
        'skor' => 4,
    ]);

    $kuis->soal()->attach($soal->id, ['urutan' => 1]);

    return $kuis->refresh();
}

/** Mulai attempt sebagai murid (sesi cookie Sanctum). */
function mulaiAttemptD2(Murid $murid, Kuis $kuis): Attempt
{
    auth()->forgetGuards();
    Sanctum::actingAs($murid->user);

    $respons = test()->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated();

    return Attempt::query()->findOrFail((int) $respons->json('id'));
}

/** Nyalakan proteksi anti-cheat untuk satu kuis (lapis kuis). */
function nyalakanProteksiD2(object $ctx, Kuis $kuis): void
{
    auth()->forgetGuards();
    Sanctum::actingAs($ctx->guru);

    test()->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis', 'lingkup_id' => $kuis->id,
        'kunci' => KunciPengaturan::AntiCheat->value, 'nilai' => true,
    ])->assertOk();

    test()->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis', 'lingkup_id' => $kuis->id,
        'kunci' => KunciPengaturan::BlockPaste->value, 'nilai' => true,
    ])->assertOk();
}

/** Geser waktu denyut terakhir ke belakang supaya melewati ambang hilang. */
function hentikanDenyutD2(Attempt $attempt): void
{
    Cache::put('denyut:attempt:'.$attempt->getKey(), [
        'nonce' => 'nonce-basi',
        'terakhir' => Carbon::now()
            ->subSeconds(DenyutProteksiService::AMBANG_HILANG_DETIK + 20)
            ->toIso8601String(),
    ], DenyutProteksiService::TTL_DETIK);
}

it('aktifkan menerbitkan nonce, dan hanya nonce yang benar yang dirotasi', function (): void {
    $kuis = kuisBerjalanD2($this);
    $attempt = mulaiAttemptD2($this->murid, $kuis);
    $layanan = app(DenyutProteksiService::class);

    $nonce = $layanan->aktifkan($attempt);

    expect($nonce)->toBeString()->and(strlen($nonce))->toBe(32)
        ->and($layanan->nonce($attempt))->toBe($nonce);

    // Nonce salah ditolak DAN tidak menyegarkan liveness (nonce lama tetap).
    expect($layanan->denyut($attempt, 'nonce-palsu'))->toBeNull()
        ->and($layanan->denyut($attempt, null))->toBeNull()
        ->and($layanan->nonce($attempt))->toBe($nonce);

    $baru = $layanan->denyut($attempt, $nonce);

    expect($baru)->toBeString()->not->toBe($nonce)
        ->and($layanan->nonce($attempt))->toBe($baru);

    // Kiriman lama (pemutaran ulang) sudah tidak berlaku sesudah rotasi.
    expect($layanan->denyut($attempt, $nonce))->toBeNull()
        ->and($layanan->denyut($attempt, $baru))->toBeString();
});

it('sapu mencatat tamper_suspected sekali saja saat denyut berhenti', function (): void {
    $kuis = kuisBerjalanD2($this);
    $attempt = mulaiAttemptD2($this->murid, $kuis);
    $layanan = app(DenyutProteksiService::class);

    $layanan->aktifkan($attempt);
    hentikanDenyutD2($attempt);

    expect($layanan->sapu())->toBe(1)
        ->and(KejadianKecurangan::query()->where('kategori', 'tamper_suspected')->count())->toBe(1);

    $catatan = KejadianKecurangan::query()->where('kategori', 'tamper_suspected')->firstOrFail();

    expect($catatan->dari_klien)->toBeFalse()
        ->and($catatan->skor_risiko)->toBe(9)
        ->and($catatan->attempt_id)->toBe($attempt->id);

    // Sapuan berkala tidak menumpuk catatan yang sama.
    expect($layanan->sapu())->toBe(0)
        ->and(KejadianKecurangan::query()->where('kategori', 'tamper_suspected')->count())->toBe(1);
});

it('sapu tidak menuduh selama denyut masih segar', function (): void {
    $kuis = kuisBerjalanD2($this);
    $attempt = mulaiAttemptD2($this->murid, $kuis);
    $layanan = app(DenyutProteksiService::class);

    $layanan->aktifkan($attempt);

    expect($layanan->sapu())->toBe(0)
        ->and(KejadianKecurangan::query()->where('kategori', 'tamper_suspected')->count())->toBe(0);
});

it('sapu tidak menuduh attempt yang lewat deadline', function (): void {
    $kuis = kuisBerjalanD2($this);
    $attempt = mulaiAttemptD2($this->murid, $kuis);
    $layanan = app(DenyutProteksiService::class);

    $layanan->aktifkan($attempt);
    hentikanDenyutD2($attempt);

    // Ulangannya sudah ditutup: klien berhenti karena waktunya habis, bukan
    // karena sensornya dimatikan.
    $attempt->forceFill(['deadline_at' => Carbon::now()->subMinute()])->save();

    expect($layanan->sapu())->toBe(0)
        ->and(KejadianKecurangan::query()->where('kategori', 'tamper_suspected')->count())->toBe(0);
});

it('payload attempt mengirim nonce denyut saat proteksi menyala, dan endpoint merotasinya', function (): void {
    $kuis = kuisBerjalanD2($this);
    $attempt = mulaiAttemptD2($this->murid, $kuis);

    // Proteksi mati (bawaan): tidak ada sensor yang perlu dijaga.
    $tanpa = $this->getJson('/api/v1/attempt/'.$attempt->id)->assertOk();
    expect($tanpa->json('denyut'))->toBeNull();

    nyalakanProteksiD2($this, $kuis);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $muat = $this->getJson('/api/v1/attempt/'.$attempt->id)->assertOk();
    $nonce = $muat->json('denyut.nonce');

    expect($nonce)->toBeString()
        ->and($muat->json('denyut.interval_detik'))->toBe(DenyutProteksiService::JEDA_DETIK);

    $kirim = $this->postJson("/api/v1/attempt/{$attempt->id}/denyut", ['nonce' => $nonce])->assertOk();

    $baru = $kirim->json('nonce');

    expect($baru)->toBeString()->not->toBe($nonce)
        ->and($kirim->json('interval_detik'))->toBe(DenyutProteksiService::JEDA_DETIK);

    // Kiriman lama (nonce yang sudah dirotasi) ditolak 409 — liveness tidak
    // bisa dipalsukan dengan memutar ulang kiriman sebelumnya.
    $this->postJson("/api/v1/attempt/{$attempt->id}/denyut", ['nonce' => $nonce])
        ->assertStatus(409);

    $this->postJson("/api/v1/attempt/{$attempt->id}/denyut", ['nonce' => $baru])->assertOk();
});

it('denyut hanya untuk pemilik attempt yang masih berjalan', function (): void {
    $kuis = kuisBerjalanD2($this);
    $attempt = mulaiAttemptD2($this->murid, $kuis);

    nyalakanProteksiD2($this, $kuis);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);
    $nonce = $this->getJson('/api/v1/attempt/'.$attempt->id)->assertOk()->json('denyut.nonce');

    // Murid lain tidak boleh mengirim denyut untuk attempt ini.
    auth()->forgetGuards();
    Sanctum::actingAs($this->muridLain->user);
    $this->postJson("/api/v1/attempt/{$attempt->id}/denyut", ['nonce' => $nonce])->assertStatus(403);

    // Nonce kosong ditolak validasi.
    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);
    $this->postJson("/api/v1/attempt/{$attempt->id}/denyut", [])
        ->assertStatus(422)->assertJsonValidationErrors(['nonce']);

    // Setelah dikumpulkan, tidak ada lagi denyut (tidak ada sensor yang dijaga)
    // dan nonce yang tersisa tidak lagi diterima.
    $this->postJson("/api/v1/attempt/{$attempt->id}/kumpulkan", ['idempotency_key' => 'kunci-denyut-d2'])
        ->assertOk();

    expect(app(DenyutProteksiService::class)->nonce($attempt->refresh()))->toBeNull();

    $this->postJson("/api/v1/attempt/{$attempt->id}/denyut", ['nonce' => $nonce])->assertStatus(403);

    // Dan sapuan tidak menuduh murid yang sudah mengumpulkan.
    expect(app(DenyutProteksiService::class)->sapu())->toBe(0)
        ->and(KejadianKecurangan::query()->where('kategori', 'tamper_suspected')->count())->toBe(0);
});
