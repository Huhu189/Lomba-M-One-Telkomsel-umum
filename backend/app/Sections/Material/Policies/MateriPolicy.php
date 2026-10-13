<?php

declare(strict_types=1);

namespace App\Sections\Material\Policies;

use App\Models\User;
use App\Sections\Material\Models\Materi;

/**
 * Materi: **guru** mengelola; murid hanya melihat materi terbit kelasnya, dan
 * kepala sekolah (peran `admin`) membaca beserta laporannya tanpa mengubah
 * (lihat `User::bolehMengubahAkademik()`).
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
        return $user->bolehMengubahAkademik();
    }

    public function update(User $user, Materi $materi): bool
    {
        return $user->bolehMengubahAkademik() && $user->bolehKelola($materi->dibuat_oleh);
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

    /**
     * Laporan materi memuat nama, progres, dan skor seluruh murid satu kelas,
     * jadi batasnya disamakan dengan batas baca materinya (K-15/S-04): guru
     * pemilik materi atau admin — bukan sembarang guru.
     *
     * Sebelumnya method ini hanya memeriksa `isGuru()`, sehingga guru lain
     * (bahkan dari luar sekolahnya, karena materinya diambil dari id di URL)
     * bisa membaca laporan kelas bukan miliknya lewat `GET /v1/materi/{id}/laporan`
     * walau `view` materi itu sendiri sudah ditolak — ditemukan saat sapuan
     * dasar 11 Okt 2026 (A.39).
     */
    public function laporan(User $user, Materi $materi): bool
    {
        // Membaca laporan, bukan mengubahnya: kepala sekolah tetap boleh.
        return $user->isGuru() && $user->bolehKelola($materi->dibuat_oleh);
    }

    /** Murid menempuh materi (progres, bukan pengelolaan). */
    public function kerjakan(User $user, Materi $materi): bool
    {
        return $user->isMurid() && $this->view($user, $materi);
    }
}
