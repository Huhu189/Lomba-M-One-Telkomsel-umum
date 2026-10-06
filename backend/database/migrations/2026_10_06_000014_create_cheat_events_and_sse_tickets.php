<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Catatan kecurangan + ticket SSE (slice 07).
 *
 * `cheat_events` adalah catatan **append-only**: setelah dibuat, hanya kolom
 * tinjauan guru (status, peninjau, waktu) yang boleh berubah — sisanya dijaga
 * di model, bukan hanya di aplikasi pemanggil. Ini yang membuat catatan bisa
 * dipakai sebagai bukti, bukan tuduhan yang bisa diedit diam-diam.
 *
 * `sse_tickets` menyimpan hash ticket Live Monitor. Ticket berlaku pendek dan
 * sekali pakai; Node hanya perlu hash-nya dari Redis, jadi Node tetap tidak
 * butuh kredensial database.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cheat_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('quiz_id')->constrained('quizzes')->cascadeOnDelete();
            $table->foreignId('attempt_id')->constrained('attempts')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            // Kategori divalidasi enum di server; asal klien vs turunan server dibedakan.
            $table->string('kategori', 40);
            $table->unsignedTinyInteger('skor_risiko');
            $table->boolean('dari_klien')->default(true);
            // Waktu menurut perangkat murid; created_at tetap dari server.
            $table->timestamp('client_at')->nullable();
            $table->json('rincian')->nullable();
            // Tinjauan guru (satu-satunya kolom yang boleh berubah setelah dibuat).
            $table->string('review_status', 20)->default('menunggu');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            // Sidik jari untuk dedupe kiriman berkelompok yang terkirim ulang.
            $table->string('sidik', 64);
            $table->timestamps();

            $table->unique(['attempt_id', 'sidik']);
            $table->index(['quiz_id', 'created_at']);
            $table->index(['attempt_id', 'review_status']);
        });

        Schema::create('sse_tickets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('quiz_id')->constrained('quizzes')->cascadeOnDelete();
            // Hanya hash yang disimpan; ticket asli dikirim sekali ke klien.
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'quiz_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sse_tickets');
        Schema::dropIfExists('cheat_events');
    }
};
