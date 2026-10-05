<?php

declare(strict_types=1);

namespace App\Sections\School\Policies;

use App\Models\User;

/**
 * Sekolah: semua pengguna terautentikasi boleh membaca; hanya guru/admin boleh mengubah.
 */
class SekolahPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function update(User $user): bool
    {
        return $user->isGuru();
    }
}
