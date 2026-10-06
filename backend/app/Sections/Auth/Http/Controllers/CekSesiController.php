<?php

declare(strict_types=1);

namespace App\Sections\Auth\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Titik pengecekan identitas cepat (dipakai klien saat memulihkan sesi & diagnostik).
 *
 * Sengaja berupa controller invokable, bukan closure di `routes/api.php`, supaya
 * `php artisan route:cache` tetap bisa dijalankan sebelum deploy.
 * Respons 200 apa pun jawabannya (tamu pun boleh memanggil) — tanpa 401 agar klien
 * tidak salah menampilkan "sesi berakhir" pada kunjungan pertama.
 */
class CekSesiController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        return response()->json(['terautentikasi' => $request->user() !== null]);
    }
}
