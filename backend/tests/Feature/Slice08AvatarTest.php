<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Avatar\Models\Avatar;
use App\Sections\Avatar\Services\PenyimpananAvatar;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '3A', 'tingkat' => 3]);
    $this->guru = User::factory()->guru()->create();

    // Satu pemilik avatar + tiga pelapor, semuanya sekelas.
    $this->pemilik = Murid::factory()->create(['school_id' => $this->sekolah->id, 'class_id' => $this->kelas->id]);
    $this->pelapor = collect(range(1, 3))->map(fn () => Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]));
});

/** Gambar PNG asli (bukan magic bytes palsu) — supaya encode ulang GD benar-benar diuji. */
function a08Png(int $lebar = 400, int $tinggi = 300): string
{
    $gambar = imagecreatetruecolor($lebar, $tinggi);
    $warna = imagecolorallocate($gambar, 12, 120, 200);
    imagefilledrectangle($gambar, 0, 0, $lebar, $tinggi, $warna);

    ob_start();
    imagepng($gambar);
    $isi = (string) ob_get_clean();
    imagedestroy($gambar);

    return $isi;
}

/** Gambar JPEG asli. */
function a08Jpeg(int $lebar = 120, int $tinggi = 90): string
{
    $gambar = imagecreatetruecolor($lebar, $tinggi);
    $warna = imagecolorallocate($gambar, 200, 80, 40);
    imagefilledrectangle($gambar, 0, 0, $lebar, $tinggi, $warna);

    ob_start();
    imagejpeg($gambar, null, 90);
    $isi = (string) ob_get_clean();
    imagedestroy($gambar);

    return $isi;
}

/** Unggah avatar lewat API sebagai satu murid. */
function a08Unggah(object $ctx, Murid $murid, string $isi, string $nama = 'wajah.png'): int
{
    auth()->forgetGuards();
    Sanctum::actingAs($murid->user);

    return (int) test()->postJson('/api/v1/avatar', [
        'nama' => $nama,
        'isi_base64' => base64_encode($isi),
    ])->assertCreated()->json('id');
}

function a08Lapor(object $ctx, Murid $pelapor, int $avatarId, string $alasan = 'tidak_pantas'): array
{
    auth()->forgetGuards();
    Sanctum::actingAs($pelapor->user);

    $respons = test()->postJson("/api/v1/avatar/{$avatarId}/lapor", ['alasan' => $alasan])->assertCreated();

    return [
        'disembunyikan' => (bool) $respons->json('disembunyikan'),
        'jumlah' => (int) $respons->json('jumlah_laporan'),
    ];
}

it('menerima PNG lalu mengencode ulang ke JPEG berukuran tetap dengan nama acak', function (): void {
    auth()->forgetGuards();
    Sanctum::actingAs($this->pemilik->user);

    $respons = $this->postJson('/api/v1/avatar', [
        'nama' => 'wajah.png',
        'isi_base64' => base64_encode(a08Png(400, 300)),
    ])->assertCreated();

    expect($respons->json('status'))->toBe('aktif')
        ->and($respons->json('mime'))->toBe('image/jpeg')
        ->and($respons->json('lebar'))->toBe(256)
        ->and($respons->json('tinggi'))->toBe(256)
        ->and($respons->json('milik_saya'))->toBeTrue()
        ->and($respons->json('url'))->toBeString();

    $avatar = Avatar::query()->findOrFail((int) $respons->json('id'));

    // Nama berkas acak: nama kiriman klien tidak pernah dipakai.
    expect(basename((string) $avatar->path))->toBe($avatar->kode.'.jpg')
        ->and((string) $avatar->path)->not->toContain('wajah');

    // Isi berkas benar-benar gambar hasil encode ulang server, bukan kiriman apa adanya.
    $tersimpan = Storage::disk(PenyimpananAvatar::DISK)->get((string) $avatar->path);
    $gambar = imagecreatefromstring((string) $tersimpan);

    expect($gambar)->not->toBeFalse()
        ->and(imagesx($gambar))->toBe(256)
        ->and(imagesy($gambar))->toBe(256)
        ->and($avatar->hash)->toBe(hash('sha256', (string) $tersimpan));

    imagedestroy($gambar);
});

it('menerima JPEG dan menolak SVG walau namanya .png', function (): void {
    $id = a08Unggah($this, $this->pemilik, a08Jpeg(300, 300), 'foto.jpg');

    expect(Avatar::query()->findOrFail($id)->status->value)->toBe('aktif');

    auth()->forgetGuards();
    Sanctum::actingAs($this->pemilik->user);

    $svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';

    $this->postJson('/api/v1/avatar', [
        'nama' => 'tampak.png',
        'isi_base64' => base64_encode($svg),
    ])->assertStatus(422)->assertJsonValidationErrors(['avatar']);

    // Berkas tidak pernah tersimpan, jadi tidak ada berkas SVG di disk privat.
    expect(Avatar::query()->where('student_id', $this->pemilik->id)->count())->toBe(1);
});

it('menolak gambar melebihi batas ukuran', function (): void {
    config(['avatar.ukuran_maks' => 200]);

    auth()->forgetGuards();
    Sanctum::actingAs($this->pemilik->user);

    $this->postJson('/api/v1/avatar', [
        'nama' => 'besar.png',
        'isi_base64' => base64_encode(a08Png(400, 300)),
    ])->assertStatus(422)->assertJsonValidationErrors(['avatar']);

    // Batas normal: gambar yang sama diterima.
    config(['avatar.ukuran_maks' => 2 * 1024 * 1024]);

    a08Unggah($this, $this->pemilik, a08Png(400, 300));
});

it('menghitung laporan unik saja lalu menyembunyikan avatar dari murid lain', function (): void {
    $avatarId = a08Unggah($this, $this->pemilik, a08Png());

    // Dua pelapor berbeda: belum mencapai ambang 3.
    $satu = a08Lapor($this, $this->pelapor[0], $avatarId, 'tidak_pantas');
    $dua = a08Lapor($this, $this->pelapor[1], $avatarId, 'bullying');

    expect($satu['disembunyikan'])->toBeFalse()
        ->and($dua['disembunyikan'])->toBeFalse()
        ->and($dua['jumlah'])->toBe(2);

    // Laporan berulang dari murid yang sama: tidak menambah hitungan.
    $ulang = a08Lapor($this, $this->pelapor[0], $avatarId, 'spam');

    expect($ulang['jumlah'])->toBe(2)
        ->and($ulang['disembunyikan'])->toBeFalse();

    // Pelapor ketiga: ambang tercapai.
    $tiga = a08Lapor($this, $this->pelapor[2], $avatarId);

    expect($tiga['disembunyikan'])->toBeTrue()
        ->and($tiga['jumlah'])->toBe(3);

    $avatar = Avatar::query()->findOrFail($avatarId);

    expect($avatar->status->value)->toBe('disembunyikan')
        ->and($avatar->disembunyikan_at)->not->toBeNull()
        ->and($avatar->jumlah_laporan)->toBe(3);

    // Pemilik tetap melihat avatarnya (termasuk URL gambarnya).
    auth()->forgetGuards();
    Sanctum::actingAs($this->pemilik->user);

    $saya = $this->getJson('/api/v1/avatar/saya')->assertOk();

    expect($saya->json('bawaan'))->toBeFalse()
        ->and($saya->json('avatar.status'))->toBe('disembunyikan')
        ->and($saya->json('avatar.milik_saya'))->toBeTrue()
        ->and($saya->json('avatar.url'))->toBeString();

    // Murid lain tidak melihatnya lagi di daftar kelas.
    auth()->forgetGuards();
    Sanctum::actingAs($this->pelapor[1]->user);

    $daftar = $this->getJson('/api/v1/avatar')->assertOk();

    expect(collect($daftar->json('avatar'))->pluck('id')->all())->not->toContain($avatarId);

    // Guru melihatnya di antrean moderasi beserta laporannya.
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $antrean = $this->getJson('/api/v1/avatar/moderasi')->assertOk();

    expect($antrean->json('0.id'))->toBe($avatarId)
        ->and($antrean->json('0.nama_murid'))->toBe($this->pemilik->user->name)
        ->and($antrean->json('0.jumlah_laporan'))->toBe(3)
        ->and($antrean->json('0.laporan'))->toHaveCount(3)
        ->and($antrean->json('0.laporan.0.alasan_label'))->toBeString();
});

it('tidak mengizinkan murid melaporkan avatarnya sendiri', function (): void {
    $avatarId = a08Unggah($this, $this->pemilik, a08Png());

    auth()->forgetGuards();
    Sanctum::actingAs($this->pemilik->user);

    $this->postJson("/api/v1/avatar/{$avatarId}/lapor", ['alasan' => 'lainnya'])
        ->assertStatus(403);

    expect(Avatar::query()->findOrFail($avatarId)->jumlah_laporan)->toBe(0);
});

it('mencatat pulihkan di audit dan mengembalikan avatar ke daftar teman', function (): void {
    $avatarId = a08Unggah($this, $this->pemilik, a08Png());

    foreach ($this->pelapor as $pelapor) {
        a08Lapor($this, $pelapor, $avatarId);
    }

    expect(Avatar::query()->findOrFail($avatarId)->status->value)->toBe('disembunyikan');

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $respons = $this->postJson("/api/v1/avatar/{$avatarId}/pulihkan", [
        'catatan' => 'Gambar hanya foto kelas, tidak melanggar.',
    ])->assertOk();

    expect($respons->json('status'))->toBe('aktif')
        ->and($respons->json('status_label'))->toBe('Aktif')
        ->and($respons->json('jumlah_laporan'))->toBe(0)
        ->and($respons->json('disembunyikan_at'))->toBeNull();

    // Keputusan guru tercatat di audit (activity_log), lengkap dengan alasannya.
    $catatan = DB::table('activity_log')
        ->where('log_name', 'avatar')
        ->where('event', 'pulihkan')
        ->orderByDesc('id')
        ->first();

    expect($catatan)->not->toBeNull();

    $properti = json_decode((string) $catatan->properties, true);

    expect((int) $catatan->causer_id)->toBe((int) $this->guru->id)
        ->and((int) $catatan->subject_id)->toBe($avatarId)
        ->and($properti['catatan'])->toContain('tidak melanggar');

    // Laporan lama ditandai tidak valid, jadi antrean kembali kosong.
    expect($this->getJson('/api/v1/avatar/moderasi')->assertOk()->json())->toBe([]);

    // Pelapor kembali melihat avatar pemilik di daftar kelas.
    auth()->forgetGuards();
    Sanctum::actingAs($this->pelapor[0]->user);

    $daftar = $this->getJson('/api/v1/avatar')->assertOk();

    expect(collect($daftar->json('avatar'))->pluck('id')->all())->toContain($avatarId);
});

it('menghapus avatar lewat moderasi, membuang berkasnya, dan mencatat audit', function (): void {
    $avatarId = a08Unggah($this, $this->pemilik, a08Png());

    $avatar = Avatar::query()->findOrFail($avatarId);
    $path = (string) $avatar->path;

    expect(Storage::disk(PenyimpananAvatar::DISK)->exists($path))->toBeTrue();

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->postJson("/api/v1/avatar/{$avatarId}/hapus", ['catatan' => 'Bukan foto anak.'])
        ->assertOk();

    $avatar->refresh();

    expect($avatar->status->value)->toBe('dihapus')
        ->and(Storage::disk(PenyimpananAvatar::DISK)->exists($path))->toBeFalse();

    $catatan = DB::table('activity_log')
        ->where('log_name', 'avatar')
        ->where('event', 'hapus')
        ->where('subject_id', $avatarId)
        ->first();

    expect($catatan)->not->toBeNull()
        ->and((int) $catatan->causer_id)->toBe((int) $this->guru->id);

    // Pemilik kembali ke avatar bawaan, dan URL bertanda tangannya sudah mati.
    auth()->forgetGuards();
    Sanctum::actingAs($this->pemilik->user);

    expect($this->getJson('/api/v1/avatar/saya')->assertOk()->json('bawaan'))->toBeTrue();

    $url = URL::temporarySignedRoute('avatar.berkas', now()->addMinutes(10), ['kode' => $avatar->kode], false);
    $this->get(rtrim((string) config('app.url'), '/').$url)->assertStatus(404);
});

it('menjaga gambar yang menunggu tinjauan agar tidak bisa dihapus pemiliknya', function (): void {
    $avatarId = a08Unggah($this, $this->pemilik, a08Png());

    foreach ($this->pelapor as $pelapor) {
        a08Lapor($this, $pelapor, $avatarId);
    }

    auth()->forgetGuards();
    Sanctum::actingAs($this->pemilik->user);

    // Menghapus sendiri akan menghapus barang bukti: ditolak.
    $this->deleteJson('/api/v1/avatar')->assertStatus(422)->assertJsonValidationErrors(['avatar']);

    expect(Avatar::query()->findOrFail($avatarId)->status->value)->toBe('disembunyikan');

    // Murid tetap boleh memasang gambar baru; gambar lama tetap menunggu tinjauan.
    $baru = a08Unggah($this, $this->pemilik, a08Jpeg());

    expect($baru)->not->toBe($avatarId)
        ->and(Avatar::query()->findOrFail($avatarId)->status->value)->toBe('disembunyikan')
        ->and(Avatar::query()->findOrFail($baru)->status->value)->toBe('aktif')
        ->and(Avatar::query()->findOrFail($baru)->jumlah_laporan)->toBe(0);
});

it('menyajikan gambar lewat URL bertanda tangan berumur pendek', function (): void {
    $avatarId = a08Unggah($this, $this->pemilik, a08Png());
    $avatar = Avatar::query()->findOrFail($avatarId);

    // Tanpa sesi sama sekali: URL bertanda tangan satu-satunya jalan.
    auth()->forgetGuards();

    $url = app(PenyimpananAvatar::class)->urlBertandaTangan($avatar);
    $respons = $this->get($url)->assertOk();

    expect($respons->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($respons->headers->get('Content-Type'))->toBe('image/jpeg')
        ->and((string) $respons->headers->get('Content-Disposition'))->toContain('inline');

    // Tanda tangan yang sudah kedaluwarsa ditolak sebelum berkasnya disentuh.
    $kedaluwarsa = URL::temporarySignedRoute('avatar.berkas', now()->subMinute(), ['kode' => $avatar->kode], false);

    $this->get(rtrim((string) config('app.url'), '/').$kedaluwarsa)->assertStatus(403);

    // Tanpa tanda tangan sama sekali: juga ditolak.
    $this->get('/api/v1/berkas/avatar/'.$avatar->kode)->assertStatus(403);
});

it('hanya murid yang boleh mengunggah avatar', function (): void {
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->postJson('/api/v1/avatar', [
        'nama' => 'guru.png',
        'isi_base64' => base64_encode(a08Png()),
    ])->assertStatus(403);

    expect(Avatar::query()->count())->toBe(0);
});
