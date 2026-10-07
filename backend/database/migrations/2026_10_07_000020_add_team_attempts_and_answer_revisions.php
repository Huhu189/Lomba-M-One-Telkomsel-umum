<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Attempt milik tim + riwayat versi jawaban bersama (slice 09-C).
 *
 * - `attempts.team_id`: satu attempt dipakai bersama seluruh anggota tim, jadi
 *   skornya otomatis sama untuk semua anggota (dibagi rata) tanpa menggandakan
 *   baris jawaban.
 * - `answers.penjawab_id` + `answers.versi`: siapa yang terakhir mengubah, dan
 *   sudah berapa kali jawaban itu berubah.
 * - `answer_revisions`: riwayat tiap versi jawaban, supaya sengketa "siapa yang
 *   mengganti jawaban kami" bisa dilihat guru. Hanya diisi pada mode tim.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attempts', function (Blueprint $table): void {
            $table->foreignId('team_id')->nullable()->after('student_id')
                ->constrained('teams')->nullOnDelete();
        });

        Schema::table('answers', function (Blueprint $table): void {
            $table->foreignId('penjawab_id')->nullable()->after('question_id')
                ->constrained('students')->nullOnDelete();
            $table->unsignedInteger('versi')->default(0)->after('penjawab_id');
        });

        Schema::create('answer_revisions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('attempt_id')->constrained('attempts')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('questions')->cascadeOnDelete();
            $table->foreignId('student_id')->nullable()->constrained('students')->nullOnDelete();
            $table->unsignedInteger('versi');
            $table->json('jawaban')->nullable();
            $table->timestamps();

            $table->unique(['attempt_id', 'question_id', 'versi']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('answer_revisions');

        Schema::table('answers', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('penjawab_id');
            $table->dropColumn('versi');
        });

        Schema::table('attempts', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('team_id');
        });
    }
};
