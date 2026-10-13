<?php

declare(strict_types=1);

namespace App\Sections\School\Policies;

use App\Models\User;
use App\Sections\School\Models\Kelas;

/**
 * Kelas: murid hanya baca; **guru** yang mengubah.
 *
 * Kepala sekolah (peran `admin`) hanya melihat — lihat `User::bolehMengubahAkademik()`.
 */
class KelasPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Kelas $kelas): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->bolehMengubahAkademik();
    }

    public function update(User $user, Kelas $kelas): bool
    {
        return $user->bolehMengubahAkademik();
    }

    public function delete(User $user, Kelas $kelas): bool
    {
        return $user->bolehMengubahAkademik();
    }
}
