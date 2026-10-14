<?php

declare(strict_types=1);

namespace App\Sections\Material\Enums;

/**
 * Kategori berkas hasil klasifikasi magic bytes.
 *
 * Empat kategori ini menentukan **cara penyajian**, bukan sekadar label:
 * kategori 1 (gambar/PDF/video/audio) dan kategori 2 (dokumen kantor) boleh
 * tampil memakai ekstensi & mime aslinya, sedangkan kategori 3 (arsip dan
 * berkas tak dikenal) disajikan sebagai unduhan paksa berekstensi `.upload`
 * supaya berkas aktif tidak pernah dieksekusi di browser.
 *
 * Kategori dokumen ada karena guru SD hampir selalu punya bahan ajar dalam
 * bentuk PDF, Word, PowerPoint, atau Excel. Menyajikan `.pptx` sebagai
 * `berkas.upload` membuat bahan itu tidak bisa dibuka sama sekali (14 Oktober
 * 2026). Yang menentukan golongan berkas tetap **isi**-nya, bukan namanya.
 */
enum KategoriBerkas: string
{
    case Umum = 'umum';

    case Dokumen = 'dokumen';

    case Berisiko = 'berisiko';

    case TidakDikenal = 'tidak_dikenal';

    public function label(): string
    {
        return match ($this) {
            self::Umum => 'Berkas umum',
            self::Dokumen => 'Dokumen kantor',
            self::Berisiko => 'Berkas berisiko',
            self::TidakDikenal => 'Tidak dikenal',
        };
    }

    /**
     * Boleh disajikan memakai ekstensi & mime aslinya (bukan `.upload`)?
     *
     * Ini yang dibaca penyimpanan (nama berkas di disk) dan penyajian
     * (`Content-Disposition: inline`). Dokumen kantor ikut di sini supaya
     * berkasnya tetap bernama `.docx`/`.pptx` — bisa dibuka aplikasi dokumen
     * murid/guru — bukan diunduh sebagai blob `.upload` yang tak terbaca.
     */
    public function bolehTampilLangsung(): bool
    {
        return $this === self::Umum || $this === self::Dokumen;
    }

    /**
     * Cara peramban sebaiknya menampilkan berkas ini.
     *
     * - `semat` — benar-benar tampil di dalam halaman (gambar/video/audio/PDF).
     * - `dokumen` — dibuka di tab/aplikasi dokumen; peramban desktop memang
     *   tidak bisa merender Word/PowerPoint, jadi tombol "Unduh" akan
     *   menyesatkan. Yang ditawarkan "Buka dokumen".
     * - `unduh` — memang harus diunduh (arsip & berkas tak dikenal).
     */
    public function sajian(): string
    {
        return match ($this) {
            self::Umum => 'semat',
            self::Dokumen => 'dokumen',
            self::Berisiko, self::TidakDikenal => 'unduh',
        };
    }

    /** Ekstensi saat disajikan: berkas berisiko tidak pernah memakai ekstensi aslinya. */
    public function ekstensiSajian(string $ekstensiAsli): string
    {
        return $this->bolehTampilLangsung() ? $ekstensiAsli : 'upload';
    }
}
