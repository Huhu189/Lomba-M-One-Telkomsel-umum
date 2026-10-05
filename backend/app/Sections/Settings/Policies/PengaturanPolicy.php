<?php

declare(strict_types=1);

namespace App\Sections\Settings\Policies;

use App\Models\User;

/**
 * Pengaturan: semua boleh membaca (murid melihat aturan yang berlaku);
 * hanya guru/admin boleh mengubah.
 */
class PengaturanPolicy
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
