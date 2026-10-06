<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Policies;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;

/**
 * Attempt: murid hanya boleh menyentuh attempt miliknya; guru boleh melihat
 * (untuk ditinjau/dinilai manual di slice 06 dan dipantau di slice 07).
 */
class AttemptPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Attempt $attempt): bool
    {
        return $user->isGuru() || $this->milikMurid($user, $attempt);
    }

    public function create(User $user): bool
    {
        return $user->isMurid();
    }

    /**
     * Menyimpan jawaban hanya selama attempt berjalan dan memang miliknya.
     */
    public function jawab(User $user, Attempt $attempt): bool
    {
        return $this->milikMurid($user, $attempt) && $attempt->berjalan();
    }

    /**
     * Mengumpulkan: pemilik saja. Attempt yang sudah dikumpulkan tetap boleh
     * memanggil ini supaya dobel klik/dua tab menerima hasil yang sama
     * (idempoten), bukan 403.
     */
    public function kumpulkan(User $user, Attempt $attempt): bool
    {
        return $this->milikMurid($user, $attempt);
    }

    public function hasil(User $user, Attempt $attempt): bool
    {
        return $this->view($user, $attempt);
    }

    public function delete(User $user, Attempt $attempt): bool
    {
        return $user->isGuru();
    }

    private function milikMurid(User $user, Attempt $attempt): bool
    {
        $profil = $user->murid;

        return $profil !== null && (int) $profil->getKey() === (int) $attempt->student_id;
    }
}
