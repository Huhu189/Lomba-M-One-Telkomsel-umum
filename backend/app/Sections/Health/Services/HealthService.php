<?php

declare(strict_types=1);

namespace App\Sections\Health\Services;

use Illuminate\Support\Facades\DB;

class HealthService
{
    /**
     * Mengumpulkan status kesehatan aplikasi.
     * Pemanggilan DB di sini disengaja: controller tidak boleh menyentuh facade DB langsung.
     */
    public function report(): array
    {
        return [
            'ok' => true,
            'service' => 'backend',
            'database' => DB::connection()->getPdo() !== null,
            'time' => now()->toIso8601String(),
        ];
    }
}
