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
     *
     * Guru juga dibatasi (K-04): kuis memuat **kunci jawaban**; kalau semua guru
     * boleh membacanya, guru mana pun bisa membuka kuis draf guru lain beserta
     * kuncinya, nilai muridnya, dan Live Monitor-nya. Aksi baca sekarang memakai
     * batas kepemilikan yang sama seperti aksi ubah (S-04/S-05).
     */
    public function view(User $user, Kuis $kuis): bool
    {
        if ($user->isGuru()) {
            return $user->bolehKelola($kuis->dibuat_oleh);
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

    /**
     * Ubah/susun kuis — hanya pembuatnya; admin boleh semuanya (S-04).
     *
     * Sebelumnya semua guru setara, jadi guru mana pun bisa mengubah judul,
     * jadwal, daftar soal, dan urutan pengacakan kuis milik guru lain — termasuk
     * saat ulangannya sedang berjalan.
     */
    public function update(User $user, Kuis $kuis): bool
    {
        return $user->isGuru() && $user->bolehKelola($kuis->dibuat_oleh);
    }

    public function delete(User $user, Kuis $kuis): bool
    {
        return $this->update($user, $kuis);
    }

    public function publikasi(User $user, Kuis $kuis): bool
    {
        return $this->update($user, $kuis);
    }

    /**
     * Laporan pemahaman per tema (slice 05) dan ekspor nilai: memuat data seluruh
     * murid kelas, jadi murid tidak pernah boleh membukanya — dan guru hanya untuk
     * kuisnya sendiri (K-04), bukan nilai murid guru lain.
     */
    public function laporan(User $user, Kuis $kuis): bool
    {
        return $this->update($user, $kuis);
    }

    /**
     * Antrean koreksi manual (slice 06) — memuat kunci jawaban, jadi guru saja,
     * dan hanya pemilik kuisnya (S-05): nilai murid di kuis itu tanggung jawab
     * guru yang menyusunnya.
     */
    public function koreksi(User $user, Kuis $kuis): bool
    {
        return $this->update($user, $kuis);
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
