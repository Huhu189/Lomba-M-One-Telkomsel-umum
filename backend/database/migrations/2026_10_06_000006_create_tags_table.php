<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabel tags — tag soal dan tema pemahaman adalah satu konsep.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tags', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->string('nama', 80);
            $table->string('deskripsi', 255)->nullable();
            $table->timestamps();

            $table->unique(['school_id', 'nama']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tags');
    }
};
