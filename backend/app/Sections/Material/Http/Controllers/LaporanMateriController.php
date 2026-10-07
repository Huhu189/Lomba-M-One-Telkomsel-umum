<?php

declare(strict_types=1);

namespace App\Sections\Material\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Material\Models\Materi;
use App\Sections\Material\Services\LaporanMateriService;
use Illuminate\Http\JsonResponse;

class LaporanMateriController extends Controller
{
    /** Laporan progres + pemahaman tema satu materi (guru/admin saja). */
    public function show(Materi $materi, LaporanMateriService $service): JsonResponse
    {
        $this->authorize('laporan', $materi);

        return response()->json($service->untukMateri($materi));
    }
}
