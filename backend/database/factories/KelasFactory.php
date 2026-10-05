<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Kelas>
 */
class KelasFactory extends Factory
{
    protected $model = Kelas::class;

    public function definition(): array
    {
        return [
            'school_id' => Sekolah::factory(),
            'nama' => 'Kelas '.fake()->unique()->numberBetween(1, 99999),
            'tingkat' => fake()->numberBetween(1, 6),
            'tahun_ajaran' => '2026/2027',
        ];
    }

    /** Kelas untuk sekolah tertentu (dipakai test). */
    public function untukSekolah(Sekolah $sekolah): static
    {
        return $this->state(fn () => ['school_id' => $sekolah->getKey()]);
    }
}
