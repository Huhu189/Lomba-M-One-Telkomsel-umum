<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tim untuk kuis mode kelompok (slice 09-C).
 *
 * Tim dibuat guru **per kuis** (bukan per kelas): mode tim hanya masuk akal untuk
 * ulangan tertentu, dan satu murid hanya boleh ada di satu tim pada kuis itu —
 * dijaga unique `quiz_id + student_id` supaya tidak ada jawaban yang dihitung
 * dua kali.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teams', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('quiz_id')->constrained('quizzes')->cascadeOnDelete();
            $table->string('nama', 60);
            $table->timestamps();

            $table->unique(['quiz_id', 'nama']);
        });

        Schema::create('team_members', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('team_id')->constrained('teams')->cascadeOnDelete();
            $table->foreignId('quiz_id')->constrained('quizzes')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->timestamps();

            // Satu murid = satu tim per kuis.
            $table->unique(['quiz_id', 'student_id']);
            $table->unique(['team_id', 'student_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('team_members');
        Schema::dropIfExists('teams');
    }
};
