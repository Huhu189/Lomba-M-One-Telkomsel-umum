<?php

declare(strict_types=1);

namespace App\Sections\Presence\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Presence\Services\TokenSseService;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Terbitkan ticket SSE sekali pakai (slice 07, diperluas slice 10).
 *
 * Ticket berumur pendek dan hanya berlaku untuk satu pengguna + satu kuis;
 * ticket dibawa klien ke service Node, bukan ke Laravel. Dua jalur sengaja
 * dipisah supaya izinnya tidak pernah tercampur: guru untuk Live Monitor,
 * murid untuk mengikuti layar guru kelasnya.
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

        return $this->balasan($tiket->terbitkan($pengguna, $kuis));
    }

    /**
     * Ticket untuk murid kelas kuis ini (layar guru, slice 10).
     *
     * Murid hanya boleh menyambung ke kanal kuis yang memang kelasnya — dan
     * itu sama dengan syarat membaca kuisnya (`KuisPolicy::layar`).
     */
    public function terbitkanMurid(Request $request, Kuis $kuis, TokenSseService $tiket): JsonResponse
    {
        $this->authorize('layar', $kuis);

        $pengguna = $request->user();

        if ($pengguna === null || ! $pengguna->isMurid()) {
            abort(403, 'Jalur ini untuk murid; guru memakai tiket Live Monitor.');
        }

        return $this->balasan($tiket->terbitkan($pengguna, $kuis));
    }

    /**
     * @param  array{tiket: string, expires_at: string}  $hasil
     */
    private function balasan(array $hasil): JsonResponse
    {
        return response()->json([
            'tiket' => $hasil['tiket'],
            'expires_at' => $hasil['expires_at'],
            'ttl_detik' => TokenSseService::TTL_DETIK,
        ], 201);
    }
}
