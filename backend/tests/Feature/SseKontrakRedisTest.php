<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Sections\Presence\Services\PenyiarRealtime;
use App\Sections\Presence\Services\TokenSseService;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Sekolah;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Redis;
use Throwable;

uses(RefreshDatabase::class);

/**
 * Kontrak kunci & kanal lintas service: Laravel → Redis → service Node (SSE).
 *
 * Service Node hanya punya Redis sebagai sumber data dan tidak mengenal prefix
 * internal Laravel. Karena itu `PenyiarRealtime` memakai koneksi `realtime`
 * dengan prefix kosong, nama kanal harus sama persis di kedua sisi, dan hash
 * tiket harus memakai algoritma + penyandian yang sama.
 *
 * Sebelumnya kontrak ini tidak diuji sama sekali — hanya dibuktikan manual lewat
 * smoke UI. Kalau prefix atau nama kanal bergeser, gejalanya halus: SSE berhenti
 * sampai dan panel guru diam-diam turun ke polling tanpa ada gate yang memerah.
 *
 * Uji di berkas ini memakai **Redis sungguhan** (prefix tidak bisa diuji di
 * driver array). Bila Redis tidak tersedia, berkas ini di-skip dengan alasan
 * yang jelas — dan `verify.sh` menolak jalur Redis yang di-skip, jadi hijau di
 * sana berarti berkas ini benar-benar berjalan.
 */
beforeEach(function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->sekolah = Sekolah::query()->firstOrFail();
    $this->kelas = Kelas::factory()->untukSekolah($this->sekolah)->create(['nama' => '6C', 'tingkat' => 6]);
    $this->mapel = Mapel::factory()->untukSekolah($this->sekolah)->create(['nama' => 'Bahasa', 'kode' => 'BIN']);
    $this->guru = User::factory()->guru()->create();

    try {
        // Ping dulu: tanpa Redis hidup, tidak ada yang bisa diuji di sini.
        Redis::connection(PenyiarRealtime::KONEKSI)->ping();
    } catch (Throwable $galat) {
        lewatiTanpaRedis('uji kontrak SSE', $galat);
    }
});

afterEach(function (): void {
    // Bersih-bersih hanya kunci buatan uji ini.
    try {
        $kunci = $this->kunciTiketUji ?? null;

        if (is_string($kunci) && $kunci !== '') {
            Redis::connection(PenyiarRealtime::KONEKSI)->del($kunci);
        }
    } catch (Throwable) {
        // Gagal bersih-bersih bukan kegagalan uji.
    }
});

/** Kuis milik guru yang sedang diuji. */
function kuisKontrakSse(object $test): Kuis
{
    return Kuis::factory()
        ->untukSekolah($test->sekolah, $test->mapel, $test->kelas)
        ->milik($test->guru)
        ->create();
}

it('tiket SSE ditulis tanpa prefix Laravel supaya service Node bisa GETDEL kunci yang sama', function (): void {
    $kuis = kuisKontrakSse($this);

    $hasil = app(TokenSseService::class)->terbitkan($this->guru, $kuis);
    $hash = hash('sha256', $hasil['tiket']);
    $kunci = PenyiarRealtime::PREFIKS_TIKET.$hash;
    $this->kunciTiketUji = $kunci;

    $conn = Redis::connection(PenyiarRealtime::KONEKSI);

    // Kunci mentah — persis yang dicari Node — ada di Redis.
    expect((int) $conn->exists($kunci))->toBe(1);

    $isi = json_decode((string) $conn->get($kunci), true);

    expect($isi)->toMatchArray([
        'user_id' => $this->guru->getKey(),
        'quiz_id' => $kuis->getKey(),
        'peran' => 'guru',
    ]);

    // Tiket berumur: kebocoran tiket cepat basi.
    expect((int) $conn->ttl($kunci))->toBeGreaterThan(0)
        ->toBeLessThanOrEqual(TokenSseService::TTL_DETIK);

    // Versi berprefix TIDAK ada. Inilah inti kontraknya: Node tidak tahu prefix
    // Laravel, jadi kunci bertiket harus ditulis lewat koneksi tanpa prefix.
    $prefix = (string) config('database.redis.options.prefix');

    expect($prefix)->not->toBe('')
        ->and((int) $conn->exists($prefix.$kunci))->toBe(0);
});

it('koneksi realtime memang tanpa prefix, sedangkan koneksi biasa memakai prefix', function (): void {
    // Bukti tingkat mekanisme: phpredis menambahkan OPT_PREFIX ke kunci (dan
    // kanal) yang dikirim. Koneksi `realtime` harus kosong, koneksi `default`
    // tidak — kalau setelan ini terhapus, siaran Laravel tidak akan pernah
    // sampai ke pelanggan Node.
    // `\Redis` = kelas ekstensi phpredis; `Redis` di atas adalah facade Laravel.
    $prefiksRealtime = Redis::connection(PenyiarRealtime::KONEKSI)->client()->getOption(\Redis::OPT_PREFIX);
    $prefiksDefault = Redis::connection('default')->client()->getOption(\Redis::OPT_PREFIX);

    expect((string) $prefiksRealtime)->toBe('')
        ->and((string) $prefiksDefault)->not->toBe('')
        ->and((string) config('database.redis.realtime.options.prefix'))->toBe('');
});

it('nama kanal, awalan kunci tiket, dan hash tiket sejalan dengan service Node', function (): void {
    // Kontrak dua sisi dibaca dari sumber service Node. Uji ini sengaja gagal
    // kalau salah satu sisi mengganti nama kanal, awalan kunci, atau algoritma
    // hash tanpa menyelaraskan sisi lainnya.
    $sumber = (string) file_get_contents(base_path('../realtime/src/server.js'));

    expect($sumber)->not->toBe('');

    // 1) Nama kanal: template di Node dipakai untuk dua peran dan dibandingkan
    //    dengan metode Laravel.
    preg_match('/function kanalKuis\(peran, kuisId\) \{\s*return `([^`]+)`/', $sumber, $cocokKanal);
    expect($cocokKanal)->toHaveCount(2, 'Pola `kanalKuis` di service Node tidak dikenali.');

    $kanalNode = str_replace(['${kuisId}', '${peran}'], ['7', 'guru'], $cocokKanal[1]);
    $kanalMuridNode = str_replace(['${kuisId}', '${peran}'], ['7', 'murid'], $cocokKanal[1]);
    $penyiar = app(PenyiarRealtime::class);

    expect($kanalNode)->toBe($penyiar->kanalGuru(7))
        ->and($kanalMuridNode)->toBe($penyiar->kanalMurid(7));

    // 2) Kunci tiket: Node membaca `GETDEL sse:tiket:<hash>`.
    preg_match('/redis\.getdel\(`([^`]+)`\)/', $sumber, $cocokKunci);
    expect($cocokKunci)->toHaveCount(2, 'Pola `getdel` di service Node tidak dikenali.');

    $awalanNode = str_replace(['${hashTiket(tiket)}', '${hash}'], '', $cocokKunci[1]);

    expect($cocokKunci[1])->toContain('${hashTiket(tiket)}')
        ->and($awalanNode)->toBe(PenyiarRealtime::PREFIKS_TIKET);

    // 3) Hash tiket: algoritma + penyandian di Node harus menghasilkan untai
    //    yang sama dengan `hash('sha256', $tiket)` milik Laravel.
    preg_match('/function hashTiket\(tiket\) \{(.+?)\}/s', $sumber, $cocokHash);
    expect($cocokHash)->toHaveCount(2, 'Pola `hashTiket` di service Node tidak dikenali.');

    preg_match("/createHash\\('([^']+)'\\)/", $cocokHash[1], $cocokAlgoritma);
    preg_match("/digest\\('([^']+)'\\)/", $cocokHash[1], $cocokSandian);

    expect($cocokAlgoritma)->toHaveCount(2)
        ->and($cocokSandian)->toHaveCount(2);

    $algoritma = $cocokAlgoritma[1];
    $sandian = $cocokSandian[1];
    $tiketContoh = 'tiket-uji-kontrak';

    // Node: createHash(algo).update(tiket).digest(sandian).
    $hashNode = $sandian === 'hex'
        ? hash($algoritma, $tiketContoh)
        : bin2hex(hash($algoritma, $tiketContoh, true));

    expect($hashNode)->toBe(hash('sha256', $tiketContoh));
});
