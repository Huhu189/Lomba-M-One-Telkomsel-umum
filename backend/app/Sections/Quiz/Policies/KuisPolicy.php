<?php

declare(strict_types=1);

namespace App\Sections\Quiz\Policies;

use App\Models\User;
use App\Sections\Quiz\Enums\StatusKuis;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Tamu\Services\TamuService;

/**
 * Kuis: **guru** mengelola; murid hanya melihat kuis terbit kelasnya, dan kepala
 * sekolah (peran `admin`) membaca kuis beserta laporannya tanpa mengubah apa pun
 * (lihat `User::bolehMengubahAkademik()`).
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

        // Siswa tamu tidak punya kelas: pagarnya bukan "kelasmu" melainkan izin
        // tamu pada kuis itu sendiri, yang ditetapkan guru lewat pengaturan
        // `izinkan_tamu` (resolusi tiga lapis)
        if ($user->isTamu()) {
            return app(TamuService::class)->izinkanKuis($kuis);
        }

        $murid = $user->murid;

        // Kuis tanpa kelas terbuka untuk semua kelas — tetapi tetap hanya di
        // sekolah kuis itu sendiri. Tanpa pemeriksaan sekolah di sini, "semua
        // kelas" ikut memuat kelas sekolah lain (kelasnya tidak lagi jadi
        // penanda sekolah saat `class_id` kosong).
        if ($murid === null || (int) $murid->school_id !== (int) $kuis->school_id) {
            return false;
        }

        return $kuis->terbukaUntukKelas($murid->class_id === null ? null : (int) $murid->class_id);
    }

    public function create(User $user): bool
    {
        return $user->bolehMengubahAkademik();
    }

    /**
     * Ubah/susun kuis — hanya pembuatnya.
     *
     * Sebelumnya semua guru setara, jadi guru mana pun bisa mengubah judul,
     * jadwal, daftar soal, dan urutan pengacakan kuis milik guru lain — termasuk
     * saat ulangannya sedang berjalan. Sejak 14 Okt 2026 kepala sekolah pun tidak
     * lagi ikut mengubah: ia memantau keadaan sekolah, bukan menyusun ulangan
     * (S-04 lama dibatalkan oleh permintaan itu), sehingga nilai anak hanya bisa
     * diubah pihak yang benar-benar mengerjakan ulangannya.
     */
    public function update(User $user, Kuis $kuis): bool
    {
        return $user->bolehMengubahAkademik() && $user->bolehKelola($kuis->dibuat_oleh);
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
     * Pulihkan kuis yang diarsipkan (14 Oktober 2026) — mengubah keadaan kuis,
     * jadi aturannya sama dengan mengubah: pemiliknya (dan bukan kepala sekolah).
     */
    public function pulihkan(User $user, Kuis $kuis): bool
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
        // Membaca laporan nilai/pemahaman, bukan mengubahnya — kepala sekolah
        // tetap boleh membukanya (itu salah satu tugasnya).
        return $user->isGuru() && $user->bolehKelola($kuis->dibuat_oleh);
    }

    /**
     * Antrean koreksi manual (slice 06) — memuat kunci jawaban, jadi guru saja,
     * dan hanya pemilik kuisnya (S-05): nilai murid di kuis itu tanggung jawab
     * guru yang menyusunnya.
     */
    public function koreksi(User $user, Kuis $kuis): bool
    {
        // Menyimpan nilai, jadi mengikuti aturan tulis.
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
