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

    /**
     * Ubah soal — hanya pembuatnya; admin boleh semuanya (S-04).
     *
     * Satu soal bisa dipakai beberapa kuis sekaligus, jadi tanpa batas ini guru
     * mana pun bisa mengganti kunci atau skor soal yang sedang dipakai ulangan
     * murid guru pembuatnya — dan nilai yang sudah dihitung ikut berubah.
     */
    public function update(User $user, Soal $soal): bool
    {
        return $user->isGuru() && $user->bolehKelola($soal->dibuat_oleh);
    }

    public function delete(User $user, Soal $soal): bool
    {
        return $this->update($user, $soal);
    }
}
