<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Attempt\Models\AnggotaAttempt;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Models\Jawaban;
use App\Sections\Attempt\Models\RevisiJawaban;
use App\Sections\Attempt\Models\Tim;
use App\Sections\Cheat\Models\KejadianKecurangan;
use App\Sections\Presence\Services\PresenceService;
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
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use RuntimeException;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '5B', 'tingkat' => 5]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'IPA', 'kode' => 'IPA5']);
    $this->guru = User::factory()->guru()->create();

    $this->murid = collect(range(1, 4))->map(fn (int $urut): Murid => Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]));
});

/** Soal objektif sederhana supaya skor tim jelas. */
function t09Soal(object $ctx): Soal
{
    return Soal::factory()->untukSekolah($ctx->sekolah, $ctx->mapel)->milik($ctx->guru)->create([
        'tipe' => TipeSoal::PilihanGanda,
        'konten' => ['teks' => 'Air membeku pada suhu?', 'opsi' => [['id' => 'a', 'teks' => '0 derajat'], ['id' => 'b', 'teks' => '100 derajat']]],
        'kunci' => ['jawaban' => 'a'],
        'skor' => 10,
    ]);
}

/**
 * @param  array<int, Soal>  $soal
 */
function t09Kuis(object $ctx, array $soal): Kuis
{
    // Pemilik = guru yang sedang masuk: susunan tim, peringkat, dan ekspor
    // nilainya hanya untuk guru pemilik kuis (K-04).
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

function t09Guru(object $ctx): void
{
    auth()->forgetGuards();
    Sanctum::actingAs($ctx->guru);
}

/**
 * Masuk sebagai murid. Relasi `murid` dimuat eksplisit karena policy kuis
 * membaca kelas murid, dan pemuatan malas sengaja dimatikan di test.
 */
function t09Murid(Murid $murid): void
{
    auth()->forgetGuards();
    Sanctum::actingAs($murid->user->loadMissing('murid'));
}

/** Nyalakan satu kunci pengaturan pada lingkup kuis. */
function t09Saklar(object $ctx, Kuis $kuis, KunciPengaturan $kunci, bool $nilai = true): void
{
    t09Guru($ctx);

    test()->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis',
        'lingkup_id' => $kuis->id,
        'kunci' => $kunci->value,
        'nilai' => $nilai,
    ])->assertOk();
}

function t09Mulai(Murid $murid, Kuis $kuis): int
{
    t09Murid($murid);

    return (int) test()->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated()->json('id');
}

/**
 * Anggota satu tim hasil pembagian otomatis (pembagian bergiliran, jadi dua
 * murid berurutan belum tentu satu tim).
 *
 * @return array<int, Murid>
 */
function t09AnggotaTim(object $ctx, Kuis $kuis, int $indeks = 0): array
{
    $tim = Tim::query()
        ->where('quiz_id', $kuis->getKey())
        ->orderBy('nama')
        ->with('murid.user')
        ->get()
        ->values()
        ->get($indeks);

    if ($tim === null) {
        throw new RuntimeException('Tim tidak ditemukan.');
    }

    return $tim->murid->values()->all();
}

it('satu tim tidak bisa punya dua attempt aktif walau dua anggota menekan Mulai bersamaan', function (): void {
    $soal = t09Soal($this);
    $kuis = t09Kuis($this, [$soal]);

    /** @var Tim $tim */
    $tim = Tim::query()->create([
        'school_id' => $this->sekolah->id,
        'quiz_id' => $kuis->id,
        'nama' => 'Tim Merah',
    ]);

    $anggota = $this->murid->values();

    /** Meniru satu permintaan "Mulai" yang menulis attempt timnya. */
    $buat = function (Murid $murid) use ($kuis, $tim): void {
        DB::table('attempts')->insert([
            'school_id' => $kuis->school_id,
            'quiz_id' => $kuis->id,
            'student_id' => $murid->id,
            'team_id' => $tim->id,
            'jenis' => 'ulangan',
            'status' => 'berjalan',
            'aktif' => true,
            'seed' => 1,
            'mulai_at' => now(),
            'deadline_at' => now()->addMinutes(30),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    };

    $buat($anggota[0]);

    // Anggota kedua membuka kuis bersamaan. Sebelum ada indeks unik per tim,
    // baris ini lolos: dua attempt aktif ber-`team_id` sama, keduanya `asli`,
    // sehingga tim terbelah dua lembar jawaban dan ranking menghitung dua kali.
    expect(fn () => $buat($anggota[1]))->toThrow(UniqueConstraintViolationException::class);

    expect(Attempt::query()->where('quiz_id', $kuis->id)->where('aktif', true)->count())->toBe(1);
});

it('guru membagi murid kelas jadi tim otomatis, murid tidak boleh menyentuhnya', function (): void {
    $kuis = t09Kuis($this, [t09Soal($this)]);

    t09Murid($this->murid[0]);
    $this->getJson("/api/v1/kuis/{$kuis->id}/tim")->assertStatus(403);
    $this->postJson("/api/v1/kuis/{$kuis->id}/tim/bagi", ['jumlah_tim' => 2])->assertStatus(403);

    t09Guru($this);

    $bagi = $this->postJson("/api/v1/kuis/{$kuis->id}/tim/bagi", ['jumlah_tim' => 2])->assertOk();

    expect($bagi->json('jumlah_tim'))->toBe(2)
        ->and($bagi->json('mode_tim'))->toBeFalse()
        ->and(collect($bagi->json('tim'))->sum('jumlah_anggota'))->toBe(4);

    // Setiap murid hanya muncul di satu tim.
    $timIds = Tim::query()->where('quiz_id', $kuis->id)->pluck('id');
    expect($timIds)->toHaveCount(2);

    $keanggotaan = DB::table('team_members')->where('quiz_id', $kuis->id)->get();
    expect($keanggotaan)->toHaveCount(4)
        ->and($keanggotaan->pluck('student_id')->unique())->toHaveCount(4);
});

it('satu murid tidak bisa masuk dua tim dan susunan tidak berubah setelah dikerjakan', function (): void {
    $kuis = t09Kuis($this, [t09Soal($this)]);
    t09Guru($this);
    $this->postJson("/api/v1/kuis/{$kuis->id}/tim/bagi", ['jumlah_tim' => 2])->assertOk();

    $tim = Tim::query()->where('quiz_id', $kuis->id)->orderBy('nama')->get();
    $isiTimSatu = t09AnggotaTim($this, $kuis);
    // Pembagian bergiliran, jadi penyusup diambil dari tim lain secara pasti
    // (bukan dari urutan array murid yang namanya acak).
    $penyusup = t09AnggotaTim($this, $kuis, 1)[0];

    // Murid yang sudah ada di tim lain tidak bisa dipindah dengan cara apa pun.
    $this->postJson("/api/v1/kuis/{$kuis->id}/tim", [
        'tim_id' => $tim[0]->id,
        'nama' => (string) $tim[0]->nama,
        'murid' => [$isiTimSatu[0]->id, $penyusup->id],
    ])->assertStatus(422)->assertJsonValidationErrors(['murid']);

    // Murid kelas lain pun tidak bisa dimasukkan.
    $kelasLain = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '5C', 'tingkat' => 5]);
    $muridLain = Murid::factory()->create(['school_id' => $this->sekolah->id, 'class_id' => $kelasLain->id]);

    $this->postJson("/api/v1/kuis/{$kuis->id}/tim", [
        'tim_id' => $tim[0]->id,
        'nama' => (string) $tim[0]->nama,
        'murid' => [$isiTimSatu[0]->id, $muridLain->id],
    ])->assertStatus(422)->assertJsonValidationErrors(['murid']);

    // Setelah kuis dikerjakan, susunan tim dibekukan.
    t09Saklar($this, $kuis, KunciPengaturan::ModeTim);
    t09Mulai($isiTimSatu[0], $kuis);

    t09Guru($this);
    $this->postJson("/api/v1/kuis/{$kuis->id}/tim/bagi", ['jumlah_tim' => 2])
        ->assertStatus(422)->assertJsonValidationErrors(['tim']);

    $this->deleteJson("/api/v1/kuis/{$kuis->id}/tim/{$tim[0]->id}")
        ->assertStatus(422)->assertJsonValidationErrors(['tim']);
});

it('mode tim memakai satu jawaban bersama dengan versi dan penjawab yang jelas', function (): void {
    $soal = t09Soal($this);
    $kuis = t09Kuis($this, [$soal]);

    t09Guru($this);
    $this->postJson("/api/v1/kuis/{$kuis->id}/tim/bagi", ['jumlah_tim' => 2])->assertOk();
    t09Saklar($this, $kuis, KunciPengaturan::ModeTim);

    [$a, $b] = t09AnggotaTim($this, $kuis);

    // Dua anggota tim membuka kuis → lembar yang sama, bukan dua attempt.
    $attemptA = t09Mulai($a, $kuis);
    $attemptB = t09Mulai($b, $kuis);

    expect($attemptB)->toBe($attemptA);

    $muat = $this->getJson("/api/v1/attempt/{$attemptA}")->assertOk();

    expect($muat->json('tim.nama'))->not->toBeNull()
        ->and($muat->json('tim.jumlah_anggota'))->toBe(2)
        ->and($muat->json('tim.rekan'))->toHaveCount(1);

    // Anggota kedua menjawab: jawaban masuk ke lembar tim yang sama.
    t09Murid($b);
    $this->postJson("/api/v1/attempt/{$attemptA}/jawab", ['question_id' => $soal->id, 'jawaban' => 'a'])->assertOk();

    $baris = Jawaban::query()->where('attempt_id', $attemptA)->where('question_id', $soal->id)->firstOrFail();

    expect($baris->penjawab_id)->toBe($b->id)
        ->and($baris->versi)->toBe(1)
        ->and(RevisiJawaban::query()->where('attempt_id', $attemptA)->count())->toBe(1);

    // Menyimpan jawaban yang sama berulang kali tidak menambah versi.
    $this->postJson("/api/v1/attempt/{$attemptA}/jawab", ['question_id' => $soal->id, 'jawaban' => 'a'])->assertOk();

    expect($baris->refresh()->versi)->toBe(1)
        ->and(RevisiJawaban::query()->where('attempt_id', $attemptA)->count())->toBe(1);

    // Anggota pertama mengganti isinya → versi naik dan pelakunya tercatat.
    t09Murid($a);
    $this->postJson("/api/v1/attempt/{$attemptA}/jawab", ['question_id' => $soal->id, 'jawaban' => 'b'])->assertOk();

    expect($baris->refresh()->versi)->toBe(2)
        ->and($baris->penjawab_id)->toBe($a->id)
        ->and(RevisiJawaban::query()->where('attempt_id', $attemptA)->count())->toBe(2);

    $riwayat = RevisiJawaban::query()->where('attempt_id', $attemptA)->orderBy('versi')->get();

    expect($riwayat->pluck('versi')->all())->toBe([1, 2])
        ->and($riwayat->pluck('student_id')->all())->toBe([$b->id, $a->id]);
});

it('dua anggota tim dengan sesi berbeda tidak dicatat sebagai sesi ganda palsu', function (): void {
    $soal = t09Soal($this);
    $kuis = t09Kuis($this, [$soal]);

    t09Guru($this);
    $this->postJson("/api/v1/kuis/{$kuis->id}/tim/bagi", ['jumlah_tim' => 2])->assertOk();
    t09Saklar($this, $kuis, KunciPengaturan::ModeTim);

    [$a] = t09AnggotaTim($this, $kuis);
    $attempt = Attempt::query()->findOrFail(t09Mulai($a, $kuis));

    // Satu lembar jawaban tim memang dipakai beberapa anggota, dan tiap anggota
    // masuk dari perangkat/sesi sendiri. Sesi yang berbeda di attempt tim yang
    // sama bukan kecurangan (Q-14) — dulu ini mencatat `duplicate_session`
    // berisiko 8 terhadap anak yang hanya mengerjakan tugas kelompoknya.
    $presence = app(PresenceService::class);
    $presence->tandaiHadir($attempt, 'sesi-anggota-a');
    $presence->tandaiHadir($attempt, 'sesi-anggota-b');

    expect(KejadianKecurangan::query()->where('kategori', 'duplicate_session')->count())->toBe(0);
});

it('murid tanpa tim ditolak, dan mode individu tetap seperti sebelumnya', function (): void {
    $soal = t09Soal($this);
    $kuis = t09Kuis($this, [$soal]);

    // Mode tim mati (bawaan): tiap murid punya attempt sendiri, tanpa riwayat versi.
    $attemptA = t09Mulai($this->murid[0], $kuis);
    $attemptB = t09Mulai($this->murid[1], $kuis);

    expect($attemptB)->not->toBe($attemptA);

    t09Murid($this->murid[0]);
    $this->postJson("/api/v1/attempt/{$attemptA}/jawab", ['question_id' => $soal->id, 'jawaban' => 'a'])->assertOk();

    expect(RevisiJawaban::query()->count())->toBe(0);

    $muat = $this->getJson("/api/v1/attempt/{$attemptA}")->assertOk();

    expect($muat->json('tim'))->toBeNull();

    // Mode tim dinyalakan tetapi murid ini belum masuk tim mana pun.
    t09Saklar($this, $kuis, KunciPengaturan::ModeTim);

    t09Murid($this->murid[2]);
    $this->postJson("/api/v1/kuis/{$kuis->id}/mulai")
        ->assertStatus(422)
        ->assertJsonValidationErrors(['kuis']);
});

it('skor tim dibagi sama ke anggotanya di laporan dan badge', function (): void {
    $soal = t09Soal($this);
    $kuis = t09Kuis($this, [$soal]);

    t09Guru($this);
    $this->postJson("/api/v1/kuis/{$kuis->id}/tim/bagi", ['jumlah_tim' => 2])->assertOk();
    t09Saklar($this, $kuis, KunciPengaturan::ModeTim);

    [$a, $b] = t09AnggotaTim($this, $kuis);
    $lawan = t09AnggotaTim($this, $kuis, 1);

    $attemptId = t09Mulai($a, $kuis);

    t09Murid($b);
    $this->postJson("/api/v1/attempt/{$attemptId}/jawab", ['question_id' => $soal->id, 'jawaban' => 'a'])->assertOk();
    $this->postJson("/api/v1/attempt/{$attemptId}/kumpulkan", ['idempotency_key' => 'tim-09-a'])->assertOk();

    expect(Attempt::query()->findOrFail($attemptId)->skor)->toEqual(10.0);

    // Kedua anggota melihat skor tim yang sama — satu nilai, bukan dua.
    foreach ([$a, $b] as $anggota) {
        t09Murid($anggota);
        $badge = $this->getJson('/api/v1/badge/saya')->assertOk();

        expect($badge->json('badge.0.jumlah_ulangan'))->toBe(1)
            ->and((float) $badge->json('badge.0.rata_rata'))->toEqual(100.0);
    }

    // Anggota tim lain yang belum mengerjakan belum punya nilai apa pun.
    t09Murid($lawan[0]);
    $this->getJson('/api/v1/badge/saya')->assertOk()->assertJsonPath('jumlah_lencana', 0);

    // Hasil attempt bisa dibuka anggota tim (bukan hanya pencatat attempt).
    t09Murid($b);
    $hasil = $this->getJson("/api/v1/attempt/{$attemptId}/hasil")->assertOk();

    expect((float) $hasil->json('skor'))->toEqual(10.0);
});

it('ekspor nilai memakai snapshot anggota tim, bukan susunan tim yang hidup (Q-18)', function (): void {
    $soal = t09Soal($this);
    $kuis = t09Kuis($this, [$soal]);

    t09Guru($this);
    $this->postJson("/api/v1/kuis/{$kuis->id}/tim/bagi", ['jumlah_tim' => 2])->assertOk();
    t09Saklar($this, $kuis, KunciPengaturan::ModeTim);

    [$a, $b] = t09AnggotaTim($this, $kuis);
    $tim = Tim::query()->where('quiz_id', $kuis->id)->orderBy('nama')->firstOrFail();

    $attemptId = t09Mulai($a, $kuis);

    t09Murid($b);
    $this->postJson("/api/v1/attempt/{$attemptId}/jawab", ['question_id' => $soal->id, 'jawaban' => 'a'])->assertOk();
    $this->postJson("/api/v1/attempt/{$attemptId}/kumpulkan", ['idempotency_key' => 'tim-09-q18'])->assertOk();

    // Snapshot dibekukan saat attempt dimulai: satu baris per anggota tim.
    expect(AnggotaAttempt::query()->where('attempt_id', $attemptId)->count())->toBe(2);

    $namaAnak = (string) $a->user->name;
    $namaTim = (string) $tim->nama;

    // Setelah ujian, data sumber boleh berubah (mis. admin membetulkan nama anak
    // atau mengganti nama tim). Buku nilai harus TIDAK ikut berubah.
    $a->user->forceFill(['name' => 'Nama Anak Sudah Diubah'])->save();
    $tim->forceFill(['nama' => 'Tim Sudah Diganti'])->save();

    t09Guru($this);
    $csv = $this->get("/api/v1/kuis/{$kuis->id}/ekspor-nilai")->assertOk()->streamedContent();

    expect($csv)
        ->toContain($namaAnak)
        ->toContain($namaTim)
        ->not->toContain('Nama Anak Sudah Diubah')
        ->not->toContain('Tim Sudah Diganti')
        // Skor tim dibagi sama: dua baris anggota, keduanya berjumlah anggota 2.
        ->and(substr_count($csv, ',2,'))->toBeGreaterThanOrEqual(2);
});

it('peringkat mode tim diurutkan per tim, bukan per anak', function (): void {
    $soal = t09Soal($this);
    $kuis = t09Kuis($this, [$soal]);

    t09Guru($this);
    $this->postJson("/api/v1/kuis/{$kuis->id}/tim/bagi", ['jumlah_tim' => 2])->assertOk();
    t09Saklar($this, $kuis, KunciPengaturan::ModeTim);

    $timSatu = Tim::query()->where('quiz_id', $kuis->id)->orderBy('nama')->firstOrFail();
    $anggotaTimSatu = t09AnggotaTim($this, $kuis);
    $lawan = t09AnggotaTim($this, $kuis, 1);

    // Tim pertama menjawab benar semua, tim kedua belum mengumpulkan.
    $attemptId = t09Mulai($anggotaTimSatu[0], $kuis);
    t09Murid($anggotaTimSatu[1]);
    $this->postJson("/api/v1/attempt/{$attemptId}/jawab", ['question_id' => $soal->id, 'jawaban' => 'a'])->assertOk();
    $this->postJson("/api/v1/attempt/{$attemptId}/kumpulkan", ['idempotency_key' => 'tim-09-b'])->assertOk();

    // Guru selalu boleh melihat peringkat walau saklar ranking mati.
    t09Guru($this);
    $guru = $this->getJson("/api/v1/kuis/{$kuis->id}/ranking")->assertOk();

    expect($guru->json('mode_tim'))->toBeTrue()
        ->and($guru->json('total'))->toBe(1)
        ->and($guru->json('peringkat.0.tim_nama'))->toBe($timSatu->nama)
        ->and($guru->json('peringkat.0.murid_id'))->toBeNull()
        ->and($guru->json('peringkat.0.anggota'))->toHaveCount(2)
        ->and((float) $guru->json('peringkat.0.skor'))->toEqual(10.0);

    // Saklar ranking dinyalakan → murid melihat peringkat timnya sendiri.
    t09Saklar($this, $kuis, KunciPengaturan::Ranking);

    t09Murid($anggotaTimSatu[0]);
    $murid = $this->getJson("/api/v1/kuis/{$kuis->id}/ranking")->assertOk();

    expect($murid->json('tampil'))->toBeTrue()
        ->and($murid->json('peringkat_saya.tim_id'))->toBe($timSatu->id)
        ->and($murid->json('peringkat_saya.tim_nama'))->toBe($timSatu->nama);

    // Murid dari tim lain belum punya baris peringkat (belum mengumpulkan).
    t09Murid($lawan[0]);
    $this->getJson("/api/v1/kuis/{$kuis->id}/ranking")
        ->assertOk()
        ->assertJsonPath('peringkat_saya', null);
});
