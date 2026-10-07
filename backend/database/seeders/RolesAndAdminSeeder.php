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
     * Role dasar + satu akun admin awal.
     * Guru/admin TIDAK bisa self-register (chunk security); akun dibuat lewat seeder/impor.
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
            ['email' => 'aadmin@sekolah.test'],
            [
                'name' => 'Guru Sekolah',
                'password' => 'qawsedrftg',
                'status' => UserStatus::Aktif->value,
                'email_verified_at' => now(),
                'role' => 'guru',
            ],
        );
        $admin->assignRole('admin');
        $guru->assignRole('guru');
    }
}
