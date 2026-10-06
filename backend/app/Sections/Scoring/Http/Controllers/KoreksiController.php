<?php

declare(strict_types=1);

namespace App\Sections\Scoring\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Scoring\Http\Requests\KoreksiRequest;
use App\Sections\Scoring\Http\Requests\MintaTokenKoreksiRequest;
use App\Sections\Scoring\Services\KoreksiService;
use Illuminate\Http\JsonResponse;

/**
 * Koreksi manual guru (slice 06): antrean soal yang perlu ditinjau, token
 * konfirmasi sekali pakai, lalu penyimpanan nilai baru.
 */
class KoreksiController extends Controller
{
    /**
     * Antrean koreksi satu kuis (memuat kunci — khusus guru).
     */
    public function antrean(Kuis $kuis, KoreksiService $service): JsonResponse
    {
        $this->authorize('koreksi', $kuis);

        return response()->json($service->antrean($kuis));
    }

    /**
     * Minta token konfirmasi untuk satu koreksi; token berlaku sekali + pendek.
     */
    public function token(MintaTokenKoreksiRequest $request, Attempt $attempt, KoreksiService $service): JsonResponse
    {
        $this->authorize('koreksi', $attempt);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        /** @var Soal $soal */
        $soal = Soal::query()->findOrFail((int) $request->input('question_id'));

        return response()->json($service->mintaToken(
            $pengguna,
            $attempt,
            $soal,
            (string) $request->input('alasan'),
            $request->ip(),
        ));
    }

    /**
     * Simpan koreksi (butuh token) lalu kembalikan total attempt yang baru.
     */
    public function simpan(KoreksiRequest $request, Attempt $attempt, KoreksiService $service): JsonResponse
    {
        $this->authorize('koreksi', $attempt);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        /** @var Soal $soal */
        $soal = Soal::query()->findOrFail((int) $request->input('question_id'));

        $jawaban = $service->koreksi(
            $pengguna,
            $attempt,
            $soal,
            (float) $request->input('skor'),
            (string) $request->input('alasan'),
            (string) $request->input('token'),
        );

        $segar = Attempt::query()->findOrFail($attempt->getKey());

        return response()->json([
            'message' => 'Nilai diperbarui dan tercatat di audit.',
            'attempt_id' => (int) $attempt->getKey(),
            'question_id' => (int) $soal->getKey(),
            'status' => $jawaban->status->value,
            'skor_soal' => (float) $jawaban->skor,
            'skor_maksimal_soal' => (float) $soal->skor,
            'total_skor' => (float) $segar->skor,
            'total_benar' => (int) $segar->jumlah_benar,
            'total_skor_maksimal' => (float) $segar->skor_maksimal,
        ]);
    }
}
