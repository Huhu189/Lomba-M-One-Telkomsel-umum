<?php

declare(strict_types=1);

namespace App\Sections\School\Services;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use App\Sections\School\Models\Murid;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

/**
 * Kelola murid tunggal (di luar impor massal).
 */
class MuridService
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function tambah(int $sekolahId, array $data): Murid
    {
        return DB::transaction(function () use ($sekolahId, $data): Murid {
            $user = User::query()->create([
                'name' => $data['nama'],
                'email' => mb_strtolower((string) $data['email']),
                'password' => Hash::make($data['kata_sandi'] ?? Str::password(16)),
                'status' => UserStatus::Aktif->value,
                'role' => 'murid',
            ]);
            // email_verified_at tidak mass-assignable; guru yang membuat = terverifikasi.
            $user->forceFill(['email_verified_at' => now()])->save();
            $user->assignRole(Role::findOrCreate('murid', 'web'));

            $murid = Murid::query()->create([
                'school_id' => $sekolahId,
                'class_id' => (int) $data['class_id'],
                'user_id' => $user->getKey(),
                'nis' => $data['nis'] ?? null,
                'nisn' => $data['nisn'] ?? null,
            ]);

            return $murid->load(['user', 'kelas']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function ubah(Murid $murid, array $data): Murid
    {
        return DB::transaction(function () use ($murid, $data): Murid {
            $user = User::query()->findOrFail($murid->user_id);
            $user->forceFill(['name' => $data['nama']])->save();

            $murid->fill([
                'class_id' => (int) $data['class_id'],
                'nis' => $data['nis'] ?? null,
                'nisn' => $data['nisn'] ?? null,
            ])->save();

            return $murid->refresh()->load(['user', 'kelas']);
        });
    }

    public function hapus(Murid $murid): void
    {
        DB::transaction(function () use ($murid): void {
            $murid->delete();
            User::query()->whereKey($murid->user_id)->delete();
        });
    }
}
