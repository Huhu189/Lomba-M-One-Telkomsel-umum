<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Unggahan jawaban murid (slice 09): gambar papan tulis, rekaman diri, atau berkas.
 *
 * Dua tabel dipakai supaya pola unggahannya sama dengan materi (slice 08):
 * berkas dipecah potongan ber-hash dan bisa dilanjutkan setelah sinyal putus —
 * dan tiap potongan diverifikasi server, jadi berkas rusak di jalan ketahuan
 * saat itu juga, bukan setelah dikumpulkan.
 *
 * Unggahan selalu terikat pada satu attempt DAN satu soal: inilah yang membuat
 * server bisa menolak unggahan setelah deadline, dan yang membuat guru tahu
 * jawaban mana yang dilampiri apa.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('answer_uploads', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('attempt_id')->constrained('attempts')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('questions')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            // Nama acak untuk URL bertanda tangan; id berurutan tidak dipakai di URL.
            $table->string('kode', 32)->unique();
            // 'gambar' (kanvas) | 'rekam' (rekaman diri) | 'berkas' (unggahan biasa).
            $table->string('jenis', 20);
            $table->string('nama_asli', 255)->nullable();
            $table->string('nama_simpan')->nullable();
            $table->string('ekstensi', 12)->default('bin');
            $table->string('mime', 100)->default('application/octet-stream');
            // Kategori hasil klasifikasi isi berkas (umum / berisiko / tidak dikenal).
            $table->string('kategori', 20)->default('tidak_dikenal');
            $table->unsignedInteger('ukuran_total');
            $table->unsignedInteger('jumlah_potongan');
            // Hanya untuk rekaman diri: durasi yang dinyatakan klien (server memvalidasi batasnya).
            $table->unsignedInteger('durasi_detik')->nullable();
            $table->string('hash', 64)->nullable();
            $table->string('status', 20)->default('menunggu');
            $table->string('path')->nullable();
            // Sesi yang ditinggalkan dibuang setelah lewat tenggat ini.
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['attempt_id', 'question_id']);
            $table->index(['student_id', 'status']);
        });

        Schema::create('answer_upload_chunks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('upload_id')->constrained('answer_uploads')->cascadeOnDelete();
            $table->unsignedInteger('indeks');
            $table->unsignedInteger('ukuran');
            $table->string('hash', 64);
            $table->string('path');
            $table->timestamps();

            $table->unique(['upload_id', 'indeks']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('answer_upload_chunks');
        Schema::dropIfExists('answer_uploads');
    }
};
