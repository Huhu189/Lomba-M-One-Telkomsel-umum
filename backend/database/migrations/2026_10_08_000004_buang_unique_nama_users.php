<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Buang indeks unik sisa scaffold pada `users` (name, guard_name).
     *
     * `users` tidak punya kolom `guard_name` — kolom itu milik tabel `roles`.
     * Indeks ini hanya menyisakan satu efek nyata: **dua pengguna tidak boleh
     * bernama sama**. Di aplikasi sekolah itu keliru (dua anak bernama "Ahmad"
     * adalah hal biasa), dan pendaftaran murid kedua gagal dengan 500
     * `UNIQUE constraint failed: users_name_guard_name_unique`. Di MySQL indeks
     * ini bahkan membuat migrasi awal gagal, jadi ia dibuang di dua tempat:
     * dari migrasi asalnya (instalasi baru) dan lewat migrasi ini (DB lama).
     */
    public function up(): void
    {
        if (Schema::hasIndex('users', 'users_name_guard_name_unique')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropUnique('users_name_guard_name_unique');
            });
        }
    }

    public function down(): void
    {
        // Sengaja tidak dikembalikan: indeksnya memang salah (tidak ada kolom
        // `guard_name` di `users`), jadi rollback pun tak perlu menghidupkannya.
    }
};
