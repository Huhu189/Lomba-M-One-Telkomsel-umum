<?php

declare(strict_types=1);

namespace App\Sections\Report\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Report\Services\LaporanTagService;
use Illuminate\Http\JsonResponse;

/**
 * Laporan pemahaman per tema untuk guru (satu kuis, seluruh murid kelas).
 */
class LaporanController extends Controller
{
    public function show(Kuis $kuis, LaporanTagService $service): JsonResponse
    {
        $this->authorize('laporan', $kuis);

        return response()->json($service->untukKuis($kuis));
    }
}
