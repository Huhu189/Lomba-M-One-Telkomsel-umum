<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Policies;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Models\Tim;

/**
 * Attempt: murid hanya boleh menyentuh attempt miliknya; guru boleh melihat
 * dan mengoreksi nilainya (koreksi manual slice 06, pemantauan slice 07).
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
     * Mengunggah/menghapus lampiran jawaban (slice 09): pemilik attempt yang
     * masih berjalan. Waktu deadline-nya sendiri ditegakkan di service, karena
     * policy tidak boleh membaca jam bisnis.
     */
    public function unggahJawaban(User $user, Attempt $attempt): bool
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

    /**
     * Koreksi manual nilai (slice 06) — hanya guru/admin, dan hanya attempt
     * yang sudah dikumpulkan (diperiksa lagi di service).
     */
    public function koreksi(User $user, Attempt $attempt): bool
    {
        return $user->isGuru();
    }

    public function delete(User $user, Attempt $attempt): bool
    {
        return $user->isGuru();
    }

    private function milikMurid(User $user, Attempt $attempt): bool
    {
        $profil = $user->murid;

        if ($profil === null) {
            return false;
        }

        if ((int) $profil->getKey() === (int) $attempt->student_id) {
            return true;
        }

        // Mode tim (slice 09-C): lembar jawaban milik tim, jadi seluruh anggotanya
        // boleh membuka, menjawab, melampirkan, dan mengumpulkan.
        if ($attempt->team_id !== null) {
            return Tim::query()
                ->whereKey($attempt->team_id)
                ->whereHas('keanggotaan', static fn ($query) => $query->where('student_id', $profil->getKey()))
                ->exists();
        }

        return false;
    }
}
