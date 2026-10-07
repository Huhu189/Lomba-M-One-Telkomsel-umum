<?php

declare(strict_types=1);

namespace App\Sections\Avatar\Enums;

/**
 * Alasan laporan avatar.
 *
 * Daftarnya sengaja pendek dan berbahasa anak: pelapor adalah murid SD, sering
 * tanpa teks penjelasan. Alasan yang dipilih dengan satu ketukan jauh lebih
 * berguna bagi guru daripada kolom bebas yang kosong.
 */
enum AlasanLaporan: string
{
    case TidakPantas = 'tidak_pantas';
    case Bullying = 'bullying';
    case Spam = 'spam';
    case Lainnya = 'lainnya';

    public function label(): string
    {
        return match ($this) {
            self::TidakPantas => 'Gambar tidak pantas',
            self::Bullying => 'Menyinggung teman',
            self::Spam => 'Bukan foto asli / spam',
            self::Lainnya => 'Alasan lain',
        };
    }
}
