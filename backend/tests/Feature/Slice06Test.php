<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Models\Jawaban;
use App\Sections\Question\Enums\TipeSoal;
use App\Sections\Question\Models\Soal;
use App\Sections\Question\Registry\RegistryTipeSoal;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use App\Sections\Scoring\Services\PenilaianTeks;
use App\Sections\Scoring\Services\TokenKonfirmasiService;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '4A', 'tingkat' => 4]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Bahasa Indonesia', 'kode' => 'BIN']);
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
function buatSoal06(object $ctx, string $tipe, array $konten, array $kunci, int $skor = 4): Soal
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
function kuisSoal06(object $ctx, array $soal): Kuis
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
 * @param  array<int, mixed>  $jawaban  peta question_id => jawaban
 */
function kerjakan06(object $ctx, Kuis $kuis, Murid $murid, array $jawaban): Attempt
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

it('guru dapat membuat isian singkat, uraian, letak kata, dan hubung kata', function (): void {
    $isian = buatSoal06($this, 'isian_singkat', ['teks' => 'Ibu kota Indonesia?'], ['jawaban_baku' => ['Jakarta']]);
    $uraian = buatSoal06($this, 'uraian', ['teks' => 'Jelaskan fotosintesis.'], [
        'kata_kunci' => [['teks' => 'klorofil', 'bobot' => 1]],
    ]);
    $letak = buatSoal06($this, 'letak_kata', [
        'teks' => 'Letakkan kata pada kolom yang tepat.',
        'kata' => [['id' => 'k1', 'teks' => 'Ibu'], ['id' => 'k2', 'teks' => 'memasak']],
        'posisi' => [['id' => 'p1', 'teks' => 'Subjek'], ['id' => 'p2', 'teks' => 'Predikat']],
    ], ['penempatan' => ['k1' => 'p1', 'k2' => 'p2']]);
    $hubung = buatSoal06($this, 'hubung_kata', [
        'teks' => 'Hubungkan kata dengan pasangannya.',
        'kiri' => [['id' => 'a', 'teks' => 'Besar'], ['id' => 'b', 'teks' => 'Panas']],
        'kanan' => [['id' => 'x', 'teks' => 'Kecil'], ['id' => 'y', 'teks' => 'Dingin']],
    ], ['sambungan' => ['a' => 'x', 'b' => 'y']]);

    expect($isian->tipe)->toBe(TipeSoal::IsianSingkat)
        ->and($uraian->tipe)->toBe(TipeSoal::Uraian)
        ->and($letak->tipe)->toBe(TipeSoal::LetakKata)
        ->and($hubung->tipe)->toBe(TipeSoal::HubungKata)
        ->and(TipeSoal::LetakKata->objektif())->toBeTrue()
        ->and(TipeSoal::Uraian->objektif())->toBeFalse()
        ->and(TipeSoal::Uraian->bertingkat())->toBeTrue();
});

it('isian singkat: normalisasi, sinonim, dan toleransi typo per kata', function (): void {
    $kunci = ['jawaban_baku' => ['Jakarta']];

    expect(RegistryTipeSoal::nilai(TipeSoal::IsianSingkat, [], $kunci, '  JAKARTA! '))->toBeTrue()
        ->and(RegistryTipeSoal::nilai(TipeSoal::IsianSingkat, [], $kunci, 'Surabaya'))->toBeFalse();

    $sinonim = ['jawaban_baku' => ['ibu kota indonesia'], 'sinonim' => [['jakarta', 'dki jakarta']]];

    expect(RegistryTipeSoal::nilai(TipeSoal::IsianSingkat, [], $sinonim, 'Jakarta'))->toBeTrue();

    // Toleransi typo per kata: satu huruf salah pada satu kata masih diterima.
    $frasa = ['jawaban_baku' => ['gunung berapi']];

    expect(RegistryTipeSoal::nilai(TipeSoal::IsianSingkat, [], $frasa, 'gunug berapi'))->toBeTrue()
        ->and(RegistryTipeSoal::nilai(TipeSoal::IsianSingkat, [], $frasa, 'gunung biasa'))->toBeFalse();
});

it('isian singkat: angka harus persis dan penjaga negasi menolak jawaban menyanggah', function (): void {
    expect(RegistryTipeSoal::nilai(TipeSoal::IsianSingkat, [], ['jawaban_baku' => ['12']], '12.0'))->toBeTrue()
        ->and(RegistryTipeSoal::nilai(TipeSoal::IsianSingkat, [], ['jawaban_baku' => ['12']], '13'))->toBeFalse()
        // "1/2" bukan "0,5": angka harus persis.
        ->and(RegistryTipeSoal::nilai(TipeSoal::IsianSingkat, [], ['jawaban_baku' => ['1/2']], '0,5'))->toBeFalse();

    // Sinonim kata pada kunci angka tetap diterima: penjaga angka_persis
    // diperiksa per kandidat, jadi kunci "9" tidak menutup sinonim "sembilan".
    $kunciAngka = ['jawaban_baku' => ['9'], 'sinonim' => [['sembilan']]];

    expect(RegistryTipeSoal::nilai(TipeSoal::IsianSingkat, [], $kunciAngka, '9'))->toBeTrue()
        ->and(RegistryTipeSoal::nilai(TipeSoal::IsianSingkat, [], $kunciAngka, 'sembilan'))->toBeTrue()
        ->and(RegistryTipeSoal::nilai(TipeSoal::IsianSingkat, [], $kunciAngka, '10'))->toBeFalse()
        // Angka tetap tidak boleh dikira-kira walau mirip hurufnya.
        ->and(RegistryTipeSoal::nilai(TipeSoal::IsianSingkat, [], ['jawaban_baku' => ['12']], '120'))->toBeFalse();

    $kalimat = ['jawaban_baku' => ['air mengalir dari tempat tinggi']];

    expect(RegistryTipeSoal::nilai(TipeSoal::IsianSingkat, [], $kalimat, 'air mengalir dari tempat tinggi'))->toBeTrue()
        ->and(RegistryTipeSoal::nilai(TipeSoal::IsianSingkat, [], $kalimat, 'air tidak mengalir dari tempat tinggi'))->toBeFalse();
});

it('uraian: kata kunci berbobot memberi skor parsial, di bawah ambang perlu tinjau', function (): void {
    $teks = app(PenilaianTeks::class);

    $soal = Soal::factory()->untukSekolah($this->sekolah, $this->mapel)->create([
        'tipe' => TipeSoal::Uraian,
        'konten' => ['teks' => 'Jelaskan proses fotosintesis.'],
        'kunci' => [
            'kata_kunci' => [
                ['teks' => 'fotosintesis', 'bobot' => 2],
                ['teks' => 'klorofil'],
                ['teks' => 'cahaya matahari'],
            ],
            'ambang_lulus' => 0.6,
        ],
        'skor' => 8,
    ]);

    // Dua dari tiga kata kunci (bobot 3 dari 4 = 0.75) → dinilai, skor parsial 6.
    $hasil = $teks->nilai($soal, 'Fotosintesis terjadi karena klorofil pada daun.');

    expect($hasil['status']->value)->toBe('dinilai')
        ->and($hasil['benar'])->toBeTrue()
        ->and($hasil['skor'])->toEqual(6.0);

    // Hanya satu kata kunci (0.25) → guru yang memutuskan.
    $kurang = $teks->nilai($soal, 'Klorofil ada di daun.');

    expect($kurang['status']->value)->toBe('perlu_tinjau')
        ->and($kurang['skor'])->toEqual(0.0);

    // Jawaban kosong tetap dinilai 0 (bukan perlu tinjau).
    $kosong = $teks->nilai($soal, '   ');

    expect($kosong['status']->value)->toBe('dinilai')
        ->and($kosong['benar'])->toBeFalse();
});

it('letak kata dan hubung kata dinilai lewat registry', function (): void {
    $kunciLetak = ['penempatan' => ['k1' => 'p1', 'k2' => 'p2']];

    expect(RegistryTipeSoal::nilai(TipeSoal::LetakKata, [], $kunciLetak, ['k1' => 'p1', 'k2' => 'p2']))->toBeTrue()
        ->and(RegistryTipeSoal::nilai(TipeSoal::LetakKata, [], $kunciLetak, ['k1' => 'p2', 'k2' => 'p1']))->toBeFalse()
        ->and(RegistryTipeSoal::nilai(TipeSoal::LetakKata, [], $kunciLetak, ['k1' => 'p1']))->toBeFalse();

    $kunciHubung = ['sambungan' => ['a' => 'x', 'b' => 'y']];

    expect(RegistryTipeSoal::nilai(TipeSoal::HubungKata, [], $kunciHubung, ['a' => 'x', 'b' => 'y']))->toBeTrue()
        ->and(RegistryTipeSoal::nilai(TipeSoal::HubungKata, [], $kunciHubung, ['a' => 'y', 'b' => 'y']))->toBeFalse();
});

it('ulangan bertingkat menilai otomatis dan menandai yang perlu ditinjau', function (): void {
    $isian = buatSoal06($this, 'isian_singkat', ['teks' => 'Ibu kota Indonesia?'], ['jawaban_baku' => ['Jakarta']], 2);
    $uraian = buatSoal06($this, 'uraian', ['teks' => 'Jelaskan fotosintesis.'], [
        'kata_kunci' => [['teks' => 'fotosintesis'], ['teks' => 'klorofil']],
        'ambang_lulus' => 0.6,
    ], 4);

    $kuis = kuisSoal06($this, [$isian, $uraian]);

    $attempt = kerjakan06($this, $kuis, $this->murid, [
        $isian->id => 'jakarta',
        $uraian->id => 'Saya belum tahu jawabannya.',
    ]);

    expect($attempt->skor)->toEqual(2.0)
        ->and($attempt->jumlah_benar)->toBe(1);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $hasil = $this->getJson("/api/v1/attempt/{$attempt->id}/hasil")->assertOk();

    $status = collect($hasil->json('per_soal'))->pluck('status', 'question_id');

    expect($status[$isian->id])->toBe('dinilai')
        ->and($status[$uraian->id])->toBe('perlu_tinjau')
        ->and($hasil->json('ringkasan_penilaian.perlu_tinjau'))->toBe(1)
        ->and($hasil->json('ringkasan_penilaian.dinilai'))->toBe(1);
});

it('antrean koreksi memuat soal perlu tinjau beserta kunci dan hanya untuk guru', function (): void {
    $uraian = buatSoal06($this, 'uraian', ['teks' => 'Jelaskan fotosintesis.'], [
        'kata_kunci' => [['teks' => 'fotosintesis'], ['teks' => 'klorofil']],
    ], 4);

    $kuis = kuisSoal06($this, [$uraian]);
    $attempt = kerjakan06($this, $kuis, $this->murid, [$uraian->id => 'Belum tahu.']);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $antrean = $this->getJson("/api/v1/kuis/{$kuis->id}/koreksi")->assertOk();

    expect($antrean->json('jumlah'))->toBe(1)
        ->and($antrean->json('item.0.attempt_id'))->toBe($attempt->id)
        ->and($antrean->json('item.0.question_id'))->toBe($uraian->id)
        ->and($antrean->json('item.0.status'))->toBe('perlu_tinjau')
        ->and($antrean->json('item.0.kunci.kata_kunci.0.teks'))->toBe('fotosintesis')
        ->and($antrean->json('item.0.jawaban'))->toBe('Belum tahu.');

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $this->getJson("/api/v1/kuis/{$kuis->id}/koreksi")->assertStatus(403);
});

it('koreksi manual butuh token sekali pakai dan alasan yang jelas', function (): void {
    $uraian = buatSoal06($this, 'uraian', ['teks' => 'Jelaskan fotosintesis.'], [
        'kata_kunci' => [['teks' => 'fotosintesis']],
    ], 4);

    $kuis = kuisSoal06($this, [$uraian]);
    $attempt = kerjakan06($this, $kuis, $this->murid, [$uraian->id => 'Belum tahu.']);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    // Alasan terlalu pendek ditolak sebelum token terbit.
    $this->postJson("/api/v1/attempt/{$attempt->id}/koreksi/token", [
        'question_id' => $uraian->id,
        'alasan' => 'salah',
    ])->assertStatus(422)->assertJsonValidationErrors(['alasan']);

    $terbit = $this->postJson("/api/v1/attempt/{$attempt->id}/koreksi/token", [
        'question_id' => $uraian->id,
        'alasan' => 'Jawaban murid benar secara konsep, saya lihat di kelas.',
    ])->assertOk();

    $token = (string) $terbit->json('token');

    expect($token)->not->toBe('')
        ->and($terbit->json('ttl_detik'))->toBe(TokenKonfirmasiService::TTL_DETIK);

    $muatan = [
        'question_id' => $uraian->id,
        'skor' => 4,
        'alasan' => 'Jawaban murid benar secara konsep, saya lihat di kelas.',
        'token' => $token,
    ];

    $this->postJson("/api/v1/attempt/{$attempt->id}/koreksi", $muatan)->assertOk();

    // Sekali pakai: percobaan kedua ditolak walau tokennya sama.
    $this->postJson("/api/v1/attempt/{$attempt->id}/koreksi", $muatan)
        ->assertStatus(422)->assertJsonValidationErrors(['token']);

    // Token baru yang kedaluwarsa juga ditolak.
    $kedua = $this->postJson("/api/v1/attempt/{$attempt->id}/koreksi/token", [
        'question_id' => $uraian->id,
        'alasan' => 'Perlu penyesuaian ulang setelah diskusi.',
    ])->assertOk();

    DB::table('confirmation_tokens')->update(['expires_at' => Carbon::now()->subMinute()]);

    $this->postJson("/api/v1/attempt/{$attempt->id}/koreksi", [
        'question_id' => $uraian->id,
        'skor' => 2,
        'alasan' => 'Perlu penyesuaian ulang setelah diskusi.',
        'token' => (string) $kedua->json('token'),
    ])->assertStatus(422)->assertJsonValidationErrors(['token']);

    // Murid tidak boleh mengoreksi nilainya sendiri.
    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $this->postJson("/api/v1/attempt/{$attempt->id}/koreksi", $muatan)->assertStatus(403);
});

it('koreksi manual menghitung ulang total attempt dan mencatat audit', function (): void {
    $uraian = buatSoal06($this, 'uraian', ['teks' => 'Jelaskan fotosintesis.'], [
        'kata_kunci' => [['teks' => 'fotosintesis']],
    ], 4);

    $kuis = kuisSoal06($this, [$uraian]);
    $attempt = kerjakan06($this, $kuis, $this->murid, [$uraian->id => 'Belum tahu.']);

    expect($attempt->skor)->toEqual(0.0)
        ->and($attempt->jumlah_benar)->toBe(0);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $alasan = 'Murid menjawab benar secara lisan; nilai saya sesuaikan.';

    $token = (string) $this->postJson("/api/v1/attempt/{$attempt->id}/koreksi/token", [
        'question_id' => $uraian->id,
        'alasan' => $alasan,
    ])->assertOk()->json('token');

    $koreksi = $this->postJson("/api/v1/attempt/{$attempt->id}/koreksi", [
        'question_id' => $uraian->id,
        'skor' => 4,
        'alasan' => $alasan,
        'token' => $token,
    ])->assertOk();

    expect($koreksi->json('skor_soal'))->toEqual(4.0)
        ->and($koreksi->json('total_skor'))->toEqual(4.0)
        ->and($koreksi->json('total_benar'))->toBe(1);

    $attempt->refresh();
    $baris = Jawaban::query()
        ->where('attempt_id', $attempt->id)
        ->where('question_id', $uraian->id)
        ->firstOrFail();

    expect($attempt->skor)->toEqual(4.0)
        ->and($attempt->jumlah_benar)->toBe(1)
        ->and($baris->status->value)->toBe('dinilai')
        ->and($baris->benar)->toBeTrue()
        ->and($baris->dinilai_manual)->toBeTrue()
        ->and($baris->alasan_koreksi)->toBe($alasan);

    // Audit append-only: satu baris activity_log dengan sebab, sasaran, dan alasan.
    $audit = DB::table('activity_log')->where('log_name', 'koreksi_nilai')->get();

    expect($audit)->toHaveCount(1)
        ->and($audit->first()->event)->toBe('koreksi_manual')
        ->and($audit->first()->causer_id)->toBe($this->guru->id)
        ->and((string) $audit->first()->properties)->toContain('skor_sesudah');

    // Laporan tema ikut berubah karena dihitung dari baris jawaban.
    $laporan = $this->getJson("/api/v1/kuis/{$kuis->id}/koreksi")->assertOk();

    expect($laporan->json('jumlah'))->toBe(0);
});

it('kuis berisi isian singkat dan uraian bisa diterbitkan', function (): void {
    $isian = buatSoal06($this, 'isian_singkat', ['teks' => 'Ibu kota Indonesia?'], ['jawaban_baku' => ['Jakarta']]);
    $uraian = buatSoal06($this, 'uraian', ['teks' => 'Jelaskan fotosintesis.'], [
        'kata_kunci' => [['teks' => 'klorofil'], ['teks' => 'cahaya']],
    ]);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $kuisId = (int) $this->postJson('/api/v1/kuis', [
        'judul' => 'Ulangan Campuran',
        'subject_id' => $this->mapel->id,
        'class_id' => $this->kelas->id,
        'durasi_menit' => 30,
        'mulai_at' => now()->addMinute()->toIso8601String(),
        'selesai_at' => now()->addHour()->toIso8601String(),
    ])->assertCreated()->json('id');

    $this->putJson("/api/v1/kuis/{$kuisId}/soal", ['soal' => [$isian->id, $uraian->id]])->assertOk();

    // Regresi: dulu publikasi menolak 422 `soal_tipe` untuk soal bertingkat,
    // padahal penilaiannya (kata kunci + antrean koreksi) sudah ada sejak slice 06.
    $this->postJson("/api/v1/kuis/{$kuisId}/publikasi")
        ->assertOk()
        ->assertJsonPath('status', 'publikasi');
});
