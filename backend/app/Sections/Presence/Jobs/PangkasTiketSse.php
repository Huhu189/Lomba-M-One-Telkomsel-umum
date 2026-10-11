<?php

declare(strict_types=1);

namespace App\Sections\Presence\Jobs;

use App\Sections\Presence\Models\TiketSse;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Throwable;

/**
 * Pangkas tiket SSE yang sudah kedaluwarsa (K-10).
 *
 * Sebelum ini tidak ada satu pun yang membuang baris `sse_tickets`: setiap kali
 * guru membuka Live Monitor atau murid mengikuti layar, satu baris menetap
 * selamanya. Tabelnya tumbuh mengikuti pemakaian, bukan mengikuti jumlah
 * pengguna — dan itu bertahan setelah kuisnya selesai.
 *
 * Yang dibuang hanya tiket yang **sudah lewat** masa berlakunya (TTL 45 detik)
 * plus jeda satu jam, supaya baris yang masih mungkin dipakai (atau sedang
 * ditelusuri guru saat kejadian aneh) tidak hilang lebih dulu. Pemangkasan tidak
 * menyentuh Redis: kunci di sana sudah kedaluwarsa sendiri sesuai TTL-nya.
 */
class PangkasTiketSse implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /** Jeda sebelum tiket yang kedaluwarsa dianggap layak dibuang (menit). */
    public const JEDA_MENIT = 60;

    public function handle(): void
    {
        TiketSse::query()
            ->where('expires_at', '<', Carbon::now()->subMinutes(self::JEDA_MENIT))
            ->delete();
    }

    public function failed(Throwable $galat): void
    {
        // Fail-open: pemangkasan yang gagal tidak boleh menjatuhkan apa pun.
        report($galat);
    }
}
