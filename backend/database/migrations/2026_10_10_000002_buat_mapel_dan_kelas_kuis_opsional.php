<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kuis draf boleh dibuat tanpa mapel dan kelas.
 *
 * Guru kerap menyusun soal lebih dulu (langsung di form builder saat menyusun
 * kuis) dan baru menentukan mapel, kelas, serta jadwalnya menjelang diterbitkan.
 * Keduanya tetap wajib pada saat publikasi — dijaga
 * `KuisService::galatKelengkapan()`, bukan lagi oleh kolom NOT NULL.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quizzes', function (Blueprint $table): void {
            $table->foreignId('subject_id')->nullable()->change();
            $table->foreignId('class_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('quizzes', function (Blueprint $table): void {
            $table->foreignId('subject_id')->nullable(false)->change();
            $table->foreignId('class_id')->nullable(false)->change();
        });
    }
};
