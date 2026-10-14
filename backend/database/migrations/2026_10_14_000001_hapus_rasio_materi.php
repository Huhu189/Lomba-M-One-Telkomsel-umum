<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rasio bingkai materi dihapus (14 Oktober 2026).
 *
 * Bingkai materi kini TETAP 16:9: latar tema digambar 1600×900 dan dipotong
 * `object-fit: cover`, jadi pilihan rasio lain hanya memotong gambar tema.
 * Kolomnya dibuang supaya tidak ada jalur kedua yang bisa membuat bingkai di
 * editor guru berbeda dari bingkai yang dilihat murid.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table): void {
            $table->dropColumn('rasio');
        });
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table): void {
            $table->string('rasio', 8)->default('16:9')->after('urutan');
        });
    }
};
