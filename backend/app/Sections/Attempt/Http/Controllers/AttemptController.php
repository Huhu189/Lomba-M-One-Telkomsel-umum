<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Attempt\Http\Requests\JawabRequest;
use App\Sections\Attempt\Http\Requests\KumpulkanRequest;
use App\Sections\Attempt\Http\Resources\AttemptHasilResource;
use App\Sections\Attempt\Http\Resources\AttemptResource;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Services\AttemptService;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Pengerjaan kuis oleh murid. Semua keputusan (waktu, urutan, skor) dikerjakan
 * AttemptService; controller hanya memeriksa policy dan membungkus respons.
 */
class AttemptController extends Controller
{
    /**
     * Mulai atau lanjutkan attempt aktif murid untuk satu kuis.
     */
    public function mulai(Request $request, Kuis $kuis, AttemptService $service): JsonResponse
    {
        $this->authorize('create', Attempt::class);
        $this->authorize('view', $kuis);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $attempt = $service->mulai($kuis, $pengguna);

        $resource = new AttemptResource($attempt);
        $resource->soal = $service->payloadSoal($attempt);
        $resource->jawaban = $service->payloadJawaban($attempt);

        return $resource->response()->setStatusCode(201);
    }

    /**
     * Status attempt berjalan + soal dalam urutan seed (tanpa kunci).
     */
    public function show(Attempt $attempt, AttemptService $service): AttemptResource
    {
        $this->authorize('view', $attempt);

        $attempt = $service->muat($attempt);

        $resource = new AttemptResource($attempt);
        $resource->soal = $service->payloadSoal($attempt);
        $resource->jawaban = $service->payloadJawaban($attempt);

        return $resource;
    }

    /**
     * Simpan satu jawaban (autosave). Server menolak setelah deadline.
     */
    public function jawab(JawabRequest $request, Attempt $attempt, AttemptService $service): JsonResponse
    {
        $this->authorize('jawab', $attempt);

        /** @var Soal $soal */
        $soal = Soal::query()->findOrFail((int) $request->input('question_id'));
        $jawaban = $service->simpanJawaban($attempt, $soal, $request->input('jawaban'));

        return response()->json([
            'message' => 'Jawaban tersimpan.',
            'question_id' => $soal->getKey(),
            'status' => $jawaban->status->value,
        ]);
    }

    /**
     * Kumpulkan + nilai. Idempoten lewat idempotency key dari klien dan status
     * attempt di server.
     */
    public function kumpulkan(KumpulkanRequest $request, Attempt $attempt, AttemptService $service): JsonResponse
    {
        $this->authorize('kumpulkan', $attempt);

        $attempt = $service->kumpulkan($attempt, (string) $request->validated('idempotency_key'));

        return $this->bungkusHasil($attempt, $service)->response();
    }

    /**
     * Hasil ulangan (murid: miliknya sendiri; guru: untuk ditinjau).
     */
    public function hasil(Attempt $attempt, AttemptService $service): AttemptHasilResource
    {
        $this->authorize('hasil', $attempt);

        $attempt = $service->muatHasil($attempt);

        return $this->bungkusHasil($attempt, $service);
    }

    /**
     * Bungkus hasil attempt + rincian per soal (tanpa `additional()` agar tetap
     * tanpa pembungkus "data", sesuai kesepakatan API repo ini).
     */
    private function bungkusHasil(Attempt $attempt, AttemptService $service): AttemptHasilResource
    {
        $resource = new AttemptHasilResource($attempt);
        $resource->rincian = $service->rincianHasil($attempt);
        $resource->ringkasan = $service->ringkasanPenilaian($attempt);

        return $resource;
    }
}
