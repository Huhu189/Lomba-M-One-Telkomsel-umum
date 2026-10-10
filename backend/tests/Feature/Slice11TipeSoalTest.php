<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Services\AttemptService;
use App\Sections\Attempt\Services\Pengacakan;
use App\Sections\Question\Enums\TipeSoal;
use App\Sections\Question\Registry\RegistryTipeSoal;

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

it('mengenal enam tipe baru gelombang 1 dan menilainya sebagai objektif', function (): void {
    $tipe = [
        TipeSoal::PilihanGandaKompleks,
        TipeSoal::BenarSalahMajemuk,
        TipeSoal::IsianAngka,
        TipeSoal::PilihanGambar,
        TipeSoal::UrutGambar,
        TipeSoal::SusunHuruf,
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
