<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Enums\StatusKuis;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Sekolah;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

/**
 * Kuis yang diarsipkan harus bisa dipulihkan (14 Oktober 2026).
 *
 * Pengarsipan dulu satu arah: tidak ada endpoint, tombol, atau jalan lain untuk
 * membukanya lagi. Guru yang salah menekan "Arsipkan" kehilangan kuisnya dari
 * daftar kerja — dan satu-satunya jalan keluar adalah menyusun ulang kuisnya dari
 * nol (soal, jadwal, susunan). Kuis yang dipulihkan kembali sebagai **draf**,
 * bukan langsung terbit: jadwalnya sudah lewat dan guru yang menentukan kapan ia
 * terbit lagi.
 */
beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '5B', 'tingkat' => 5]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Matematika', 'kode' => 'MTK5']);

    $this->guru = User::factory()->guru()->create();
    $this->guruLain = User::factory()->guru()->create();
    $this->admin = User::query()->where('email', 'admin@sekolah.test')->firstOrFail();
});

/** Masuk sebagai satu pengguna. */
function pkMasuk(User $user): void
{
    auth()->forgetGuards();
    Sanctum::actingAs($user);
}

/** Kuis siap terbit milik guru yang sedang diuji (satu soal aktif + jadwal). */
function pkKuisSiap(object $ctx, User $pemilik): Kuis
{
    $kuis = Kuis::factory()->untukSekolah($ctx->sekolah, $ctx->mapel, $ctx->kelas)
        ->milik($pemilik)->berjalan()->create(['judul' => 'Ulangan Pecahan']);

    $soal = Soal::factory()->untukSekolah($ctx->sekolah, $ctx->mapel)->milik($pemilik)->create();
    $kuis->soal()->attach($soal->id, ['urutan' => 1]);

    return $kuis->refresh();
}

it('kuis arsip bisa dipulihkan dan kembali sebagai draf yang bisa disunting lagi', function (): void {
    $kuis = pkKuisSiap($this, $this->guru);
    pkMasuk($this->guru);

    $this->postJson("/api/v1/kuis/{$kuis->id}/publikasi")->assertOk();
    $this->postJson("/api/v1/kuis/{$kuis->id}/arsip")->assertOk()->assertJsonPath('status', 'arsip');

    $pulih = $this->postJson("/api/v1/kuis/{$kuis->id}/pulihkan")->assertOk();

    expect($pulih->json('status'))->toBe('draf')
        ->and($pulih->json('status_label'))->toBe('Draf')
        // Susunan soalnya tidak hilang: memulihkan bukan membuat kuis baru.
        ->and($pulih->json('jumlah_soal'))->toBe(1)
        ->and($kuis->refresh()->status)->toBe(StatusKuis::Draf);

    // Dan kuisnya benar-benar bisa dikerjakan lagi, bukan cuma berubah label.
    $this->putJson("/api/v1/kuis/{$kuis->id}", [
        'judul' => 'Ulangan Pecahan (diperbaiki)',
        'subject_id' => $this->mapel->id,
        'class_id' => $this->kelas->id,
        'durasi_menit' => 25,
    ])->assertOk()->assertJsonPath('judul', 'Ulangan Pecahan (diperbaiki)');
});

it('kuis yang dipulihkan masih harus diterbitkan ulang lewat jalur publikasi', function (): void {
    $kuis = pkKuisSiap($this, $this->guru);
    pkMasuk($this->guru);

    $this->postJson("/api/v1/kuis/{$kuis->id}/arsip")->assertOk();
    $this->postJson("/api/v1/kuis/{$kuis->id}/pulihkan")->assertOk();

    // Draf tidak tampil ke murid sampai diterbitkan lagi — dan penerbitan tetap
    // memeriksa kelengkapan, jadi aturan lama tidak dilangkahi oleh pemulihan.
    $this->postJson("/api/v1/kuis/{$kuis->id}/publikasi")
        ->assertOk()
        ->assertJsonPath('status', 'publikasi');
});

it('memulihkan kuis yang memang tidak diarsipkan tidak mengubah apa pun', function (): void {
    // Kuis draf biasa (bukan yang sudah berjalan): yang diuji di sini adalah
    // "pulihkan" yang dipanggil pada kuis yang tidak diarsipkan — tidak boleh
    // menaikkannya jadi terbit.
    $kuis = Kuis::factory()->untukSekolah($this->sekolah, $this->mapel, $this->kelas)
        ->milik($this->guru)->create(['judul' => 'Masih disusun']);
    pkMasuk($this->guru);

    $this->postJson("/api/v1/kuis/{$kuis->id}/pulihkan")
        ->assertOk()
        ->assertJsonPath('status', 'draf');

    expect($kuis->refresh()->status)->toBe(StatusKuis::Draf);
});

it('guru lain tidak bisa memulihkan kuis milik guru lain', function (): void {
    $kuis = pkKuisSiap($this, $this->guru);
    pkMasuk($this->guru);
    $this->postJson("/api/v1/kuis/{$kuis->id}/arsip")->assertOk();

    pkMasuk($this->guruLain);
    $this->postJson("/api/v1/kuis/{$kuis->id}/pulihkan")->assertStatus(403);

    expect($kuis->refresh()->status)->toBe(StatusKuis::Arsip);
});

it('kepala sekolah juga tidak bisa memulihkan kuis guru', function (): void {
    $kuis = pkKuisSiap($this, $this->guru);
    pkMasuk($this->guru);
    $this->postJson("/api/v1/kuis/{$kuis->id}/arsip")->assertOk();

    pkMasuk($this->admin);
    $this->postJson("/api/v1/kuis/{$kuis->id}/pulihkan")->assertStatus(403);

    expect($kuis->refresh()->status)->toBe(StatusKuis::Arsip);
});
