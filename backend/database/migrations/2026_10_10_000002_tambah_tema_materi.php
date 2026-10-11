<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tema perjalanan materi (template tema video: mis. "Mendaki Gunung").
 *
 * Guru memilih template, lalu setiap blok materi menjadi satu langkah di peta
 * perjalanan. Kolom ini menyimpan pilihan guru saja — `{kode, nama,
 * video_kode}` — sedangkan nama bawaan fase dan tingkat kenaikan hidup di
 * Registry\TemaPerjalanan supaya tidak ada data tema yang bisa rusak di DB.
 *
 * Baris lama (NULL) berarti tema bawaan: materi yang sudah ada sebelum fitur ini
 * otomatis ikut punya perjalanan, tanpa perlu mengisi apa pun.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table): void {
            $table->json('tema')->nullable()->after('rasio');
        });
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table): void {
            $table->dropColumn('tema');
        });
    }
};
