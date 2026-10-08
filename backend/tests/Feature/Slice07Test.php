<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Cheat\Enums\KategoriKecurangan;
use App\Sections\Cheat\Enums\StatusTinjauan;
use App\Sections\Cheat\Models\KejadianKecurangan;
use App\Sections\Presence\Models\TiketSse;
use App\Sections\Presence\Services\PresenceService;
use App\Sections\Presence\Services\TokenSseService;
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
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use RuntimeException;

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
    $this->muridLain = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);
    Cache::flush();
});

/** Kuis berjalan berisi dua soal pilihan ganda, siap dikerjakan. */
function kuisBerjalan07(object $ctx): Kuis
{
    $kuis = Kuis::factory()->untukSekolah($ctx->sekolah, $ctx->mapel, $ctx->kelas)->berjalan()->create([
        'acak_soal' => false,
        'acak_opsi' => false,
    ]);

    foreach ([1, 2] as $nomor) {
        $soal = Soal::factory()->untukSekolah($ctx->sekolah, $ctx->mapel)->create([
            'tipe' => 'pilihan_ganda',
            'konten' => [
                'teks' => 'Soal nomor '.$nomor,
                'opsi' => [['id' => 'A', 'teks' => 'Salah'], ['id' => 'B', 'teks' => 'Benar']],
            ],
            'kunci' => ['jawaban' => 'B'],
            'skor' => 4,
        ]);

        $kuis->soal()->attach($soal->id, ['urutan' => $nomor]);
    }

    return $kuis->refresh();
}

/** Mulai attempt sebagai murid (sesi cookie Sanctum). */
function mulaiAttempt07(Murid $murid, Kuis $kuis): Attempt
{
    auth()->forgetGuards();
    Sanctum::actingAs($murid->user);

    $respons = test()->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated();

    return Attempt::query()->findOrFail((int) $respons->json('id'));
}

it('murid mencatat kejadian berkelompok dan dedupe membuat kiriman ulang tidak menggandakan', function (): void {
    $kuis = kuisBerjalan07($this);
    $attempt = mulaiAttempt07($this->murid, $kuis);

    $kiriman = [
        'kejadian' => [
            ['kategori' => 'paste_attempt', 'client_at' => '2026-10-06T10:00:00+00:00', 'rincian' => ['sumber' => 'keyboard']],
            ['kategori' => 'tab_switch', 'client_at' => '2026-10-06T10:00:05+00:00'],
        ],
    ];

    $this->postJson("/api/v1/attempt/{$attempt->id}/kejadian", $kiriman)
        ->assertCreated()
        ->assertJsonPath('tersimpan', 2);

    // Kiriman yang sama terulang (retry jaringan) tidak menambah catatan.
    $this->postJson("/api/v1/attempt/{$attempt->id}/kejadian", $kiriman)
        ->assertCreated()
        ->assertJsonPath('tersimpan', 0);

    expect(KejadianKecurangan::query()->count())->toBe(2)
        ->and(KejadianKecurangan::query()->where('kategori', 'paste_attempt')->firstOrFail()->skor_risiko)->toBe(6)
        ->and(KejadianKecurangan::query()->where('kategori', 'tab_switch')->firstOrFail()->skor_risiko)->toBe(4);
});

it('kategori turunan server ditolak bila dikirim klien', function (): void {
    $kuis = kuisBerjalan07($this);
    $attempt = mulaiAttempt07($this->murid, $kuis);

    // `duplicate_session` hanya boleh diturunkan server: klien tidak bisa
    // "menuduh dirinya sendiri" dengan kategori berat.
    $this->postJson("/api/v1/attempt/{$attempt->id}/kejadian", [
        'kejadian' => [['kategori' => 'duplicate_session']],
    ])->assertStatus(422)->assertJsonValidationErrors(['kejadian.0.kategori']);

    // Kategori yang tidak dikenal juga ditolak.
    $this->postJson("/api/v1/attempt/{$attempt->id}/kejadian", [
        'kejadian' => [['kategori' => 'kategori_karangan']],
    ])->assertStatus(422);

    expect(KejadianKecurangan::query()->count())->toBe(0);
});

it('murid tidak bisa mencatat kejadian pada attempt milik murid lain', function (): void {
    $kuis = kuisBerjalan07($this);
    $attempt = mulaiAttempt07($this->murid, $kuis);

    auth()->forgetGuards();
    Sanctum::actingAs($this->muridLain->user);

    $this->postJson("/api/v1/attempt/{$attempt->id}/kejadian", [
        'kejadian' => [['kategori' => 'paste_attempt']],
    ])->assertStatus(403);
});

it('catatan kecurangan bersifat append-only: hanya kolom tinjauan yang boleh berubah', function (): void {
    $kuis = kuisBerjalan07($this);
    $attempt = mulaiAttempt07($this->murid, $kuis);

    $this->postJson("/api/v1/attempt/{$attempt->id}/kejadian", [
        'kejadian' => [['kategori' => 'tamper_suspected']],
    ])->assertCreated();

    $kejadian = KejadianKecurangan::query()->firstOrFail();

    // Kolom isi catatan tidak boleh diubah...
    expect(function () use ($kejadian): void {
        $kejadian->forceFill(['kategori' => KategoriKecurangan::WindowBlur->value])->save();
    })->toThrow(RuntimeException::class);

    // ...dan catatan tidak boleh dihapus sama sekali.
    expect(function () use ($kejadian): void {
        $kejadian->delete();
    })->toThrow(RuntimeException::class);

    // Kolom tinjauan tetap boleh. (Ambil ulang barisnya dulu: save yang gagal
    // meninggalkan model dengan atribut kotor, bukan mengubah database.)
    $segar = KejadianKecurangan::query()->findOrFail($kejadian->getKey());
    $segar->forceFill(['review_status' => StatusTinjauan::Valid->value])->save();

    expect($segar->refresh()->review_status)->toBe(StatusTinjauan::Valid)
        // Isi catatan di database tidak berubah sama sekali.
        ->and($segar->kategori)->toBe(KategoriKecurangan::TamperSuspected);
});

it('guru meninjau catatan (valid/tidak valid) dan tinjauannya tercatat di audit', function (): void {
    $kuis = kuisBerjalan07($this);
    $attempt = mulaiAttempt07($this->murid, $kuis);

    $this->postJson("/api/v1/attempt/{$attempt->id}/kejadian", [
        'kejadian' => [['kategori' => 'devtools_open']],
    ])->assertCreated();

    $kejadian = KejadianKecurangan::query()->firstOrFail();

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->getJson("/api/v1/kuis/{$kuis->id}/kejadian")
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.kategori_label', 'Alat pengembang terbuka')
        ->assertJsonPath('0.nama_murid', $this->murid->user->name)
        ->assertJsonPath('0.review_status_label', 'Menunggu tinjauan');

    // Status "menunggu" bukan hasil tinjauan.
    $this->putJson("/api/v1/kejadian/{$kejadian->id}", ['status' => 'menunggu'])->assertStatus(422);

    $this->putJson("/api/v1/kejadian/{$kejadian->id}", [
        'status' => 'tidak_valid',
        'catatan' => 'Murid memang membuka kalkulator daring.',
    ])
        ->assertOk()
        ->assertJsonPath('review_status', 'tidak_valid')
        ->assertJsonPath('review_status_label', 'Tidak valid');

    expect(DB::table('activity_log')->where('log_name', 'kecurangan')->count())->toBe(1);

    // Saringan status untuk guru.
    $this->getJson("/api/v1/kuis/{$kuis->id}/kejadian?status=menunggu")->assertOk()->assertJsonCount(0);
    $this->getJson("/api/v1/kuis/{$kuis->id}/kejadian?status=tidak_valid")->assertOk()->assertJsonCount(1);
});

it('murid tidak boleh membaca catatan kecurangan atau meninjau', function (): void {
    $kuis = kuisBerjalan07($this);
    $attempt = mulaiAttempt07($this->murid, $kuis);

    $this->postJson("/api/v1/attempt/{$attempt->id}/kejadian", [
        'kejadian' => [['kategori' => 'window_blur']],
    ])->assertCreated();

    $kejadian = KejadianKecurangan::query()->firstOrFail();

    $this->getJson("/api/v1/kuis/{$kuis->id}/kejadian")->assertStatus(403);
    $this->putJson("/api/v1/kejadian/{$kejadian->id}", ['status' => 'valid'])->assertStatus(403);
    $this->getJson("/api/v1/kuis/{$kuis->id}/monitor")->assertStatus(403);
});

it('presence: kehadiran lahir dari request biasa, ping manual, dan ambang kesegaran', function (): void {
    $kuis = kuisBerjalan07($this);
    $attempt = mulaiAttempt07($this->murid, $kuis);

    $presence = app(PresenceService::class);
    $daftar = $presence->daftar($kuis);

    // `mulai` sendiri sudah menandai hadir — tanpa satu pun ping tambahan.
    expect($daftar)->toHaveCount(1)
        ->and($daftar[0]['attempt_id'])->toBe((int) $attempt->id)
        ->and($daftar[0]['online'])->toBeTrue();

    // Ping manual dari klien dipakai hanya saat 15 detik tanpa request lain.
    $this->postJson("/api/v1/attempt/{$attempt->id}/hadir")
        ->assertOk()
        ->assertJsonPath('ambang_segar_detik', PresenceService::AMBANG_SEGAR);

    // Kehadiran yang lebih tua dari ambang segar dianggap offline.
    $kunci = 'presence:kuis:'.$kuis->id;
    $peta = Cache::get($kunci);
    $peta[(int) $attempt->id]['terakhir'] = now()->subSeconds(PresenceService::AMBANG_SEGAR + 5)->toIso8601String();
    Cache::put($kunci, $peta, 600);

    $daftar = $presence->daftar($kuis);

    expect($daftar[0]['online'])->toBeFalse();

    // Murid lain tidak bisa meming attempt ini.
    auth()->forgetGuards();
    Sanctum::actingAs($this->muridLain->user);
    $this->postJson("/api/v1/attempt/{$attempt->id}/hadir")->assertStatus(403);
});

it('sesi ganda diturunkan server dan murid yang lama tidak aktif dicatat saat sapuan', function (): void {
    $kuis = kuisBerjalan07($this);
    $attempt = mulaiAttempt07($this->murid, $kuis);

    $presence = app(PresenceService::class);

    // Sesi pertama masih segar, lalu sesi kedua memakai attempt yang sama.
    $presence->tandaiHadir($attempt, 'sesi-satu');
    $presence->tandaiHadir($attempt, 'sesi-dua');

    $sesiGanda = KejadianKecurangan::query()->where('kategori', 'duplicate_session')->get();

    expect($sesiGanda)->toHaveCount(1)
        ->and($sesiGanda[0]->dari_klien)->toBeFalse()
        ->and($sesiGanda[0]->skor_risiko)->toBe(8);

    // Lama tidak aktif: kehadiran basi melewati ambang, attempt masih berjalan.
    $kunci = 'presence:kuis:'.$kuis->id;
    $peta = Cache::get($kunci);
    $peta[(int) $attempt->id]['terakhir'] = now()->subSeconds(PresenceService::AMBANG_LAMA_OFFLINE + 10)->toIso8601String();
    Cache::put($kunci, $peta, 600);

    expect($presence->sapu())->toBe(1);

    $offline = KejadianKecurangan::query()->where('kategori', 'long_offline')->get();

    expect($offline)->toHaveCount(1)
        ->and($offline[0]->dari_klien)->toBeFalse()
        ->and($offline[0]->skor_risiko)->toBe(4);

    // Sapuan ulang tidak menumpuk catatan yang sama.
    expect($presence->sapu())->toBe(0);
});

it('kehadiran attempt hilang begitu attempt dikumpulkan', function (): void {
    $kuis = kuisBerjalan07($this);
    $attempt = mulaiAttempt07($this->murid, $kuis);

    $presence = app(PresenceService::class);
    expect($presence->daftar($kuis))->toHaveCount(1);

    $this->postJson("/api/v1/attempt/{$attempt->id}/kumpulkan", [
        'idempotency_key' => 'kunci-lupakan-presence',
    ])->assertOk();

    // Attempt selesai tidak perlu lagi di peta kehadiran: tanpa ini Live Monitor
    // sempat menampilkan murid "online" yang sudah mengumpulkan sampai sapuan
    // berkala membuangnya (Q-15: `lupakan` dulu tidak pernah dipanggil).
    expect($presence->daftar($kuis))->toHaveCount(0);
});

it('snapshot Live Monitor memuat presence, progres, dan ringkasan kecurangan untuk guru', function (): void {
    $kuis = kuisBerjalan07($this);
    $attempt = mulaiAttempt07($this->murid, $kuis);

    $soalPertama = (int) $kuis->soal()->firstOrFail()->id;

    $this->postJson("/api/v1/attempt/{$attempt->id}/jawab", [
        'question_id' => $soalPertama,
        'jawaban' => 'B',
    ])->assertOk();

    $this->postJson("/api/v1/attempt/{$attempt->id}/kejadian", [
        'kejadian' => [['kategori' => 'screenshot_attempt']],
    ])->assertCreated();

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $respons = $this->getJson("/api/v1/kuis/{$kuis->id}/monitor")
        ->assertOk()
        ->assertJsonPath('kuis.id', $kuis->id)
        ->assertJsonPath('jumlah_online', 1)
        ->assertJsonPath('murid.0.attempt_id', $attempt->id)
        ->assertJsonPath('murid.0.online', true)
        ->assertJsonPath('murid.0.dijawab', 1)
        ->assertJsonPath('murid.0.jumlah_soal', 2)
        ->assertJsonPath('murid.0.persen', 50)
        ->assertJsonPath('murid.0.kecurangan.jumlah', 1)
        ->assertJsonPath('murid.0.kecurangan.skor_tertinggi', 7)
        ->assertJsonPath('murid.0.kecurangan.belum_ditinjau', 1);

    expect($respons->json('server_now'))->toBeString();
});

it('ticket SSE sekali pakai, berumur pendek, dan hanya untuk guru', function (): void {
    $kuis = kuisBerjalan07($this);

    // Murid ditolak.
    mulaiAttempt07($this->murid, $kuis);
    $this->postJson("/api/v1/kuis/{$kuis->id}/sse-tiket")->assertStatus(403);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $terbit = $this->postJson("/api/v1/kuis/{$kuis->id}/sse-tiket")->assertCreated();

    $tiket = (string) $terbit->json('tiket');
    $ttl = (int) $terbit->json('ttl_detik');

    expect($tiket)->not->toBe('')
        ->and($ttl)->toBe(TokenSseService::TTL_DETIK);

    $layanan = app(TokenSseService::class);

    // Pakai pertama berhasil, pemakaian kedua ditolak (sekali pakai).
    expect($layanan->pakai($tiket))->not->toBeNull()
        ->and($layanan->pakai($tiket))->toBeNull();

    // Ticket yang tidak pernah diterbitkan juga ditolak.
    expect($layanan->pakai('tiket-karangan'))->toBeNull();

    // Yang tersimpan hanya hash, bukan ticket asli.
    $baris = TiketSse::query()->firstOrFail();

    expect($baris->token_hash)->not->toBe($tiket)
        ->and($baris->token_hash)->toBe(hash('sha256', $tiket))
        ->and($baris->terpakai())->toBeTrue();

    // Ticket kedaluwarsa tidak bisa dipakai lagi.
    $kedaluwarsa = $layanan->terbitkan($this->guru, $kuis);
    TiketSse::query()->where('token_hash', hash('sha256', $kedaluwarsa['tiket']))->update([
        'expires_at' => now()->subMinute(),
    ]);

    expect($layanan->pakai($kedaluwarsa['tiket']))->toBeNull();
});

it('saklar anti-cheat default mati dan dikirim ke klien lewat payload attempt', function (): void {
    $kuis = kuisBerjalan07($this);

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $mulai = $this->postJson("/api/v1/kuis/{$kuis->id}/mulai")->assertCreated();

    // Proteksi default mati: klien tidak memasang sensor apa pun.
    expect($mulai->json('proteksi.anti_cheat'))->toBeFalse()
        ->and($mulai->json('proteksi.block_paste'))->toBeFalse()
        ->and($mulai->json('proteksi.block_tab_switch'))->toBeFalse()
        ->and($mulai->json('proteksi.exam_mode'))->toBeFalse();

    // Guru menyalakan dua proteksi untuk kuis ini (lapis kuis menimpa bawaan).
    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis', 'lingkup_id' => $kuis->id, 'kunci' => KunciPengaturan::AntiCheat->value, 'nilai' => true,
    ])->assertOk();

    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis', 'lingkup_id' => $kuis->id, 'kunci' => KunciPengaturan::BlockPaste->value, 'nilai' => true,
    ])->assertOk();

    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis', 'lingkup_id' => $kuis->id, 'kunci' => KunciPengaturan::BlockTabSwitch->value, 'nilai' => true,
    ])->assertOk();

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $muat = $this->getJson('/api/v1/attempt/'.$mulai->json('id'))->assertOk();

    expect($muat->json('proteksi.anti_cheat'))->toBeTrue()
        ->and($muat->json('proteksi.block_paste'))->toBeTrue()
        ->and($muat->json('proteksi.block_tab_switch'))->toBeTrue()
        ->and($muat->json('proteksi.block_screenshot'))->toBeFalse();
});

it('mengumpulkan terlambat dicatat sebagai turunan server hanya bila anti-cheat menyala', function (): void {
    $kuis = kuisBerjalan07($this);
    $attempt = mulaiAttempt07($this->murid, $kuis);

    // Anti-cheat mati (bawaan) → tidak ada catatan walau terlambat.
    $attempt->forceFill(['deadline_at' => now()->subSeconds(30)])->save();

    $this->postJson("/api/v1/attempt/{$attempt->id}/kumpulkan", ['idempotency_key' => 'kunci-07-a'])->assertOk();

    expect(KejadianKecurangan::query()->where('kategori', 'late_submit')->count())->toBe(0);
    expect($attempt->refresh()->terlambat)->toBeTrue();

    // Anti-cheat menyala untuk kuis ini → keterlambatan tercatat.
    $kuisDua = kuisBerjalan07($this);
    $attemptDua = mulaiAttempt07($this->murid, $kuisDua);

    auth()->forgetGuards();
    Sanctum::actingAs($this->guru);

    $this->putJson('/api/v1/pengaturan', [
        'lingkup' => 'kuis', 'lingkup_id' => $kuisDua->id, 'kunci' => KunciPengaturan::AntiCheat->value, 'nilai' => true,
    ])->assertOk();

    auth()->forgetGuards();
    Sanctum::actingAs($this->murid->user);

    $attemptDua->forceFill(['deadline_at' => now()->subSeconds(30)])->save();

    $this->postJson("/api/v1/attempt/{$attemptDua->id}/kumpulkan", ['idempotency_key' => 'kunci-07-b'])->assertOk();

    $catatan = KejadianKecurangan::query()->where('kategori', 'late_submit')->get();

    expect($catatan)->toHaveCount(1)
        ->and($catatan[0]->attempt_id)->toBe((int) $attemptDua->id)
        ->and($catatan[0]->dari_klien)->toBeFalse()
        ->and($catatan[0]->skor_risiko)->toBe(3);
});
