<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Models\Jawaban;
use App\Sections\Attempt\Services\AttemptService;
use App\Sections\Attempt\Services\Pengacakan;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
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
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '5A', 'tingkat' => 5]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Matematika', 'kode' => 'MTK']);
    $this->guru = User::factory()->guru()->create();
    $this->murid = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);
});

/**
 * Kuis terbit yang sedang berjalan + dua soal objektif (skor 5 masing-masing).
 *
 * @param  array<string, mixed>  $ubah  atribut kuis yang ingin diubah
 */
function siapkanKuis(object $ctx, array $ubah = []): Kuis
{
    $kuis = Kuis::factory()->untukSekolah($ctx->sekolah, $ctx->mapel, $ctx->kelas)->berjalan()->create([
        'acak_soal' => false,
        'acak_opsi' => false,
        ...$ubah,
    ]);

    $pilihanGanda = Soal::factory()->untukSekolah($ctx->sekolah, $ctx->mapel)->create(['skor' => 5]);
    $benarSalah = Soal::factory()->benarSalah()->untukSekolah($ctx->sekolah, $ctx->mapel)->create(['skor' => 5]);

    $kuis->soal()->attach($pilihanGanda->id, ['urutan' => 1]);
    $kuis->soal()->attach($benarSalah->id, ['urutan' => 2]);

    return $kuis->refresh();
}

/** @return array{attempt: int, soal: array<int, array<string, mixed>>} */
function mulaiUlangan(object $ctx, Kuis $kuis, ?Murid $murid = null): array
{
    auth()->forgetGuards();
    Sanctum::actingAs(($murid ?? $ctx->murid)->user);

    $respons = test()->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated();

    return ['attempt' => (int) $respons->json('id'), 'soal' => (array) $respons->json('soal')];
}

it('murid memulai ulangan dan menerima soal tanpa kunci dengan deadline dari server', function (): void {
    $kuis = siapkanKuis($this);

    $hasil = mulaiUlangan($this, $kuis);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);
    $respons = $this->getJson("/api/v1/attempt/{$hasil['attempt']}")->assertOk();

    expect($respons->json('status'))->toBe('berjalan')
        ->and($respons->json('jenis'))->toBe('ulangan')
        ->and($respons->json('soal'))->toHaveCount(2)
        ->and($respons->json('skor_maksimal'))->toEqual(10.0)
        ->and($respons->json('jumlah_soal'))->toBe(2)
        ->and($respons->json('sisa_detik'))->toBeGreaterThan(1500);

    // deadline = mulai_at + durasi kuis, dilitung server.
    $selisih = Carbon::parse($respons->json('deadline_at'))
        ->diffInMinutes(Carbon::parse($respons->json('mulai_at')), true);
    expect($selisih)->toEqual(30.0);

    // Kunci tidak pernah ikut di respons mana pun.
    expect($respons->getContent())->not->toContain('kunci')
        ->and($respons->getContent())->not->toContain('pembahasan')
        ->and($respons->json('soal.0'))->not->toHaveKey('kunci');
});

it('mulai dua kali mengembalikan attempt yang sama (satu attempt aktif)', function (): void {
    $kuis = siapkanKuis($this);

    $pertama = mulaiUlangan($this, $kuis);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);
    $kedua = $this->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated();

    expect((int) $kedua->json('id'))->toBe($pertama['attempt'])
        ->and(Attempt::query()->count())->toBe(1);
});

it('urutan soal dan opsi stabil untuk seed yang sama dan opsi tetap permutasi', function (): void {
    $kuis = siapkanKuis($this, ['acak_soal' => true, 'acak_opsi' => true]);
    $hasil = mulaiUlangan($this, $kuis);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $satu = $this->getJson("/api/v1/attempt/{$hasil['attempt']}")->assertOk()->json('soal');
    $dua = $this->getJson("/api/v1/attempt/{$hasil['attempt']}")->assertOk()->json('soal');

    expect(collect($satu)->pluck('id')->all())->toBe(collect($dua)->pluck('id')->all());

    $pilihan = collect($satu)->firstWhere('tipe', 'pilihan_ganda');
    expect($pilihan)->not->toBeNull()
        ->and(collect($pilihan['konten']['opsi'])->pluck('id')->sort()->values()->all())->toBe(['A', 'B', 'C']);

    // Pengacakan deterministik: seed yang sama selalu memberi urutan yang sama.
    $attempt = Attempt::query()->findOrFail($hasil['attempt']);
    $attempt->load('kuis.soal');
    $urutSekali = Pengacakan::urutSoal($attempt->kuis->soal->all(), (int) $attempt->seed, (int) $attempt->id);
    $urutDua = Pengacakan::urutSoal($attempt->kuis->soal->all(), (int) $attempt->seed, (int) $attempt->id);

    expect(collect($urutSekali)->pluck('id')->all())->toBe(collect($urutDua)->pluck('id')->all());
});

it('attempt murid lain ditolak di semua endpoint (IDOR)', function (): void {
    $kuis = siapkanKuis($this);
    $hasil = mulaiUlangan($this, $kuis);

    $lain = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);

    auth()->forgetGuards();
    Sanctum::actingAs($lain->user);

    $this->getJson("/api/v1/attempt/{$hasil['attempt']}")->assertStatus(403);
    $this->postJson("/api/v1/attempt/{$hasil['attempt']}/jawab", [
        'question_id' => $hasil['soal'][0]['id'],
        'jawaban' => 'B',
    ])->assertStatus(403);
    $this->postJson("/api/v1/attempt/{$hasil['attempt']}/kumpulkan", [
        'idempotency_key' => 'kunci-murid-lain',
    ])->assertStatus(403);
    $this->getJson("/api/v1/attempt/{$hasil['attempt']}/hasil")->assertStatus(403);
});

it('guru tidak bisa memulai ulangan tetapi boleh melihat hasil murid', function (): void {
    $kuis = siapkanKuis($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);
    $this->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertStatus(403);

    $hasil = mulaiUlangan($this, $kuis);
    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);
    $this->postJson("/api/v1/attempt/{$hasil['attempt']}/kumpulkan", [
        'idempotency_key' => 'kunci-guru-melihat',
    ])->assertOk();

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);
    $this->getJson("/api/v1/attempt/{$hasil['attempt']}/hasil")->assertOk();
});

it('jawaban tersimpan satu baris per soal dan bisa diperbarui', function (): void {
    $kuis = siapkanKuis($this);
    $hasil = mulaiUlangan($this, $kuis);
    $soalId = (int) $hasil['soal'][0]['id'];

    $this->postJson("/api/v1/attempt/{$hasil['attempt']}/jawab", [
        'question_id' => $soalId,
        'jawaban' => 'A',
    ])->assertOk()->assertJsonPath('status', 'menunggu');

    $this->postJson("/api/v1/attempt/{$hasil['attempt']}/jawab", [
        'question_id' => $soalId,
        'jawaban' => 'B',
    ])->assertOk();

    expect(Jawaban::query()->where('attempt_id', $hasil['attempt'])->count())->toBe(1)
        ->and(Jawaban::query()->where('attempt_id', $hasil['attempt'])->firstOrFail()->jawaban)->toBe('B');

    // Muat ulang halaman: jawaban dikirim kembali dari DB (tanpa kunci).
    $ulang = $this->getJson("/api/v1/attempt/{$hasil['attempt']}")->assertOk();

    $tersimpan = collect($ulang->json('jawaban'))->firstWhere('question_id', $soalId);

    expect($tersimpan['jawaban'])->toBe('B')
        ->and($ulang->getContent())->not->toContain('kunci');
});

it('jawaban ditolak setelah deadline dan soal di luar kuis ditolak', function (): void {
    $kuis = siapkanKuis($this);
    $hasil = mulaiUlangan($this, $kuis);

    $lain = Soal::factory()->untukSekolah($this->sekolah, $this->mapel)->create();

    $this->postJson("/api/v1/attempt/{$hasil['attempt']}/jawab", [
        'question_id' => $lain->id,
        'jawaban' => 'A',
    ])->assertStatus(422)->assertJsonValidationErrors(['question_id']);

    Attempt::query()->whereKey($hasil['attempt'])->update(['deadline_at' => Carbon::now()->subSeconds(10)]);

    $this->postJson("/api/v1/attempt/{$hasil['attempt']}/jawab", [
        'question_id' => $hasil['soal'][0]['id'],
        'jawaban' => 'B',
    ])->assertStatus(422)->assertJsonValidationErrors(['attempt']);
});

it('mengumpulkan menilai soal objektif dan idempoten saat ditekan dua kali', function (): void {
    $kuis = siapkanKuis($this);
    $hasil = mulaiUlangan($this, $kuis);

    $pilihan = collect($hasil['soal'])->firstWhere('tipe', 'pilihan_ganda');
    $benarSalah = collect($hasil['soal'])->firstWhere('tipe', 'benar_salah');

    $this->postJson("/api/v1/attempt/{$hasil['attempt']}/jawab", [
        'question_id' => $pilihan['id'],
        'jawaban' => 'B',
    ])->assertOk();
    $this->postJson("/api/v1/attempt/{$hasil['attempt']}/jawab", [
        'question_id' => $benarSalah['id'],
        'jawaban' => true,
    ])->assertOk();

    $pertama = $this->postJson("/api/v1/attempt/{$hasil['attempt']}/kumpulkan", [
        'idempotency_key' => 'kunci-pertama-1234',
    ])->assertOk();

    expect($pertama->json('status'))->toBe('selesai')
        ->and($pertama->json('skor'))->toEqual(10.0)
        ->and($pertama->json('jumlah_benar'))->toBe(2)
        ->and($pertama->json('terlambat'))->toBeFalse()
        ->and(collect($pertama->json('per_soal'))->pluck('status')->unique()->all())->toBe(['dinilai'])
        ->and($pertama->json('ringkasan_penilaian.dinilai'))->toBe(2);

    // Dobel klik / dua tab: hasil sama, penilaian tidak digandakan.
    $kedua = $this->postJson("/api/v1/attempt/{$hasil['attempt']}/kumpulkan", [
        'idempotency_key' => 'kunci-kedua-5678',
    ])->assertOk();

    expect($kedua->json('skor'))->toEqual(10.0)
        ->and(Jawaban::query()->count())->toBe(2)
        ->and(Attempt::query()->count())->toBe(1);

    // Jawaban setelah dikumpulkan ditolak.
    $this->postJson("/api/v1/attempt/{$hasil['attempt']}/jawab", [
        'question_id' => $pilihan['id'],
        'jawaban' => 'A',
    ])->assertStatus(403);
});

it('mengumpulkan setelah deadline ditandai terlambat, dan ditolak bila sudah lewat toleransi', function (): void {
    $kuis = siapkanKuis($this);
    $hasil = mulaiUlangan($this, $kuis);

    Attempt::query()->whereKey($hasil['attempt'])->update(['deadline_at' => Carbon::now()->subSeconds(30)]);

    $respons = $this->postJson("/api/v1/attempt/{$hasil['attempt']}/kumpulkan", [
        'idempotency_key' => 'kunci-terlambat-1',
    ])->assertOk();

    expect($respons->json('terlambat'))->toBeTrue();

    // Attempt lain yang sudah lewat jauh tetap ditolak (bukan dinilai).
    $kedua = mulaiUlangan($this, $kuis);
    Attempt::query()->whereKey($kedua['attempt'])->update(['deadline_at' => Carbon::now()->subMinutes(10)]);

    $this->postJson("/api/v1/attempt/{$kedua['attempt']}/kumpulkan", [
        'idempotency_key' => 'kunci-terlambat-2',
    ])->assertStatus(422)->assertJsonValidationErrors(['attempt']);
});

it('penilaian satu soal rusak tidak menjatuhkan soal lain dan tidak menghasilkan 500', function (): void {
    $kuis = siapkanKuis($this);

    // Baris rusak disisipkan langsung ke DB (validasi aplikasi menolak tipe ini),
    // meniru data lama/rusak yang harus tetap membuat ulangan selesai dinilai.
    $rusakId = DB::table('questions')->insertGetId([
        'school_id' => $this->sekolah->id,
        'subject_id' => $this->mapel->id,
        'tag_id' => null,
        'tipe' => 'entah',
        'konten' => json_encode(['teks' => 'Soal rusak'], JSON_THROW_ON_ERROR),
        'kunci' => json_encode([], JSON_THROW_ON_ERROR),
        'pembahasan' => null,
        'skor' => 5,
        'aktif' => true,
        'dibuat_oleh' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $kuis->soal()->attach($rusakId, ['urutan' => 3]);

    $hasil = mulaiUlangan($this, $kuis);
    $pilihan = collect($hasil['soal'])->firstWhere('tipe', 'pilihan_ganda');

    $this->postJson("/api/v1/attempt/{$hasil['attempt']}/jawab", [
        'question_id' => $pilihan['id'],
        'jawaban' => 'B',
    ])->assertOk();

    $respons = $this->postJson("/api/v1/attempt/{$hasil['attempt']}/kumpulkan", [
        'idempotency_key' => 'kunci-soal-rusak',
    ])->assertOk();

    $status = collect($respons->json('per_soal'))->pluck('status', 'tipe');

    expect($status['pilihan_ganda'])->toBe('dinilai')
        ->and($status['benar_salah'])->toBe('dinilai')
        ->and($status['tidak_dikenal'])->toBe('gagal')
        ->and($respons->json('skor'))->toEqual(5.0)
        ->and($respons->json('ringkasan_penilaian.gagal'))->toBe(1)
        // Yang belum dijawab: soal benar/salah dan soal rusak (hanya PG diisi).
        ->and($respons->json('ringkasan_penilaian.belum_dijawab'))->toBe(2);
});

it('hasil murid memuat skor per soal tanpa kunci dan tanpa pembahasan', function (): void {
    $kuis = siapkanKuis($this);
    $hasil = mulaiUlangan($this, $kuis);

    $this->postJson("/api/v1/attempt/{$hasil['attempt']}/kumpulkan", [
        'idempotency_key' => 'kunci-hasil-1234',
    ])->assertOk();

    $respons = $this->getJson("/api/v1/attempt/{$hasil['attempt']}/hasil")->assertOk();

    expect($respons->json('per_soal'))->toHaveCount(2)
        ->and($respons->json('skor'))->toEqual(0.0)
        ->and($respons->json('ringkasan_penilaian.belum_dijawab'))->toBe(2);

    expect($respons->getContent())->not->toContain('"kunci"')
        ->and($respons->getContent())->not->toContain('"pembahasan"');
});

it('kuis kelas lain, belum dimulai, dan sudah berakhir tidak bisa dimulai', function (): void {
    $kelasLain = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6A', 'tingkat' => 6]);
    $kuisKelasLain = siapkanKuis($this, ['class_id' => $kelasLain->id]);
    $kuisBelumMulai = siapkanKuis($this, ['mulai_at' => Carbon::now()->addHour()]);
    $kuisSudahLewat = siapkanKuis($this, ['selesai_at' => Carbon::now()->subHour()]);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $this->postJson("/api/v1/kuis/{$kuisKelasLain->id}/mulai")->assertStatus(403);
    $this->postJson("/api/v1/kuis/{$kuisBelumMulai->id}/mulai")
        ->assertStatus(422)->assertJsonValidationErrors(['kuis']);
    $this->postJson("/api/v1/kuis/{$kuisSudahLewat->id}/mulai")
        ->assertStatus(422)->assertJsonValidationErrors(['kuis']);
});

it('attempt yang ditinggalkan jauh lewat deadline ditutup lalu murid bisa mencoba lagi', function (): void {
    $kuis = siapkanKuis($this);
    $hasil = mulaiUlangan($this, $kuis);

    // Jawaban sempat tersimpan sebelum murid menutup tab.
    $this->postJson("/api/v1/attempt/{$hasil['attempt']}/jawab", [
        'question_id' => (int) $hasil['soal'][0]['id'],
        'jawaban' => 'a',
    ])->assertOk();

    // Murid kembali 10 menit setelah deadline (di luar toleransi 120 detik).
    Attempt::query()->whereKey($hasil['attempt'])->update(['deadline_at' => Carbon::now()->subMinutes(10)]);

    // Regresi: dulu `mulai()` selalu mengembalikan attempt mati itu, sehingga
    // murid mentok — jawab ditolak (deadline lewat) dan kumpulkan ditolak (lewat
    // toleransi) — dan tidak pernah bisa mengerjakan kuis itu lagi.
    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);
    $kedua = $this->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated();

    $lama = Attempt::query()->findOrFail($hasil['attempt']);

    expect((int) $kedua->json('id'))->not->toBe($hasil['attempt'])
        ->and((int) $kedua->json('attempt_no'))->toBe(2)
        ->and($lama->status->value)->toBe('selesai')
        ->and($lama->aktif)->toBeNull()
        ->and($lama->terlambat)->toBeTrue()
        ->and($lama->dikumpulkan_at)->not->toBeNull()
        // Jawaban yang sempat tersimpan tetap dinilai, bukan dibuang.
        ->and((int) $lama->jawaban()->count())->toBe(2);
});

it('sapuan berkala menutup attempt yang ditinggalkan tanpa menunggu murid kembali', function (): void {
    $kuis = siapkanKuis($this);
    $hasil = mulaiUlangan($this, $kuis);

    Attempt::query()->whereKey($hasil['attempt'])->update(['deadline_at' => Carbon::now()->subMinutes(10)]);

    $jumlah = app(AttemptService::class)->tutupSemuaBasi();

    $lama = Attempt::query()->findOrFail($hasil['attempt']);

    expect($jumlah)->toBe(1)
        ->and($lama->status->value)->toBe('selesai')
        ->and($lama->aktif)->toBeNull()
        ->and($lama->terlambat)->toBeTrue();

    // Attempt yang masih di dalam masa toleransi TIDAK disentuh: murid yang baru
    // saja kehabisan waktu masih boleh mengumpulkan sendiri.
    $kedua = mulaiUlangan($this, $kuis);
    Attempt::query()->whereKey($kedua['attempt'])->update(['deadline_at' => Carbon::now()->subSeconds(30)]);

    expect(app(AttemptService::class)->tutupSemuaBasi())->toBe(0)
        ->and(Attempt::query()->findOrFail($kedua['attempt'])->status->value)->toBe('berjalan');
});
