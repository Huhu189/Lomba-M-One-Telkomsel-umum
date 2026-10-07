<?php

declare(strict_types=1);

namespace App\Sections\Report\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Attempt\Models\Tim;
use App\Sections\Attempt\Services\TimService;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Report\Services\RankingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Peringkat kuis. Murid hanya bisa membuka kuis kelasnya (policy kuis);
 * keterlihatan isi peringkat mengikuti saklar `ranking` (bawaan mati).
 */
class RankingController extends Controller
{
    public function show(
        Request $request,
        Kuis $kuis,
        RankingService $service,
        TimService $timService,
    ): JsonResponse {
        $this->authorize('view', $kuis);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $pengguna->loadMissing('murid');
        $top = $request->integer('top');
        $murid = $pengguna->murid;

        // Mode tim: yang dicari di peringkat adalah tim murid ini (slice 09-C).
        $tim = $murid !== null ? $timService->timUntukMurid($kuis, (int) $murid->getKey()) : null;

        return response()->json($service->untukKuis(
            $kuis,
            $top > 0 ? $top : RankingService::BAWAAN_TOP,
            $murid !== null ? (int) $murid->getKey() : null,
            $pengguna->isGuru(),
            $tim instanceof Tim ? (int) $tim->getKey() : null,
        ));
    }
}
