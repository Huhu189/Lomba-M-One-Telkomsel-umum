<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabel classes (kelas) — FK ke sekolah NOT NULL.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('classes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->string('nama', 60);
            $table->unsignedTinyInteger('tingkat');
            $table->string('tahun_ajaran', 20)->nullable();
            $table->timestamps();

            $table->unique(['school_id', 'nama']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classes');
    }
};
