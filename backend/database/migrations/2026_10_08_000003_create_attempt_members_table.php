<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Snapshot anggota tim saat attempt dibuat (Q-18).
 *
 * Ekspor dan laporan dulu membaca keanggotaan tim yang HIDUP (`team_members`).
 * Begitu seorang murid keluar dari tim, tim dihapus (`nullOnDelete` membuat
 * attempt tim jadi individu), atau akun murid dihapus, susunan baris ekspor ikut
 * berubah — nilai historis ulangan jadi tidak bisa dipertanggungjawabkan.
 *
 * Tabel ini membekukan siapa saja yang mengerjakan satu attempt beserta nama
 * dan nama timnya, persis seperti `snapshot_soal` membekukan isi soal (Q-09).
 * `student_id`/`team_id` sengaja `nullOnDelete` supaya baris snapshot tidak ikut
 * terhapus; `nama`/`tim_nama` tetap membawa identitasnya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attempt_members', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('attempt_id')->constrained('attempts')->cascadeOnDelete();
            $table->foreignId('student_id')->nullable()->constrained('students')->nullOnDelete();
            $table->foreignId('team_id')->nullable()->constrained('teams')->nullOnDelete();
            $table->string('nama', 120);
            $table->string('tim_nama', 60)->nullable();
            $table->timestamps();

            // Satu murid = satu baris per attempt (tidak digandakan).
            $table->unique(['attempt_id', 'student_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attempt_members');
    }
};
