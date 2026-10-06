<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabel questions (bank soal) — isi soal terstruktur (teks + MathML + media)
 * disimpan sebagai JSON; kunci jawaban juga JSON dan TIDAK pernah dikirim ke murid.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('questions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->foreignId('tag_id')->nullable()->constrained('tags')->nullOnDelete();
            $table->string('tipe', 30);
            $table->json('konten');
            $table->json('kunci');
            $table->string('pembahasan', 500)->nullable();
            $table->unsignedSmallInteger('skor')->default(1);
            $table->boolean('aktif')->default(true);
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['school_id', 'tipe']);
            $table->index(['subject_id', 'tag_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('questions');
    }
};
