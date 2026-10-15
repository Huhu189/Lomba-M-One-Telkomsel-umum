<?php

declare(strict_types=1);

namespace App\Sections\Presence\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Presence\Services\MonitorService;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Http\JsonResponse;

/**
 * Snapshot Live Monitor (slice 07) untuk guru.
 *
 * Endpoint ini adalah jalur awal sekaligus jalur cadangan: tanpa SSE (mis. Redis
 * sedang mati) guru cukup memanggil ulang endpoint yang sama untuk memperbarui
 * layar. Karena itu Live Monitor tidak pernah "kosong" walau SSE gagal.
 */
class MonitorController extends Controller
{
    public function show(Kuis $kuis, MonitorService $monitor): JsonResponse
    {
        $this->pastikanGuruPemantau($kuis);

        return response()->json($monitor->snapshot($kuis));
    }

    /**
     * Lembar jawaban satu murid di Monitor Ulangan (15 Oktober 2026).
     *
     * Guru yang melihat satu anak berhenti di soal 7 bisa langsung membuka apa
     * yang sudah ditulis anak itu — tanpa berjalan ke mejanya, dan tanpa
     * berpindah ke halaman koreksi (yang isinya baru lengkap setelah dikumpulkan).
     *
     * Batas bacanya sengaja SAMA dengan monitor (K-04): pemilik kuis, dan kepala
     * sekolah yang memang mengawasi. Yang berbeda dari halaman koreksi: di sini
     * **tidak ada kunci jawaban dan tidak ada nilai per soal** — layar monitor
     * terbuka di depan kelas (lihat catatan `MonitorService::lembarJawaban`).
     */
    public function jawaban(Kuis $kuis, Attempt $attempt, MonitorService $monitor): JsonResponse
    {
        $this->pastikanGuruPemantau($kuis);

        // Attempt dari kuis lain = 404, bukan 403: sekaligus menutup jalan
        // menebak attempt milik kuis orang lain lewat monitor sendiri.
        abort_if((int) $attempt->quiz_id !== (int) $kuis->getKey(), 404, 'Attempt itu bukan bagian dari kuis ini.');

        return response()->json($monitor->lembarJawaban($attempt));
    }

    /**
     * Hanya guru yang memantau, dan hanya kuisnya sendiri.
     *
     * Kepala sekolah ikut diizinkan karena `KuisPolicy::view` memang membolehkan
     * ia membaca keadaan kuis di sekolahnya (ia mengawasi, tidak mengubah) — sama
     * seperti jalur `show`. Murid tetap ditolak walaupun kuisnya terbit: monitor
     * memuat keadaan seluruh kelas, bukan miliknya sendiri.
     */
    private function pastikanGuruPemantau(Kuis $kuis): void
    {
        $this->authorize('view', $kuis);

        if (! request()->user()?->isGuru()) {
            abort(403, 'Hanya guru yang bisa memantau ulangan.');
        }
    }
}
