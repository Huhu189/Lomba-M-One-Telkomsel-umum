<?php

declare(strict_types=1);

namespace App\Sections\School\Policies;

use App\Models\User;
use App\Sections\School\Models\Mapel;

/**
 * Mapel: murid hanya baca; guru/admin boleh mengubah.
 */
class MapelPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Mapel $mapel): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->isGuru();
    }

    public function update(User $user, Mapel $mapel): bool
    {
        return $user->isGuru();
    }

    public function delete(User $user, Mapel $mapel): bool
    {
        return $user->isGuru();
    }
}
