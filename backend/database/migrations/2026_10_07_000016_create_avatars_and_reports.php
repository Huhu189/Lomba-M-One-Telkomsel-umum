<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Avatar murid + laporan moderasi (slice 08).
 *
 * `avatars` menyimpan **tiap unggahan sebagai baris sendiri**, bukan satu baris
 * yang ditimpa. Alasannya moderasi: laporan menunjuk versi gambar tertentu, dan
 * guru tetap perlu melihat gambar yang dilaporkan walau muridnya sudah
 * menggantinya. Avatar "terkini" seorang murid = baris terbaru yang statusnya
 * bukan `dihapus`.
 *
 * `avatar_reports` menyimpan laporan murid. Unique (avatar_id, reporter_id)
 * menegakkan aturan "satu laporan per murid per avatar" di level database:
 * anak yang menekan lapor berulang kali tidak menambah hitungan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('avatars', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            // Nama acak untuk URL bertanda tangan; id berurutan tidak dipakai di URL.
            $table->string('kode', 32)->unique();
            $table->string('path');
            // Selalu hasil encode ulang di server (JPEG), bukan berkas kiriman apa adanya.
            $table->string('mime', 100)->default('image/jpeg');
            $table->unsignedInteger('ukuran');
            $table->unsignedSmallInteger('lebar');
            $table->unsignedSmallInteger('tinggi');
            $table->string('hash', 64);
            $table->string('status', 20)->default('aktif');
            // Jumlah laporan UNIK yang sudah masuk (mengikuti jumlah baris laporan).
            $table->unsignedInteger('jumlah_laporan')->default(0);
            $table->timestamp('disembunyikan_at')->nullable();
            $table->timestamps();

            $table->index(['student_id', 'created_at']);
            $table->index(['school_id', 'status']);
        });

        Schema::create('avatar_reports', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('avatar_id')->constrained('avatars')->cascadeOnDelete();
            $table->foreignId('reporter_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->string('alasan', 40);
            $table->string('keterangan', 300)->nullable();
            $table->string('review_status', 20)->default('menunggu');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->unique(['avatar_id', 'reporter_id']);
            $table->index(['review_status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('avatar_reports');
        Schema::dropIfExists('avatars');
    }
};
