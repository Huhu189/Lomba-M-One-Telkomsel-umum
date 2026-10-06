<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabel answers — satu jawaban per soal per attempt.
 *
 * `status` mencatat hasil penilaian per soal (menunggu/dinilai/perlu_tinjau/
 * gagal) supaya kegagalan menilai satu soal tidak menjatuhkan soal lain dan
 * guru bisa meninjau yang perlu diperiksa (slice 06).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('answers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('attempt_id')->constrained('attempts')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('questions')->cascadeOnDelete();
            $table->json('jawaban')->nullable();
            $table->string('status', 20)->default('menunggu');
            $table->boolean('benar')->nullable();
            $table->decimal('skor', 8, 2)->default(0);
            $table->dateTime('dinilai_at')->nullable();
            $table->timestamps();

            $table->unique(['attempt_id', 'question_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('answers');
    }
};
