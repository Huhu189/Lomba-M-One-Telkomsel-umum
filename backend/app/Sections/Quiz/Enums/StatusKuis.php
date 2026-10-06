<?php

declare(strict_types=1);

namespace App\Sections\Quiz\Enums;

/**
 * Status kuis: draf (belum tampil ke murid), publikasi (terjadwal/tampil),
 * arsip (ditutup).
 */
enum StatusKuis: string
{
    case Draf = 'draf';
    case Publikasi = 'publikasi';
    case Arsip = 'arsip';

    public function label(): string
    {
        return match ($this) {
            self::Draf => 'Draf',
            self::Publikasi => 'Terbit',
            self::Arsip => 'Arsip',
        };
    }
}
