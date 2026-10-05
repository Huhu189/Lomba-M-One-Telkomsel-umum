<?php

declare(strict_types=1);

namespace App\Sections\School\Policies;

use App\Models\User;
use App\Sections\School\Models\Kelas;

/**
 * Kelas: murid hanya baca; guru/admin boleh mengubah.
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
        return $user->isGuru();
    }

    public function update(User $user, Kelas $kelas): bool
    {
        return $user->isGuru();
    }

    public function delete(User $user, Kelas $kelas): bool
    {
        return $user->isGuru();
    }
}
