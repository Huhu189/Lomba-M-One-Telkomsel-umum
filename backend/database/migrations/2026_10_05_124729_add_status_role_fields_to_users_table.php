<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kolom identitas tambahan: status akun dan role awal.
     * Role guru/admin dibuat lewat seeder atau impor (bukan self-register).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('status')->default('pending')->after('password')->index();
            $table->string('role')->nullable()->after('status');

            // Role spatie unik per guard (web saja di aplikasi ini).
            $table->unique(['name', 'guard_name']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique(['name', 'guard_name']);
            $table->dropColumn(['status', 'role']);
        });
    }
};
