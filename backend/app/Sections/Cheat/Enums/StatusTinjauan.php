<?php

declare(strict_types=1);

namespace App\Sections\Cheat\Enums;

/**
 * Hasil tinjauan guru atas satu catatan kecurangan (chunk anticheat:
 * bukti, bukan vonis).
 */
enum StatusTinjauan: string
{
    case Menunggu = 'menunggu';
    case Valid = 'valid';
    case TidakValid = 'tidak_valid';

    public function label(): string
    {
        return match ($this) {
            self::Menunggu => 'Menunggu tinjauan',
            self::Valid => 'Valid',
            self::TidakValid => 'Tidak valid',
        };
    }
}
