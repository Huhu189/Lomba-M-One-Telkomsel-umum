<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Token konfirmasi sekali pakai + jejak koreksi manual (slice 06).
 *
 * Setiap mutasi sensitif (mengubah nilai yang sudah final) wajib memakai token
 * berumur pendek yang terikat pengguna + sasaran, dan hanya bisa dipakai sekali.
 * Kolom di `answers` menandai bahwa baris itu hasil koreksi guru, bukan mesin.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('confirmation_tokens', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Tujuan token (mis. 'koreksi_nilai') supaya token tidak bisa dipakai lintas aksi.
            $table->string('tujuan', 40);
            // Yang disimpan hanya hash; token asli dikirim sekali ke klien.
            $table->string('token_hash', 64)->unique();
            $table->json('payload');
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamps();

            $table->index(['tujuan', 'user_id']);
        });

        Schema::table('answers', function (Blueprint $table): void {
            $table->boolean('dinilai_manual')->default(false)->after('dinilai_at');
            $table->text('alasan_koreksi')->nullable()->after('dinilai_manual');
        });
    }

    public function down(): void
    {
        Schema::table('answers', function (Blueprint $table): void {
            $table->dropColumn(['dinilai_manual', 'alasan_koreksi']);
        });

        Schema::dropIfExists('confirmation_tokens');
    }
};
