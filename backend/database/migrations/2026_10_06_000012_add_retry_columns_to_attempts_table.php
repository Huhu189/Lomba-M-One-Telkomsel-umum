<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kolom retry (slice 05): tiap percobaan punya `attempt_no` berurutan
 * (1, 2, 3, …) dan hanya percobaan pertama bertanda `asli`.
 *
 * Ranking HANYA memakai baris `asli = true`, jadi skor asli tidak pernah
 * berubah walau murid mengulang kuis.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attempts', function (Blueprint $table): void {
            // Percobaan ke-berapa untuk kuis ini (1 = pertama).
            $table->unsignedSmallInteger('attempt_no')->default(1)->after('jenis');
            // true hanya untuk percobaan pertama — dasar ranking & skor asli.
            $table->boolean('asli')->default(true)->after('attempt_no');

            $table->index(['quiz_id', 'student_id', 'asli']);
        });
    }

    public function down(): void
    {
        Schema::table('attempts', function (Blueprint $table): void {
            $table->dropIndex(['quiz_id', 'student_id', 'asli']);
            $table->dropColumn(['attempt_no', 'asli']);
        });
    }
};
