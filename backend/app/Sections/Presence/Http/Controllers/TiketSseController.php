<?php

declare(strict_types=1);

namespace App\Sections\Presence\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Presence\Services\TokenSseService;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Terbitkan ticket SSE sekali pakai untuk Live Monitor (slice 07).
 *
 * Ticket berumur pendek dan hanya berlaku untuk satu guru + satu kuis; ticket
 * dibawa klien ke service Node, bukan ke Laravel.
 */
class TiketSseController extends Controller
{
    public function terbitkan(Request $request, Kuis $kuis, TokenSseService $tiket): JsonResponse
    {
        $this->authorize('view', $kuis);

        $pengguna = $request->user();

        if ($pengguna === null || ! $pengguna->isGuru()) {
            abort(403, 'Hanya guru yang bisa membuka Live Monitor.');
        }

        $hasil = $tiket->terbitkan($pengguna, $kuis);

        return response()->json([
            'tiket' => $hasil['tiket'],
            'expires_at' => $hasil['expires_at'],
            'ttl_detik' => TokenSseService::TTL_DETIK,
        ], 201);
    }
}
