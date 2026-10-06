<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Sections\Question\Enums\TipeSoal;
use App\Sections\Question\Models\Soal;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Soal>
 */
class SoalFactory extends Factory
{
    protected $model = Soal::class;

    public function definition(): array
    {
        return [
            'school_id' => Sekolah::factory(),
            'subject_id' => Mapel::factory(),
            'tag_id' => null,
            'tipe' => TipeSoal::PilihanGanda,
            'konten' => [
                'teks' => 'Berapa hasil dari 2 + 3?',
                'opsi' => [
                    ['id' => 'A', 'teks' => '4'],
                    ['id' => 'B', 'teks' => '5'],
                    ['id' => 'C', 'teks' => '6'],
                ],
            ],
            'kunci' => ['jawaban' => 'B'],
            'pembahasan' => null,
            'skor' => 1,
            'aktif' => true,
            'dibuat_oleh' => null,
        ];
    }

    /** Soal untuk sekolah + mapel tertentu (dipakai test). */
    public function untukSekolah(Sekolah $sekolah, ?Mapel $mapel = null): static
    {
        return $this->state(fn () => [
            'school_id' => $sekolah->getKey(),
            'subject_id' => $mapel?->getKey() ?? Mapel::factory()->state(['school_id' => $sekolah->getKey()]),
        ]);
    }

    /**
     * Soal benar/salah valid.
     */
    public function benarSalah(): static
    {
        return $this->state(fn () => [
            'tipe' => TipeSoal::BenarSalah,
            'konten' => ['teks' => 'Air membeku pada suhu 0 derajat Celsius.'],
            'kunci' => ['benar' => true],
        ]);
    }

    /**
     * Soal menjodohkan valid.
     */
    public function menjodohkan(): static
    {
        return $this->state(fn () => [
            'tipe' => TipeSoal::Menjodohkan,
            'konten' => [
                'teks' => 'Jodohkan hewan dengan makanannya.',
                'kiri' => [
                    ['id' => 'k1', 'teks' => 'Sapi'],
                    ['id' => 'k2', 'teks' => 'Ayam'],
                ],
                'kanan' => [
                    ['id' => 'n1', 'teks' => 'Rumput'],
                    ['id' => 'n2', 'teks' => 'Biji-bijian'],
                ],
            ],
            'kunci' => ['pasangan' => ['k1' => 'n1', 'k2' => 'n2']],
        ]);
    }

    /**
     * Soal mengurutkan valid.
     */
    public function mengurutkan(): static
    {
        return $this->state(fn () => [
            'tipe' => TipeSoal::Mengurutkan,
            'konten' => [
                'teks' => 'Urutkan dari yang terkecil.',
                'item' => [
                    ['id' => 'i1', 'teks' => '1'],
                    ['id' => 'i2', 'teks' => '2'],
                    ['id' => 'i3', 'teks' => '3'],
                ],
            ],
            'kunci' => ['urutan' => ['i1', 'i2', 'i3']],
        ]);
    }
}
