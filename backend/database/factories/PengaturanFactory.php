<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Enums\LingkupPengaturan;
use App\Sections\Settings\Models\Pengaturan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Pengaturan>
 */
class PengaturanFactory extends Factory
{
    protected $model = Pengaturan::class;

    public function definition(): array
    {
        return [
            'lingkup' => LingkupPengaturan::Sekolah->value,
            'lingkup_id' => 1,
            'kunci' => KunciPengaturan::Retry->value,
            'nilai' => false,
            'terkunci' => false,
        ];
    }
}
