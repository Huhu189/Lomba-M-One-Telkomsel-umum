<?php

declare(strict_types=1);

namespace App\Sections\Cheat\Policies;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Cheat\Models\KejadianKecurangan;

/**
 * Catatan kecurangan: murid hanya boleh menambah kejadian pada attempt miliknya
 * yang masih berjalan; membaca dan meninjau hanya guru/admin.
 */
class KejadianKecuranganPolicy
{
    public function catat(User $user, Attempt $attempt): bool
    {
        $profil = $user->murid;

        return $profil !== null
            && (int) $profil->getKey() === (int) $attempt->student_id
            && $attempt->berjalan();
    }

    public function lihatSemua(User $user): bool
    {
        return $user->isGuru();
    }

    public function tinjau(User $user, KejadianKecurangan $kejadian): bool
    {
        return $user->isGuru();
    }

    public function delete(User $user, KejadianKecurangan $kejadian): bool
    {
        // Catatan kecurangan append-only: tidak ada yang boleh menghapusnya.
        return false;
    }
}
