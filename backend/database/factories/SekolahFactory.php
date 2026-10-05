<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Sekolah>
 */
class SekolahFactory extends Factory
{
    protected $model = Sekolah::class;

    public function definition(): array
    {
        return [
            'nama' => 'SD Negeri '.fake()->unique()->numberBetween(1, 9999),
            'npsn' => fake()->unique()->numerify('########'),
            'alamat' => 'Jl. Pendidikan No. '.fake()->numberBetween(1, 200),
            'kepala_sekolah' => fake()->name(),
            'tahun_ajaran' => '2026/2027',
        ];
    }
}
