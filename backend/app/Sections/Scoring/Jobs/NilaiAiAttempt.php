<?php

declare(strict_types=1);

namespace App\Sections\Scoring\Jobs;

use App\Sections\Attempt\Models\Attempt;
use App\Sections\Scoring\Services\PenilaiAiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Minta saran AI untuk satu ulangan (slice 09-B).
 *
 * Ada di queue supaya menekan "kumpulkan" tidak ikut menunggu layanan AI, dan
 * supaya satu ulangan hanya menghasilkan sedikit permintaan ke API. Job ini
 * tidak akan pernah mengubah nilai final: kegagalan pun hanya ditandai
 * "AI gagal" agar guru tetap meninjau.
 */
class NilaiAiAttempt implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /** Sekali coba saja: gagal = tandai perlu ditinjau, bukan menumpuk antrean. */
    public int $tries = 1;

    public int $timeout = 120;

    public function __construct(public readonly int $attemptId) {}

    public function handle(PenilaiAiService $service): void
    {
        if (! $service->aktif()) {
            return;
        }

        $attempt = Attempt::query()->find($this->attemptId);

        if ($attempt === null) {
            return;
        }

        $tersimpan = $service->proses($attempt);

        // Tidak ada satu pun saran tersimpan padahal ada kandidat: jejak gagal
        // supaya antrean koreksi guru tidak diam-diam kosong tanpa alasan.
        if ($tersimpan === 0 && $service->kandidat($attempt) !== []) {
            $service->tandaiGagal($attempt);
        }
    }
}
