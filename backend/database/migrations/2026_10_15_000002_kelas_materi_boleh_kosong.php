<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Kelas materi boleh kosong = **semua kelas** di sekolah materi itu
 * (15 Oktober 2026).
 *
 * Materi pengayaan/remedial sering ditujukan ke seluruh angkatan, bukan satu
 * kelas. Kuis sudah lebih dulu punya arti ini (`quizzes.class_id` kosong =
 * semua kelas), jadi materi disamakan supaya "tanpa kelas" tidak berarti dua
 * hal berbeda di aplikasi yang sama.
 *
 * Kolomnya `nullable`, bukan diisi kelas "semua": nilai palsu akan ikut terhitung
 * di laporan per kelas dan di cakupan murid. Cakupan murid materi tanpa kelas
 * ditentukan `Materi::muridCakupan()` (seluruh murid sekolah).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table): void {
            $table->foreignId('class_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Kembalikan NOT NULL: materi yang tidak punya kelas dipindahkan ke kelas
        // pertama sekolahnya supaya tidak ada baris yang membuat migrasi gagal.
        $kelasPertama = Schema::hasTable('classes')
            ? DB::table('classes')->orderBy('id')->value('id')
            : null;

        if ($kelasPertama !== null) {
            DB::table('materials')->whereNull('class_id')->update(['class_id' => $kelasPertama]);
        }

        Schema::table('materials', function (Blueprint $table): void {
            $table->foreignId('class_id')->nullable(false)->change();
        });
    }
};
