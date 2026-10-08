<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Enums\StatusKuis;
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

/**
 * Batas kepemilikan antar guru (S-04/S-05).
 *
 * Sebelum ini semua guru setara: guru mana pun bisa mengubah judul, jadwal,
 * daftar soal, dan saklar anti-cheat milik guru lain — termasuk saat ulangannya
 * sedang berjalan — lalu mengoreksi nilainya.
 */
beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '4A', 'tingkat' => 4]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'IPA', 'kode' => 'IPA4']);

    $this->guruA = User::factory()->guru()->create();
    $this->guruB = User::factory()->guru()->create();
    $this->admin = User::query()->where('email', 'admin@sekolah.test')->firstOrFail();

    $this->kuisB = Kuis::factory()->untukSekolah($this->sekolah, $this->mapel, $this->kelas)->create([
        'judul' => 'Kuis milik guru B',
        'dibuat_oleh' => $this->guruB->id,
    ]);

    $this->soalB = Soal::factory()->untukSekolah($this->sekolah, $this->mapel)->create([
        'dibuat_oleh' => $this->guruB->id,
    ]);
});

/** Masuk sebagai satu pengguna. */
function o04Masuk(User $user): void
{
    auth()->forgetGuards();
    Sanctum::actingAs($user);
}

/** Isi kuis yang sah (dipakai untuk membuktikan penolakan 403, bukan 422). */
function o04IsiKuis(object $ctx): array
{
    return [
        'judul' => 'Kuis diubah',
        'subject_id' => $ctx->mapel->id,
        'class_id' => $ctx->kelas->id,
        'durasi_menit' => 20,
        // Jadwal ikut dikirim supaya kuis bisa diterbitkan (penerbitan menolak
        // kuis tanpa jadwal — aturan domain, bukan urusan kepemilikan).
        'mulai_at' => now()->subMinute()->toIso8601String(),
        'selesai_at' => now()->addHour()->toIso8601String(),
    ];
}

/** Isi soal yang sah. */
function o04IsiSoal(object $ctx): array
{
    return [
        'subject_id' => $ctx->mapel->id,
        'tipe' => 'pilihan_ganda',
        'konten' => [
            'teks' => 'Ibu kota Indonesia?',
            'opsi' => [
                ['id' => 'a', 'teks' => 'Jakarta'],
                ['id' => 'b', 'teks' => 'Bandung'],
            ],
        ],
        'kunci' => ['jawaban' => 'a'],
        'skor' => 5,
    ];
}

it('guru lain tidak bisa mengubah, menerbitkan, atau menghapus kuis milik guru lain', function (): void {
    o04Masuk($this->guruA);

    $this->putJson("/api/v1/kuis/{$this->kuisB->id}", o04IsiKuis($this))->assertStatus(403);
    $this->postJson("/api/v1/kuis/{$this->kuisB->id}/publikasi")->assertStatus(403);
    $this->deleteJson("/api/v1/kuis/{$this->kuisB->id}")->assertStatus(403);

    expect($this->kuisB->refresh()->judul)->toBe('Kuis milik guru B')
        ->and($this->kuisB->status)->toBe(StatusKuis::Draf);

    // Pemiliknya sendiri tidak ikut terkunci.
    o04Masuk($this->guruB);
    $this->putJson("/api/v1/kuis/{$this->kuisB->id}", o04IsiKuis($this))->assertOk();

    expect($this->kuisB->refresh()->judul)->toBe('Kuis diubah');

    // Penerbitan juga menuntut kuis punya soal — aturan domain, bukan kepemilikan.
    $this->kuisB->soal()->attach($this->soalB->id, ['urutan' => 1]);

    // Admin boleh semuanya, termasuk kuis milik guru lain.
    o04Masuk($this->admin);
    $this->postJson("/api/v1/kuis/{$this->kuisB->id}/publikasi")->assertOk();
    $this->deleteJson("/api/v1/kuis/{$this->kuisB->id}")->assertOk();
});

it('guru lain tidak bisa mengubah atau menghapus soal milik guru lain', function (): void {
    o04Masuk($this->guruA);

    $this->putJson("/api/v1/soal/{$this->soalB->id}", o04IsiSoal($this))->assertStatus(403);
    $this->deleteJson("/api/v1/soal/{$this->soalB->id}")->assertStatus(403);

    expect(Soal::query()->whereKey($this->soalB->id)->exists())->toBeTrue();

    // Pemiliknya sendiri tetap bisa.
    o04Masuk($this->guruB);
    $this->putJson("/api/v1/soal/{$this->soalB->id}", o04IsiSoal($this))->assertOk();

    expect((int) $this->soalB->refresh()->skor)->toBe(5);

    // Admin boleh.
    o04Masuk($this->admin);
    $this->deleteJson("/api/v1/soal/{$this->soalB->id}")->assertOk();
});

it('guru lain tidak bisa mengubah pengaturan lingkup kuis milik guru lain', function (): void {
    o04Masuk($this->guruA);

    // Saklar anti-cheat/mode tim satu kuis inilah yang mengubah aturan ulangan
    // murid di kelas guru B.
    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis',
        'lingkup_id' => $this->kuisB->id,
        'kunci' => 'mode_tim',
        'nilai' => true,
    ])->assertStatus(403);

    // Pemiliknya sendiri boleh.
    o04Masuk($this->guruB);
    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis',
        'lingkup_id' => $this->kuisB->id,
        'kunci' => 'mode_tim',
        'nilai' => true,
    ])->assertOk();

    // Admin boleh.
    o04Masuk($this->admin);
    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis',
        'lingkup_id' => $this->kuisB->id,
        'kunci' => 'mode_tim',
        'nilai' => false,
    ])->assertOk();
});

it('guru lain tidak bisa membuka antrean koreksi atau mengubah nilai pada kuis guru lain', function (): void {
    // Kuis berjalan dengan satu soal + seorang murid yang sudah mengerjakan.
    $this->kuisB->soal()->attach($this->soalB->id, ['urutan' => 1]);
    $this->kuisB->forceFill([
        'status' => StatusKuis::Publikasi,
        'mulai_at' => now()->subMinute(),
        'selesai_at' => now()->addHour(),
    ])->save();

    $murid = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);

    o04Masuk($murid->user->loadMissing('murid'));
    $attemptId = (int) $this->postJson("/api/v1/kuis/{$this->kuisB->id}/mulai")->assertCreated()->json('id');

    o04Masuk($this->guruA);
    $this->getJson("/api/v1/kuis/{$this->kuisB->id}/koreksi")->assertStatus(403);
    $this->postJson("/api/v1/attempt/{$attemptId}/koreksi/token", [
        'question_id' => $this->soalB->id,
        'alasan' => 'Jawaban sebenarnya benar, hanya salah tulis.',
    ])->assertStatus(403);

    // Pemiliknya sendiri boleh membuka antreannya.
    o04Masuk($this->guruB);
    $this->getJson("/api/v1/kuis/{$this->kuisB->id}/koreksi")->assertOk();
});

it('kuis lama tanpa pemilik tercatat tetap boleh dikelola semua guru (perilaku lama)', function (): void {
    $kuisLama = Kuis::factory()->untukSekolah($this->sekolah, $this->mapel, $this->kelas)->create([
        'judul' => 'Kuis tanpa pemilik',
        'dibuat_oleh' => null,
    ]);

    o04Masuk($this->guruA);

    $this->putJson("/api/v1/kuis/{$kuisLama->id}", o04IsiKuis($this))->assertOk();

    expect($kuisLama->refresh()->judul)->toBe('Kuis diubah');
});
