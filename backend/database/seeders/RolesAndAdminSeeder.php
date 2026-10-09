<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class RolesAndAdminSeeder extends Seeder
{
    /**
     * Role dasar + satu akun admin dan dua akun guru awal.
     * Guru/admin TIDAK bisa self-register (chunk security); akun dibuat lewat seeder/impor.
     * Guru kedua diperlukan supaya uji kepemilikan (guru lain menolak mengubah milik
     * orang lain) bisa dijalankan di basis data yang baru di-seed.
     */
    public function run(): void
    {
        foreach (['admin', 'guru', 'murid'] as $nama) {
            Role::findOrCreate($nama, 'web');
        }

        $admin = User::query()->firstOrCreate(
            ['email' => 'admin@sekolah.test'],
            [
                'name' => 'Admin Sekolah',
                'password' => Hash::make('Passw0rd!Aman', ['memory_cost' => 1024]),
                'status' => UserStatus::Aktif->value,
                'email_verified_at' => now(),
                'role' => 'admin',
            ],
        );

        $guru = User::query()->firstOrCreate(
            ['email' => 'guru1@gmail.com'],
            [
                'name' => 'Guru Sekolah',
                'password' => 'password12',
                'status' => UserStatus::Aktif->value,
                'email_verified_at' => now(),
                'role' => 'guru',
            ],
        );
        $guruDua = User::query()->firstOrCreate(
            ['email' => 'guru2@sekolah.test'],
            [
                'name' => 'Guru Kedua',
                'password' => 'password12',
                'status' => UserStatus::Aktif->value,
                'email_verified_at' => now(),
                'role' => 'guru',
            ],
        );

        $admin->assignRole('admin');
        $guru->assignRole('guru');
        $guruDua->assignRole('guru');
    }
}
