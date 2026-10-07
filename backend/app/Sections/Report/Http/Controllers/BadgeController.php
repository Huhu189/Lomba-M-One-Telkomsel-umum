<?php

declare(strict_types=1);

namespace App\Sections\Report\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Report\Services\BadgeService;
use App\Sections\School\Services\MuridService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Badge per mapel murid yang sedang masuk.
 */
class BadgeController extends Controller
{
    public function saya(Request $request, BadgeService $service, MuridService $muridService): JsonResponse
    {
        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $pengguna->loadMissing('murid');
        $murid = $pengguna->murid;

        // Murid lama yang profilnya belum ada (di luar jalur /daftar) disambungkan
        // di sini, bukan ditolak 403 — lihat MuridService::pastikanProfil.
        if ($murid === null && $pengguna->isMurid()) {
            $murid = $muridService->pastikanProfil($pengguna);
        }

        if ($murid === null) {
            abort(403, 'Hanya akun murid yang punya badge.');
        }

        return response()->json($service->untukMurid($murid));
    }
}
