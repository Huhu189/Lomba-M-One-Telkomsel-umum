<?php

declare(strict_types=1);

namespace App\Sections\Avatar\Enums;

/**
 * Status satu berkas avatar murid.
 *
 * `Disembunyikan` bukan tindakan disiplin: ia hanya berarti "jangan tampilkan
 * ke murid lain sampai guru meninjau". Pemiliknya tetap melihat gambarnya, dan
 * guru tetap bisa memulihkannya — moderasi di sini menahan, bukan menghukum.
 */
enum StatusAvatar: string
{
    case Aktif = 'aktif';
    case Disembunyikan = 'disembunyikan';
    case Dihapus = 'dihapus';

    public function label(): string
    {
        return match ($this) {
            self::Aktif => 'Aktif',
            self::Disembunyikan => 'Disembunyikan (menunggu tinjauan)',
            self::Dihapus => 'Dihapus',
        };
    }

    /** Terlihat oleh murid lain dan guru. */
    public function terlihatSemua(): bool
    {
        return $this === self::Aktif;
    }
}
