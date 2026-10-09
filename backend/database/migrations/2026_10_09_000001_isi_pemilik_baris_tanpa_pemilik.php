<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Isi pemilik baris kuis/soal/materi yang `dibuat_oleh`-nya masih NULL (K-04).
 *
 * Sebelum ini baris tanpa pemilik dianggap milik bersama, sehingga guru mana pun
 * bisa membuka kunci jawaban, nilai, dan catatan kecurangan milik guru lain.
 * Pengecualian itu sudah dibuang di `User::bolehKelola`, dan migrasi ini yang
 * membuat baris lama tidak ikut terkunci: pemiliknya diisi dulu.
 *
 * Pemilik yang dipakai: admin pertama (fallback: guru pertama). Bila belum ada
 * keduanya (basis data kosong), tidak ada yang bisa diisi — baris tanpa pemilik
 * sesudah ini hanya dapat disentuh admin.
 */
return new class extends Migration
{
    public function up(): void
    {
        $pemilik = DB::table('users')
            ->where('role', 'admin')
            ->orderBy('id')
            ->value('id');

        $pemilik ??= DB::table('users')
            ->where('role', 'guru')
            ->orderBy('id')
            ->value('id');

        if ($pemilik === null) {
            return;
        }

        foreach (['questions', 'quizzes', 'materials'] as $tabel) {
            DB::table($tabel)
                ->whereNull('dibuat_oleh')
                ->update(['dibuat_oleh' => $pemilik]);
        }
    }

    /**
     * Tidak bisa dikembalikan: pemilik asli baris NULL tidak pernah dicatat.
     */
    public function down(): void
    {
        //
    }
};
