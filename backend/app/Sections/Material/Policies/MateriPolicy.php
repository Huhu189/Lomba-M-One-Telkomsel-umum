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

    /**
     * Guru hanya membuka materi buatannya sendiri (K-15); murid melihat materi
     * terbit kelasnya.
     *
     * Materi memuat naskah/blok pelajaran yang belum terbit dan laporan
     * pengerjaan murid kelas lain, jadi batas bacanya disamakan dengan batas
     * ubahnya.
     */
    public function view(User $user, Materi $materi): bool
    {
        if ($user->isGuru()) {
            return $user->bolehKelola($materi->dibuat_oleh);
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
        return $user->isGuru() && $user->bolehKelola($materi->dibuat_oleh);
    }

    public function delete(User $user, Materi $materi): bool
    {
        return $this->update($user, $materi);
    }

    public function publikasi(User $user, Materi $materi): bool
    {
        return $this->update($user, $materi);
    }

    /** Mengunggah/menghapus berkas materi — hanya pemilik materinya (K-15). */
    public function berkas(User $user, Materi $materi): bool
    {
        return $this->update($user, $materi);
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
