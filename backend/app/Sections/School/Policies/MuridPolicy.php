<?php

declare(strict_types=1);

namespace App\Sections\School\Policies;

use App\Models\User;
use App\Sections\School\Models\Murid;

/**
 * Murid: murid hanya baca; guru/admin boleh mengelola dan mengimpor.
 */
class MuridPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Murid $murid): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->isGuru();
    }

    public function update(User $user, Murid $murid): bool
    {
        return $user->isGuru();
    }

    public function delete(User $user, Murid $murid): bool
    {
        return $user->isGuru();
    }
}
