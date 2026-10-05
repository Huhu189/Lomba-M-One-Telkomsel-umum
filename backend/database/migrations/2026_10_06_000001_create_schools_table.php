<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabel schools — satu baris per instalasi (lapis pengaturan teratas).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('schools', function (Blueprint $table): void {
            $table->id();
            $table->string('nama');
            $table->string('npsn', 20)->nullable()->unique();
            $table->string('alamat')->nullable();
            $table->string('kepala_sekolah')->nullable();
            $table->string('tahun_ajaran', 20)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('schools');
    }
};
