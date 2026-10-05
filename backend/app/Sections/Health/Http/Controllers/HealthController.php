<?php

declare(strict_types=1);

namespace App\Sections\Health\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Health\Services\HealthService;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    /**
     * Endpoint kesehatan dasar untuk slice 00.
     * Arsitektur Sections dimulai dari sini: fitur berikutnya hidup di app/Sections/<Nama>.
     */
    public function __invoke(HealthService $health): JsonResponse
    {
        return response()->json($health->report());
    }
}
