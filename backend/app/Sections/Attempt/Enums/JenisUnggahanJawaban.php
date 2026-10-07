<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Enums;

/**
 * Jenis lampiran jawaban murid.
 *
 * Ketiganya menempuh jalur yang sama (potongan ber-hash, diklasifikasi server),
 * tetapi perlakuannya berbeda di ujung:
 *
 * - `Gambar` datang dari kanvas jawaban dan **selalu diencode ulang ke PNG** di
 *   server, jadi berkas kiriman tidak pernah disajikan apa adanya.
 * - `Rekam` (rekaman diri) dibatasi durasinya dan hanya boleh bila saklar izin
 *   `rekam_diri` menyala — anak tidak boleh direkam tanpa izin sekolah/orang tua.
 * - `Berkas` mengikuti klasifikasi isi berkas: yang berisiko/tidak dikenal
 *   disajikan sebagai unduhan `.upload`, tidak pernah dijalankan inline.
 */
enum JenisUnggahanJawaban: string
{
    case Gambar = 'gambar';
    case Rekam = 'rekam';
    case Berkas = 'berkas';

    public function label(): string
    {
        return match ($this) {
            self::Gambar => 'Gambar jawaban',
            self::Rekam => 'Rekaman diri',
            self::Berkas => 'Berkas jawaban',
        };
    }

    /** Hanya rekaman diri yang memerlukan saklar izin. */
    public function perluIzin(): bool
    {
        return $this === self::Rekam;
    }

    /** Gambar kanvas selalu diencode ulang server menjadi PNG. */
    public function diencodeUlangPng(): bool
    {
        return $this === self::Gambar;
    }
}
