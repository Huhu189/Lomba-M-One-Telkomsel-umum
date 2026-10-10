<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Services\AttemptService;
use App\Sections\Attempt\Services\Pengacakan;
use App\Sections\Question\Enums\TipeSoal;
use App\Sections\Question\Models\Soal;
use App\Sections\Question\Registry\RegistryTipeSoal;
use App\Sections\Scoring\Enums\StatusPenilaian;
use App\Sections\Scoring\Services\PenilaiSoal;
use Database\Seeders\BankSoalSeeder;
use Database\Seeders\MasterDataSeeder;
use Database\Seeders\RolesAndAdminSeeder;
use Database\Seeders\SekolahSeeder;

/*
|--------------------------------------------------------------------------
| Tipe soal baru — Objektif 1, gelombang 1
|--------------------------------------------------------------------------
|
| Enam tipe: pilihan ganda kompleks, benar/salah majemuk, isian angka,
| pilihan gambar, urut gambar, susun huruf. Yang diuji di sini adalah kontrak
| penilaian registry (validasi konten/kunci, nilai, bobot — termasuk jawaban
| parsial, kosong, dan `null`) dan janji keamanan: payload murid tidak pernah
| memuat kunci, dan huruf susun kata diacak server.
|
*/

/**
 * Susun satu soal in-memory dari snapshot untuk `AttemptService::payloadSoal`.
 *
 * @param  array<int, array{id: int, tipe: string, konten: array<string, mixed>, kunci: array<string, mixed>, skor: int}>  $soal
 * @return array<int, array<string, mixed>>
 */
function muatan11(array $soal, bool $acakOpsi = false, int $seed = 20261010): array
{
    $attempt = new Attempt;
    $attempt->forceFill([
        'school_id' => 1,
        'quiz_id' => 1,
        'seed' => $seed,
        'snapshot_soal' => ['acak_soal' => false, 'acak_opsi' => $acakOpsi, 'soal' => $soal],
    ]);
    $attempt->id = 1;

    return app(AttemptService::class)->payloadSoal($attempt);
}

it('menyediakan contoh bank soal yang lolos validasi registry', function (): void {
    $this->seed(RolesAndAdminSeeder::class);
    $this->seed(SekolahSeeder::class);
    $this->seed(MasterDataSeeder::class);
    $this->seed(BankSoalSeeder::class);

    $soal = Soal::query()->get();

    // Contoh tipe baru wajib benar-benar bisa disimpan: kalau tidak, guru yang
    // membuka bank soal demo menemukan soal yang ditolak server saat diperbarui.
    $tipe = $soal->map(fn (Soal $satu): ?string => $satu->tipeAman()?->value)->sort()->values()->all();

    expect($soal)->not->toBeEmpty()
        ->and($tipe)->toContain(
            'isian_rumpang',
            'klasifikasi',
            'tabel_isian',
            'garis_bilangan',
        );

    foreach ($soal as $satu) {
        $tipe = $satu->tipeAman();
        $mentah = (string) $satu->getRawOriginal('tipe');

        expect($tipe)->not->toBeNull("Tipe soal contoh '{$mentah}' tak dikenal")
            ->and(RegistryTipeSoal::validasi($tipe, $satu->kontenSebagaiArray(), $satu->kunciSebagaiArray()))
            ->toBe([]);
    }
});

it('mengenal semua tipe baru sebagai objektif', function (): void {
    $tipe = [
        TipeSoal::PilihanGandaKompleks,
        TipeSoal::BenarSalahMajemuk,
        TipeSoal::IsianAngka,
        TipeSoal::PilihanGambar,
        TipeSoal::UrutGambar,
        TipeSoal::SusunHuruf,
        TipeSoal::IsianRumpang,
        TipeSoal::Klasifikasi,
        TipeSoal::TabelIsian,
        TipeSoal::GarisBilangan,
        TipeSoal::HotspotGambar,
        TipeSoal::BacaJam,
        TipeSoal::TekaSilangMini,
    ];

    foreach ($tipe as $satu) {
        expect(TipeSoal::tryFrom($satu->value))->toBe($satu)
            ->and($satu->objektif())->toBeTrue()
            ->and($satu->label())->not->toBe('');
    }
});

it('menilai pilihan ganda kompleks secara parsial dan menolak kunci kosong', function (): void {
    $konten = [
        'teks' => 'Centang bilangan genap.',
        'opsi' => [
            ['id' => 'o1', 'teks' => '4'],
            ['id' => 'o2', 'teks' => '7'],
            ['id' => 'o3', 'teks' => '10'],
            ['id' => 'o4', 'teks' => '15'],
        ],
    ];
    $kunci = ['benar' => ['o1', 'o3']];

    expect(RegistryTipeSoal::validasi(TipeSoal::PilihanGandaKompleks, $konten, $kunci))->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::PilihanGandaKompleks, $konten, ['benar' => []]))
        ->not->toBe([])
        // Semua opsi jadi kunci → ditolak.
        ->and(RegistryTipeSoal::validasi(TipeSoal::PilihanGandaKompleks, $konten, ['benar' => ['o1', 'o2', 'o3', 'o4']]))
        ->not->toBe([]);

    // Himpunan sama = 1.0; sebagian = proporsi bersih; salah semua = 0.
    expect(RegistryTipeSoal::bobot(TipeSoal::PilihanGandaKompleks, $konten, $kunci, ['o1', 'o3']))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::PilihanGandaKompleks, $konten, $kunci, ['o3', 'o1']))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::PilihanGandaKompleks, $konten, $kunci, ['o1']))->toBe(0.5)
        ->and(RegistryTipeSoal::bobot(TipeSoal::PilihanGandaKompleks, $konten, $kunci, ['o1', 'o2']))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::PilihanGandaKompleks, $konten, $kunci, []))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::PilihanGandaKompleks, $konten, $kunci, null))->toBe(0.0)
        ->and(RegistryTipeSoal::nilai(TipeSoal::PilihanGandaKompleks, $konten, $kunci, ['o1']))->toBeFalse();
});

it('menilai benar/salah majemuk per baris dan menolak kunci yang tidak lengkap', function (): void {
    $konten = [
        'teks' => 'Tandai tiap pernyataan.',
        'pernyataan' => [
            ['id' => 'p1', 'teks' => '1 + 1 = 2'],
            ['id' => 'p2', 'teks' => '2 + 2 = 5'],
            ['id' => 'p3', 'teks' => '3 + 3 = 6'],
        ],
    ];
    $kunci = ['jawaban' => ['p1' => true, 'p2' => false, 'p3' => true]];

    expect(RegistryTipeSoal::validasi(TipeSoal::BenarSalahMajemuk, $konten, $kunci))->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::BenarSalahMajemuk, $konten, ['jawaban' => ['p1' => true]]))
        ->not->toBe([]);

    expect(RegistryTipeSoal::bobot(TipeSoal::BenarSalahMajemuk, $konten, $kunci, ['p1' => true, 'p2' => false, 'p3' => true]))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::BenarSalahMajemuk, $konten, $kunci, ['p1' => true, 'p2' => true, 'p3' => true]))->toBe(2 / 3)
        ->and(RegistryTipeSoal::bobot(TipeSoal::BenarSalahMajemuk, $konten, $kunci, []))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::BenarSalahMajemuk, $konten, $kunci, null))->toBe(0.0)
        // String "true" dari JSON salah bentuk tidak dihitung cocok.
        ->and(RegistryTipeSoal::bobot(TipeSoal::BenarSalahMajemuk, $konten, $kunci, ['p1' => 'true', 'p2' => 'false', 'p3' => 'true']))->toBe(0.0);
});

it('menilai isian angka dengan toleransi dan membaca satuan/koma', function (): void {
    $konten = ['teks' => 'Berapa hasilnya?', 'satuan' => 'cm'];
    $kunci = ['nilai' => 21, 'toleransi' => 0];

    expect(RegistryTipeSoal::validasi(TipeSoal::IsianAngka, $konten, $kunci))->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::IsianAngka, $konten, ['nilai' => 21, 'toleransi' => -1]))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::IsianAngka, $konten, ['nilai' => 'dua puluh', 'toleransi' => 0]))->not->toBe([]);

    expect(RegistryTipeSoal::bobot(TipeSoal::IsianAngka, $konten, $kunci, '21'))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::IsianAngka, $konten, $kunci, ' 21 cm '))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::IsianAngka, $konten, $kunci, '20'))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::IsianAngka, $konten, $kunci, null))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::IsianAngka, $konten, $kunci, ['21']))->toBe(0.0)
        // Toleransi 0.5 menerima 20.6 tetapi bukan 20.4.
        ->and(RegistryTipeSoal::bobot(TipeSoal::IsianAngka, $konten, ['nilai' => 21, 'toleransi' => 0.5], '20.6'))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::IsianAngka, $konten, ['nilai' => 21, 'toleransi' => 0.5], '20.4'))->toBe(0.0)
        // Koma dibaca sebagai pemisah desimal gaya Indonesia.
        ->and(RegistryTipeSoal::bobot(TipeSoal::IsianAngka, ['teks' => 'x'], ['nilai' => 1.5, 'toleransi' => 0], '1,5'))->toBe(1.0);
});

it('menilai pilihan gambar 0/1 dan menolak media berbahaya', function (): void {
    $konten = [
        'teks' => 'Pilih lingkaran.',
        'opsi' => [
            ['id' => 'g1', 'media' => '/media/lingkaran.png'],
            ['id' => 'g2', 'media' => '/media/persegi.png'],
        ],
    ];
    $kunci = ['benar' => 'g1'];

    expect(RegistryTipeSoal::validasi(TipeSoal::PilihanGambar, $konten, $kunci))->toBe([])
        ->and(RegistryTipeSoal::bobot(TipeSoal::PilihanGambar, $konten, $kunci, 'g1'))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::PilihanGambar, $konten, $kunci, 'g2'))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::PilihanGambar, $konten, $kunci, 'g9'))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::PilihanGambar, $konten, $kunci, null))->toBe(0.0)
        // Gambar wajib punya media; URL http (bukan https) ditolak.
        ->and(RegistryTipeSoal::validasi(TipeSoal::PilihanGambar, ['teks' => 'x', 'opsi' => [['id' => 'a', 'media' => ''], ['id' => 'b', 'media' => '']]], $kunci))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::PilihanGambar, ['teks' => 'x', 'opsi' => [['id' => 'a', 'media' => 'http://jahat.example/img.png'], ['id' => 'b', 'media' => '/media/b.png']]], $kunci))->not->toBe([]);
});

it('menilai urut gambar per posisi (parsial)', function (): void {
    $konten = [
        'teks' => 'Urutkan dari terkecil.',
        'item' => [
            ['id' => 'u1', 'media' => '/media/a.png'],
            ['id' => 'u2', 'media' => '/media/b.png'],
            ['id' => 'u3', 'media' => '/media/c.png'],
        ],
    ];
    $kunci = ['urutan' => ['u2', 'u1', 'u3']];

    expect(RegistryTipeSoal::validasi(TipeSoal::UrutGambar, $konten, $kunci))->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::UrutGambar, $konten, ['urutan' => ['u1', 'u2']]))->not->toBe([]);

    expect(RegistryTipeSoal::bobot(TipeSoal::UrutGambar, $konten, $kunci, ['u2', 'u1', 'u3']))->toBe(1.0)
        // Satu posisi tepat dari tiga.
        ->and(RegistryTipeSoal::bobot(TipeSoal::UrutGambar, $konten, $kunci, ['u1', 'u2', 'u3']))->toBe(0.3333)
        ->and(RegistryTipeSoal::bobot(TipeSoal::UrutGambar, $konten, $kunci, ['u3', 'u2', 'u1']))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::UrutGambar, $konten, $kunci, []))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::UrutGambar, $konten, $kunci, null))->toBe(0.0);
});

it('menilai susun huruf dan menolak kata ber-spasi atau terlalu pendek', function (): void {
    $konten = ['petunjuk' => 'Nama hewan mengeong.'];
    $kunci = ['kata' => 'kucing'];

    expect(RegistryTipeSoal::validasi(TipeSoal::SusunHuruf, $konten, $kunci))->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::SusunHuruf, $konten, ['kata' => 'kucing oren']))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::SusunHuruf, $konten, ['kata' => 'a']))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::SusunHuruf, ['petunjuk' => ''], $kunci))->not->toBe([]);

    expect(RegistryTipeSoal::bobot(TipeSoal::SusunHuruf, $konten, $kunci, 'kucing'))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::SusunHuruf, $konten, $kunci, ' KUCING '))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::SusunHuruf, $konten, $kunci, 'kucinng'))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::SusunHuruf, $konten, $kunci, null))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::SusunHuruf, $konten, $kunci, ['k', 'u']))->toBe(0.0);
});

it('mengacak huruf susun secara stabil per seed dan bisa diuji', function (): void {
    $sekali = Pengacakan::urutHuruf('kucing', 777, 5);
    $duaKali = Pengacakan::urutHuruf('kucing', 777, 5);

    expect($sekali)->toBe($duaKali)
        ->and($sekali)->toHaveCount(6)
        ->and(implode('', $sekali))->not->toBe('kucing');

    $huruf = $sekali;
    sort($huruf);
    expect($huruf)->toBe(['c', 'g', 'i', 'k', 'n', 'u']);
});

it('menilai isian rumpang per lubang dan menolak penanda yang tidak berurutan', function (): void {
    $konten = ['teks' => 'Ibu kota Indonesia adalah {{1}} dan 6 x 7 = {{2}}.'];
    $kunci = ['lubang' => ['1' => ['Jakarta'], '2' => ['42', 'empat puluh dua']]];

    expect(RegistryTipeSoal::validasi(TipeSoal::IsianRumpang, $konten, $kunci))->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::IsianRumpang, ['teks' => 'Tanpa penanda.'], $kunci))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::IsianRumpang, ['teks' => '{{1}} lalu {{3}}.'], $kunci))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::IsianRumpang, $konten, ['lubang' => ['1' => ['Jakarta']]]))->not->toBe([]);

    expect(RegistryTipeSoal::bobot(TipeSoal::IsianRumpang, $konten, $kunci, ['1' => 'jakarta', '2' => '42']))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::IsianRumpang, $konten, $kunci, ['1' => ' Jakarta ', '2' => '41']))->toBe(0.5)
        ->and(RegistryTipeSoal::bobot(TipeSoal::IsianRumpang, $konten, $kunci, ['1' => 'Bandung', '2' => '41']))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::IsianRumpang, $konten, $kunci, []))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::IsianRumpang, $konten, $kunci, null))->toBe(0.0)
        ->and(RegistryTipeSoal::nilai(TipeSoal::IsianRumpang, $konten, $kunci, ['1' => 'jakarta', '2' => '42']))->toBeTrue();
});

it('menilai klasifikasi per item dan menolak item tanpa kotak', function (): void {
    $konten = [
        'teks' => 'Kelompokkan hewan.',
        'item' => [
            ['id' => 'i1', 'teks' => 'kucing'],
            ['id' => 'i2', 'teks' => 'ayam'],
            ['id' => 'i3', 'teks' => 'sapi'],
        ],
        'kotak' => [['id' => 'k1', 'label' => 'Mamalia'], ['id' => 'k2', 'label' => 'Unggas']],
    ];
    $kunci = ['peta' => ['i1' => 'k1', 'i2' => 'k2', 'i3' => 'k1']];

    expect(RegistryTipeSoal::validasi(TipeSoal::Klasifikasi, $konten, $kunci))->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::Klasifikasi, $konten, ['peta' => ['i1' => 'k1', 'i2' => 'k2']]))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::Klasifikasi, $konten, ['peta' => ['i1' => 'k9', 'i2' => 'k2', 'i3' => 'k1']]))->not->toBe([]);

    expect(RegistryTipeSoal::bobot(TipeSoal::Klasifikasi, $konten, $kunci, ['i1' => 'k1', 'i2' => 'k2', 'i3' => 'k1']))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::Klasifikasi, $konten, $kunci, ['i1' => 'k1', 'i2' => 'k1', 'i3' => 'k1']))->toBe(2 / 3)
        ->and(RegistryTipeSoal::bobot(TipeSoal::Klasifikasi, $konten, $kunci, []))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::Klasifikasi, $konten, $kunci, null))->toBe(0.0);
});

it('menilai tabel isian per sel dan menolak kode sel duplikat', function (): void {
    $konten = [
        'teks' => 'Isi tabel hasil perkalian.',
        'kolom' => ['Soal', 'Hasil'],
        'baris' => [
            ['id' => 'r1', 'sel' => [['kode' => 'r1c1', 'teks' => '3 x 4'], ['kode' => 'r1c2']]],
            ['id' => 'r2', 'sel' => [['kode' => 'r2c1', 'teks' => '5 x 5'], ['kode' => 'r2c2']]],
        ],
    ];
    $kunci = ['sel' => ['r1c2' => ['12'], 'r2c2' => ['25']]];

    expect(RegistryTipeSoal::validasi(TipeSoal::TabelIsian, $konten, $kunci))->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::TabelIsian, $konten, ['sel' => ['r1c2' => ['12']]]))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::TabelIsian, [
            'teks' => 'x',
            'kolom' => ['A'],
            'baris' => [['id' => 'r1', 'sel' => [['kode' => 's1'], ['kode' => 's1']]]],
        ], ['sel' => ['s1' => ['a']]]))->not->toBe([]);

    expect(RegistryTipeSoal::bobot(TipeSoal::TabelIsian, $konten, $kunci, ['r1c2' => '12', 'r2c2' => '25']))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::TabelIsian, $konten, $kunci, ['r1c2' => '12', 'r2c2' => '26']))->toBe(0.5)
        ->and(RegistryTipeSoal::bobot(TipeSoal::TabelIsian, $konten, $kunci, []))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::TabelIsian, $konten, $kunci, null))->toBe(0.0);
});

it('menilai garis bilangan dengan toleransi dan menolak rentang terbalik', function (): void {
    $konten = ['teks' => 'Tandai bilangan yang dimaksud.', 'min' => 0, 'max' => 10, 'langkah' => 1];
    $kunci = ['nilai' => 7, 'toleransi' => 0];

    expect(RegistryTipeSoal::validasi(TipeSoal::GarisBilangan, $konten, $kunci))->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::GarisBilangan, ['teks' => 'x', 'min' => 10, 'max' => 0, 'langkah' => 1], $kunci))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::GarisBilangan, ['teks' => 'x', 'min' => 0, 'max' => 10, 'langkah' => 0], $kunci))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::GarisBilangan, $konten, ['nilai' => 20, 'toleransi' => 0]))->not->toBe([]);

    expect(RegistryTipeSoal::bobot(TipeSoal::GarisBilangan, $konten, $kunci, 7))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::GarisBilangan, $konten, $kunci, '7'))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::GarisBilangan, $konten, $kunci, 8))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::GarisBilangan, $konten, ['nilai' => 6.5, 'toleransi' => 0.5], '6,5'))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::GarisBilangan, $konten, $kunci, null))->toBe(0.0);
});

it('menilai hotspot gambar dari titik yang diketuk murid', function (): void {
    $konten = [
        'teks' => 'Ketuk lingkaran.',
        'media' => '/media/bentuk.png',
        'area' => [
            ['id' => 'a1', 'x' => 0.0, 'y' => 0.0, 'w' => 0.3, 'h' => 0.3],
            ['id' => 'a2', 'x' => 0.5, 'y' => 0.5, 'w' => 0.2, 'h' => 0.2],
        ],
    ];
    $kunci = ['area_benar' => ['a2']];

    expect(RegistryTipeSoal::validasi(TipeSoal::HotspotGambar, $konten, $kunci))->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::HotspotGambar, ['teks' => 'x', 'area' => $konten['area']], $kunci))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::HotspotGambar, $konten, ['area_benar' => ['a9']]))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::HotspotGambar, [
            'teks' => 'x',
            'media' => '/media/a.png',
            'area' => [['id' => 'a1', 'x' => 0.9, 'y' => 0.0, 'w' => 0.3, 'h' => 0.3]],
        ], ['area_benar' => ['a1']]))->not->toBe([]);

    // Titik di dalam area benar = 1.0; di luar (termasuk area yang salah) = 0.0.
    expect(RegistryTipeSoal::bobot(TipeSoal::HotspotGambar, $konten, $kunci, ['x' => 0.6, 'y' => 0.6]))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::HotspotGambar, $konten, $kunci, ['x' => 0.1, 'y' => 0.1]))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::HotspotGambar, $konten, $kunci, null))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::HotspotGambar, $konten, $kunci, ['x' => 2, 'y' => 2]))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::HotspotGambar, $konten, $kunci, ['x' => 'a', 'y' => 0.6]))->toBe(0.0)
        ->and(RegistryTipeSoal::nilai(TipeSoal::HotspotGambar, $konten, $kunci, ['x' => 0.55, 'y' => 0.55]))->toBeTrue();
});

it('menilai baca jam persis dan menolak kunci di luar rentang', function (): void {
    $konten = ['teks' => 'Tunjukkan pukul setengah delapan.'];
    $kunci = ['jam' => 7, 'menit' => 30];

    expect(RegistryTipeSoal::validasi(TipeSoal::BacaJam, $konten, $kunci))->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::BacaJam, $konten, ['jam' => 12, 'menit' => 30]))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::BacaJam, $konten, ['jam' => 7, 'menit' => 60]))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::BacaJam, ['teks' => ''], $kunci))->not->toBe([]);

    expect(RegistryTipeSoal::bobot(TipeSoal::BacaJam, $konten, $kunci, ['jam' => 7, 'menit' => 30]))->toBe(1.0)
        // "07" dari input teks tetap dibaca sebagai 7.
        ->and(RegistryTipeSoal::bobot(TipeSoal::BacaJam, $konten, $kunci, ['jam' => '07', 'menit' => '30']))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::BacaJam, $konten, $kunci, ['jam' => 7, 'menit' => 0]))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::BacaJam, $konten, $kunci, ['jam' => 19, 'menit' => 30]))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::BacaJam, $konten, $kunci, null))->toBe(0.0);
});

it('menjadikan tugas unggah soal non-objektif yang menunggu guru', function (): void {
    $konten = ['teks' => 'Unggah foto pekerjaanmu.', 'jenis_berkas' => 'Foto JPG atau PNG'];
    $kunci = ['rubrik' => [['butir' => 'Langkah lengkap', 'poin' => 3], ['butir' => 'Hasil benar', 'poin' => 2]]];

    expect(TipeSoal::TugasUnggah->objektif())->toBeFalse()
        ->and(TipeSoal::TugasUnggah->bertingkat())->toBeTrue()
        ->and(RegistryTipeSoal::validasi(TipeSoal::TugasUnggah, $konten, $kunci))->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::TugasUnggah, ['teks' => 'x', 'jenis_berkas' => ''], $kunci))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::TugasUnggah, $konten, ['rubrik' => []]))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::TugasUnggah, $konten, ['rubrik' => [['butir' => 'x', 'poin' => 0]]]))->not->toBe([])
        ->and(RegistryTipeSoal::bobot(TipeSoal::TugasUnggah, $konten, $kunci, 'jawaban apa pun'))->toBe(0.0)
        ->and(RegistryTipeSoal::nilai(TipeSoal::TugasUnggah, $konten, $kunci, 'jawaban apa pun'))->toBeFalse();

    // Tanpa jalur khusus, jawaban berupa teks (mis. path berkas) bisa dicocokkan
    // PenilaianTeks dan murid mendapat 0 padahal belum dinilai guru.
    $soal = new Soal;
    $soal->forceFill([
        'school_id' => 1,
        'subject_id' => 1,
        'tipe' => 'tugas_unggah',
        'konten' => $konten,
        'kunci' => $kunci,
        'skor' => 5,
    ]);

    $hasil = app(PenilaiSoal::class)->nilai($soal, 'attempt/1/jawaban/lampiran.jpg');

    expect($hasil['status'])->toBe(StatusPenilaian::PerluTinjau)
        ->and($hasil['benar'])->toBeNull()
        ->and($hasil['skor'])->toBe(0.0);
});

it('menilai teka silang mini per kata dan menolak bentuk tak sah', function (): void {
    $konten = [
        'grid' => [
            ['', '', ''],
            ['#', '', '#'],
        ],
        'mendatar' => [['nomor' => 1, 'teks' => 'Nama hewan mengeong.', 'sel' => ['0,0', '0,1', '0,2']]],
        'menurun' => [['nomor' => 2, 'teks' => 'Di tengah baris kedua.', 'sel' => ['0,1', '1,1']]],
    ];
    $kunci = ['sel' => ['0,0' => 'k', '0,1' => 'a', '0,2' => 't', '1,1' => 'i']];

    expect(RegistryTipeSoal::validasi(TipeSoal::TekaSilangMini, $konten, $kunci))->toBe([])
        // Tanpa satu huruf pun, kotak kosong belum bisa dinilai.
        ->and(RegistryTipeSoal::validasi(TipeSoal::TekaSilangMini, $konten, ['sel' => ['0,0' => 'k']]))->not->toBe([])
        // Kotak hitam tidak boleh punya huruf.
        ->and(RegistryTipeSoal::validasi(TipeSoal::TekaSilangMini, $konten, ['sel' => [...$kunci['sel'], '1,0' => 'x']]))->not->toBe([])
        // Kata mendatar wajib satu baris dan berurutan.
        ->and(RegistryTipeSoal::validasi(TipeSoal::TekaSilangMini, [
            ...$konten,
            'mendatar' => [['nomor' => 1, 'teks' => 'x', 'sel' => ['0,0', '0,2']]],
        ], $kunci))->not->toBe([])
        ->and(RegistryTipeSoal::validasi(TipeSoal::TekaSilangMini, [
            'grid' => [['', ''], ['', 'x']],
            'mendatar' => [],
            'menurun' => [],
        ], $kunci))->not->toBe([]);

    // Dua kata dinilai: satu benar (mendatar) = 0.5.
    expect(RegistryTipeSoal::bobot(TipeSoal::TekaSilangMini, $konten, $kunci, ['0,0' => 'k', '0,1' => 'a', '0,2' => 't', '1,1' => 'u']))->toBe(0.5)
        ->and(RegistryTipeSoal::bobot(TipeSoal::TekaSilangMini, $konten, $kunci, ['0,0' => 'K', '0,1' => 'A', '0,2' => 'T', '1,1' => 'i']))->toBe(1.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::TekaSilangMini, $konten, $kunci, []))->toBe(0.0)
        ->and(RegistryTipeSoal::bobot(TipeSoal::TekaSilangMini, $konten, $kunci, null))->toBe(0.0)
        ->and(RegistryTipeSoal::nilai(TipeSoal::TekaSilangMini, $konten, $kunci, ['0,0' => 'k']))->toBeFalse();
});

it('payload murid gelombang 3 tidak memuat kunci dan menjaga bentuk papan', function (): void {
    $muatan = muatan11([
        [
            'id' => 31,
            'tipe' => 'hotspot_gambar',
            'konten' => [
                'teks' => 'Ketuk lingkaran.',
                'media' => '/media/bentuk.png',
                'area' => [['id' => 'a1', 'x' => 0.1, 'y' => 0.1, 'w' => 0.2, 'h' => 0.2]],
            ],
            'kunci' => ['area_benar' => ['a1']],
            'skor' => 4,
        ],
        [
            'id' => 32,
            'tipe' => 'tugas_unggah',
            'konten' => ['teks' => 'Unggah fotonya.', 'jenis_berkas' => 'Foto JPG'],
            'kunci' => ['rubrik' => [['butir' => 'Rapi', 'poin' => 1]]],
            'skor' => 4,
        ],
        [
            'id' => 33,
            'tipe' => 'teka_silang_mini',
            'konten' => [
                'grid' => [['', '', ''], ['#', '', '#']],
                'mendatar' => [['nomor' => 1, 'teks' => 'Nama hewan mengeong.', 'sel' => ['0,0', '0,1', '0,2']]],
                'menurun' => [['nomor' => 2, 'teks' => 'Tengah baris kedua.', 'sel' => ['0,1', '1,1']]],
            ],
            'kunci' => ['sel' => ['0,0' => 'k', '0,1' => 'a', '0,2' => 't', '1,1' => 'i']],
            'skor' => 4,
        ],
    ], acakOpsi: true);

    // Hotspot: gambar + kotak yang bisa diketuk, tanpa penanda mana yang benar.
    expect($muatan[0]['konten']['media'])->toBe('/media/bentuk.png')
        ->and($muatan[0]['konten']['area'])->toHaveCount(1)
        ->and($muatan[0]['konten'])->not->toHaveKey('area_benar')
        ->and($muatan[0]['konten'])->not->toHaveKey('kunci');

    // Tugas unggah: jenis berkas ikut, rubrik tidak.
    expect($muatan[1]['konten']['jenis_berkas'])->toBe('Foto JPG')
        ->and($muatan[1]['konten'])->not->toHaveKey('rubrik');

    // Teka silang: bentuk papan tetap urut dan huruf jawaban tidak ikut.
    expect($muatan[2]['konten']['grid'])->toBe([['', '', ''], ['#', '', '#']])
        ->and($muatan[2]['konten']['mendatar'])->toHaveCount(1)
        ->and($muatan[2]['konten']['menurun'])->toHaveCount(1)
        ->and($muatan[2]['konten'])->not->toHaveKey('sel');
});

it('payload murid tidak memuat kunci dan menyembunyikan huruf kata', function (): void {
    $muatan = muatan11([
        [
            'id' => 1,
            'tipe' => 'susun_huruf',
            'konten' => ['petunjuk' => 'Nama hewan mengeong.'],
            'kunci' => ['kata' => 'kucing'],
            'skor' => 5,
        ],
        [
            'id' => 2,
            'tipe' => 'isian_angka',
            'konten' => ['teks' => 'Berapa 12 + 9?', 'satuan' => 'cm'],
            'kunci' => ['nilai' => 21, 'toleransi' => 0],
            'skor' => 5,
        ],
        [
            'id' => 3,
            'tipe' => 'pilihan_gambar',
            'konten' => [
                'teks' => 'Pilih lingkaran.',
                'opsi' => [['id' => 'g1', 'media' => '/media/a.png'], ['id' => 'g2', 'media' => '/media/b.png']],
            ],
            'kunci' => ['benar' => 'g1'],
            'skor' => 5,
        ],
    ]);

    expect($muatan)->toHaveCount(3);

    // Tidak ada nilai penentu jawaban yang bocor ke konten murid.
    foreach ($muatan as $soal) {
        foreach (['kunci', 'kata', 'nilai', 'toleransi', 'benar', 'urutan', 'jawaban'] as $kunciTerlarang) {
            expect($soal['konten'])->not->toHaveKey($kunciTerlarang);
        }
    }

    // Susun huruf: hanya petunjuk + huruf teracak yang dikirim.
    expect($muatan[0]['konten']['petunjuk'])->toBe('Nama hewan mengeong.')
        ->and($muatan[0]['konten']['huruf'])->toHaveCount(6)
        ->and(implode('', $muatan[0]['konten']['huruf']))->not->toBe('kucing');

    // Isian angka: satuan ikut, kunci tidak.
    expect($muatan[1]['konten']['satuan'])->toBe('cm');

    // Pilihan gambar: daftar gambar dikirim, id kunci tidak ditandai.
    expect($muatan[2]['konten']['opsi'])->toHaveCount(2);
});

it('payload tipe gelombang 2 membawa data yang dibutuhkan tanpa kunci', function (): void {
    $muatan = muatan11([
        [
            'id' => 12,
            'tipe' => 'tabel_isian',
            'konten' => [
                'teks' => 'Isi tabel.',
                'kolom' => ['Soal', 'Hasil'],
                'baris' => [
                    ['id' => 'r1', 'sel' => [['kode' => 'r1c1', 'teks' => '3 x 4'], ['kode' => 'r1c2']]],
                ],
            ],
            'kunci' => ['sel' => ['r1c2' => ['12']]],
            'skor' => 4,
        ],
        [
            'id' => 13,
            'tipe' => 'garis_bilangan',
            'konten' => ['teks' => 'Tandai.', 'min' => 0, 'max' => 10, 'langkah' => 1],
            'kunci' => ['nilai' => 7, 'toleransi' => 0],
            'skor' => 4,
        ],
        [
            'id' => 14,
            'tipe' => 'klasifikasi',
            'konten' => [
                'teks' => 'Kelompokkan.',
                'item' => [['id' => 'i1', 'teks' => 'kucing'], ['id' => 'i2', 'teks' => 'ayam']],
                'kotak' => [['id' => 'k1', 'label' => 'Mamalia'], ['id' => 'k2', 'label' => 'Unggas']],
            ],
            'kunci' => ['peta' => ['i1' => 'k1', 'i2' => 'k2']],
            'skor' => 4,
        ],
    ]);

    expect($muatan[0]['konten']['kolom'])->toBe(['Soal', 'Hasil'])
        ->and($muatan[0]['konten']['baris'])->toHaveCount(1)
        ->and($muatan[1]['konten']['min'])->toBe(0)
        ->and($muatan[1]['konten']['max'])->toBe(10)
        ->and($muatan[1]['konten']['langkah'])->toBe(1)
        ->and($muatan[2]['konten']['kotak'])->toHaveCount(2)
        ->and($muatan[2]['konten']['item'])->toHaveCount(2);

    foreach ($muatan as $soal) {
        expect($soal['konten'])->not->toHaveKey('kunci')
            ->and($soal['konten'])->not->toHaveKey('nilai')
            ->and($soal['konten'])->not->toHaveKey('peta')
            ->and($soal['konten'])->not->toHaveKey('sel');
    }
});
