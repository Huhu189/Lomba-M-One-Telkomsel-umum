<?php

declare(strict_types=1);

namespace App\Sections\Presence\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Presence\Enums\ModeLayar;
use App\Sections\Presence\Http\Requests\SimpanLayarRequest;
use App\Sections\Presence\Services\LayarService;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Layar guru (slice 10).
 *
 * Dua arah di satu endpoint pasangan:
 * - **guru** membaca keadaan + bahan mengubahnya (daftar soal, batas panjang);
 * - **murid** kelas itu membaca keadaan yang sama, tanpa bahan pengendali.
 *
 * Deploy layar guru tetap berlaku walau SSE mati: endpoint `show` inilah yang
 * dipanggil ulang saat polling.
 */
class LayarController extends Controller
{
    public function show(Request $request, Kuis $kuis, LayarService $layar): JsonResponse
    {
        $this->authorize('layar', $kuis);

        return response()->json($layar->baca($kuis, (bool) $request->user()?->isGuru()));
    }

    public function simpan(SimpanLayarRequest $request, Kuis $kuis, LayarService $layar): JsonResponse
    {
        $this->authorize('update', $kuis);

        $pengguna = $request->user();

        if ($pengguna === null || ! $pengguna->isGuru()) {
            abort(403, 'Hanya guru yang bisa mengubah layar kelas.');
        }

        $judul = $request->validated('judul');
        $isi = $request->validated('isi');
        $soal = $request->validated('question_id');

        return response()->json($layar->ubah(
            $pengguna,
            $kuis,
            ModeLayar::from((string) $request->validated('mode')),
            is_string($judul) ? $judul : null,
            is_string($isi) ? $isi : null,
            is_numeric($soal) ? (int) $soal : null,
        ));
    }
}
