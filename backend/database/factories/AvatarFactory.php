<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Sections\Avatar\Enums\StatusAvatar;
use App\Sections\Avatar\Models\Avatar;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Avatar>
 */
class AvatarFactory extends Factory
{
    protected $model = Avatar::class;

    public function definition(): array
    {
        $kode = Str::random(32);

        return [
            'school_id' => Sekolah::factory(),
            'student_id' => Murid::factory(),
            'kode' => $kode,
            'path' => 'avatar/uji/'.$kode.'.jpg',
            'mime' => 'image/jpeg',
            'ukuran' => 1024,
            'lebar' => 256,
            'tinggi' => 256,
            'hash' => hash('sha256', $kode),
            'status' => StatusAvatar::Aktif,
            'jumlah_laporan' => 0,
            'disembunyikan_at' => null,
        ];
    }

    /** Avatar milik murid tertentu (school_id ikut muridnya). */
    public function untukMurid(Murid $murid): static
    {
        return $this->state(fn () => [
            'school_id' => $murid->school_id,
            'student_id' => $murid->getKey(),
        ]);
    }

    /** Avatar yang sudah disembunyikan karena laporan. */
    public function disembunyikan(): static
    {
        return $this->state(fn () => [
            'status' => StatusAvatar::Disembunyikan,
            'disembunyikan_at' => now(),
        ]);
    }
}
