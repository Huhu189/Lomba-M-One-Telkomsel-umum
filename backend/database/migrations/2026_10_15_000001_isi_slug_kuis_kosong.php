<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Isi slug kuis yang masih kosong.
 *
 * Migrasi `2026_10_13_000001_tambah_slug_kuis` sudah mengisi seluruh baris yang
 * ada SAAT ITU. Baris yang dibuat sesudahnya lewat jalur yang tidak memakai
 * `KuisService` — seeder materi contoh memakai `firstOrCreate` langsung ke model
 * — lolos tanpa slug.
 *
 * Akibatnya bukan kecil: klien mensyaratkan `slug` ada (`skemaKuis` di
 * `frontend/src/sections/quiz/api.js` sengaja menolak slug kosong), dan skema itu
 * dijalankan atas SELURUH daftar. Satu baris tanpa slug membuat seluruh daftar
 * gagal di-parse, sehingga beranda menulis "Gagal memuat jadwal kuis" dan daftar
 * ulangan murid menulis "Gagal memuat ulangan" — padahal server menjawab 200.
 *
 * Seeder-nya sudah diperbaiki supaya tidak lahir lagi; migrasi ini merapikan
 * basis data yang terlanjur menyimpannya.
 */
return new class extends Migration
{
    public function up(): void
    {
        $dipakai = [];

        foreach (DB::table('quizzes')->whereNotNull('slug')->where('slug', '!=', '')->pluck('slug') as $satu) {
            $dipakai[(string) $satu] = true;
        }

        $kosong = DB::table('quizzes')
            ->where(function ($q): void {
                $q->whereNull('slug')->orWhere('slug', '');
            })
            ->orderBy('id')
            ->pluck('id');

        foreach ($kosong as $id) {
            do {
                $slug = Str::lower(Str::random(8));
            } while (isset($dipakai[$slug]));

            $dipakai[$slug] = true;

            DB::table('quizzes')->where('id', $id)->update(['slug' => $slug]);
        }
    }

    public function down(): void
    {
        // Tidak ada yang perlu dibatalkan: slug yang diisi di sini tetap sah dan
        // justru wajib ada. Mengosongkannya kembali hanya akan merusak daftar kuis.
    }
};
