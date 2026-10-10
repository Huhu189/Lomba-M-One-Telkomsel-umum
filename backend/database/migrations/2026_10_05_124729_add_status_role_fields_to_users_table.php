<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kolom identitas tambahan: status akun dan role awal.
     * Role guru/admin dibuat lewat seeder atau impor (bukan self-register).
     *
     * Catatan revisi: dulu di sini ikut ditambahkan `unique(['name', 'guard_name'])`
     * — pola tabel `roles` yang salah tempat. `users` tidak punya kolom
     * `guard_name`, sehingga di MySQL migrasi ini langsung gagal, sedangkan di
     * SQLite indeksnya tetap terbuat dan membuat dua pengguna tidak boleh
     * bernama sama (dua anak bernama "Ahmad" = normal di sekolah). Indeks itu
     * dibuang lagi oleh migrasi 2026_10_08_000004 untuk DB yang sudah jalan.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('status')->default('pending')->after('password')->index();
            $table->string('role')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['status', 'role']);
        });
    }
};
