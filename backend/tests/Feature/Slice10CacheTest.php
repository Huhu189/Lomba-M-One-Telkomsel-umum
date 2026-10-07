<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Sections\Cache\Contracts\LapisanCache;
use App\Sections\Cache\Services\CacheBerlapis;
use App\Sections\Cache\Services\LapisanL1;
use App\Sections\Cache\Services\LapisanL2;
use App\Sections\Cache\Services\PintuTraffic;
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Enums\LingkupPengaturan;
use App\Sections\Settings\Models\Pengaturan;
use App\Sections\Settings\Services\PengaturanService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Redis;

uses(RefreshDatabase::class);

/**
 * Lapisan palsu yang mencatat urutan pemanggilan — untuk membuktikan
 * urutan invalidasi Redis → L1 tanpa bergantung pada Redis sungguhan.
 */
final class LapisanPalsu implements LapisanCache
{
    /** @var array<int, string> */
    public array $jejak = [];

    /** @var array<string, array{muatan: mixed, versi: int}> */
    public array $isi = [];

    public function __construct(private readonly string $namaLapisan) {}

    public function nama(): string
    {
        return $this->namaLapisan;
    }

    public function tersedia(): bool
    {
        return true;
    }

    public function ambil(string $kunci): ?array
    {
        return $this->isi[$kunci] ?? null;
    }

    public function simpan(string $kunci, mixed $muatan, int $versi): void
    {
        $this->jejak[] = "simpan:{$this->namaLapisan}:{$kunci}";
        $this->isi[$kunci] = ['muatan' => $muatan, 'versi' => $versi];
    }

    public function lupakan(string $kunci): void
    {
        $this->jejak[] = "lupakan:{$this->namaLapisan}:{$kunci}";
        unset($this->isi[$kunci]);
    }

    public function lupakanRuang(string $ruang): void
    {
        $this->jejak[] = "lupakanRuang:{$this->namaLapisan}:{$ruang}";

        foreach (array_keys($this->isi) as $kunci) {
            if (str_starts_with((string) $kunci, $ruang.':')) {
                unset($this->isi[$kunci]);
            }
        }
    }
}

beforeEach(function (): void {
    Cache::flush();

    $this->pintu = new PintuTraffic(5, 10.0, 2.0);

    // Jalur L1 sementara supaya tes tidak menyentuh tmpfs/berkas sungguhan.
    $this->jalurL1 = sys_get_temp_dir().'/ulangan-l1-uji-'.uniqid().'.sqlite';
    $this->l1 = new LapisanL1($this->jalurL1, 3600);
});

afterEach(function (): void {
    foreach (['', '-wal', '-shm'] as $akhiran) {
        $berkas = $this->jalurL1.$akhiran;

        if (is_file($berkas)) {
            unlink($berkas);
        }
    }
});

/** Nyalakan lalu lintas satu ruang supaya pintu L1 membuka. */
function padatkan(object $ctx, string $ruang = 'pengaturan'): void
{
    $ctx->pintu->catat($ruang, 100);
}

it('invalidasi berjalan berurutan: versi naik, Redis dulu, lalu L1', function (): void {
    $l2 = new LapisanPalsu('redis');
    $l1 = new LapisanPalsu('l1');
    $berlapis = new CacheBerlapis($this->pintu, [$l2, $l1]);

    $berlapis->ingat('pengaturan:kuis:9', fn (): array => ['nilai' => 1], 'pengaturan');

    $l1->jejak = [];
    $l2->jejak = [];

    $berlapis->lupakan('pengaturan:kuis:9', 'pengaturan');

    // Urutannya: (1) versi naik sebagai validation check, (2) Redis dilupakan,
    // (3) baru L1 — L1 tidak pernah jadi sumber kebenaran.
    expect($l2->jejak[0])->toBe('simpan:redis:pengaturan:kuis:9:versi')
        ->and($l2->jejak[1])->toBe('lupakan:redis:pengaturan:kuis:9')
        ->and($l1->jejak[0])->toBe('lupakan:l1:pengaturan:kuis:9')
        // Salinan L1 satu ruang sekaligus dibuang saat ruangnya disebutkan.
        ->and($l1->jejak[1])->toBe('lupakanRuang:l1:pengaturan')
        ->and($berlapis->versi('pengaturan:kuis:9'))->toBe(1);
});

it('menolak salinan L1 yang versinya ketinggalan (validation check)', function (): void {
    $l2 = new LapisanPalsu('redis');
    $l1 = new LapisanPalsu('l1');
    $berlapis = new CacheBerlapis($this->pintu, [$l2, $l1]);

    padatkan($this, 'pengaturan');
    $berlapis->ingat('pengaturan:kuis:3', fn (): array => ['nilai' => 'lama'], 'pengaturan');

    // Proses lain mengubah data: salinan L1 jadi basi, tetapi masih ada di L1.
    $berlapis->lupakan('pengaturan:kuis:3', 'pengaturan');
    $l1->isi['pengaturan:kuis:3'] = ['muatan' => ['nilai' => 'basi'], 'versi' => 0];

    $hasil = $berlapis->ingat('pengaturan:kuis:3', fn (): array => ['nilai' => 'baru'], 'pengaturan');

    expect($hasil)->toBe(['nilai' => 'baru'])
        ->and($l1->jejak)->toContain('lupakan:l1:pengaturan:kuis:3');
});

it('L1 hanya dipakai saat lalu lintas padat dan dibuang saat reda', function (): void {
    $berlapis = new CacheBerlapis($this->pintu, [new LapisanL2, $this->l1]);
    $dipanggil = 0;

    $sumber = function () use (&$dipanggil): array {
        $dipanggil++;

        return ['nilai' => $dipanggil];
    };

    // Lalu lintas biasa: L1 tidak diisi, tiap pembacaan jatuh ke sumber.
    $berlapis->ingat('pengaturan:kuis:1', $sumber);
    $berlapis->ingat('pengaturan:kuis:1', $sumber);

    expect($dipanggil)->toBe(1)
        ->and($this->l1->ambil('pengaturan:kuis:1'))->toBeNull();

    // Ruang jadi padat → L1 dipakai, pembacaan berikutnya tidak menyentuh sumber.
    padatkan($this);
    $berlapis->ingat('pengaturan:kuis:1', $sumber);

    expect($this->l1->ambil('pengaturan:kuis:1'))->not->toBeNull();

    $sebelum = $dipanggil;
    $berlapis->ingat('pengaturan:kuis:1', $sumber);

    expect($dipanggil)->toBe($sebelum);

    // Lalu lintas reda → salinan L1 satu ruang dibuang. Nilainya tetap dilayani
    // L2 (Redis), jadi sumber database tidak ikut dipanggil lagi.
    Cache::forget('l1:laju:pengaturan');
    Cache::forget('l1:status:pengaturan');
    $berlapis->ingat('pengaturan:kuis:1', $sumber);

    expect($this->l1->ambil('pengaturan:kuis:1'))->toBeNull()
        ->and($dipanggil)->toBe($sebelum);
});

it('pintu L1 memakai histeresis di antara dua ambang', function (): void {
    // Di bawah ambang mati → tertutup.
    $this->pintu->catat('uji', 5);
    expect($this->pintu->aktif('uji'))->toBeFalse();

    // Di atas ambang aktif → terbuka.
    $this->pintu->catat('uji', 100);
    expect($this->pintu->aktif('uji'))->toBeTrue();

    // Di antara dua ambang → keputusan terakhir dipertahankan (masih terbuka).
    Cache::forget('l1:laju:uji');
    $this->pintu->catat('uji', 20);
    expect($this->pintu->laju('uji'))->toEqual(4.0)
        ->and($this->pintu->aktif('uji'))->toBeTrue();

    // Turun di bawah ambang mati → tertutup lagi.
    Cache::forget('l1:laju:uji');
    $this->pintu->catat('uji', 1);
    expect($this->pintu->aktif('uji'))->toBeFalse();
});

it('perubahan pengaturan langsung terlihat walau L1 sedang aktif', function (): void {
    config(['cache_l1.aktif' => true, 'cache_l1.jalur' => $this->jalurL1, 'cache_l1.kanal' => 'ulangan:state']);
    $this->app->forgetInstance(CacheBerlapis::class);

    Redis::shouldReceive('publish')->andReturn(1);

    /** @var PengaturanService $pengaturan */
    $pengaturan = app(PengaturanService::class);

    // Semua murid membaca bersamaan → ruang pengaturan padat → L1 menyala.
    for ($i = 0; $i < 60; $i++) {
        $pengaturan->semua(1, null, 7);
    }

    $sebelum = $pengaturan->semua(1, null, 7)['pengaturan'][KunciPengaturan::ModeTim->value]['nilai'];
    expect($sebelum)->toBeFalse();

    // Guru mengubah pengaturan: DB dulu, lalu invalidasi berlapis.
    $pengaturan->simpan(LingkupPengaturan::Kuis, 7, KunciPengaturan::ModeTim, true);

    expect(Pengaturan::query()->where('kunci', KunciPengaturan::ModeTim->value)->first()?->nilai)->toBeTrue()
        ->and($pengaturan->semua(1, null, 7)['pengaturan'][KunciPengaturan::ModeTim->value]['nilai'])->toBeTrue()
        ->and($pengaturan->semua(1, null, 7)['pengaturan'][KunciPengaturan::ModeTim->value]['sumber'])->toBe('kuis');

    // Salinan L1 lama benar-benar dibuang, bukan hanya diabaikan.
    $salinan = (new LapisanL1($this->jalurL1, 3600))->ambil('pengaturan:kuis:7');

    expect($salinan['muatan']['nilai'][KunciPengaturan::ModeTim->value] ?? null)->toBeTrue();
});
