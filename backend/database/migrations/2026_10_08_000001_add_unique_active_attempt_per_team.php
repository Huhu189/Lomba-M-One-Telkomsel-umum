<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Satu attempt aktif per TIM (Q-07).
 *
 * Indeks unik lama `(quiz_id, student_id, jenis, aktif)` hanya menjaga per murid,
 * sedangkan pada mode tim satu lembar jawaban dipakai bersama: dua anggota yang
 * menekan "Mulai" bersamaan membuat dua attempt aktif berbeda `student_id` dengan
 * `team_id` yang sama, keduanya `asli` — tim terbelah dua lembar dan ranking
 * menghitung dua baris. Indeks ini menutup celah itu di sisi basis data, jadi
 * `AttemptService::mulai` tinggal menangkap pelanggarannya dan memakai attempt
 * yang menang.
 *
 * `team_id` NULL (attempt individu) tetap bebas bertumpuk karena NULL dianggap
 * berbeda pada indeks unik, sama seperti perilaku kolom `aktif`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attempts', function (Blueprint $table): void {
            $table->unique(['quiz_id', 'team_id', 'jenis', 'aktif']);
        });
    }

    public function down(): void
    {
        Schema::table('attempts', function (Blueprint $table): void {
            $table->dropUnique(['quiz_id', 'team_id', 'jenis', 'aktif']);
        });
    }
};
