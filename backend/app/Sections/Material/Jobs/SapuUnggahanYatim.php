<?php

declare(strict_types=1);

namespace App\Sections\Material\Jobs;

use App\Sections\Material\Services\PenyimpananMateri;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

/**
 * Buang sesi unggah yang ditinggalkan (koneksi putus di tengah jalan, tab
 * ditutup) beserta potongan-potongannya.
 *
 * Tanpa ini, potongan berkas berukuran besar akan menumpuk di storage tanpa
 * pernah muncul di mana pun — memakan kuota sekolah tanpa bisa dilihat guru.
 *
 * Fail-open: kegagalan sapuan tidak boleh mengganggu unggahan yang sedang
 * berjalan; sesi yang gagal disapu tetap bisa digabung sendiri oleh pemiliknya.
 */
class SapuUnggahanYatim implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function handle(PenyimpananMateri $penyimpanan): void
    {
        $penyimpanan->sapuYatim();
    }

    public function failed(Throwable $galat): void
    {
        report($galat);
    }
}
