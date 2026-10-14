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
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Enums\LingkupPengaturan;
use App\Sections\Settings\Services\PengaturanService;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

/**
 * Peringkat sebagai alat kelas: nomor peringkat hanya untuk N% teratas, dan
 * bonus penyemangat yang HANYA mengubah angka yang ditampilkan.
 *
 * Yang dijaga berkas ini:
 * 1. skor asli tidak pernah berubah — `skor`, rapor, dan ekspor tetap nilai
 *    sebenarnya, sedangkan `skor_tampil` yang berbantuan selalu membawa
 *    `bonus` > 0 dan `berbantuan` true, jadi mustahil menyamar jadi nilai asli;
 * 2. nomor peringkat murid mengikuti `peringkat_terbuka_persen` (bawaan 30%),
 *    dan guru selalu melihat seluruh papan;
 * 3. bonusnya sebesar yang dibutuhkan untuk melewati titik tengah kelas, dibatasi
 *    `bonus_semangat_maks_persen` — jadi ia bisa gagal menyeberang kalau batasnya
 *    kecil, dan itu memang perilaku yang diharapkan (bukan angka ajaib).
 */
beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6B', 'tingkat' => 6]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'IPA', 'kode' => 'IPA']);
    $this->guru = User::factory()->guru()->create();
    $this->pengaturan = app(PengaturanService::class);
});

/**
 * Kuis berjalan dengan sepuluh soal pilihan ganda bernilai 1 poin.
 *
 * Sepuluh soal dipakai supaya "persen" bisa disetel tepat: murid dengan 8 benar
 * berskor 8/10 = 80%.
 *
 * @return array{kuis: Kuis, soal: array<int, int>}
 */
function siapkanSemangat(object $ctx): array
{
    $kuis = Kuis::factory()->untukSekolah($ctx->sekolah, $ctx->mapel, $ctx->kelas)
        ->milik($ctx->guru)->berjalan()->create([
            'acak_soal' => false,
            'acak_opsi' => false,
        ]);

    $soal = [];

    for ($urutan = 1; $urutan <= 10; $urutan++) {
        $satu = Soal::factory()->untukSekolah($ctx->sekolah, $ctx->mapel)
            ->milik($ctx->guru)->create(['skor' => 1]);

        $kuis->soal()->attach($satu->id, ['urutan' => $urutan]);
        $soal[] = $satu->id;
    }

    return ['kuis' => $kuis->refresh(), 'soal' => $soal];
}

/**
 * Satu murid mengerjakan kuis dengan jumlah jawaban benar tertentu.
 *
 * @return array{murid: Murid, benar: int}
 */
function kerjakanSemangat(object $ctx, Kuis $kuis, array $soal, string $nama, int $benar): array
{
    $murid = Murid::factory()
        ->untuk($ctx->sekolah, $ctx->kelas, User::factory()->muridAktif()->create(['name' => $nama]))
        ->create();

    auth()->forgetGuards();
    Sanctum::actingAs($murid->user);

    $mulai = test()->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated();
    $attemptId = (int) $mulai->json('id');

    foreach (array_slice($soal, 0, $benar) as $soalId) {
        test()
            // Kunci pilihan ganda bawaan pabrik soal adalah 'B'.
            ->postJson("/api/v1/attempt/{$attemptId}/jawab", ['question_id' => $soalId, 'jawaban' => 'B'])
            ->assertOk();
    }

    test()
        ->postJson("/api/v1/attempt/{$attemptId}/kumpulkan", ['idempotency_key' => 'kunci-'.uniqid()])
        ->assertOk();

    return ['murid' => $murid, 'benar' => $benar];
}

it('tanpa bonus, papan memakai skor apa adanya dan setiap baris berbantuan=false', function (): void {
    $siap = siapkanSemangat($this);
    kerjakanSemangat($this, $siap['kuis'], $siap['soal'], 'Ani', 8);
    kerjakanSemangat($this, $siap['kuis'], $siap['soal'], 'Budi', 3);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $respons = $this->getJson("/api/v1/kuis/{$siap['kuis']->id}/ranking")->assertOk();

    expect($respons->json('bonus_aktif'))->toBeFalse()
        ->and($respons->json('peringkat.0.nama'))->toBe('Ani')
        ->and($respons->json('peringkat.0.bonus'))->toEqual(0)
        ->and($respons->json('peringkat.0.berbantuan'))->toBeFalse()
        ->and($respons->json('peringkat.0.skor_tampil'))->toEqual($respons->json('peringkat.0.skor'))
        ->and($respons->json('peringkat.1.nama'))->toBe('Budi');
});

it('bonus penyemangat menaikkan angka tampilan sampai melewati titik tengah, dan skor asli tidak berubah', function (): void {
    $siap = siapkanSemangat($this);
    // Persen: 100, 80, 60, 20 → median 70.
    $ani = kerjakanSemangat($this, $siap['kuis'], $siap['soal'], 'Ani', 10);
    $budi = kerjakanSemangat($this, $siap['kuis'], $siap['soal'], 'Budi', 8);
    $citra = kerjakanSemangat($this, $siap['kuis'], $siap['soal'], 'Citra', 6);
    $dedi = kerjakanSemangat($this, $siap['kuis'], $siap['soal'], 'Dedi', 2);

    // Bonus dibuka guru: ambang 50%, batas tambahan 60% (cukup untuk menyeberang).
    $this->pengaturan->simpan(LingkupPengaturan::Sekolah, $this->sekolah->id, KunciPengaturan::BonusSemangat, true);
    $this->pengaturan->simpan(LingkupPengaturan::Sekolah, $this->sekolah->id, KunciPengaturan::BonusSemangatMaksPersen, 60);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $respons = $this->getJson("/api/v1/kuis/{$siap['kuis']->id}/ranking")->assertOk();
    $baris = collect($respons->json('peringkat'))->keyBy('nama');

    expect($respons->json('bonus_aktif'))->toBeTrue()
        ->and($respons->json('bonus_bawah_persen'))->toBe(50)
        ->and($respons->json('bonus_maks_persen'))->toBe(60);

    // Dedi (20%) ditolong sampai 70% (median) → 7 poin tampil, skor asli tetap 2.
    expect($baris['Dedi']['skor'])->toEqual(2.0)
        ->and($baris['Dedi']['skor_tampil'])->toEqual(7.0)
        ->and($baris['Dedi']['persen'])->toEqual(20.0)
        ->and($baris['Dedi']['persen_tampil'])->toEqual(70.0)
        ->and($baris['Dedi']['berbantuan'])->toBeTrue()
        ->and($baris['Dedi']['peringkat_asli'])->toBe(4)
        ->and($baris['Dedi']['peringkat'])->toBeLessThan(4);

    // Murid di atas ambang tidak disentuh.
    expect($baris['Citra']['bonus'])->toEqual(0)
        ->and($baris['Citra']['berbantuan'])->toBeFalse()
        ->and($baris['Citra']['skor_tampil'])->toEqual($baris['Citra']['skor']);

    // Nilai yang benar-benar tercatat (rapor/ekspor) tetap skor asli.
    foreach ([$ani, $budi, $citra, $dedi] as $satu) {
        $attempt = Attempt::query()
            ->where('quiz_id', $siap['kuis']->id)
            ->where('student_id', $satu['murid']->id)
            ->firstOrFail();

        expect((float) $attempt->skor)->toEqual((float) $satu['benar']);
    }
});

it('batas tambahan yang kecil membuat bonus tidak cukup untuk menyeberang — bukan angka ajaib', function (): void {
    $siap = siapkanSemangat($this);
    kerjakanSemangat($this, $siap['kuis'], $siap['soal'], 'Ani', 10);
    kerjakanSemangat($this, $siap['kuis'], $siap['soal'], 'Budi', 8);
    kerjakanSemangat($this, $siap['kuis'], $siap['soal'], 'Citra', 6);
    kerjakanSemangat($this, $siap['kuis'], $siap['soal'], 'Dedi', 2);

    $this->pengaturan->simpan(LingkupPengaturan::Sekolah, $this->sekolah->id, KunciPengaturan::BonusSemangat, true);
    $this->pengaturan->simpan(LingkupPengaturan::Sekolah, $this->sekolah->id, KunciPengaturan::BonusSemangatMaksPersen, 5);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $respons = $this->getJson("/api/v1/kuis/{$siap['kuis']->id}/ranking")->assertOk();
    $dedi = collect($respons->json('peringkat'))->firstWhere('nama', 'Dedi');

    // 20% + 5% = 25% — masih di bawah ambang, dan itu memang yang dijanjikan.
    expect($dedi['persen_tampil'])->toEqual(25.0)
        ->and($dedi['skor_tampil'])->toEqual(2.5)
        ->and($dedi['berbantuan'])->toBeTrue()
        ->and($dedi['peringkat'])->toBe(4);
});

it('nomor peringkat hanya untuk N% teratas, dan guru membuka saklarnya sesuai kebutuhan kelas', function (): void {
    $siap = siapkanSemangat($this);
    $murid = [];

    foreach ([['Ani', 10], ['Budi', 9], ['Citra', 8], ['Dedi', 7], ['Eka', 6]] as [$nama, $benar]) {
        $murid[$nama] = kerjakanSemangat($this, $siap['kuis'], $siap['soal'], $nama, $benar)['murid'];
    }

    $this->pengaturan->simpan(LingkupPengaturan::Sekolah, $this->sekolah->id, KunciPengaturan::Ranking, true);

    // Bawaan 30% dari 5 peserta = 2 baris.
    auth()->forgetGuards();
    Sanctum::actingAs($murid['Dedi']->user);

    $dedi = $this->getJson("/api/v1/kuis/{$siap['kuis']->id}/ranking")->assertOk();

    expect($dedi->json('terbuka_persen'))->toBe(30)
        ->and($dedi->json('terbuka_jumlah'))->toBe(2)
        ->and($dedi->json('peringkat'))->toHaveCount(2)
        ->and($dedi->json('peringkat_saya'))->toBeNull()
        ->and($dedi->json('detail_saya.peringkat'))->toBeNull()
        ->and($dedi->json('detail_saya.di_luar_terbuka'))->toBeTrue()
        ->and($dedi->json('detail_saya.skor'))->toEqual(7.0);

    // Peringkat ke-2 masih mendapat nomornya.
    auth()->forgetGuards();
    Sanctum::actingAs($murid['Budi']->user);

    $budi = $this->getJson("/api/v1/kuis/{$siap['kuis']->id}/ranking")->assertOk();

    expect($budi->json('peringkat_saya.peringkat'))->toBe(2)
        ->and($budi->json('detail_saya.di_luar_terbuka'))->toBeFalse();

    // Guru meminta 50 baris untuk proyektor → seluruh papan (5) terkirim.
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $guru = $this->getJson("/api/v1/kuis/{$siap['kuis']->id}/ranking?top=50")->assertOk();

    expect($guru->json('guru'))->toBeTrue()
        ->and($guru->json('peringkat'))->toHaveCount(5)
        ->and(collect($guru->json('peringkat'))->pluck('nama')->all())->toBe(['Ani', 'Budi', 'Citra', 'Dedi', 'Eka']);
});

it('murid tidak pernah melihat jejak bonus: yang dibacanya adalah angkanya, bukan tanda bantuan', function (): void {
    $siap = siapkanSemangat($this);
    kerjakanSemangat($this, $siap['kuis'], $siap['soal'], 'Ani', 10);
    kerjakanSemangat($this, $siap['kuis'], $siap['soal'], 'Budi', 8);
    kerjakanSemangat($this, $siap['kuis'], $siap['soal'], 'Citra', 6);
    $dedi = kerjakanSemangat($this, $siap['kuis'], $siap['soal'], 'Dedi', 2)['murid'];

    $this->pengaturan->simpan(LingkupPengaturan::Sekolah, $this->sekolah->id, KunciPengaturan::Ranking, true);
    $this->pengaturan->simpan(LingkupPengaturan::Sekolah, $this->sekolah->id, KunciPengaturan::PeringkatTerbukaPersen, 100);
    $this->pengaturan->simpan(LingkupPengaturan::Sekolah, $this->sekolah->id, KunciPengaturan::BonusSemangat, true);
    $this->pengaturan->simpan(LingkupPengaturan::Sekolah, $this->sekolah->id, KunciPengaturan::BonusSemangatMaksPersen, 60);

    auth()->forgetGuards();
    Sanctum::actingAs($dedi->user);

    $respons = $this->getJson("/api/v1/kuis/{$siap['kuis']->id}/ranking")->assertOk();
    $dediDiPapan = collect($respons->json('peringkat'))->firstWhere('nama', 'Dedi');

    // Angka tampilan pindah ke `skor`/`persen`, dan tidak ada satu pun kunci
    // yang membocorkan bahwa ia dibantu.
    expect($dediDiPapan['skor'])->toEqual(7.0)
        ->and($dediDiPapan['persen'])->toEqual(70.0)
        ->and($dediDiPapan)->not->toHaveKey('bonus')
        ->and($dediDiPapan)->not->toHaveKey('berbantuan')
        ->and($dediDiPapan)->not->toHaveKey('peringkat_asli')
        ->and($dediDiPapan)->not->toHaveKey('skor_tampil')
        ->and($respons->json('detail_saya.skor'))->toEqual(7.0)
        ->and($respons->json('detail_saya'))->not->toHaveKey('bonus')
        ->and($respons->json('detail_saya'))->not->toHaveKey('berbantuan')
        ->and($respons->json('peringkat_saya'))->not->toHaveKey('bonus');

    // Guru tetap melihat mana yang berbantuan dan berapa nilai aslinya —
    // pemantauan tetap mungkin, yang dirahasiakan hanya dari murid.
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $guru = $this->getJson("/api/v1/kuis/{$siap['kuis']->id}/ranking")->assertOk();
    $dediGuru = collect($guru->json('peringkat'))->firstWhere('nama', 'Dedi');

    expect($dediGuru['berbantuan'])->toBeTrue()
        ->and($dediGuru['bonus'])->toEqual(5.0)
        ->and($dediGuru['skor'])->toEqual(2.0)
        ->and($dediGuru['skor_tampil'])->toEqual(7.0)
        ->and($dediGuru['peringkat_asli'])->toBe(4);
});

it('persentase di luar 0–100 ditolak validasi', function (): void {
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $kuis = Kuis::factory()->untukSekolah($this->sekolah, $this->mapel, $this->kelas)
        ->milik($this->guru)->create();

    foreach (['peringkat_terbuka_persen', 'bonus_semangat_bawah_persen', 'bonus_semangat_maks_persen'] as $kunci) {
        $this->putJson('/api/v1/pengaturan', [
            'lingkup' => 'kuis', 'lingkup_id' => $kuis->id, 'kunci' => $kunci, 'nilai' => 150,
        ])->assertStatus(422)->assertJsonValidationErrors(['nilai']);
    }

    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis', 'lingkup_id' => $kuis->id, 'kunci' => 'peringkat_terbuka_persen', 'nilai' => 30,
    ])->assertOk();
});
