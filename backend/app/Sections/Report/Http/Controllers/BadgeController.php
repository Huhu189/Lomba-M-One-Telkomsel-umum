<?php

declare(strict_types=1);

namespace App\Sections\Report\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Report\Services\BadgeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Badge per mapel murid yang sedang masuk.
 */
class BadgeController extends Controller
{
    public function saya(Request $request, BadgeService $service): JsonResponse
    {
        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $pengguna->loadMissing('murid');
        $murid = $pengguna->murid;

        if ($murid === null) {
            abort(403, 'Hanya akun murid yang punya badge.');
        }

        return response()->json($service->untukMurid($murid));
    }
}
