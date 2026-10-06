<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Enums;

/**
 * Jenis pengerjaan — pembeda ada di baris attempt (bukan tabel baru):
 * 'latihan' = kuis sisipan materi berblok (F2); boleh berjalan bersamaan dengan
 * ulangan resmi karena batas "satu attempt aktif" dihitung per jenis.
 */
enum JenisAttempt: string
{
    case Ulangan = 'ulangan';
    case Latihan = 'latihan';

    public function label(): string
    {
        return match ($this) {
            self::Ulangan => 'Ulangan',
            self::Latihan => 'Latihan',
        };
    }

    /** Latihan tidak masuk ranking dan bukan skor asli. */
    public function resmi(): bool
    {
        return $this === self::Ulangan;
    }
}
