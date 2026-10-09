<?php

declare(strict_types=1);

namespace App\Sections\Cheat\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Cheat\Enums\StatusTinjauan;
use App\Sections\Cheat\Http\Requests\CatatKejadianRequest;
use App\Sections\Cheat\Http\Requests\TinjauKejadianRequest;
use App\Sections\Cheat\Http\Resources\KejadianKecuranganResource;
use App\Sections\Cheat\Models\KejadianKecurangan;
use App\Sections\Cheat\Services\KecuranganService;
use App\Sections\Presence\Services\PenyiarRealtime;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Catatan kecurangan (slice 07).
 *
 * Prinsip yang dijaga: sinyal kecurangan adalah **bahan tinjauan guru, bukan
 * vonis**. Controller ini tidak pernah menolak/menghentikan ulangan; ia hanya
 * mencatat dan menampilkan.
 */
class KecuranganController extends Controller
{
    /**
     * Murid mengirim kejadian berkelompok dari perangkatnya.
     */
    public function catat(
        CatatKejadianRequest $request,
        Attempt $attempt,
        KecuranganService $service,
        PenyiarRealtime $penyiar,
    ): JsonResponse {
        $this->authorize('catat', [KejadianKecurangan::class, $attempt]);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $tersimpan = $service->catat($attempt, $pengguna, (array) $request->validated('kejadian'));

        // Guru yang sedang memantau langsung tahu tanpa menunggu polling.
        // Kanal GURU saja (K-03): muatannya memuat `attempt_id`, jadi kanal
        // murid tidak boleh menerimanya.
        if ($tersimpan > 0) {
            $penyiar->siarkan($penyiar->kanalGuru((int) $attempt->quiz_id), [
                'jenis' => 'kejadian',
                'attempt_id' => (int) $attempt->getKey(),
                'jumlah' => $tersimpan,
            ]);
        }

        return response()->json([
            'message' => 'Kejadian tercatat.',
            'tersimpan' => $tersimpan,
        ], 201);
    }

    /**
     * Guru melihat catatan satu kuis (opsional disaring status tinjauan).
     */
    public function daftar(Request $request, Kuis $kuis, KecuranganService $service): AnonymousResourceCollection
    {
        $this->authorize('lihatSemua', KejadianKecurangan::class);
        $this->authorize('view', $kuis);

        $status = StatusTinjauan::tryFrom((string) $request->query('status', ''));

        return KejadianKecuranganResource::collection($service->daftar($kuis, $status));
    }

    /**
     * Guru meninjau satu catatan: valid atau tidak valid (+ alasan singkat).
     */
    public function tinjau(
        TinjauKejadianRequest $request,
        KejadianKecurangan $kejadian,
        KecuranganService $service,
    ): KejadianKecuranganResource {
        $this->authorize('tinjau', $kejadian);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $status = StatusTinjauan::from((string) $request->validated('status'));
        $catatan = $request->validated('catatan');

        $baru = $service->tinjau($kejadian, $status, $pengguna, is_string($catatan) ? $catatan : null);

        // Nama murid ikut supaya baris yang ditinjau bisa langsung ditampilkan
        // tanpa permintaan tambahan.
        $baru->load('murid.user');

        return new KejadianKecuranganResource($baru);
    }
}
