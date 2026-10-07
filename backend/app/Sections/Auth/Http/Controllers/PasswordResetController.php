<?php

declare(strict_types=1);

namespace App\Sections\Auth\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Auth\Http\Requests\AturUlangSandiRequest;
use App\Sections\Auth\Http\Requests\LupaSandiRequest;
use App\Sections\Auth\Services\PasswordResetService;
use App\Sections\Report\Http\Controllers\BadgeController;
use App\Sections\Report\Http\Controllers\ProgresController;
use App\Sections\Report\Services\BadgeService;
use App\Sections\Report\Services\LaporanTagService;
use App\Sections\Report\Services\RemedialService;
use App\Sections\School\Services\MuridService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PasswordResetController extends Controller
{
    /**
     * Minta tautan reset (anti-enumerasi: respons identik untuk email apa pun).
     */
    public function lupa(LupaSandiRequest $request, PasswordResetService $reset): JsonResponse
    {
        return response()->json([
            'message' => $reset->kirimTautan((string) $request->input('email')),
        ]);
    }

    /**
     * Terapkan kata sandi baru dengan token sekali pakai.
     *
     * Bila tautan sudah pernah dipakai, respons tetap 200 (pesan dan skema tidak
     * berubah) tetapi diberi penanda `tautan_dipakai: true` supaya UI bisa
     * menampilkan halaman "tautan sudah dipakai" alih-alih form yang pasti gagal
     * lagi. Pesan galatnya tetap sengaja sama untuk token salah maupun terpakai
     * (tidak ada informasi keamanan yang bocor).
     */
    public function aturUlang(AturUlangSandiRequest $request, PasswordResetService $reset): JsonResponse
    {
        $pesan = $reset->terapkan(
            (string) $request->input('email'),
            (string) $request->input('token'),
            (string) $request->input('password'),
        );

        return response()->json([
            'message' => $pesan,
            'tautan_dipakai' => $reset->tautanSudahDipakai(),
        ]);
    }

    /**
     * Alias POST dari `/progres/saya` — sengaja disediakan supaya klien yang
     * (salah) mengirim POST tidak menabrak 405/403. Keduanya hanya membaca:
     * tidak ada perubahan data, jadi GET dan POST setara.
     */
    public function progresSayaPost(
        Request $request,
        LaporanTagService $laporan,
        RemedialService $remedial,
        BadgeService $badge,
        MuridService $muridService,
    ): JsonResponse {
        return app(ProgresController::class)->saya($request, $laporan, $remedial, $badge, $muridService);
    }

    /**
     * Alias POST dari `/badge/saya` — setara GET, hanya membaca.
     */
    public function badgeSayaPost(Request $request, BadgeService $service, MuridService $muridService): JsonResponse
    {
        return app(BadgeController::class)->saya($request, $service, $muridService);
    }
}
