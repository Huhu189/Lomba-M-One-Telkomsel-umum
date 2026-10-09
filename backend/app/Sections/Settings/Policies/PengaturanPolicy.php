<?php

declare(strict_types=1);

namespace App\Sections\Settings\Policies;

use App\Models\User;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Settings\Enums\LingkupPengaturan;

/**
 * Pengaturan: hanya guru/admin yang boleh membacanya (K-05) — murid menerima
 * saklar proteksi lewat payload attempt, jadi ia tidak perlu tahu proteksi mana
 * yang menyala. Mengubah lingkup kuis hanya pemilik kuisnya (S-05), dan lingkup
 * sekolah/kelas hanya admin — satu guru tidak boleh mematikan anti-cheat atau
 * menaikkan batas percobaan untuk seluruh sekolah.
 */
class PengaturanPolicy
{
    /**
     * Murid ditolak: dengan membaca `GET /pengaturan?kuis_id=` ia tahu persis
     * proteksi mana yang aktif dan bisa memetakannya sebelum ulangan (K-05).
     * Saklar yang memang mengikat murid dikirim bersama attempt (sudah tersaring
     * per kuis dan per saklar efektif).
     */
    public function viewAny(User $user): bool
    {
        return $user->isGuru();
    }

    /**
     * Lingkup kuis (mis. saklar anti-cheat, mode tim, batas percobaan) mengubah
     * aturan ulangan satu kuis, jadi kepemilikannya diperiksa dengan aturan yang
     * sama seperti mengubah kuisnya.
     */
    public function update(User $user, ?LingkupPengaturan $lingkup = null, ?int $lingkupId = null): bool
    {
        if (! $user->isGuru()) {
            return false;
        }

        if ($lingkup === LingkupPengaturan::Kuis && $lingkupId !== null) {
            $kuis = Kuis::query()->find($lingkupId);

            return $kuis !== null && $user->can('update', $kuis);
        }

        // Lingkup sekolah/kelas berlaku untuk SELURUH sekolah (anti-cheat,
        // batas percobaan, retry), dan di skema ini tidak ada pemilik per guru
        // untuk baris pengaturan itu — jadi hanya admin (K-05). Sebelumnya guru
        // mana pun bisa mengubahnya.
        return $user->hasRole('admin');
    }
}
