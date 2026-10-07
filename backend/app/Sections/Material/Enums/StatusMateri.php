<?php

declare(strict_types=1);

namespace App\Sections\Material\Enums;

/**
 * Status materi: draf (belum tampil ke murid), publikasi, arsip.
 */
enum StatusMateri: string
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
