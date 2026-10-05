<?php

declare(strict_types=1);

namespace App\Sections\Settings\Enums;

/**
 * Lingkup (lapis) pengaturan tiga lapis (chunk slice-02).
 */
enum LingkupPengaturan: string
{
    case Sekolah = 'sekolah';
    case Kelas = 'kelas';
    case Kuis = 'kuis';

    public function label(): string
    {
        return match ($this) {
            self::Sekolah => 'Sekolah',
            self::Kelas => 'Kelas',
            self::Kuis => 'Kuis',
        };
    }
}
