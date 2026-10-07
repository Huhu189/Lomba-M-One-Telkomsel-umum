<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Attempt\Http\Requests\BagiTimRequest;
use App\Sections\Attempt\Http\Requests\SimpanTimRequest;
use App\Sections\Attempt\Models\Tim;
use App\Sections\Attempt\Services\TimService;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Tim kuis mode kelompok (slice 09-C).
 *
 * Guru pemilik kuis menyusun tim (satu-satu atau dibagi otomatis); murid hanya
 * melihat timnya sendiri. Semua keputusan ada di TimService.
 */
class TimController extends Controller
{
    /** Daftar tim + murid kelas (layar guru). */
    public function daftar(Kuis $kuis, TimService $service): JsonResponse
    {
        $this->authorize('update', $kuis);

        return response()->json($service->daftar($kuis));
    }

    /** Buat/ubah satu tim. */
    public function simpan(SimpanTimRequest $request, Kuis $kuis, TimService $service): JsonResponse
    {
        $this->authorize('update', $kuis);

        $timId = $request->input('tim_id');
        $tim = $timId !== null ? Tim::query()->findOrFail((int) $timId) : null;

        /** @var array<int, int> $murid */
        $murid = array_map('intval', (array) $request->input('murid', []));

        $ringkas = $service->simpan($kuis, $tim, (string) $request->input('nama'), $murid);

        return response()->json([
            'message' => 'Tim tersimpan.',
            'tim' => $ringkas,
        ]);
    }

    /** Bagi otomatis seluruh murid kelas menjadi beberapa tim. */
    public function bagi(BagiTimRequest $request, Kuis $kuis, TimService $service): JsonResponse
    {
        $this->authorize('update', $kuis);

        $hasil = $service->bagiOtomatis($kuis, (int) $request->input('jumlah_tim'));
        $hasil['message'] = 'Tim dibagi otomatis.';

        return response()->json($hasil);
    }

    /** Hapus satu tim (hanya sebelum kuis dikerjakan). */
    public function hapus(Kuis $kuis, Tim $tim, TimService $service): JsonResponse
    {
        $this->authorize('update', $kuis);

        $service->hapus($kuis, $tim);

        return response()->json(['message' => 'Tim dihapus.']);
    }

    /** Tim pemohon pada kuis ini (layar murid). */
    public function milikSaya(Request $request, Kuis $kuis, TimService $service): JsonResponse
    {
        $this->authorize('view', $kuis);

        $pengguna = $request->user();
        $pengguna?->loadMissing('murid');

        if ($pengguna?->murid === null) {
            abort(403, 'Endpoint ini untuk murid.');
        }

        return response()->json([
            'kuis_id' => $kuis->getKey(),
            'mode_tim' => $service->modeTim($kuis),
            'tim' => $service->ringkasUntukMurid($kuis, $pengguna->murid),
        ]);
    }
}
