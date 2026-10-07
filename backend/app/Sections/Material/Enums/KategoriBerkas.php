<?php

declare(strict_types=1);

namespace App\Sections\Material\Enums;

/**
 * Kategori berkas hasil klasifikasi magic bytes.
 *
 * Tiga kategori ini menentukan **cara penyajian**, bukan sekadar label:
 * kategori 1 boleh tampil langsung (gambar/PDF/video/audio), kategori 2 dan 3
 * disajikan sebagai unduhan paksa berekstensi `.upload` supaya berkas aktif
 * tidak pernah dieksekusi di browser.
 */
enum KategoriBerkas: string
{
    case Umum = 'umum';

    case Berisiko = 'berisiko';

    case TidakDikenal = 'tidak_dikenal';

    public function label(): string
    {
        return match ($this) {
            self::Umum => 'Berkas umum',
            self::Berisiko => 'Berkas berisiko',
            self::TidakDikenal => 'Tidak dikenal',
        };
    }

    /** Boleh ditampilkan langsung (inline) di halaman murid. */
    public function bolehTampilLangsung(): bool
    {
        return $this === self::Umum;
    }

    /** Ekstensi saat disajikan: berkas berisiko tidak pernah memakai ekstensi aslinya. */
    public function ekstensiSajian(string $ekstensiAsli): string
    {
        return $this->bolehTampilLangsung() ? $ekstensiAsli : 'upload';
    }
}
