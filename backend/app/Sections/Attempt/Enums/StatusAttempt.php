<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Enums;

/**
 * Status pengerjaan kuis oleh murid.
 */
enum StatusAttempt: string
{
    case Berjalan = 'berjalan';
    case Selesai = 'selesai';

    public function label(): string
    {
        return match ($this) {
            self::Berjalan => 'Sedang dikerjakan',
            self::Selesai => 'Sudah dikumpulkan',
        };
    }
}
