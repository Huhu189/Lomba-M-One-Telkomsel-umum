<?php

declare(strict_types=1);

namespace App\Sections\Auth\Enums;

enum UserStatus: string
{
    case Pending = 'pending';
    case Aktif = 'aktif';
    case Suspended = 'suspended';
    case Dihapus = 'dihapus';

    /** Label Indonesia untuk UI (chunk theme: status selalu dengan teks). */
    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Menunggu verifikasi',
            self::Aktif => 'Aktif',
            self::Suspended => 'Ditangguhkan',
            self::Dihapus => 'Dihapus',
        };
    }
}
