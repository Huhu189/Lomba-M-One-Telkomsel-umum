<?php

declare(strict_types=1);

namespace App\Sections\Material\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Material\Http\Requests\MulaiUnggahanRequest;
use App\Sections\Material\Http\Requests\SimpanPotonganRequest;
use App\Sections\Material\Http\Resources\UnggahanResource;
use App\Sections\Material\Models\Materi;
use App\Sections\Material\Models\UnggahanMateri;
use App\Sections\Material\Services\PenyimpananMateri;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Unggah berkas materi secara berpotongan.
 *
 * Hanya guru yang boleh mengunggah, dan hanya ke sesi unggahannya sendiri.
 */
class UnggahanController extends Controller
{
    /** Buka sesi unggah untuk sebuah materi. */
    public function mulai(MulaiUnggahanRequest $request, Materi $materi, PenyimpananMateri $penyimpanan): JsonResponse
    {
        $this->authorize('berkas', $materi);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $unggahan = $penyimpanan->mulai(
            (int) $materi->school_id,
            (int) $pengguna->getKey(),
            (int) $materi->getKey(),
            (string) $request->validated('nama'),
            (int) $request->validated('ukuran'),
        );

        return (new UnggahanResource($unggahan))->response()->setStatusCode(201);
    }

    /** Terima satu potongan (idempoten; kirim ulang potongan yang sama aman). */
    public function potongan(
        SimpanPotonganRequest $request,
        UnggahanMateri $unggahan,
        int $indeks,
        PenyimpananMateri $penyimpanan,
    ): JsonResponse {
        $this->pemilik($request, $unggahan);

        $isi = $request->isi();

        if ($isi === '') {
            throw ValidationException::withMessages(['potongan' => 'Isi potongan kosong.']);
        }

        $potongan = $penyimpanan->simpanPotongan($unggahan, $indeks, $isi, $request->input('hash'));

        return response()->json([
            'message' => 'Potongan diterima.',
            'indeks' => $potongan->indeks,
            'ukuran' => $potongan->ukuran,
            'hash' => $potongan->hash,
        ]);
    }

    /** Gabungkan semua potongan, klasifikasi isi, dan terbitkan URL. */
    public function selesai(Request $request, UnggahanMateri $unggahan, PenyimpananMateri $penyimpanan): UnggahanResource
    {
        $this->pemilik($request, $unggahan);

        return new UnggahanResource($penyimpanan->selesai($unggahan));
    }

    public function destroy(Request $request, UnggahanMateri $unggahan, PenyimpananMateri $penyimpanan): JsonResponse
    {
        $this->pemilik($request, $unggahan);

        $penyimpanan->hapus($unggahan);

        return response()->json(['message' => 'Berkas dibuang.']);
    }

    private function pemilik(Request $request, UnggahanMateri $unggahan): void
    {
        $pengguna = $request->user();

        if ($pengguna === null || ! $pengguna->isGuru() || (int) $unggahan->user_id !== (int) $pengguna->getKey()) {
            abort(403, 'Kamu tidak berhak atas berkas ini.');
        }
    }
}
