<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabel attempts — satu pengerjaan kuis oleh seorang murid.
 *
 * Kunci "satu attempt aktif per murid per kuis" dijaga kolom `aktif`:
 * bernilai 1 selama berjalan, lalu di-NULL-kan saat selesai. Baik MySQL maupun
 * SQLite menganggap NULL unik, jadi attempt selesai boleh menumpuk (retry di
 * slice 05) tanpa menabrak batas attempt aktif.
 *
 * Waktu dihitung server: `mulai_at` dicatat server dan `deadline_at` =
 * `mulai_at` + durasi kuis.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attempts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('quiz_id')->constrained('quizzes')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            // ulangan = penilaian resmi; latihan = kuis sisipan materi (F2).
            $table->string('jenis', 20)->default('ulangan');
            $table->string('status', 20)->default('berjalan');
            $table->boolean('aktif')->nullable()->default(true);
            $table->unsignedInteger('seed');
            $table->dateTime('mulai_at');
            $table->dateTime('deadline_at');
            $table->dateTime('dikumpulkan_at')->nullable();
            $table->boolean('terlambat')->default(false);
            $table->unsignedSmallInteger('jumlah_soal')->default(0);
            $table->decimal('skor', 8, 2)->nullable();
            $table->decimal('skor_maksimal', 8, 2)->nullable();
            $table->unsignedSmallInteger('jumlah_benar')->default(0);
            $table->string('idempotency_key', 64)->nullable();
            $table->timestamps();

            $table->index(['quiz_id', 'student_id']);
            $table->unique(['quiz_id', 'student_id', 'jenis', 'aktif']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attempts');
    }
};
