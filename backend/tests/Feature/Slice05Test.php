<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Question\Models\Soal;
use App\Sections\Question\Models\Tag;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Report\Services\LaporanTagService;
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
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '5A', 'tingkat' => 5]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Matematika', 'kode' => 'MTK']);
    $this->guru = User::factory()->guru()->create();
    $this->murid = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);
    $this->pengaturan = app(PengaturanService::class);
});

/**
 * Kuis berjalan + dua soal objektif bertag sama (masing-masing skor 5).
 *
 * @param  array<string, mixed>  $ubah
 * @return array{kuis: Kuis, tag: Tag, soal: array<int, int>}
 */
function siapkanKuis05(object $ctx, array $ubah = []): array
{
    $kuis = Kuis::factory()->untukSekolah($ctx->sekolah, $ctx->mapel, $ctx->kelas)->berjalan()->create([
        'acak_soal' => false,
        'acak_opsi' => false,
        ...$ubah,
    ]);

    $tag = Tag::factory()->untukSekolah($ctx->sekolah)->create(['nama' => 'Operasi Hitung']);

    $pilihanGanda = Soal::factory()->untukSekolah($ctx->sekolah, $ctx->mapel)
        ->create(['tag_id' => $tag->id, 'skor' => 5]);
    $benarSalah = Soal::factory()->benarSalah()->untukSekolah($ctx->sekolah, $ctx->mapel)
        ->create(['tag_id' => $tag->id, 'skor' => 5]);

    $kuis->soal()->attach($pilihanGanda->id, ['urutan' => 1]);
    $kuis->soal()->attach($benarSalah->id, ['urutan' => 2]);

    return ['kuis' => $kuis->refresh(), 'tag' => $tag, 'soal' => [$pilihanGanda->id, $benarSalah->id]];
}

/**
 * Kerjakan kuis penuh (mulai → jawab → kumpulkan) lalu kembalikan attempt-nya.
 *
 * @param  array<int, bool|string>  $jawaban  peta question_id => jawaban
 */
function kerjakan05(object $ctx, Kuis $kuis, Murid $murid, array $jawaban = []): Attempt
{
    auth()->forgetGuards();
    Sanctum::actingAs($murid->user);

    $mulai = test()->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated();
    $attemptId = (int) $mulai->json('id');

    foreach ($jawaban as $soalId => $nilai) {
        test()
            ->postJson("/api/v1/attempt/{$attemptId}/jawab", ['question_id' => $soalId, 'jawaban' => $nilai])
            ->assertOk();
    }

    test()
        ->postJson("/api/v1/attempt/{$attemptId}/kumpulkan", ['idempotency_key' => 'kunci-'.uniqid()])
        ->assertOk();

    return Attempt::query()->findOrFail($attemptId);
}

it('respons mulai menyertakan attempt_no dan asli', function (): void {
    $siap = siapkanKuis05($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $respons = $this->postJson("/api/v1/kuis/{$siap['kuis']->id}/mulai")->assertCreated();

    expect($respons->json('attempt_no'))->toBe(1)
        ->and($respons->json('asli'))->toBeTrue();
});

it('retry menambah attempt_no tanpa mengubah skor asli', function (): void {
    $siap = siapkanKuis05($this);

    $pertama = kerjakan05($this, $siap['kuis'], $this->murid, [
        $siap['soal'][0] => 'A', // salah (kunci B)
        $siap['soal'][1] => true,
    ]);

    expect($pertama->attempt_no)->toBe(1)
        ->and($pertama->asli)->toBeTrue()
        ->and($pertama->skor)->toEqual(5.0);

    $kedua = kerjakan05($this, $siap['kuis'], $this->murid, [
        $siap['soal'][0] => 'B',
        $siap['soal'][1] => true,
    ]);

    expect($kedua->attempt_no)->toBe(2)
        ->and($kedua->asli)->toBeFalse()
        ->and($kedua->skor)->toEqual(10.0);

    // Skor asli tetap apa adanya; retry hidup sebagai baris terpisah.
    $pertama->refresh();

    expect($pertama->skor)->toEqual(5.0)
        ->and(Attempt::query()->where('quiz_id', $siap['kuis']->id)->count())->toBe(2)
        ->and(Attempt::query()->asli()->count())->toBe(1);
});

it('retry mengikuti saklar dan batas percobaan dari pengaturan', function (): void {
    $siap = siapkanKuis05($this);

    $this->pengaturan->simpan(LingkupPengaturan::Sekolah, $this->sekolah->id, KunciPengaturan::BatasPercobaan, 2);

    kerjakan05($this, $siap['kuis'], $this->murid);
    kerjakan05($this, $siap['kuis'], $this->murid);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $habis = $this->postJson("/api/v1/kuis/{$siap['kuis']->id}/mulai")->assertStatus(422);
    expect($habis->json('errors.kuis.0'))->toContain('Batas percobaan');

    // Saklar retry dimatikan → percobaan ulang ditolak lebih awal.
    $this->pengaturan->simpan(LingkupPengaturan::Sekolah, $this->sekolah->id, KunciPengaturan::Retry, false);

    $ditolak = $this->postJson("/api/v1/kuis/{$siap['kuis']->id}/mulai")->assertStatus(422);
    expect($ditolak->json('errors.kuis.0'))->toContain('tidak diizinkan');
});

it('ranking hanya memakai skor asli dengan tie-break waktu selesai lalu nama', function (): void {
    $siap = siapkanKuis05($this);

    $budi = Murid::factory()->untuk($this->sekolah, $this->kelas, User::factory()->muridAktif()->create(['name' => 'Budi']))->create();
    $ani = Murid::factory()->untuk($this->sekolah, $this->kelas, User::factory()->muridAktif()->create(['name' => 'Ani']))->create();

    $attemptBudi = kerjakan05($this, $siap['kuis'], $budi, [
        $siap['soal'][0] => 'B',
        $siap['soal'][1] => false, // skor 5
    ]);
    Attempt::query()->whereKey($attemptBudi->id)->update(['dikumpulkan_at' => now()->subMinutes(10)]); // lebih cepat

    $attemptAni = kerjakan05($this, $siap['kuis'], $ani, [
        $siap['soal'][0] => 'B',
        $siap['soal'][1] => false, // skor sama (5)
    ]);
    Attempt::query()->whereKey($attemptAni->id)->update(['dikumpulkan_at' => now()->subMinute()]);

    // Ani mengulang sampai nilai sempurna — skor ulang TIDAK menaikkan peringkat.
    kerjakan05($this, $siap['kuis'], $ani, [
        $siap['soal'][0] => 'B',
        $siap['soal'][1] => true,
    ]);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $guru = $this->getJson("/api/v1/kuis/{$siap['kuis']->id}/ranking")->assertOk();

    expect(KunciPengaturan::Ranking->bawaan())->toBeFalse()
        ->and($guru->json('tampil'))->toBeFalse()
        ->and($guru->json('total'))->toBe(2)
        ->and($guru->json('peringkat.0.nama'))->toBe('Budi')
        ->and($guru->json('peringkat.0.skor'))->toEqual(5.0)
        ->and($guru->json('peringkat.1.nama'))->toBe('Ani');

    // Top N dipotong sesuai permintaan.
    $top1 = $this->getJson("/api/v1/kuis/{$siap['kuis']->id}/ranking?top=1")->assertOk();
    expect($top1->json('peringkat'))->toHaveCount(1);

    // Murid tidak melihat isi peringkat selama saklar mati.
    auth()->forgetGuards();
    Sanctum::actingAs($ani->user);

    $tersembunyi = $this->getJson("/api/v1/kuis/{$siap['kuis']->id}/ranking")->assertOk();
    expect($tersembunyi->json('tampil'))->toBeFalse()
        ->and($tersembunyi->json('peringkat'))->toBe([])
        ->and($tersembunyi->json('peringkat_saya'))->toBeNull();

    // Guru menyalakan ranking → murid melihat peringkatnya sendiri.
    $this->pengaturan->simpan(LingkupPengaturan::Sekolah, $this->sekolah->id, KunciPengaturan::Ranking, true);

    $tampil = $this->getJson("/api/v1/kuis/{$siap['kuis']->id}/ranking")->assertOk();
    expect($tampil->json('tampil'))->toBeTrue()
        ->and($tampil->json('peringkat'))->toHaveCount(2)
        ->and($tampil->json('peringkat_saya.nama'))->toBe('Ani');
});

it('badge per mapel terbentuk dari rata-rata skor asli', function (): void {
    $siap = siapkanKuis05($this);

    kerjakan05($this, $siap['kuis'], $this->murid, [
        $siap['soal'][0] => 'B',
        $siap['soal'][1] => true, // 10/10 → 100%
    ]);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $respons = $this->getJson('/api/v1/badge/saya')->assertOk();

    expect($respons->json('nama'))->toBe($this->murid->user->name)
        ->and($respons->json('jumlah_lencana'))->toBe(1)
        ->and($respons->json('badge.0.mapel_nama'))->toBe('Matematika')
        ->and($respons->json('badge.0.rata_rata'))->toEqual(100.0)
        ->and($respons->json('badge.0.lencana.kode'))->toBe('emas')
        ->and($respons->json('badge.0.lencana.level'))->toBe(3);
});

it('remedial menyusun latihan dari tema lemah dan tidak mengubah skor asli', function (): void {
    $siap = siapkanKuis05($this);

    // Ambang data minimum diturunkan supaya tema langsung dinilai (2 soal < bawaan 3).
    $this->pengaturan->simpan(LingkupPengaturan::Sekolah, $this->sekolah->id, KunciPengaturan::MinimalDataTag, 1);

    $attempt = kerjakan05($this, $siap['kuis'], $this->murid, [
        $siap['soal'][0] => 'A',
        $siap['soal'][1] => false, // 0/10 → tema belum paham
    ]);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $respons = $this->getJson('/api/v1/progres/saya')->assertOk();

    expect($respons->json('tema.0.tingkat'))->toBe(LaporanTagService::TINGKAT_BELUM_PAHAM)
        ->and($respons->json('remedial.diaktifkan'))->toBeTrue()
        ->and($respons->json('remedial.tema_lemah.0.tag_nama'))->toBe('Operasi Hitung')
        ->and($respons->json('remedial.soal'))->not->toBeEmpty()
        ->and($respons->getContent())->not->toContain('"kunci"');

    // Skor asli tetap utuh: remedial tidak menulis attempt baru.
    $attempt->refresh();

    expect($attempt->skor)->toEqual(0.0)
        ->and(Attempt::query()->count())->toBe(1);

    // Saklar remedial dimatikan → rekomendasi kosong tanpa menghapus riwayat.
    $this->pengaturan->simpan(LingkupPengaturan::Sekolah, $this->sekolah->id, KunciPengaturan::Remedial, false);

    $mati = $this->getJson('/api/v1/progres/saya')->assertOk();

    expect($mati->json('remedial.diaktifkan'))->toBeFalse()
        ->and($mati->json('remedial.soal'))->toBe([]);
});

it('laporan per tema mengikuti ambang guru dan hanya untuk guru', function (): void {
    $siap = siapkanKuis05($this);

    // 1 benar dari 2 soal (50%).
    kerjakan05($this, $siap['kuis'], $this->murid, [
        $siap['soal'][0] => 'B',
        $siap['soal'][1] => false,
    ]);

    $this->pengaturan->simpan(LingkupPengaturan::Sekolah, $this->sekolah->id, KunciPengaturan::AmbangPaham, 50);
    $this->pengaturan->simpan(LingkupPengaturan::Sekolah, $this->sekolah->id, KunciPengaturan::MinimalDataTag, 1);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $respons = $this->getJson("/api/v1/kuis/{$siap['kuis']->id}/laporan")->assertOk();

    expect($respons->json('ambang.ambang_paham'))->toBe(50)
        ->and($respons->json('murid'))->toHaveCount(1)
        ->and($respons->json('murid.0.nama'))->toBe($this->murid->user->name)
        ->and($respons->json('murid.0.tema.0.tag_nama'))->toBe('Operasi Hitung')
        ->and($respons->json('murid.0.tema.0.persen'))->toEqual(50.0)
        ->and($respons->json('murid.0.tema.0.tingkat'))->toBe(LaporanTagService::TINGKAT_PAHAM)
        ->and($respons->json('murid.0.ringkasan.paham'))->toBe(1);

    // Laporan memuat data seluruh kelas → murid selalu ditolak.
    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $this->getJson("/api/v1/kuis/{$siap['kuis']->id}/laporan")->assertStatus(403);
    $this->getJson('/api/v1/progres/saya')->assertOk();
    $this->getJson('/api/v1/badge/saya')->assertOk();
});

it('guru tidak punya badge atau progres tema', function (): void {
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->getJson('/api/v1/badge/saya')->assertStatus(403);
    $this->getJson('/api/v1/progres/saya')->assertStatus(403);
});
