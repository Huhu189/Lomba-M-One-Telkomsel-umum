<?php

declare(strict_types=1);

use App\Sections\Attempt\Jobs\TutupAttemptBasi;
use App\Sections\Material\Jobs\SapuUnggahanYatim;
use App\Sections\Presence\Jobs\SapuPresence;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Sapuan presence (slice 07): buang kehadiran basi dan catat murid yang lama
// tidak aktif. Penjadwal Laravel berbasis cron tidak bisa lebih rapat dari satu
// menit, jadi sapuan tambahan dijalankan setiap kali guru membuka Live Monitor
// (lihat MonitorService) — status yang dilihat guru tetap segar.
Schedule::job(new SapuPresence)->everyMinute()->withoutOverlapping()->name('sapu-presence');

// Tutup attempt yang ditinggalkan (slice 04): tanpa ini murid yang menutup tab
// sebelum waktu habis akan mentok — jawab ditolak (deadline lewat), kumpulkan
// ditolak (lewat toleransi), dan percobaan baru tidak bisa dimulai karena kolom
// `aktif` attempt lama masih terisi.
Schedule::job(new TutupAttemptBasi)->everyMinute()->withoutOverlapping()->name('tutup-attempt-basi');

// Buang sesi unggah materi yang ditinggalkan (slice 08). Tanpa ini potongan
// berkas besar menumpuk di storage tanpa pernah muncul di layar guru, memakan
// kuota sekolah diam-diam. Tidak perlu tiap menit; cukup tiap seperempat jam.
Schedule::job(new SapuUnggahanYatim)->everyFifteenMinutes()->withoutOverlapping()->name('sapu-unggahan-yatim');
