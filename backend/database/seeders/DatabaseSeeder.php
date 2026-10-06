<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed data dasar: role + admin, sekolah, lalu data induk contoh.
     */
    public function run(): void
    {
        $this->call([
            RolesAndAdminSeeder::class,
            SekolahSeeder::class,
            MasterDataSeeder::class,
            BankSoalSeeder::class,
        ]);
    }
}
