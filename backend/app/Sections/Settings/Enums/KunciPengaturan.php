<?php

declare(strict_types=1);

namespace App\Sections\Settings\Enums;

/**
 * Kunci pengaturan yang dikenali beserta tipe, nilai bawaan, dan labelnya.
 * Berlaku untuk retry, batas percobaan, remedial, ranking, layar guru,
 * mode tim, dan saklar anti-cheat (chunk slice-02).
 */
enum KunciPengaturan: string
{
    case Retry = 'retry';
    case BatasPercobaan = 'batas_percobaan';
    case Remedial = 'remedial';
    case Ranking = 'ranking';
    case LayarGuru = 'layar_guru';
    case ModeTim = 'mode_tim';
    case AntiCheat = 'anti_cheat';

    /** Tipe nilai yang diterima ('boolean' | 'integer'). */
    public function tipe(): string
    {
        return match ($this) {
            self::BatasPercobaan => 'integer',
            default => 'boolean',
        };
    }

    /** Nilai bawaan bila tidak diatur di lapis mana pun. */
    public function bawaan(): bool|int
    {
        return match ($this) {
            self::BatasPercobaan => 3,
            self::ModeTim => false,
            default => true,
        };
    }

    /** Kelompok tampilan di halaman pengaturan. */
    public function kelompok(): string
    {
        return match ($this) {
            self::AntiCheat => 'Anti-cheat',
            self::LayarGuru, self::ModeTim, self::Ranking => 'Tampilan & laporan',
            default => 'Aturan ulangan',
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Retry => 'Izinkan ulangan ulang (retry)',
            self::BatasPercobaan => 'Batas percobaan',
            self::Remedial => 'Aktifkan remedial',
            self::Ranking => 'Tampilkan ranking',
            self::LayarGuru => 'Aktifkan layar guru',
            self::ModeTim => 'Aktifkan mode tim',
            self::AntiCheat => 'Aktifkan anti-cheat',
        };
    }
}
