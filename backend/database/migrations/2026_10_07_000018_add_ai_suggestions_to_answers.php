<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Saran penilaian AI untuk jawaban bertingkat (slice 09-B).
 *
 * Kolomnya sengaja dipisah dari `skor`/`status`: nilai AI adalah SARAN, bukan
 * nilai final. Guru tetap yang mengetuk nilai lewat alur koreksi bertoken, jadi
 * `skor` tidak pernah berubah karena AI. `alasan_ai` menyimpan alasan mentah
 * dari model dan hanya boleh dibaca guru — tidak pernah ikut ke murid.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('answers', function (Blueprint $table): void {
            $table->decimal('skor_ai', 8, 2)->nullable()->after('alasan_koreksi');
            $table->text('alasan_ai')->nullable()->after('skor_ai');
            // saran = AI menjawab sesuai skema; gagal = panggilan/parse bermasalah.
            $table->string('ai_status', 20)->nullable()->after('alasan_ai');
            $table->dateTime('ai_dinilai_at')->nullable()->after('ai_status');
        });
    }

    public function down(): void
    {
        Schema::table('answers', function (Blueprint $table): void {
            $table->dropColumn(['skor_ai', 'alasan_ai', 'ai_status', 'ai_dinilai_at']);
        });
    }
};
