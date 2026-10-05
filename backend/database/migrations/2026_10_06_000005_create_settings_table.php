<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabel settings — pengaturan tiga lapis (sekolah > kelas > kuis) dengan
 * penanda terkunci pada lapis sekolah (chunk slice-02).
 * lingkup_id tidak ber-FK karena menunjuk ke tabel berbeda per lingkup
 * (sekolah/kelas/kuis); validasi dilakukan di lapisan aplikasi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table): void {
            $table->id();
            $table->string('lingkup', 20);
            $table->unsignedBigInteger('lingkup_id');
            $table->string('kunci', 60);
            $table->json('nilai');
            $table->boolean('terkunci')->default(false);
            $table->timestamps();

            $table->unique(['lingkup', 'lingkup_id', 'kunci']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
