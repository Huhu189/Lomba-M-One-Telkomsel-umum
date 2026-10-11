<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Akun siswa tamu (mode tamu tanpa login).
 *
 * Guru bisa membuka kuis untuk siswa tanpa akun lewat pengaturan
 * `izinkan_tamu`; tamu cukup mengetik nama. Supaya jejak pengerjaannya tetap
 * terpisah dari murid sungguhan (laporan, koreksi, dan batas percobaan), akun
 * tamu tetap punya baris `users` + `students` seperti murid biasa, hanya
 * ditandai kolom ini. Tanpa penanda, tidak ada cara membedakan akun tamu dari
 * murid yang baru didaftarkan guru — dan aturan "tamu tidak punya kelas" tidak
 * bisa ditegakkan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('is_tamu')->default(false)->after('role')->index();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex(['is_tamu']);
            $table->dropColumn('is_tamu');
        });
    }
};
