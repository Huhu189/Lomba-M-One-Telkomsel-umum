<?php

declare(strict_types=1);

namespace App\Sections\Question\Policies;

use App\Models\User;
use App\Sections\Question\Models\Soal;

/**
 * Bank soal memuat kunci jawaban, jadi seluruh jalurnya hanya untuk guru/admin.
 * Murid menerima soal lewat endpoint kuis dengan resource tanpa kunci.
 */
class SoalPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isGuru();
    }

    public function view(User $user, Soal $soal): bool
    {
        return $user->isGuru();
    }

    public function create(User $user): bool
    {
        return $user->isGuru();
    }

    public function update(User $user, Soal $soal): bool
    {
        return $user->isGuru();
    }

    public function delete(User $user, Soal $soal): bool
    {
        return $user->isGuru();
    }
}
