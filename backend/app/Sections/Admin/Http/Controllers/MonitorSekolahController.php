<?php

declare(strict_types=1);

namespace App\Sections\Admin\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Sections\Admin\Services\MonitorSekolahService;
use Illuminate\Http\JsonResponse;

/**
 * Dasbor skala sekolah (admin sekolah).
 *
 * Satu panggilan mengembalikan seluruh yang dibutuhkan beranda admin: berapa
 * murid & guru aktif, berapa ulangan berjalan, keadaan tiap kelas, dan jejak
 * audit terbaru. Read-only dan tanpa data pribadi murid (hanya angka), jadi
 * admin tidak perlu membuka daftar nilai siapa pun untuk tahu keadaan sekolah.
 */
class MonitorSekolahController extends Controller
{
    public function show(MonitorSekolahService $monitor): JsonResponse
    {
        $this->authorize('lihat', User::class);

        return response()->json($monitor->snapshot());
    }
}
