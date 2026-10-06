<?php

declare(strict_types=1);

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
