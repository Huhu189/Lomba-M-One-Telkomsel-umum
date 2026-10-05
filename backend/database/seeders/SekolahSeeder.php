<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Seeder;

class SekolahSeeder extends Seeder
{
    /**
     * Satu instalasi = satu sekolah (idempoten).
     */
    public function run(): void
    {
        if (Sekolah::query()->exists()) {
            return;
        }

        Sekolah::query()->create([
            'nama' => 'SD Negeri Harapan Bangsa',
            'npsn' => '20512345',
            'alamat' => 'Jl. Pendidikan No. 10, Bandung',
            'kepala_sekolah' => 'Dra. Siti Aminah',
            'tahun_ajaran' => '2026/2027',
        ]);
    }
}
