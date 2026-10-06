<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Sections\Question\Models\Tag;
use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Tag>
 */
class TagFactory extends Factory
{
    protected $model = Tag::class;

    public function definition(): array
    {
        return [
            'school_id' => Sekolah::factory(),
            'nama' => 'Tema '.fake()->unique()->numberBetween(1, 99999),
            'deskripsi' => null,
        ];
    }

    /** Tag untuk sekolah tertentu (dipakai test). */
    public function untukSekolah(Sekolah $sekolah): static
    {
        return $this->state(fn () => ['school_id' => $sekolah->getKey()]);
    }
}
