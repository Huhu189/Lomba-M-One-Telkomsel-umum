<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Slug acak untuk kuis: URL kuis tidak lagi memakai id berurutan.
 *
 * Alasannya bukan otorisasi — server sudah menolak kuis milik guru lain (403)
 * dan itu tetap pagar utamanya. Yang dihilangkan slug adalah *pintu menebak*:
 * dengan `/kuis/191` siapa pun yang sudah masuk bisa menyisir id berurutan dan
 * melihat kuis mana yang ada; dengan `/kuis/unu5k` id itu tidak lagi menjadi
 * alamat yang dibagikan atau dipakai orang lain.
 *
 * Kolomnya nullable supaya baris lama tidak menghalangi `ALTER TABLE`, lalu
 * seluruh baris yang ada diisi slug unik. Baris baru selalu dibuat dengan slug
 * (lihat `KuisService::simpan`), jadi nilai NULL tidak pernah muncul lagi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quizzes', function (Blueprint $table): void {
            $table->string('slug', 12)->nullable()->unique();
        });

        $dipakai = [];

        foreach (DB::table('quizzes')->orderBy('id')->pluck('id') as $id) {
            do {
                $slug = Str::lower(Str::random(8));
            } while (isset($dipakai[$slug]));

            $dipakai[$slug] = true;

            DB::table('quizzes')->where('id', $id)->update(['slug' => $slug]);
        }
    }

    public function down(): void
    {
        Schema::table('quizzes', function (Blueprint $table): void {
            $table->dropUnique(['slug']);
            $table->dropColumn('slug');
        });
    }
};
