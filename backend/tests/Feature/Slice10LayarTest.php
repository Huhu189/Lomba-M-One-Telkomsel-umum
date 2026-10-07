<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Presence\Models\LayarKuis;
use App\Sections\Presence\Models\TiketSse;
use App\Sections\Presence\Services\PenyiarRealtime;
use App\Sections\Presence\Services\TokenSseService;
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
use Laravel\Sanctum\Sanctum;
use Mockery;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6A', 'tingkat' => 6]);
    $this->kelasLain = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6B', 'tingkat' => 6]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Matematika', 'kode' => 'MTK6']);
    $this->guru = User::factory()->guru()->create();

    $this->murid = Murid::factory()->create(['school_id' => $this->sekolah->id, 'class_id' => $this->kelas->id]);
    $this->muridLain = Murid::factory()->create(['school_id' => $this->sekolah->id, 'class_id' => $this->kelasLain->id]);

    l10Penyiar($this);
});

/**
 * Penyiar realtime palsu: `kanalKuis()` tetap memakai kode asli (supaya kanal
 * yang diuji benar-benar kanal aplikasi), sedangkan `siarkan()`/`armTicket()`
 * direkam atau dinetralkan — test tidak boleh butuh Redis, dan tidak boleh
 * bergantung pada Redis yang kebetulan hidup di mesin pengembang.
 */
function l10Penyiar(object $ctx): void
{
    $ctx->siaran = [];

    $palsu = Mockery::mock(PenyiarRealtime::class)->makePartial();

    $palsu->shouldReceive('armTicket')->andReturn(true);

    $palsu->shouldReceive('siarkan')->andReturnUsing(function (string $kanal, array $payload) use ($ctx): bool {
        $ctx->siaran[] = ['kanal' => $kanal, 'payload' => $payload];

        return true;
    });

    app()->instance(PenyiarRealtime::class, $palsu);
}

function l10Soal(object $ctx, string $teks = 'Hasil dari 7 x 8?'): Soal
{
    return Soal::factory()->untukSekolah($ctx->sekolah, $ctx->mapel)->create([
        'tipe' => TipeSoal::PilihanGanda,
        'konten' => [
            'teks' => $teks,
            'opsi' => [['id' => 'a', 'teks' => '56'], ['id' => 'b', 'teks' => '54']],
        ],
        'kunci' => ['jawaban' => 'a'],
        'pembahasan' => 'Perkalian dasar.',
        'skor' => 10,
    ]);
}

/**
 * @param  array<int, Soal>  $soal
 */
function l10Kuis(object $ctx, array $soal): Kuis
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

function l10Guru(object $ctx): void
{
    auth()->forgetGuards();
    Sanctum::actingAs($ctx->guru);
}

/**
 * Masuk sebagai murid. Relasi `murid` dimuat eksplisit karena policy membaca
 * kelas murid, sedangkan pemuatan malas sengaja dimatikan di test.
 */
function l10Murid(Murid $murid): void
{
    auth()->forgetGuards();
    Sanctum::actingAs($murid->user->loadMissing('murid'));
}

/** Nyalakan/matikan satu kunci pengaturan pada lingkup kuis. */
function l10Saklar(object $ctx, Kuis $kuis, KunciPengaturan $kunci, bool $nilai = true): void
{
    l10Guru($ctx);

    test()->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis',
        'lingkup_id' => $kuis->id,
        'kunci' => $kunci->value,
        'nilai' => $nilai,
    ])->assertOk();
}

it('guru menyorot soal, murid kelas itu mengikuti tanpa kunci jawaban ikut terkirim', function (): void {
    $soal = l10Soal($this);
    $kuis = l10Kuis($this, [l10Soal($this, 'Soal pertama'), $soal]);

    l10Guru($this);

    $simpan = $this->putJson("/api/v1/kuis/{$kuis->id}/layar", [
        'mode' => 'soal',
        'judul' => '  Bahas nomor 2  ',
        'question_id' => $soal->id,
    ])->assertOk();

    expect($simpan->json('mode'))->toBe('soal')
        ->and($simpan->json('versi'))->toBe(1)
        ->and($simpan->json('soal.id'))->toBe($soal->id)
        ->and($simpan->json('soal.nomor'))->toBe(2)
        ->and($simpan->json('judul'))->toBe('Bahas nomor 2')
        ->and($simpan->json('daftar_soal'))->toHaveCount(2)
        ->and($simpan->json('daftar_mode'))->toHaveCount(4);

    // Kunci jawaban & pembahasan tidak pernah ikut, bahkan untuk guru: layar
    // kelas hanya menampilkan, dan guru sudah bisa melihatnya di halaman kuis.
    expect($simpan->json('soal'))->not->toHaveKey('kunci')
        ->and($simpan->json('soal'))->not->toHaveKey('pembahasan');

    l10Murid($this->murid);

    $muridLihat = $this->getJson("/api/v1/kuis/{$kuis->id}/layar")->assertOk();

    expect($muridLihat->json('aktif'))->toBeTrue()
        ->and($muridLihat->json('mode'))->toBe('soal')
        ->and($muridLihat->json('soal.konten.teks'))->toBe('Hasil dari 7 x 8?')
        ->and($muridLihat->json('soal'))->not->toHaveKey('kunci')
        // Bahan pengendali tidak dikirim ke perangkat murid.
        ->and($muridLihat->json())->not->toHaveKey('daftar_soal')
        ->and($muridLihat->json())->not->toHaveKey('maks_isi');

    // Mengosongkan layar mengembalikan perangkat murid ke tampilan ulangan.
    l10Guru($this);

    $kosong = $this->putJson("/api/v1/kuis/{$kuis->id}/layar", ['mode' => 'kosong'])->assertOk();

    expect($kosong->json('mode'))->toBe('kosong')
        ->and($kosong->json('soal'))->toBeNull()
        ->and($kosong->json('versi'))->toBe(2);

    l10Murid($this->murid);

    expect($this->getJson("/api/v1/kuis/{$kuis->id}/layar")->json('mode'))->toBe('kosong');
});

it('murid kelas lain tidak bisa mengikuti maupun mengubah layar kuis ini', function (): void {
    $kuis = l10Kuis($this, [l10Soal($this)]);

    l10Murid($this->muridLain);

    $this->getJson("/api/v1/kuis/{$kuis->id}/layar")->assertStatus(403);
    $this->postJson("/api/v1/kuis/{$kuis->id}/sse-tiket-murid")->assertStatus(403);

    // Bahkan dengan membawa soal yang benar, murid tidak boleh mengubah layar.
    $this->putJson("/api/v1/kuis/{$kuis->id}/layar", ['mode' => 'kosong'])->assertStatus(403);

    expect(LayarKuis::query()->count())->toBe(0);
});

it('saklar layar_guru yang dimatikan menutup jalur guru dan menyembunyikan layar dari murid', function (): void {
    $kuis = l10Kuis($this, [l10Soal($this)]);

    l10Guru($this);

    $this->putJson("/api/v1/kuis/{$kuis->id}/layar", [
        'mode' => 'pengumuman',
        'judul' => 'Istirahat 5 menit',
    ])->assertOk();

    l10Saklar($this, $kuis, KunciPengaturan::LayarGuru, false);

    l10Guru($this);

    $this->putJson("/api/v1/kuis/{$kuis->id}/layar", ['mode' => 'kosong'])->assertStatus(403);

    l10Murid($this->murid);

    $lihat = $this->getJson("/api/v1/kuis/{$kuis->id}/layar")->assertOk();

    // Keadaannya masih tersimpan (tidak hilang), tetapi murid diberi tahu
    // bahwa layar guru tidak aktif sehingga tidak ada yang ditampilkan.
    expect($lihat->json('aktif'))->toBeFalse()
        ->and($lihat->json('mode'))->toBe('pengumuman');

    expect(LayarKuis::query()->firstOrFail()->mode)->toBe('pengumuman');
});

it('menolak mode tak dikenal dan sorotan soal yang bukan bagian kuis ini', function (): void {
    $kuis = l10Kuis($this, [l10Soal($this)]);
    $soalLain = l10Soal($this, 'Soal kuis lain');

    l10Guru($this);

    $this->putJson("/api/v1/kuis/{$kuis->id}/layar", ['mode' => 'tayangan_langsung'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['mode']);

    $this->putJson("/api/v1/kuis/{$kuis->id}/layar", ['mode' => 'soal'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['question_id']);

    // Soal yang ada di bank soal tetapi tidak dipakai kuis ini tidak boleh disorot.
    $this->putJson("/api/v1/kuis/{$kuis->id}/layar", ['mode' => 'soal', 'question_id' => $soalLain->id])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['question_id']);

    // Pengumuman tanpa bahan tulisan tidak berarti apa-apa bagi murid.
    $this->putJson("/api/v1/kuis/{$kuis->id}/layar", ['mode' => 'pengumuman', 'judul' => '   '])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['judul']);

    expect(LayarKuis::query()->count())->toBe(0)
        ->and($this->siaran)->toBe([]);
});

it('setiap perubahan menaikkan versi dan disiarkan ke kanal kuis', function (): void {
    $kuis = l10Kuis($this, [l10Soal($this)]);

    l10Guru($this);

    $this->putJson("/api/v1/kuis/{$kuis->id}/layar", [
        'mode' => 'pengumuman',
        'judul' => 'Waktu tersisa 10 menit',
        'isi' => "Kerjakan dengan teliti.\nJangan lupa periksa ulang.",
    ])->assertOk();

    // Baris baru dipertahankan: pengumuman panjang sering dipisah per baris
    // supaya terbaca dari belakang kelas.
    expect(LayarKuis::query()->where('quiz_id', $kuis->id)->firstOrFail()->isi)
        ->toBe("Kerjakan dengan teliti.\nJangan lupa periksa ulang.");

    $this->putJson("/api/v1/kuis/{$kuis->id}/layar", [
        'mode' => 'pengumuman',
        'judul' => 'Waktu tersisa 5 menit',
    ])->assertOk();

    expect($this->siaran)->toHaveCount(2);

    $pertama = $this->siaran[0];

    expect($pertama['kanal'])->toBe("ulangan:kuis:{$kuis->id}")
        ->and($pertama['payload']['jenis'])->toBe('layar')
        ->and($pertama['payload']['kuis_id'])->toBe((int) $kuis->id)
        ->and($pertama['payload']['versi'])->toBe(1)
        ->and($this->siaran[1]['payload']['versi'])->toBe(2);

    $baris = LayarKuis::query()->where('quiz_id', $kuis->id)->firstOrFail();

    expect($baris->versi)->toBe(2)
        ->and($baris->mode)->toBe('pengumuman')
        ->and($baris->judul)->toBe('Waktu tersisa 5 menit')
        // Payload adalah keadaan PENUH, bukan tambalan: `isi` yang tidak lagi
        // dikirim memang dikosongkan, bukan tertinggal dari perubahan lalu.
        ->and($baris->isi)->toBeNull()
        ->and($baris->diubah_oleh)->toBe($this->guru->id);
});

it('murid kelas itu meminta tiket SSE layar; guru memakai jalur Live Monitor', function (): void {
    $kuis = l10Kuis($this, [l10Soal($this)]);

    l10Murid($this->murid);

    $terbit = $this->postJson("/api/v1/kuis/{$kuis->id}/sse-tiket-murid")->assertCreated();

    $tiket = (string) $terbit->json('tiket');

    expect($tiket)->not->toBe('')
        ->and($terbit->json('ttl_detik'))->toBe(TokenSseService::TTL_DETIK);

    $layanan = app(TokenSseService::class);

    expect($layanan->pakai($tiket))->not->toBeNull()
        ->and($layanan->pakai($tiket))->toBeNull();

    $baris = TiketSse::query()->firstOrFail();

    expect($baris->token_hash)->toBe(hash('sha256', $tiket))
        ->and($baris->used_at)->not->toBeNull();

    // Jalur murid bukan jalur guru — dan sebaliknya guru tetap punya jalurnya sendiri.
    l10Guru($this);

    $this->postJson("/api/v1/kuis/{$kuis->id}/sse-tiket-murid")->assertStatus(403);
    $this->postJson("/api/v1/kuis/{$kuis->id}/sse-tiket")->assertCreated();
});
