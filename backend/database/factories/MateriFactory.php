<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Sections\Material\Enums\StatusMateri;
use App\Sections\Material\Models\Materi;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Materi>
 */
class MateriFactory extends Factory
{
    protected $model = Materi::class;

    public function definition(): array
    {
        return [
            'school_id' => Sekolah::factory(),
            'subject_id' => Mapel::factory(),
            'class_id' => Kelas::factory(),
            'tag_id' => null,
            'judul' => 'Materi '.fake()->unique()->numberBetween(1, 99999),
            'deskripsi' => null,
            'status' => StatusMateri::Draf,
            'urutan' => 0,
            'publikasi_at' => null,
            'dibuat_oleh' => null,
        ];
    }

    /** Materi untuk sekolah + mapel + kelas tertentu (dipakai test). */
    public function untukSekolah(Sekolah $sekolah, ?Mapel $mapel = null, ?Kelas $kelas = null): static
    {
        return $this->state(fn () => [
            'school_id' => $sekolah->getKey(),
            'subject_id' => $mapel?->getKey() ?? Mapel::factory()->state(['school_id' => $sekolah->getKey()]),
            'class_id' => $kelas?->getKey() ?? Kelas::factory()->state(['school_id' => $sekolah->getKey()]),
        ]);
    }

    /** Materi yang sudah terbit. */
    public function terbit(): static
    {
        return $this->state(fn () => [
            'status' => StatusMateri::Publikasi,
            'publikasi_at' => now()->subHour(),
        ]);
    }
}
