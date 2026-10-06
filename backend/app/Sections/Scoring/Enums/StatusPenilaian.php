<?php

declare(strict_types=1);

namespace App\Sections\Scoring\Enums;

/**
 * Status penilaian satu soal. Kegagalan satu soal tidak menjatuhkan soal lain —
 * soal yang gagal ditandai di sini dan tidak menghasilkan 500 mentah ke klien.
 */
enum StatusPenilaian: string
{
    case Menunggu = 'menunggu';
    case Dinilai = 'dinilai';
    case PerluTinjau = 'perlu_tinjau';
    case Gagal = 'gagal';

    public function label(): string
    {
        return match ($this) {
            self::Menunggu => 'Menunggu dinilai',
            self::Dinilai => 'Dinilai',
            self::PerluTinjau => 'Perlu ditinjau guru',
            self::Gagal => 'Gagal dinilai',
        };
    }

    /** Sudah final (tidak akan dinilai ulang otomatis). */
    public function selesai(): bool
    {
        return $this !== self::Menunggu;
    }
}
