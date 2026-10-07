<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Jobs;

use App\Sections\Attempt\Services\PenyimpananJawaban;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

/**
 * Buang sesi unggah lampiran jawaban yang ditinggalkan (sinyal putus, tab
 * ditutup) beserta potongan-potongannya.
 *
 * Fail-open: kegagalan sapuan tidak boleh mengganggu unggahan yang sedang
 * berjalan — sesi yang belum sempat disapu tetap bisa digabung pemiliknya.
 */
class SapuUnggahanJawabanYatim implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function handle(PenyimpananJawaban $penyimpanan): void
    {
        $penyimpanan->sapuYatim();
    }

    public function failed(Throwable $galat): void
    {
        report($galat);
    }
}
