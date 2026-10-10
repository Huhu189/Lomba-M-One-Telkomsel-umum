<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rasio bingkai pratinjau materi (editor gaya video editor).
 *
 * Dikunci per materi supaya media yang tidak pas tidak "meluber": guru memilih
 * 16:9, 9:16, 1:1, atau 4:3, dan setiap klip media menyesuaikan diri ke bingkai.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table): void {
            $table->string('rasio', 8)->default('16:9')->after('urutan');
        });
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table): void {
            $table->dropColumn('rasio');
        });
    }
};
