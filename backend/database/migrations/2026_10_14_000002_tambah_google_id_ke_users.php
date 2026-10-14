<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Akun Google (14 Oktober 2026).
 *
 * - `google_id` = klaim `sub` dari Google (id akun Google yang stabil), dipakai
 *   untuk mengenali kembali murid/guru yang masuk lewat tombol Google. Unik,
 *   supaya satu akun Google tidak pernah menempel ke dua baris user.
 * - `perlu_buat_sandi` = penanda akun yang belum punya kata sandi miliknya
 *   sendiri (dibuat lewat Google: server menaruh sandi acak yang tidak pernah
 *   diberitahukan ke siapa pun). Selama penanda ini menyala, murid diwajibkan
 *   membuat kata sandi sekali di awal (`/buat-sandi`) sebelum memakai aplikasi —
 *   sesudah itu masuk lagi tidak pernah menanyakan kata sandi selama sesinya
 *   masih hidup.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            // 64 karakter cukup untuk klaim `sub` Google (21 digit) dan sengaja
            // longgar supaya format id Google berikutnya tidak memaksa migrasi.
            $table->string('google_id', 64)->nullable()->unique();
            $table->boolean('perlu_buat_sandi')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique(['google_id']);
            $table->dropColumn(['google_id', 'perlu_buat_sandi']);
        });
    }
};
