<?php

declare(strict_types=1);

namespace App\Sections\Material\Enums;

/**
 * Status progres murid pada satu blok materi.
 */
enum StatusProgres: string
{
    case Dibuka = 'dibuka';

    case Selesai = 'selesai';

    public function label(): string
    {
        return match ($this) {
            self::Dibuka => 'Sedang dibuka',
            self::Selesai => 'Selesai',
        };
    }
}
