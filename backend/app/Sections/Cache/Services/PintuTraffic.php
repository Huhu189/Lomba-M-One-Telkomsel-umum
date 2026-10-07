<?php

declare(strict_types=1);

namespace App\Sections\Cache\Services;

use Illuminate\Support\Facades\Cache;

/**
 * Gerbang lalu lintas untuk cache L1 (slice 10).
 *
 * Aturannya: L1 baru dinyalakan kalau satu ruang dibaca lebih dari
 * `ambangAktif` kali per detik (mis. semua murid membuka ulangan serempak), dan
 * dimatikan lagi setelah turun di bawah `ambangMati`. Di antara dua ambang itu
 * keputusan terakhir dipertahankan (histeresis) supaya L1 tidak berkedip
 * nyala-mati saat lalu lintas naik-turun.
 */
final class PintuTraffic
{
    public function __construct(
        private readonly int $jendelaDetik,
        private readonly float $ambangAktif,
        private readonly float $ambangMati,
    ) {}

    /** Catat `jumlah` pembacaan pada satu ruang (dipakai untuk mengukur laju). */
    public function catat(string $ruang, int $jumlah = 1): void
    {
        $kunci = $this->kunciLaju($ruang);
        $jendela = max(1, $this->jendelaDetik);

        // Cache::add hanya berhasil bila kunci belum ada → aman sebagai penghitung
        // yang reset sendiri setiap jendela.
        Cache::add($kunci, 0, $jendela);
        Cache::increment($kunci, max(1, $jumlah));
    }

    /** Laju rata-rata (permintaan per detik) pada jendela terakhir. */
    public function laju(string $ruang): float
    {
        $jumlah = (int) Cache::get($this->kunciLaju($ruang), 0);

        return $jumlah / max(1, $this->jendelaDetik);
    }

    /** Apakah L1 boleh dipakai untuk ruang ini (dengan histeresis). */
    public function aktif(string $ruang): bool
    {
        $laju = $this->laju($ruang);
        $sebelumnya = Cache::get($this->kunciStatus($ruang));

        $aktif = match (true) {
            $laju >= $this->ambangAktif => true,
            $laju <= $this->ambangMati => false,
            default => (bool) ($sebelumnya ?? false),
        };

        Cache::put($this->kunciStatus($ruang), $aktif, max(3, $this->jendelaDetik * 3));

        return $aktif;
    }

    /** Lupakan hitungan & status satu ruang (dipakai test dan saat pembersihan). */
    public function bersihkan(string $ruang): void
    {
        Cache::forget($this->kunciLaju($ruang));
        Cache::forget($this->kunciStatus($ruang));
    }

    private function kunciLaju(string $ruang): string
    {
        return 'l1:laju:'.$ruang;
    }

    private function kunciStatus(string $ruang): string
    {
        return 'l1:status:'.$ruang;
    }
}
