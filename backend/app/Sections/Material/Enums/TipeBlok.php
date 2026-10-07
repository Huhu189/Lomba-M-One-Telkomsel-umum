<?php

declare(strict_types=1);

namespace App\Sections\Material\Enums;

/**
 * Jenis blok materi: teks, media, atau kuis sisipan.
 *
 * Blok kuis tidak membawa soal sendiri — ia hanya menunjuk kuis yang sudah ada
 * di bank soal, sehingga tidak ada mesin penilaian kedua yang harus dijaga.
 */
enum TipeBlok: string
{
    case Teks = 'teks';

    case Media = 'media';

    case Kuis = 'kuis';

    public function label(): string
    {
        return match ($this) {
            self::Teks => 'Teks',
            self::Media => 'Media',
            self::Kuis => 'Kuis sisipan',
        };
    }

    /** Blok kuis perlu attempt lewat mesin kuis yang sama. */
    public function berkuis(): bool
    {
        return $this === self::Kuis;
    }
}
