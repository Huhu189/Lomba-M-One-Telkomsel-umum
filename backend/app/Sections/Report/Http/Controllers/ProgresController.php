<?php

declare(strict_types=1);

namespace App\Sections\Report\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Report\Services\BadgeService;
use App\Sections\Report\Services\LaporanTagService;
use App\Sections\Report\Services\RemedialService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Progres tema + remedial murid yang sedang masuk: pemahaman per tag, badge
 * per mapel, dan latihan remedial dari tema lemah (tanpa mengubah skor asli).
 */
class ProgresController extends Controller
{
    public function saya(
        Request $request,
        LaporanTagService $laporan,
        RemedialService $remedial,
        BadgeService $badge,
    ): JsonResponse {
        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $pengguna->loadMissing('murid');
        $murid = $pengguna->murid;

        if ($murid === null) {
            abort(403, 'Hanya akun murid yang punya progres tema.');
        }

        $sekolahId = (int) $murid->school_id;
        $kelasId = (int) $murid->class_id;
        $ambang = $laporan->ambang($sekolahId, $kelasId);

        return response()->json([
            'murid_id' => (int) $murid->getKey(),
            'nama' => (string) $pengguna->name,
            'ambang' => $ambang,
            'tema' => $laporan->untukMurid($murid, $ambang),
            'badge' => $badge->untukMurid($murid),
            'remedial' => $remedial->untukMurid($murid, $sekolahId, $kelasId),
        ]);
    }
}
