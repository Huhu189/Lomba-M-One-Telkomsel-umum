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
     * Sandi bawaan akun demo. Hanya dipakai di luar produksi — di produksi
     * seeder ini berhenti sebelum membuat akun apa pun (K-01).
     */
    public const SANDI_DEMO_ADMIN = 'Passw0rd!Aman';

    public const SANDI_DEMO_GURU = 'password12';

    /**
     * Role dasar + satu akun admin dan dua akun guru awal.
     * Guru/admin TIDAK bisa self-register (chunk security); akun dibuat lewat seeder/impor.
     * Guru kedua diperlukan supaya uji kepemilikan (guru lain menolak mengubah milik
     * orang lain) bisa dijalankan di basis data yang baru di-seed.
     *
     * Akun di sini memakai sandi yang tertulis di repo (untuk demo dan uji), jadi
     * seeder ini menolak jalan di produksi: `db:seed` di server tidak boleh
     * menyalakan akun admin dengan sandi yang diketahui publik (K-01). Sandi tetap
     * bisa ditimpa lewat `SEEDER_SANDI_ADMIN` / `SEEDER_SANDI_GURU`.
     */
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn(
                'RolesAndAdminSeeder dilewati: akun demo tidak dibuat di produksi. '
                .'Buat admin lewat perintah/seed khusus dengan sandi dari env (K-01).',
            );

            return;
        }

        foreach (['admin', 'guru', 'murid'] as $nama) {
            Role::findOrCreate($nama, 'web');
        }

        $sandiAdmin = (string) env('SEEDER_SANDI_ADMIN', self::SANDI_DEMO_ADMIN);
        $sandiGuru = (string) env('SEEDER_SANDI_GURU', self::SANDI_DEMO_GURU);

        $admin = User::query()->firstOrCreate(
            ['email' => 'admin@sekolah.test'],
            [
                'name' => 'Admin Sekolah',
                'password' => Hash::make($sandiAdmin, ['memory_cost' => 1024]),
                'status' => UserStatus::Aktif->value,
                'email_verified_at' => now(),
                'role' => 'admin',
            ],
        );

        $guru = User::query()->firstOrCreate(
            ['email' => 'guru1@sekolah.test'],
            [
                'name' => 'Guru Sekolah',
                'password' => $sandiGuru,
                'status' => UserStatus::Aktif->value,
                'email_verified_at' => now(),
                'role' => 'guru',
            ],
        );
        $guruDua = User::query()->firstOrCreate(
            ['email' => 'guru2@sekolah.test'],
            [
                'name' => 'Guru Kedua',
                'password' => $sandiGuru,
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
