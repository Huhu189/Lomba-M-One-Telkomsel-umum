<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Jobs;

use App\Sections\Attempt\Services\AttemptService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

/**
 * Tutup attempt yang ditinggalkan (tab/perangkat ditutup sebelum waktu habis).
 *
 * Mengapa perlu dijadwalkan: attempt seperti itu tetap berstatus `berjalan`
 * dengan kolom `aktif` terisi, sehingga (a) murid tidak bisa menyimpan jawaban
 * maupun mengumpulkan, dan tidak bisa memulai percobaan baru, serta (b) layar
 * guru menampilkan murid "sedang mengerjakan" berjam-jam setelah waktunya habis.
 *
 * Penutupan memakai penilaian yang sama seperti pengumpulan biasa, jadi jawaban
 * yang sempat tersimpan tetap dinilai apa adanya — tidak ada data yang dibuang.
 *
 * Fail-open: kegagalan sapuan tidak boleh mengganggu apa pun; murid yang kembali
 * akan tetap dibukakan jalannya lewat pemeriksaan di `AttemptService::mulai()`.
 */
class TutupAttemptBasi implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function handle(AttemptService $attempt): void
    {
        $attempt->tutupSemuaBasi();
    }

    public function failed(Throwable $galat): void
    {
        report($galat);
    }
}
