<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Layar guru per kuis (slice 10).
 *
 * Satu baris per kuis — bukan tabel riwayat: yang dibutuhkan perangkat murid
 * hanya **keadaan sekarang** (apa yang sedang ditampilkan guru). Karena itu
 * `quiz_id` unik, dan `versi` naik setiap kali guru mengubah apa pun supaya
 * klien bisa tahu salinannya sudah basi tanpa membandingkan isi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quiz_screens', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('quiz_id')->unique()->constrained('quizzes')->cascadeOnDelete();
            $table->string('mode', 20)->default('kosong');
            $table->string('judul', 120)->nullable();
            $table->text('isi')->nullable();
            // Soal yang disorot (mode "soal"); soal yang dihapus hanya
            // mengosongkan sorotan, bukan ikut menghapus layar.
            $table->foreignId('question_id')->nullable()->constrained('questions')->nullOnDelete();
            $table->unsignedInteger('versi')->default(0);
            $table->foreignId('diubah_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quiz_screens');
    }
};
