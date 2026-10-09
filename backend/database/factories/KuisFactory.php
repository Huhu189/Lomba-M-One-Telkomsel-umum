<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\User;
use App\Sections\Quiz\Enums\StatusKuis;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Kuis>
 */
class KuisFactory extends Factory
{
    protected $model = Kuis::class;

    public function definition(): array
    {
        return [
            'school_id' => Sekolah::factory(),
            'subject_id' => Mapel::factory(),
            'class_id' => Kelas::factory(),
            'judul' => 'Kuis '.fake()->unique()->numberBetween(1, 99999),
            'deskripsi' => null,
            'status' => StatusKuis::Draf,
            'mulai_at' => null,
            'selesai_at' => null,
            'durasi_menit' => 30,
            'acak_soal' => true,
            'acak_opsi' => true,
            'publikasi_at' => null,
            'dibuat_oleh' => null,
        ];
    }

    /** Kuis untuk sekolah + mapel + kelas tertentu (dipakai test). */
    public function untukSekolah(Sekolah $sekolah, ?Mapel $mapel = null, ?Kelas $kelas = null): static
    {
        return $this->state(fn () => [
            'school_id' => $sekolah->getKey(),
            'subject_id' => $mapel?->getKey() ?? Mapel::factory()->state(['school_id' => $sekolah->getKey()]),
            'class_id' => $kelas?->getKey() ?? Kelas::factory()->state(['school_id' => $sekolah->getKey()]),
        ]);
    }

    /**
     * Kuis milik guru tertentu.
     *
     * Sejak K-04 batas baca ikut kepemilikan, jadi fixture uji yang dibuat tanpa
     * pemilik akan ditolak 403 saat diakses guru — bukan karena bug, tapi karena
     * memang bukan milik siapa-siapa. Test yang menguji satu guru cukup memakai
     * state ini dengan guru yang sedang masuk.
     */
    public function milik(User $guru): static
    {
        return $this->state(fn (): array => ['dibuat_oleh' => $guru->getKey()]);
    }

    /** Kuis terbit dan sedang berjalan (mulai tadi, selesai nanti). */
    public function berjalan(): static
    {
        return $this->state(fn () => [
            'status' => StatusKuis::Publikasi,
            'mulai_at' => now()->subMinutes(10),
            'selesai_at' => now()->addHour(),
            'publikasi_at' => now()->subHour(),
        ]);
    }
}
