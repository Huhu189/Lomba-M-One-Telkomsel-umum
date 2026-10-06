<?php

declare(strict_types=1);

namespace App\Sections\Report\Http\Controllers;

use App\Http\Controllers\Controller;
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
    public function show(Request $request, Kuis $kuis, RankingService $service): JsonResponse
    {
        $this->authorize('view', $kuis);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $pengguna->loadMissing('murid');
        $top = $request->integer('top');

        return response()->json($service->untukKuis(
            $kuis,
            $top > 0 ? $top : RankingService::BAWAAN_TOP,
            $pengguna->murid !== null ? (int) $pengguna->murid->getKey() : null,
            $pengguna->isGuru(),
        ));
    }
}
