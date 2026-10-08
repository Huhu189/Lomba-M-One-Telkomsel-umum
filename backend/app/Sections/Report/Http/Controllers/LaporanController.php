<?php

declare(strict_types=1);

namespace App\Sections\Report\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Report\Services\EksporNilaiService;
use App\Sections\Report\Services\LaporanTagService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

    /**
     * Unduh nilai satu kuis sebagai CSV untuk buku nilai guru (slice 10).
     *
     * Pada mode tim semua anggota mendapat baris dengan skor tim yang sama,
     * jadi ekspor ini konsisten dengan aturan "skor dibagi sama".
     */
    public function eksporNilai(Request $request, Kuis $kuis, EksporNilaiService $service): StreamedResponse
    {
        $this->authorize('laporan', $kuis);

        // `?delimiter=;` untuk Excel berbahasa Indonesia (Q-16).
        return $service->ekspor($kuis, (string) $request->query('delimiter', ','));
    }
}
