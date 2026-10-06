<?php

declare(strict_types=1);

namespace App\Sections\Presence\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Presence\Services\MonitorService;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Http\JsonResponse;

/**
 * Snapshot Live Monitor (slice 07) untuk guru.
 *
 * Endpoint ini adalah jalur awal sekaligus jalur cadangan: tanpa SSE (mis. Redis
 * sedang mati) guru cukup memanggil ulang endpoint yang sama untuk memperbarui
 * layar. Karena itu Live Monitor tidak pernah "kosong" walau SSE gagal.
 */
class MonitorController extends Controller
{
    public function show(Kuis $kuis, MonitorService $monitor): JsonResponse
    {
        $this->authorize('view', $kuis);

        if (! request()->user()?->isGuru()) {
            abort(403, 'Hanya guru yang bisa memantau ulangan.');
        }

        return response()->json($monitor->snapshot($kuis));
    }
}
