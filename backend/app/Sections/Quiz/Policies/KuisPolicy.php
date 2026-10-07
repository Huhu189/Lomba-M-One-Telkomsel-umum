<?php

declare(strict_types=1);

namespace App\Sections\Quiz\Policies;

use App\Models\User;
use App\Sections\Quiz\Enums\StatusKuis;
use App\Sections\Quiz\Models\Kuis;

/**
 * Kuis: guru/admin mengelola; murid hanya melihat kuis terbit kelasnya.
 */
class KuisPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Murid hanya boleh melihat kuis yang sudah terbit dan memang kelasnya.
     */
    public function view(User $user, Kuis $kuis): bool
    {
        if ($user->isGuru()) {
            return true;
        }

        if ($kuis->status !== StatusKuis::Publikasi) {
            return false;
        }

        $kelasMurid = $user->murid?->class_id;

        return $kelasMurid !== null && (int) $kelasMurid === (int) $kuis->class_id;
    }

    public function create(User $user): bool
    {
        return $user->isGuru();
    }

    public function update(User $user, Kuis $kuis): bool
    {
        return $user->isGuru();
    }

    public function delete(User $user, Kuis $kuis): bool
    {
        return $user->isGuru();
    }

    public function publikasi(User $user, Kuis $kuis): bool
    {
        return $user->isGuru();
    }

    /**
     * Laporan pemahaman per tema (slice 05) — hanya guru/admin; laporan memuat
     * data seluruh murid kelas, jadi murid tidak pernah boleh membukanya.
     */
    public function laporan(User $user, Kuis $kuis): bool
    {
        return $user->isGuru();
    }

    /**
     * Antrean koreksi manual (slice 06) — memuat kunci jawaban: guru saja.
     */
    public function koreksi(User $user, Kuis $kuis): bool
    {
        return $user->isGuru();
    }

    /**
     * Layar guru (slice 10) — dibaca dua arah: guru mengendalikan, murid kelas
     * itu mengikuti. Karena itu syarat murid sama dengan `view`: kuisnya harus
     * sudah terbit dan memang kelas murid ini.
     */
    public function layar(User $user, Kuis $kuis): bool
    {
        return $this->view($user, $kuis);
    }
}
