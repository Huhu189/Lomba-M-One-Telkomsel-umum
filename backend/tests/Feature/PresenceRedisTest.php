<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Cheat\Models\KejadianKecurangan;
use App\Sections\Presence\Services\PresenceService;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Throwable;

uses(RefreshDatabase::class);

/**
 * Presence di atas Redis (P-02).
 *
 * Uji di berkas ini sengaja memakai **Redis sungguhan**, bukan driver array:
 * gunanya membuktikan bahwa jalur tulis kehadiran tidak lagi membaca-menulis
 * seluruh peta kelas. Kalau Redis tidak tersedia, seluruh berkas dilewati
 * dengan alasan yang jelas — bukan dinyatakan lulus.
 *
 * Kunci uji memakai prefiks sendiri (`uji-presence-`) supaya tidak bertabrakan
 * dengan kunci aplikasi di basis data Redis yang sama, dan hanya kunci berawalan
 * itu yang dibersihkan sesudahnya.
 */
const PRESENCE_PREFIX_UJI = 'uji-presence-';

beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6B', 'tingkat' => 6]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'IPA', 'kode' => 'IPA']);
    $this->guru = User::factory()->guru()->create();
    $this->murid = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);
    $this->muridLain = Murid::factory()->create([
        'school_id' => $this->sekolah->id,
        'class_id' => $this->kelas->id,
    ]);

    $this->awalanStore = config('cache.default');
    $this->awalanPrefix = config('cache.prefix');

    try {
        // Ping dulu: tanpa Redis yang hidup, berkas ini tidak bisa menguji apa pun.
        Cache::store('redis')->connection()->ping();
    } catch (Throwable $galat) {
        $this->markTestSkipped('Redis tidak tersedia untuk uji presence: '.$galat->getMessage());
    }
});

afterEach(function (): void {
    Carbon::setTestNow();

    try {
        $conn = Cache::store('redis')->connection();
        $awalan = (string) config('database.redis.options.prefix');

        // `KEYS` mengembalikan nama LENGKAP (termasuk prefiks klien Redis),
        // sedangkan setiap perintah lewat koneksi Laravel menambahkan prefiks itu
        // lagi. Jadi prefiksnya dilepas dulu sebelum dihapus; tanpa ini kunci uji
        // tertinggal dan mencemari uji berikutnya.
        foreach ((array) $conn->keys(PRESENCE_PREFIX_UJI.'*') as $nama) {
            $relatif = is_string($nama) && str_starts_with($nama, $awalan)
                ? substr($nama, strlen($awalan))
                : $nama;

            $conn->del($relatif);
        }
    } catch (Throwable) {
        // Bersih-bersih gagal bukan kegagalan uji; kunci berprefiks uji tetap
        // tidak mengganggu aplikasi.
    }

    config(['cache.default' => $this->awalanStore, 'cache.prefix' => $this->awalanPrefix]);
    Cache::forgetDriver(['redis', 'array', 'database', 'default']);
});

/** Pindahkan proses uji ini ke Redis dengan prefiks khusus uji. */
function pakaiRedisUji(): void
{
    config(['cache.default' => 'redis', 'cache.prefix' => PRESENCE_PREFIX_UJI]);
    Cache::forgetDriver(['redis', 'array', 'database', 'default']);
}

/** Jumlah pemanggilan satu perintah Redis sejak `CONFIG RESETSTAT` terakhir. */
function hitungPerintahRedis(mixed $conn, string $perintah): int
{
    $stats = $conn->info('commandstats');
    $baris = is_array($stats) ? ($stats['cmdstat_'.$perintah] ?? null) : null;

    if (! is_string($baris)) {
        return 0;
    }

    preg_match('/calls=(\d+)/', $baris, $cocok);

    return (int) ($cocok[1] ?? 0);
}

it('memakai gudang redis saat cache aplikasi redis, dan peta saat bukan', function (): void {
    config(['cache.default' => 'array']);
    Cache::forgetDriver(['array', 'redis']);

    expect(app(PresenceService::class)->namaGudang())->toBe('peta');

    pakaiRedisUji();

    expect(app(PresenceService::class)->namaGudang())->toBe('redis');
});

it('jalur tulis kehadiran hanya menyentuh satu medan hash, bukan seluruh peta kelas', function (): void {
    pakaiRedisUji();

    $kuis = kuisBerjalan07($this);
    $conn = Cache::store('redis')->connection();

    // Enam murid mengerjakan kuis yang sama: peta kelas yang harus dikelola
    // berisi enam entri.
    $attempt = mulaiAttempt07($this->murid, $kuis);
    $murid = [$this->murid, $this->muridLain];

    while (count($murid) < 6) {
        $murid[] = Murid::factory()->create([
            'school_id' => $this->sekolah->id,
            'class_id' => $this->kelas->id,
        ]);
    }

    foreach ($murid as $satu) {
        $presence = app(PresenceService::class);
        $hasil = $satu->is($this->murid)
            ? $attempt
            : mulaiAttempt07($satu, $kuis);

        $presence->tandaiHadir($hasil, 'sesi-'.$satu->id);
    }

    $kunci = PRESENCE_PREFIX_UJI.'presence:kuis:'.$kuis->id;

    expect($conn->hlen($kunci))->toBe(6);

    // Satu request murid = baca SATU medan + tulis SATU medan. Tidak ada
    // HGETALL di jalur tulis: itulah yang membuat biayanya tidak tumbuh seiring
    // jumlah murid di kelas (P-02). Sebelumnya jalur ini membaca seluruh peta,
    // mengubah satu entri, lalu menulis seluruhnya.
    $conn->config('RESETSTAT');
    app(PresenceService::class)->tandaiHadir($attempt, 'sesi-baru');

    expect(hitungPerintahRedis($conn, 'hget'))->toBe(1)
        ->and(hitungPerintahRedis($conn, 'hset'))->toBe(1)
        ->and(hitungPerintahRedis($conn, 'hgetall'))->toBe(0)
        ->and($conn->hlen($kunci))->toBe(6);

    // Guru membaca seluruh peta kelas: satu round-trip, tanpa penulisan.
    $conn->config('RESETSTAT');
    $daftar = app(PresenceService::class)->daftar($kuis);

    expect($daftar)->toHaveCount(6)
        ->and(hitungPerintahRedis($conn, 'hgetall'))->toBe(1)
        ->and(hitungPerintahRedis($conn, 'hset'))->toBe(0);
});

it('sesi ganda terdeteksi dari medan hash dan kehadiran jadi offline setelah ambang segar', function (): void {
    pakaiRedisUji();

    $kuis = kuisBerjalan07($this);
    $attempt = mulaiAttempt07($this->murid, $kuis);
    $presence = app(PresenceService::class);

    // Medan hash yang sama dibaca ulang: sesi kedua dianggap sesi ganda.
    $presence->tandaiHadir($attempt, 'sesi-satu');
    $presence->tandaiHadir($attempt, 'sesi-dua');

    $sesiGanda = KejadianKecurangan::query()->where('kategori', 'duplicate_session')->get();

    expect($sesiGanda)->toHaveCount(1)
        ->and($sesiGanda[0]->dari_klien)->toBeFalse();

    expect($presence->daftar($kuis)[0]['online'])->toBeTrue();

    // Lebih tua dari ambang segar: guru melihatnya offline, entri belum dibuang.
    Carbon::setTestNow(Carbon::now()->addSeconds(PresenceService::AMBANG_SEGAR + 5));

    expect($presence->daftar($kuis)[0]['online'])->toBeFalse();
});

it('sapuan membuang entri basi dari hash dan indeks Redis, lalu mencatat lama tidak aktif', function (): void {
    pakaiRedisUji();

    $kuis = kuisBerjalan07($this);
    $attempt = mulaiAttempt07($this->murid, $kuis);
    $conn = Cache::store('redis')->connection();

    app(PresenceService::class)->tandaiHadir($attempt, 'sesi-satu');

    $kunci = PRESENCE_PREFIX_UJI.'presence:kuis:'.$kuis->id;
    $indeks = PRESENCE_PREFIX_UJI.'presence:indeks';

    expect($conn->hlen($kunci))->toBe(1)
        ->and($conn->sismember($indeks, (string) $kuis->id))->toBeTrue();

    Carbon::setTestNow(Carbon::now()->addSeconds(PresenceService::AMBANG_LAMA_OFFLINE + 10));

    expect(app(PresenceService::class)->sapu())->toBe(1);

    $offline = KejadianKecurangan::query()->where('kategori', 'long_offline')->get();

    expect($offline)->toHaveCount(1)
        ->and($offline[0]->dari_klien)->toBeFalse();

    // Kuis tanpa entri tidak perlu disapu terus: kunci hash dan id di indeks
    // ikut hilang, dan sapuan berikutnya tidak menghitung apa-apa lagi.
    expect($conn->exists($kunci))->toBe(0)
        ->and($conn->sismember($indeks, (string) $kuis->id))->toBeFalse()
        ->and(app(PresenceService::class)->sapu())->toBe(0);
});

it('kunci sisa berbentuk string dari driver lama tidak mematikan presence', function (): void {
    pakaiRedisUji();

    $kuis = kuisBerjalan07($this);
    $conn = Cache::store('redis')->connection();
    $kunci = PRESENCE_PREFIX_UJI.'presence:kuis:'.$kuis->id;

    // Keadaan sesudah deploy: kunci yang sama masih berisi STRING bekas gudang
    // peta. `HSET` di atas string akan ditolak Redis (WRONGTYPE) — presence
    // tidak boleh mati diam-diam karenanya.
    $conn->set($kunci, (string) json_encode(['lama' => true]));

    $attempt = mulaiAttempt07($this->murid, $kuis);

    expect(app(PresenceService::class)->daftar($kuis))->toHaveCount(1)
        ->and($conn->hlen($kunci))->toBe(1)
        ->and($conn->get($kunci))->toBeFalsy();
});

it('kehadiran Redis hilang begitu attempt dikumpulkan', function (): void {
    pakaiRedisUji();

    $kuis = kuisBerjalan07($this);
    $attempt = mulaiAttempt07($this->murid, $kuis);
    $conn = Cache::store('redis')->connection();

    expect(app(PresenceService::class)->daftar($kuis))->toHaveCount(1);

    test()->postJson("/api/v1/attempt/{$attempt->id}/kumpulkan", [
        'idempotency_key' => 'kunci-lupakan-presence-redis',
    ])->assertOk();

    expect(app(PresenceService::class)->daftar($kuis))->toHaveCount(0)
        ->and($conn->exists(PRESENCE_PREFIX_UJI.'presence:kuis:'.$kuis->id))->toBe(0);
});
