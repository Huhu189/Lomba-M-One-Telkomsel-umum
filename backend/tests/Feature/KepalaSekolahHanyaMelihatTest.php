<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Attempt\Enums\JenisAttempt;
use App\Sections\Attempt\Enums\StatusAttempt;
use App\Sections\Avatar\Models\Avatar;
use App\Sections\Cheat\Models\KejadianKecurangan;
use App\Sections\Material\Models\Materi;
use App\Sections\Question\Models\Soal;
use App\Sections\Question\Models\Tag;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

/*
|--------------------------------------------------------------------------
| Kepala sekolah hanya melihat (14 Oktober 2026)
|--------------------------------------------------------------------------
|
| Peran `admin` (akun "Admin Sekolah", sebutan di sekolah: kepala sekolah)
| memantau keadaan sekolah dan merapikan akun guru/murid, tetapi TIDAK mengubah
| data akademik: kuis, soal, materi, kelas, mapel, tag, nilai, dan catatan
| kecurangan tetap milik guru yang mengerjakan ulangan itu.
|
| Alasannya bukan soal kepercayaan, melainkan soal jejak: kalau dua pihak bisa
| mengubah kunci soal atau nilai anak yang sama, tidak ada lagi cara mengetahui
| siapa yang mengubahnya — dan nilai rapor kehilangan dasar.
|
| Dua hal yang harus tetap dijaga karena itu:
| 1. **Membaca tetap boleh** — kalau kepala sekolah buta, ia tidak bisa mengawasi.
| 2. **Guru tetap boleh menulis** — kalau tidak, tidak ada yang bisa menyusun
|    ulangan sama sekali. Karena itu setiap pemeriksaan 403 di sini diimbangi
|    kontrol positif yang membuktikan jalurnya memang hidup.
|
| Pengecualian yang disengaja: panel kelola akun (`/v1/admin/*`) tetap milik
| kepala sekolah — diujikan di `AdminSekolahTest`.
|
*/

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);

    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '4A', 'tingkat' => 4]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'IPA', 'kode' => 'IPA4']);

    $this->guru = User::factory()->guru()->create();
    $this->kepala = User::query()->where('email', 'admin@sekolah.test')->firstOrFail();

    $this->kuis = Kuis::factory()->untukSekolah($this->sekolah, $this->mapel, $this->kelas)->create([
        'judul' => 'Kuis guru',
        'dibuat_oleh' => $this->guru->id,
    ]);
    $this->soal = Soal::factory()->untukSekolah($this->sekolah, $this->mapel)->create([
        'dibuat_oleh' => $this->guru->id,
    ]);
    $this->materi = Materi::factory()->untukSekolah($this->sekolah, $this->mapel, $this->kelas)->create([
        'judul' => 'Materi guru',
        'dibuat_oleh' => $this->guru->id,
    ]);
    $this->tag = Tag::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Aljabar']);
});

/** Masuk sebagai satu pengguna (guard dibersihkan supaya tidak lengket). */
function ksMasuk(User $user): void
{
    auth()->forgetGuards();
    Sanctum::actingAs($user);
}

/** Isi kelas/mapel/tag/murid yang sah — supaya 403 bukan berasal dari validasi. */
function ksIsiKelas(): array
{
    return ['nama' => 'Kelas 5C', 'tingkat' => 5];
}

function ksIsiMapel(): array
{
    return ['nama' => 'Matematika', 'kode' => 'MTK'];
}

function ksIsiTag(): array
{
    return ['nama' => 'Geometri'];
}

function ksIsiSoal(object $ctx): array
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

function ksIsiKuis(object $ctx): array
{
    return [
        'judul' => 'Kuis baru',
        'subject_id' => $ctx->mapel->id,
        'class_id' => $ctx->kelas->id,
        'durasi_menit' => 20,
    ];
}

function ksIsiMateri(object $ctx): array
{
    return [
        'judul' => 'Materi baru',
        'subject_id' => $ctx->mapel->id,
        'class_id' => $ctx->kelas->id,
    ];
}

it('kepala sekolah ditolak di seluruh jalur tulis data akademik', function (): void {
    $murid = Murid::factory()->untuk($this->sekolah, $this->kelas, User::factory()->muridAktif()->create())->create();

    ksMasuk($this->kepala);

    // Data induk.
    $this->postJson('/api/v1/kelas', ksIsiKelas())->assertStatus(403);
    $this->putJson("/api/v1/kelas/{$this->kelas->id}", ['nama' => 'Kelas 4B', 'tingkat' => 4])->assertStatus(403);
    $this->deleteJson("/api/v1/kelas/{$this->kelas->id}")->assertStatus(403);

    $this->postJson('/api/v1/mapel', ksIsiMapel())->assertStatus(403);
    $this->putJson("/api/v1/mapel/{$this->mapel->id}", ksIsiMapel())->assertStatus(403);
    $this->deleteJson("/api/v1/mapel/{$this->mapel->id}")->assertStatus(403);

    $this->postJson('/api/v1/murid', [
        'nama' => 'Murid Baru',
        'email' => 'murid.baru@sekolah.test',
        'class_id' => $this->kelas->id,
    ])->assertStatus(403);
    $this->putJson("/api/v1/murid/{$murid->id}", [
        'nama' => 'Murid Diubah',
        'email' => (string) $murid->user->email,
        'class_id' => $this->kelas->id,
    ])->assertStatus(403);
    $this->deleteJson("/api/v1/murid/{$murid->id}")->assertStatus(403);

    // Bank soal.
    $this->postJson('/api/v1/tag', ksIsiTag())->assertStatus(403);
    $this->putJson("/api/v1/tag/{$this->tag->id}", ksIsiTag())->assertStatus(403);
    $this->deleteJson("/api/v1/tag/{$this->tag->id}")->assertStatus(403);

    $this->postJson('/api/v1/soal', ksIsiSoal($this))->assertStatus(403);
    $this->putJson("/api/v1/soal/{$this->soal->id}", ksIsiSoal($this))->assertStatus(403);
    $this->deleteJson("/api/v1/soal/{$this->soal->id}")->assertStatus(403);

    // Kuis & materi.
    $this->postJson('/api/v1/kuis', ksIsiKuis($this))->assertStatus(403);
    $this->putJson("/api/v1/kuis/{$this->kuis->id}", ksIsiKuis($this))->assertStatus(403);
    $this->postJson("/api/v1/kuis/{$this->kuis->id}/publikasi")->assertStatus(403);
    $this->postJson("/api/v1/kuis/{$this->kuis->id}/arsip")->assertStatus(403);
    $this->deleteJson("/api/v1/kuis/{$this->kuis->id}")->assertStatus(403);

    $this->postJson('/api/v1/materi', ksIsiMateri($this))->assertStatus(403);
    $this->putJson("/api/v1/materi/{$this->materi->id}", ksIsiMateri($this))->assertStatus(403);
    $this->postJson("/api/v1/materi/{$this->materi->id}/publikasi")->assertStatus(403);
    $this->postJson("/api/v1/materi/{$this->materi->id}/arsip")->assertStatus(403);
    $this->deleteJson("/api/v1/materi/{$this->materi->id}")->assertStatus(403);

    // Identitas sekolah & aturan ulangan.
    $this->putJson('/api/v1/sekolah', ['nama' => 'SD Negeri Diubah'])->assertStatus(403);
    $this->putJson('/api/v1/pengaturan', ['lingkup' => 'sekolah', 'kunci' => 'retry', 'nilai' => false])
        ->assertStatus(403);

    // Nilai & tinjauan bukti kecurangan.
    $this->getJson("/api/v1/kuis/{$this->kuis->id}/koreksi")->assertStatus(403);

    // Tidak ada satu pun yang benar-benar berubah.
    expect($this->kelas->refresh()->nama)->toBe('4A')
        ->and($this->mapel->refresh()->nama)->toBe('IPA')
        ->and($this->kuis->refresh()->judul)->toBe('Kuis guru')
        ->and($this->materi->refresh()->judul)->toBe('Materi guru')
        ->and((int) $this->soal->refresh()->skor)->toBe((int) $this->soal->skor)
        ->and($this->tag->refresh()->nama)->toBe('Aljabar')
        ->and(Kelas::query()->count())->toBe(1)
        ->and(Tag::query()->count())->toBe(1);
});

it('kepala sekolah tetap boleh membaca seluruh sekolah', function (): void {
    ksMasuk($this->kepala);

    $this->getJson('/api/v1/kelas')->assertOk();
    $this->getJson('/api/v1/mapel')->assertOk();
    $this->getJson('/api/v1/murid')->assertOk();
    $this->getJson('/api/v1/tag')->assertOk();
    // Bank soal memuat kunci jawaban: kepala sekolah perlu meninjau mutunya.
    $this->getJson('/api/v1/soal')->assertOk();
    $this->getJson("/api/v1/soal/{$this->soal->id}")->assertOk();

    $this->getJson("/api/v1/kuis/{$this->kuis->id}")->assertOk();
    $this->getJson("/api/v1/kuis/{$this->kuis->id}/laporan")->assertOk();
    $this->getJson("/api/v1/kuis/{$this->kuis->id}/ekspor-nilai")->assertOk();
    $this->getJson("/api/v1/kuis/{$this->kuis->id}/kejadian")->assertOk();
    $this->getJson("/api/v1/kuis/{$this->kuis->id}/monitor")->assertOk();

    $this->getJson("/api/v1/materi/{$this->materi->id}")->assertOk();
    $this->getJson("/api/v1/materi/{$this->materi->id}/laporan")->assertOk();

    $this->getJson('/api/v1/pengaturan')->assertOk();

    // Panel yang memang miliknya tetap hidup.
    $this->getJson('/api/v1/admin/monitor')->assertOk();
    $this->getJson('/api/v1/admin/akun')->assertOk();
});

it('guru tetap boleh menulis — 403 di atas bukan karena jalurnya mati', function (): void {
    ksMasuk($this->guru);

    $this->postJson('/api/v1/kelas', ksIsiKelas())->assertCreated();
    $this->postJson('/api/v1/mapel', ksIsiMapel())->assertCreated();
    $this->postJson('/api/v1/tag', ksIsiTag())->assertCreated();
    $this->postJson('/api/v1/soal', ksIsiSoal($this))->assertCreated();

    $this->putJson("/api/v1/kuis/{$this->kuis->id}", ksIsiKuis($this))->assertOk();
    $this->putJson("/api/v1/materi/{$this->materi->id}", ksIsiMateri($this))->assertOk();

    // Setelan per kuis tetap milik pemilik kuisnya.
    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis', 'lingkup_id' => $this->kuis->id, 'kunci' => 'mode_tim', 'nilai' => true,
    ])->assertOk();

    expect(Kelas::query()->where('nama', 'Kelas 5C')->exists())->toBeTrue()
        ->and(Tag::query()->where('nama', 'Geometri')->exists())->toBeTrue();
});

it('kemampuan tulis kepala sekolah ditolak juga di tingkat policy', function (): void {
    // Jalur HTTP di atas hanya membuktikan endpoint yang diuji. Pemeriksaan
    // berikut mengunci policy-nya langsung, supaya endpoint baru yang memakai
    // policy yang sama tidak diam-diam membuka lagi pintu tulis.
    $kepala = $this->kepala;

    $avatarMurid = Avatar::factory()->untukMurid(
        Murid::factory()->untuk($this->sekolah, $this->kelas, User::factory()->muridAktif()->create())->create(),
    )->create();

    foreach ([
        'buat kelas' => fn () => Gate::forUser($kepala)->allows('create', Kelas::class),
        'ubah kelas' => fn () => Gate::forUser($kepala)->allows('update', $this->kelas),
        'hapus kelas' => fn () => Gate::forUser($kepala)->allows('delete', $this->kelas),
        'buat mapel' => fn () => Gate::forUser($kepala)->allows('create', Mapel::class),
        'buat murid' => fn () => Gate::forUser($kepala)->allows('create', Murid::class),
        'buat tag' => fn () => Gate::forUser($kepala)->allows('create', Tag::class),
        'ubah tag' => fn () => Gate::forUser($kepala)->allows('update', $this->tag),
        'buat soal' => fn () => Gate::forUser($kepala)->allows('create', Soal::class),
        'ubah soal' => fn () => Gate::forUser($kepala)->allows('update', $this->soal),
        'buat kuis' => fn () => Gate::forUser($kepala)->allows('create', Kuis::class),
        'ubah kuis' => fn () => Gate::forUser($kepala)->allows('update', $this->kuis),
        'terbitkan kuis' => fn () => Gate::forUser($kepala)->allows('publikasi', $this->kuis),
        'koreksi kuis' => fn () => Gate::forUser($kepala)->allows('koreksi', $this->kuis),
        'buat materi' => fn () => Gate::forUser($kepala)->allows('create', Materi::class),
        'ubah materi' => fn () => Gate::forUser($kepala)->allows('update', $this->materi),
        'unggah berkas materi' => fn () => Gate::forUser($kepala)->allows('berkas', $this->materi),
        'ubah sekolah' => fn () => Gate::forUser($kepala)->allows('update', Sekolah::class),
        'moderasi avatar' => fn () => Gate::forUser($kepala)->allows('moderasi', Avatar::class),
        'hapus avatar murid' => fn () => Gate::forUser($kepala)->allows('delete', $avatarMurid),
        // Membaca tetap terbuka.
        'baca bank soal' => fn () => ! Gate::forUser($kepala)->allows('viewAny', Soal::class),
        'baca laporan kuis' => fn () => ! Gate::forUser($kepala)->allows('laporan', $this->kuis),
        'baca laporan materi' => fn () => ! Gate::forUser($kepala)->allows('laporan', $this->materi),
        'baca antrean kecurangan' => fn () => ! Gate::forUser($kepala)->allows('lihatSemua', KejadianKecurangan::class),
    ] as $nama => $cek) {
        expect($cek())->toBeFalse("kepala sekolah seharusnya ditolak: {$nama}");
    }
});

it('kepala sekolah tidak bisa meninjau catatan kecurangan (hanya membacanya)', function (): void {
    $murid = Murid::factory()->untuk($this->sekolah, $this->kelas, User::factory()->muridAktif()->create())->create();

    $attemptId = (int) DB::table('attempts')->insertGetId([
        'school_id' => $this->sekolah->id,
        'quiz_id' => $this->kuis->id,
        'student_id' => $murid->id,
        'jenis' => JenisAttempt::Ulangan->value,
        'attempt_no' => 1,
        'status' => StatusAttempt::Berjalan->value,
        'aktif' => true,
        'seed' => 1,
        'mulai_at' => now()->subMinutes(5),
        'deadline_at' => now()->addMinutes(25),
        'jumlah_soal' => 1,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $kejadianId = (int) DB::table('cheat_events')->insertGetId([
        'school_id' => $this->sekolah->id,
        'quiz_id' => $this->kuis->id,
        'attempt_id' => $attemptId,
        'student_id' => $murid->id,
        'kategori' => 'tab_switch',
        'skor_risiko' => 3,
        'dari_klien' => true,
        'review_status' => 'menunggu',
        'sidik' => str_repeat('a', 64),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    // Membaca: boleh.
    ksMasuk($this->kepala);
    $this->getJson("/api/v1/kuis/{$this->kuis->id}/kejadian")->assertOk();

    // Meninjau: tidak — keputusan atas bukti bukan miliknya.
    $this->putJson("/api/v1/kejadian/{$kejadianId}", ['status' => 'valid'])->assertStatus(403);

    expect(DB::table('cheat_events')->where('id', $kejadianId)->value('review_status'))->toBe('menunggu');

    // Pemilik kuisnya boleh meninjau.
    ksMasuk($this->guru);
    $this->putJson("/api/v1/kejadian/{$kejadianId}", ['status' => 'valid'])->assertOk();

    expect(DB::table('cheat_events')->where('id', $kejadianId)->value('review_status'))->toBe('valid');
});
