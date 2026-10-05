<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Mapel>
 */
class MapelFactory extends Factory
{
    protected $model = Mapel::class;

    public function definition(): array
    {
        return [
            'school_id' => Sekolah::factory(),
            'nama' => 'Mapel '.fake()->unique()->numberBetween(1, 99999),
            'kode' => strtoupper(fake()->unique()->bothify('???')),
        ];
    }

    /** Mapel untuk sekolah tertentu (dipakai test). */
    public function untukSekolah(Sekolah $sekolah): static
    {
        return $this->state(fn () => ['school_id' => $sekolah->getKey()]);
    }
}
