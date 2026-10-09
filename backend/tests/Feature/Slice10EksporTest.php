<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Question\Enums\TipeSoal;
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
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6A', 'tingkat' => 6]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Matematika', 'kode' => 'MTK']);
    $this->guru = User::factory()->guru()->create();
    $this->murid = Murid::factory()->create(['school_id' => $this->sekolah->id, 'class_id' => $this->kelas->id]);
});

function e10Soal(object $ctx, string $kunci = 'a'): Soal
{
    return Soal::factory()->untukSekolah($ctx->sekolah, $ctx->mapel)->milik($ctx->guru)->create([
        'tipe' => TipeSoal::PilihanGanda,
        'konten' => ['teks' => 'Hasil 3 + 4?', 'opsi' => [['id' => 'a', 'teks' => '7'], ['id' => 'b', 'teks' => '8']]],
        'kunci' => ['jawaban' => $kunci],
        'skor' => 10,
    ]);
}

/**
 * @param  array<int, Soal>  $soal
 */
function e10Kuis(object $ctx, array $soal): Kuis
{
    // Pemilik = guru yang sedang masuk: ekspor nilai kuis ini hanya untuknya (K-04).
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

function e10Kerjakan(object $ctx, Kuis $kuis, Murid $murid, Soal $soal, string $jawaban): void
{
    auth()->forgetGuards();
    Sanctum::actingAs($murid->user->loadMissing('murid'));

    $attemptId = (int) test()->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated()->json('id');

    test()->postJson("/api/v1/attempt/{$attemptId}/jawab", ['question_id' => $soal->id, 'jawaban' => $jawaban])->assertOk();
    test()->postJson("/api/v1/attempt/{$attemptId}/kumpulkan", ['idempotency_key' => 'e10-'.uniqid()])->assertOk();
}

function e10Guru(object $ctx): void
{
    auth()->forgetGuards();
    Sanctum::actingAs($ctx->guru);
}

it('guru mengunduh nilai kuis sebagai CSV satu baris per murid', function (): void {
    $soal = e10Soal($this);
    $kuis = e10Kuis($this, [$soal]);

    $benar = Murid::factory()->create(['school_id' => $this->sekolah->id, 'class_id' => $this->kelas->id]);
    e10Kerjakan($this, $kuis, $this->murid, $soal, 'a');
    e10Kerjakan($this, $kuis, $benar, $soal, 'b');

    e10Guru($this);

    $respons = $this->get("/api/v1/kuis/{$kuis->id}/ekspor-nilai")->assertOk();

    expect($respons->headers->get('content-type'))->toContain('text/csv')
        ->and((string) $respons->headers->get('content-disposition'))->toContain('.csv');

    $isi = $respons->streamedContent();
    $baris = explode("\n", trim($isi));

    // Baris pertama judul kolom; dua murid → dua baris data.
    expect($baris)->toHaveCount(3)
        ->and($baris[0])->toContain('nama')
        ->and($baris[0])->toContain('soal_1')
        ->and($isi)->toContain((string) $this->murid->user->name)
        ->and($isi)->toContain((string) $benar->user->name);

    // Skor asli: satu murid 10, satu 0, dengan maksimal 10.
    expect($isi)->toContain(',10,10,100,')
        ->and($isi)->toContain(',0,10,0,');
});

it('ekspor nilai diawali BOM UTF-8 dan mendukung pemisah titik koma', function (): void {
    $soal = e10Soal($this);
    $kuis = e10Kuis($this, [$soal]);
    e10Kerjakan($this, $kuis, $this->murid, $soal, 'a');
    e10Guru($this);

    // Excel berbahasa Indonesia butuh BOM agar mengenali UTF-8, dan memakai
    // `;` sebagai pemisah kolom (Q-16).
    $bawaan = $this->get("/api/v1/kuis/{$kuis->id}/ekspor-nilai")->assertOk()->streamedContent();

    expect(str_starts_with($bawaan, "\xEF\xBB\xBF"))->toBeTrue();

    $titikKoma = $this->get("/api/v1/kuis/{$kuis->id}/ekspor-nilai?delimiter=;")
        ->assertOk()
        ->streamedContent();
    $baris = explode("\n", trim($titikKoma));

    expect($baris[0])->toContain('nama;nis;nisn')
        ->and($baris[1])->toContain(';10;10;100;');
});

it('ekspor nilai memakai jam WIB dan mengurut nama tanpa peduli besar-kecil huruf', function (): void {
    // Waktu dipatok DULU agar jadwal kuis (berjalan = mulai tadi, selesai nanti)
    // tetap mengapit jam yang dibekukan; UTC 03:00 → WIB 10:00.
    $this->travelTo(Carbon::parse('2026-03-01T03:00:00Z'));

    $soal = e10Soal($this);
    $kuis = e10Kuis($this, [$soal]);

    $zahra = Murid::factory()->create(['school_id' => $this->sekolah->id, 'class_id' => $this->kelas->id]);
    $zahra->user->forceFill(['name' => 'Zahra'])->save();
    $andi = Murid::factory()->create(['school_id' => $this->sekolah->id, 'class_id' => $this->kelas->id]);
    $andi->user->forceFill(['name' => 'andi'])->save();

    e10Kerjakan($this, $kuis, $zahra, $soal, 'a');
    e10Kerjakan($this, $kuis, $andi, $soal, 'a');

    e10Guru($this);
    $isi = $this->get("/api/v1/kuis/{$kuis->id}/ekspor-nilai")->assertOk()->streamedContent();
    $baris = explode("\n", trim($isi));

    // Case-insensitive: "andi" mendahului "Zahra" (strcmp lama menyimpannya
    // setelah huruf besar).
    expect($baris[1])->toContain('andi')
        ->and($baris[2])->toContain('Zahra')
        ->and($isi)->toContain('2026-03-01 10:00')
        ->and($isi)->not->toContain('2026-03-01 03:00');

    expect(Attempt::query()->where('quiz_id', $kuis->id)->count())->toBe(2);
});

it('ekspor mengamankan nama yang mirip rumus spreadsheet', function (): void {
    $soal = e10Soal($this);
    $kuis = e10Kuis($this, [$soal]);

    $berbahaya = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);
    $berbahaya->user->forceFill(['name' => '=SUM(1+1)'])->save();

    e10Kerjakan($this, $kuis, $berbahaya, $soal, 'a');
    e10Guru($this);

    $isi = $this->get("/api/v1/kuis/{$kuis->id}/ekspor-nilai")->assertOk()->streamedContent();

    // Sel berawalan = diberi kutip tunggal supaya tidak dieksekusi Excel.
    expect($isi)->toContain("'=SUM(1+1)")
        ->and($isi)->not->toContain("\n=SUM(1+1)");
});

it('ekspor tim memakai snapshot anggota sehingga tetap utuh walau tim berubah', function (): void {
    $soal = e10Soal($this);
    $kuis = e10Kuis($this, [$soal]);

    Murid::factory()->count(3)->create(['school_id' => $this->sekolah->id, 'class_id' => $this->kelas->id]);

    e10Guru($this);
    $this->postJson("/api/v1/kuis/{$kuis->id}/tim/bagi", ['jumlah_tim' => 2])->assertOk();
    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis', 'lingkup_id' => $kuis->id, 'kunci' => KunciPengaturan::ModeTim->value, 'nilai' => true,
    ])->assertOk();

    $tim = DB::table('team_members')->where('quiz_id', $kuis->id)->first();
    $timId = (int) $tim->team_id;
    $namaTim = (string) DB::table('teams')->where('id', $timId)->value('nama');
    $anggota = DB::table('team_members')->where('team_id', $timId)->pluck('student_id');

    $pertama = Murid::query()->findOrFail($anggota[0]);
    $rekan = Murid::query()->findOrFail($anggota[1]);

    e10Kerjakan($this, $kuis, $pertama, $soal, 'a');

    // Setelah ujian: satu anggota keluar dari tim dan timnya dihapus. Tanpa
    // snapshot, `attempts.team_id` jadi null sehingga ekspor menyusut menjadi
    // satu baris tanpa nama tim — nilai historis berubah (Q-18).
    DB::table('team_members')->where('team_id', $timId)->where('student_id', $rekan->id)->delete();
    DB::table('teams')->where('id', $timId)->delete();

    e10Guru($this);
    $isi = $this->get("/api/v1/kuis/{$kuis->id}/ekspor-nilai")->assertOk()->streamedContent();
    $baris = explode("\n", trim($isi));

    // Baris snapshot tetap dua anggota dan masih membawa nama tim aslinya.
    expect($baris)->toHaveCount(3)
        ->and($isi)->toContain((string) $pertama->user->name)
        ->and($isi)->toContain((string) $rekan->user->name)
        ->and(substr_count($isi, ',"'.$namaTim.'",2,'))->toBe(2);
});

it('murid tidak boleh mengunduh nilai kelas dan kuis belum dikerjakan tetap kosong', function (): void {
    $soal = e10Soal($this);
    $kuis = e10Kuis($this, [$soal]);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user->loadMissing('murid'));

    $this->get("/api/v1/kuis/{$kuis->id}/ekspor-nilai")->assertStatus(403);

    e10Guru($this);
    $isi = $this->get("/api/v1/kuis/{$kuis->id}/ekspor-nilai")->assertOk()->streamedContent();

    // Hanya baris judul kolom, tanpa baris data.
    expect(explode("\n", trim($isi)))->toHaveCount(1);
});

it('ekspor mode tim memberi setiap anggota skor tim yang sama', function (): void {
    $soal = e10Soal($this);
    $kuis = e10Kuis($this, [$soal]);

    // Kelas butuh minimal 4 murid supaya bisa dibagi jadi 2 tim berisi 2 anak.
    Murid::factory()->count(3)->create(['school_id' => $this->sekolah->id, 'class_id' => $this->kelas->id]);

    e10Guru($this);
    $this->postJson("/api/v1/kuis/{$kuis->id}/tim/bagi", ['jumlah_tim' => 2])->assertOk();
    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis', 'lingkup_id' => $kuis->id, 'kunci' => KunciPengaturan::ModeTim->value, 'nilai' => true,
    ])->assertOk();

    // Ambil dua anggota satu tim, kerjakan bersama-sama.
    $tim = DB::table('team_members')->where('quiz_id', $kuis->id)->first();
    $namaTim = (string) DB::table('teams')->where('id', $tim->team_id)->value('nama');
    $anggota = DB::table('team_members')->where('team_id', $tim->team_id)->pluck('student_id');

    $pertama = Murid::query()->findOrFail($anggota[0]);
    $rekan = Murid::query()->findOrFail($anggota[1]);

    e10Kerjakan($this, $kuis, $pertama, $soal, 'a');

    e10Guru($this);
    $isi = $this->get("/api/v1/kuis/{$kuis->id}/ekspor-nilai")->assertOk()->streamedContent();
    $baris = explode("\n", trim($isi));

    // Dua anggota → dua baris, keduanya membawa nama tim dan skor yang sama.
    expect($baris)->toHaveCount(3)
        ->and($isi)->toContain((string) $pertama->user->name)
        ->and($isi)->toContain((string) $rekan->user->name)
        // Nama tim yang memuat spasi dikutip oleh penulis CSV; yang penting
        // kedua baris membawa tim dan skor yang sama.
        ->and(substr_count($isi, ',"'.$namaTim.'",2,10,10,100,'))->toBe(2);
});
