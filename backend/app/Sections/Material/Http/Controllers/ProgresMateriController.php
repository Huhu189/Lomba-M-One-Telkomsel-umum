<?php

declare(strict_types=1);

namespace App\Sections\Material\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Attempt\Http\Resources\AttemptResource;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Services\AttemptService;
use App\Sections\Material\Models\BlokMateri;
use App\Sections\Material\Models\Materi;
use App\Sections\Material\Services\ProgresMateriService;
use App\Sections\School\Models\Murid;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Murid menempuh materi berblok: lihat daftar, buka blok, tandai selesai.
 *
 * Aturan urutan blok wajib dan pembuatan attempt latihan ditegakkan
 * ProgresMateriService — controller hanya memeriksa hak akses.
 */
class ProgresMateriController extends Controller
{
    /** Daftar materi yang bisa ditempuh murid di kelasnya. */
    public function daftar(Request $request, ProgresMateriService $service): JsonResponse
    {
        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $daftar = [];

        foreach ($service->daftarMurid($pengguna) as $materi) {
            $daftar[] = [
                'id' => $materi->getKey(),
                'judul' => $materi->judul,
                'deskripsi' => $materi->deskripsi,
                'mapel_nama' => $materi->mapel?->nama,
                'tema_nama' => $materi->tag?->nama,
                'jumlah_blok' => (int) ($materi->blok_count ?? 0),
            ];
        }

        return response()->json(['materi' => $daftar]);
    }

    /** Buka satu blok; blok kuis langsung membuka attempt latihan. */
    public function buka(
        Request $request,
        Materi $materi,
        BlokMateri $blok,
        ProgresMateriService $service,
        AttemptService $attempt,
    ): JsonResponse {
        $this->authorize('kerjakan', $materi);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $hasil = $service->buka($materi, $blok, $pengguna);

        return response()->json([
            'blok' => $hasil['blok'],
            'attempt' => $hasil['attempt'] === null
                ? null
                : $this->bungkusAttempt($hasil['attempt'], $attempt, $request)->resolve($request),
        ]);
    }

    /** Tandai blok selesai (blok kuis menunggu latihannya dikumpulkan). */
    public function selesai(
        Request $request,
        Materi $materi,
        BlokMateri $blok,
        ProgresMateriService $service,
    ): JsonResponse {
        $this->authorize('kerjakan', $materi);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        return response()->json(['blok' => $service->selesai($materi, $blok, $pengguna)]);
    }

    /** Ringkasan progres satu materi (halaman murid). */
    public function ringkasan(Request $request, Materi $materi, ProgresMateriService $service): JsonResponse
    {
        $this->authorize('view', $materi);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        return response()->json($service->ringkasan($materi, $pengguna));
    }

    /**
     * Attempt latihan dibungkus seperti pengerjaan kuis biasa: soal tanpa kunci,
     * jawaban yang tersimpan, dan saklar proteksi (default mati untuk latihan).
     */
    private function bungkusAttempt(
        Attempt $attempt,
        AttemptService $service,
        Request $request,
    ): AttemptResource {
        $attempt = $service->muat($attempt);
        $resource = new AttemptResource($attempt);
        $resource->soal = $service->payloadSoal($attempt);
        $resource->jawaban = $service->payloadJawaban($attempt);
        $resource->proteksi = $service->saklarAntiCheat($attempt->kuis);

        return $resource;
    }
}
