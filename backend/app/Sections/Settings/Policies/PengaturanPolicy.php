<?php

declare(strict_types=1);

namespace App\Sections\Settings\Policies;

use App\Models\User;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Settings\Enums\LingkupPengaturan;

/**
 * Pengaturan: semua boleh membaca (murid melihat aturan yang berlaku);
 * hanya guru/admin boleh mengubah — dan untuk lingkup kuis, hanya pemilik
 * kuisnya (S-05).
 */
class PengaturanPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
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

        // Lingkup sekolah/kelas tidak punya pemilik per guru di skema ini, jadi
        // batasnya tetap seperti semula: guru mana pun di sekolahnya.
        return true;
    }
}
