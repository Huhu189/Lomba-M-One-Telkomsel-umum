<?php

declare(strict_types=1);

namespace App\Sections\Presence\Jobs;

use App\Sections\Presence\Services\PenyiarRealtime;
use App\Sections\Presence\Services\PresenceService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

/**
 * Sapu presence: buang entri basi dan catat murid yang lama tidak aktif.
 *
 * Catatan jujur: chunk menyebut sapuan tiap 10 detik, sedangkan penjadwal
 * Laravel berbasis cron tidak bisa lebih rapat dari satu menit. Karena itu
 * sapuan dijadwalkan tiap menit **dan** dijalankan sekali setiap kali guru
 * membuka Live Monitor, sehingga status yang dilihat guru tetap segar.
 *
 * Fail-open: kalau sapuan gagal, ulangan tetap jalan — kehadiran hanya
 * dihitung ulang dari ambang kesegaran saat monitor dibaca.
 */
class SapuPresence implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(private readonly bool $siarkan = true) {}

    public function handle(PresenceService $presence, PenyiarRealtime $penyiar): void
    {
        $dibuang = $presence->sapu();

        if ($this->siarkan && $dibuang > 0) {
            $penyiar->siarkan('ulangan:presence', ['jenis' => 'sapu', 'dibuang' => $dibuang]);
        }
    }

    public function failed(Throwable $galat): void
    {
        // Fail-open: sapuan yang gagal tidak boleh menjatuhkan apa pun.
        report($galat);
    }
}
