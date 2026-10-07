<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Sections\Avatar\Enums\AlasanLaporan;
use App\Sections\Avatar\Models\Avatar;
use App\Sections\Avatar\Models\LaporanAvatar;
use App\Sections\Cheat\Enums\StatusTinjauan;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LaporanAvatar>
 */
class LaporanAvatarFactory extends Factory
{
    protected $model = LaporanAvatar::class;

    public function definition(): array
    {
        return [
            'avatar_id' => Avatar::factory(),
            'reporter_id' => Murid::factory(),
            'school_id' => Sekolah::factory(),
            'alasan' => AlasanLaporan::TidakPantas,
            'keterangan' => null,
            'review_status' => StatusTinjauan::Menunggu,
            'reviewed_by' => null,
            'reviewed_at' => null,
        ];
    }

    /** Laporan oleh pelapor tertentu atas avatar tertentu (school_id ikut avatar). */
    public function untuk(Avatar $avatar, Murid $pelapor): static
    {
        return $this->state(fn () => [
            'avatar_id' => $avatar->getKey(),
            'reporter_id' => $pelapor->getKey(),
            'school_id' => $avatar->school_id,
        ]);
    }
}
