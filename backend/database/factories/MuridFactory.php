<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\User;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Murid>
 */
class MuridFactory extends Factory
{
    protected $model = Murid::class;

    public function definition(): array
    {
        return [
            'school_id' => Sekolah::factory(),
            'class_id' => Kelas::factory(),
            'user_id' => User::factory()->muridAktif(),
            'nis' => fake()->unique()->numerify('######'),
            'nisn' => fake()->unique()->numerify('##########'),
        ];
    }

    /** Murid di sekolah dan kelas tertentu dengan akun yang sudah ada. */
    public function untuk(Sekolah $sekolah, Kelas $kelas, User $user): static
    {
        return $this->state(fn () => [
            'school_id' => $sekolah->getKey(),
            'class_id' => $kelas->getKey(),
            'user_id' => $user->getKey(),
        ]);
    }
}
