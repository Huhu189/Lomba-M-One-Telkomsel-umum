<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pivot quiz_questions — urutan soal di dalam satu kuis.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quiz_questions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('quiz_id')->constrained('quizzes')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('questions')->cascadeOnDelete();
            $table->unsignedSmallInteger('urutan');
            $table->timestamps();

            $table->unique(['quiz_id', 'question_id']);
            $table->unique(['quiz_id', 'urutan']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quiz_question');
    }
};
