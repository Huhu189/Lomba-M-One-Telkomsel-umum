<?php

declare(strict_types=1);

namespace App\Sections\Presence\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Presence\Http\Requests\DenyutRequest;
use App\Sections\Presence\Services\DenyutProteksiService;
use App\Sections\Presence\Services\PresenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Ping kehadiran (slice 07).
 *
 * Dipanggil klien hanya bila 15 detik berlalu tanpa request lain; request
 * normal (memuat attempt, menyimpan jawaban) sudah memperbarui kehadiran
 * sendiri. Murid hanya boleh menandai attempt miliknya yang masih berjalan.
 */
class KehadiranController extends Controller
{
    public function ping(Request $request, Attempt $attempt, PresenceService $presence): JsonResponse
    {
        $this->authorize('jawab', $attempt);

        // Sesi diambil dari server, bukan dari payload: ini yang membuat deteksi
        // "sesi ganda" bisa dipercaya.
        $sesi = $request->hasSession() ? (string) $request->session()->getId() : null;

        $presence->tandaiHadir($attempt, $sesi);

        return response()->json([
            'message' => 'Kehadiran diperbarui.',
            'server_now' => Carbon::now()->toIso8601String(),
            'ambang_segar_detik' => PresenceService::AMBANG_SEGAR,
        ]);
    }

    /**
     * Denyut proteksi ber-nonce (2D).
     *
     * Klien mengirim nonce terakhir; server memeriksanya, merotasi nonce, lalu
     * mengembalikan yang baru. Nonce yang tidak berlaku dijawab **409** dan
     * **tidak** menyegarkan liveness — jadi memutar ulang kiriman lama tidak
     * bisa mengelabui sapuan. Klien yang menerima 409 memuat ulang payload
     * attempt untuk mendapat nonce segar.
     */
    public function denyut(DenyutRequest $request, Attempt $attempt, DenyutProteksiService $denyut): JsonResponse
    {
        $this->authorize('jawab', $attempt);

        $baru = $denyut->denyut($attempt, $request->validated('nonce'));

        if ($baru === null) {
            return response()->json([
                'message' => 'Nonce denyut tidak berlaku.',
                'server_now' => Carbon::now()->toIso8601String(),
            ], 409);
        }

        return response()->json([
            'message' => 'Denyut proteksi diterima.',
            'nonce' => $baru,
            'interval_detik' => DenyutProteksiService::JEDA_DETIK,
            'server_now' => Carbon::now()->toIso8601String(),
        ]);
    }
}
