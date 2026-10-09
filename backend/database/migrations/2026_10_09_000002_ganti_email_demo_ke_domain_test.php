<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Ganti email akun guru demo lama ke domain `.test` (K-01).
 *
 * Seeder contoh dulu membuat `guru1@gmail.com` dengan sandi yang tertulis di
 * repo. Seeder sekarang memakai domain `.test` dan berhenti di produksi, tetapi
 * basis data yang sudah pernah di-seed masih menyimpan akun gmail itu. Mengganti
 * emailnya membuat alamat nyata milik orang lain tidak lagi menjadi akun demo
 * yang bisa dimasuki siapa pun yang membaca repo ini.
 *
 * Aman: hanya baris yang jelas akun guru demo (role `guru`, nama `Guru Sekolah`)
 * yang diganti, dan tidak mengganti apa pun bila email tujuan sudah dipakai.
 * Sandi tidak diubah di sini — akun guru di aplikasi ini tidak pernah bisa
 * didaftarkan sendiri oleh murid, jadi tidak ada akun pengguna asli yang
 * tertimpa.
 */
return new class extends Migration
{
    public function up(): void
    {
        $tujuan = 'guru1@sekolah.test';

        if (DB::table('users')->where('email', $tujuan)->exists()) {
            return;
        }

        DB::table('users')
            ->where('email', 'guru1@gmail.com')
            ->where('role', 'guru')
            ->where('name', 'Guru Sekolah')
            ->update(['email' => $tujuan]);
    }

    /**
     * Tidak dikembalikan: mengembalikan email ke domain nyata justru membuka
     * lagi temuan ini.
     */
    public function down(): void
    {
        //
    }
};
