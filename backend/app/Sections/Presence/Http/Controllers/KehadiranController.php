<?php

declare(strict_types=1);

namespace App\Sections\Presence\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Attempt\Models\Attempt;
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
}
