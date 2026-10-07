<?php

declare(strict_types=1);

namespace App\Sections\Material\Enums;

/**
 * Status unggahan berpotongan: menunggu (potongan masih dikirim), selesai
 * (sudah digabung dan diklasifikasi), gagal (ditolak/ditinggalkan).
 */
enum StatusUnggahan: string
{
    case Menunggu = 'menunggu';

    case Selesai = 'selesai';

    case Gagal = 'gagal';

    public function label(): string
    {
        return match ($this) {
            self::Menunggu => 'Menunggu potongan',
            self::Selesai => 'Selesai',
            self::Gagal => 'Gagal',
        };
    }
}
