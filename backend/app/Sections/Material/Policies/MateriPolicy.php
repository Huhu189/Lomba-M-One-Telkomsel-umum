<?php

declare(strict_types=1);

namespace App\Sections\Material\Policies;

use App\Models\User;
use App\Sections\Material\Models\Materi;

/**
 * Materi: guru/admin mengelola; murid hanya melihat materi terbit kelasnya.
 */
class MateriPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Materi $materi): bool
    {
        if ($user->isGuru()) {
            return true;
        }

        if (! $materi->terbit()) {
            return false;
        }

        $kelasMurid = $user->murid?->class_id;

        return $kelasMurid !== null && (int) $kelasMurid === (int) $materi->class_id;
    }

    public function create(User $user): bool
    {
        return $user->isGuru();
    }

    public function update(User $user, Materi $materi): bool
    {
        return $user->isGuru();
    }

    public function delete(User $user, Materi $materi): bool
    {
        return $user->isGuru();
    }

    public function publikasi(User $user, Materi $materi): bool
    {
        return $user->isGuru();
    }

    /** Mengunggah/menghapus berkas materi. */
    public function berkas(User $user, Materi $materi): bool
    {
        return $user->isGuru();
    }

    /** Laporan materi memuat data seluruh murid kelas: guru saja. */
    public function laporan(User $user, Materi $materi): bool
    {
        return $user->isGuru();
    }

    /** Murid menempuh materi (progres, bukan pengelolaan). */
    public function kerjakan(User $user, Materi $materi): bool
    {
        return $user->isMurid() && $this->view($user, $materi);
    }
}
