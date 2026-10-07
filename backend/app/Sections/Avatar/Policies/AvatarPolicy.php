<?php

declare(strict_types=1);

namespace App\Sections\Avatar\Policies;

use App\Models\User;
use App\Sections\Avatar\Models\Avatar;
use App\Sections\School\Models\Murid;

/**
 * Avatar: murid hanya mengurus avatarnya sendiri dan melaporkan avatar teman
 * sekelas; guru yang memutuskan hasil tinjauan.
 *
 * Catatan implementasi: kelas pemilik avatar dibaca lewat query langsung, bukan
 * `$avatar->murid`, supaya policy tetap benar walau relasinya belum dimuat
 * (model ketat `preventLazyLoading` aktif di lingkungan non-produksi).
 */
class AvatarPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    /** Lihat satu avatar: guru selalu, pemilik selalu, murid lain hanya bila aktif & sekelas. */
    public function lihat(User $user, Avatar $avatar): bool
    {
        if ($user->isGuru()) {
            return true;
        }

        $profil = $user->murid;

        if ($profil === null) {
            return false;
        }

        if ((int) $profil->getKey() === (int) $avatar->student_id) {
            return true;
        }

        if (! $avatar->terlihatSemua()) {
            return false;
        }

        $kelasPemilik = Murid::query()->whereKey($avatar->student_id)->value('class_id');

        return $kelasPemilik !== null && (int) $kelasPemilik === (int) $profil->class_id;
    }

    /** Unggah avatar sendiri: hanya murid yang punya profil murid. */
    public function unggah(User $user): bool
    {
        return $user->isMurid() && $user->murid !== null;
    }

    /** Kembalikan ke avatar bawaan (hapus avatar sendiri). */
    public function hapusSendiri(User $user): bool
    {
        return $this->unggah($user);
    }

    /** Melaporkan avatar teman: tidak boleh avatarnya sendiri, harus terlihat. */
    public function lapor(User $user, Avatar $avatar): bool
    {
        if (! $user->isMurid()) {
            return false;
        }

        $profil = $user->murid;

        if ($profil === null || (int) $profil->getKey() === (int) $avatar->student_id) {
            return false;
        }

        return $this->lihat($user, $avatar);
    }

    /** Antrean moderasi + pulihkan: guru saja. */
    public function moderasi(User $user): bool
    {
        return $user->isGuru();
    }

    /** Hapus avatar murid (tindakan moderasi) — selalu lewat antrean guru. */
    public function delete(User $user, Avatar $avatar): bool
    {
        return $user->isGuru();
    }
}
