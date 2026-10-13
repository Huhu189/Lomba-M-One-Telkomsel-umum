<?php

declare(strict_types=1);

namespace App\Sections\Admin\Policies;

use App\Models\User;

/**
 * Panel admin sekolah: memantau skala sekolah dan mengelola akun guru/murid.
 *
 * Hanya peran `admin`. Mengubah email atau menyetel ulang sandi akun orang lain
 * adalah tindakan yang bisa dipakai **mengambil alih akun**, jadi guru tidak
 * diberi jalan itu walau ia boleh mengelola murid di kelasnya (lihat MuridPolicy:
 * guru hanya boleh menambah/mengubah data murid, bukan kredensialnya).
 *
 * Dua pagar tambahan:
 * - admin tidak bisa menyentuh akunnya sendiri lewat panel ini (ganti nama/sandi
 *   sendiri tetap lewat /pengaturan) — supaya tidak ada jalan menangguhkan diri
 *   sendiri lalu terkunci di luar;
 * - admin tidak bisa menyentuh admin lain, karena itu bukan pengelolaan sekolah
 *   melainkan perebutan kendali antar-pengelola.
 */
class AkunSekolahPolicy
{
    /** Membaca dasbor & daftar akun: admin sekolah saja. */
    public function lihat(User $user): bool
    {
        return $user->hasRole('admin');
    }

    /** Mengubah kredensial akun `$sasaran` (email/sandi/status). */
    public function kelola(User $user, User $sasaran): bool
    {
        if (! $user->hasRole('admin')) {
            return false;
        }

        if ((int) $user->getKey() === (int) $sasaran->getKey()) {
            return false;
        }

        if ($sasaran->hasRole('admin')) {
            return false;
        }

        // Siswa tamu berperan 'murid' tetapi tanpa kata sandi dan tidak pernah
        // dipakai untuk masuk; menyetel sandi/emailnya tidak mengubah apa pun
        // yang berguna, jadi ia ditolak di sini — bukan hanya disembunyikan dari
        // daftar.
        if ($sasaran->isTamu()) {
            return false;
        }

        return $sasaran->hasRole('guru') || $sasaran->hasRole('murid');
    }
}
