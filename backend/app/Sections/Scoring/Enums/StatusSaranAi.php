<?php

declare(strict_types=1);

namespace App\Sections\Scoring\Enums;

/**
 * Hasil satu kali permintaan saran AI untuk satu jawaban (slice 09-B).
 *
 * Tidak ada status "dinilai": AI tidak pernah menutup penilaian. Yang ada hanya
 * saran yang bisa dipakai guru, atau kegagalan yang membuat jawaban tetap
 * menunggu tinjauan manusia.
 */
enum StatusSaranAi: string
{
    case Saran = 'saran';
    case Gagal = 'gagal';

    public function label(): string
    {
        return match ($this) {
            self::Saran => 'Saran AI tersedia',
            self::Gagal => 'AI gagal menilai',
        };
    }
}
