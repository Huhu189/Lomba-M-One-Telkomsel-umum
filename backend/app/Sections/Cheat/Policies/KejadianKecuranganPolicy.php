<?php

declare(strict_types=1);

namespace App\Sections\Cheat\Policies;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Cheat\Models\KejadianKecurangan;
use App\Sections\Quiz\Models\Kuis;

/**
 * Catatan kecurangan: murid hanya boleh menambah kejadian pada attempt miliknya
 * yang masih berjalan; membaca dan meninjau hanya guru/admin.
 */
class KejadianKecuranganPolicy
{
    public function catat(User $user, Attempt $attempt): bool
    {
        $profil = $user->murid;

        return $profil !== null
            && (int) $profil->getKey() === (int) $attempt->student_id
            && $attempt->berjalan();
    }

    public function lihatSemua(User $user): bool
    {
        return $user->isGuru();
    }

    /**
     * Meninjau (menandai valid/tidak valid) hanya pemilik kuis catatan itu.
     *
     * Sebelumnya cukup `isGuru()`, sehingga guru yang bukan pemilik kuis bisa
     * mengubah status tinjauan catatan kecurangan murid di kuis guru lain —
     * padahal MEMBACA catatan yang sama sudah dibatasi pemilik. Tinjauan adalah
     * satu-satunya kolom yang boleh berubah pada catatan append-only, jadi tanpa
     * batas ini bukti anti-cheat bisa dilumpuhkan guru mana pun.
     */
    public function tinjau(User $user, KejadianKecurangan $kejadian): bool
    {
        // Meninjau = mengubah keputusan atas bukti, jadi kepala sekolah (peran
        // `admin`) tidak ikut; ia tetap boleh MEMBACA seluruh catatan lewat
        // `lihatSemua`.
        if (! $user->bolehMengubahAkademik()) {
            return false;
        }

        // Pemilik kuis dibaca lewat query, bukan relasi, karena policy ini
        // dipanggil dari endpoint yang belum tentu memuat relasinya (dan pemuatan
        // malas sengaja dimatikan di luar produksi).
        $pemilik = Kuis::query()
            ->whereKey(
                Attempt::query()->whereKey($kejadian->attempt_id)->value('quiz_id'),
            )
            ->value('dibuat_oleh');

        return $user->bolehKelola($pemilik === null ? null : (int) $pemilik);
    }

    public function delete(User $user, KejadianKecurangan $kejadian): bool
    {
        // Catatan kecurangan append-only: tidak ada yang boleh menghapusnya.
        return false;
    }
}
