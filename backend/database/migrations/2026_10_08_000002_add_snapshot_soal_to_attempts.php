<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Snapshot soal per attempt (Q-09).
 *
 * Tanpa salinan beku, nilai historis ikut berubah setiap guru menyunting bank
 * soal: mengganti kunci atau skor satu soal mengubah perhitungan ulang attempt
 * lama, dan soal yang dihapus membuat rincian hasil kehilangan acuannya. Karena
 * murid memakai satu soal yang sama di bank soal, perubahan itu bisa mengenai
 * banyak kuis sekaligus.
 *
 * Isinya (JSON): `acak_soal` + daftar soal (id, tipe, konten, kunci, skor) pada
 * urutan yang berlaku saat attempt dibuat. `acak_soal` ikut dibekukan supaya
 * mengubah setelan pengacakan di tengah ulangan tidak mengubah urutan layar
 * murid yang sedang mengerjakan.
 *
 * Kolomnya nullable: attempt yang sudah ada sebelum migrasi ini tetap dilayani
 * dari soal hidup (lihat `AttemptService::soalTerurut`).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attempts', function (Blueprint $table): void {
            $table->json('snapshot_soal')->nullable()->after('skor_maksimal');
        });
    }

    public function down(): void
    {
        Schema::table('attempts', function (Blueprint $table): void {
            $table->dropColumn('snapshot_soal');
        });
    }
};
