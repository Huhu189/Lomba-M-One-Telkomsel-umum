<?php

declare(strict_types=1);

namespace App\Sections\Material\Services;

use App\Sections\Material\Enums\KategoriBerkas;

/**
 * Klasifikasi berkas dari **isi**, bukan dari nama atau header kiriman klien.
 *
 * Nama berkas dan `Content-Type` mudah dipalsukan: `foto.jpg` bisa berisi
 * berkas apa pun, dan klien bisa mengaku mengirim gambar padahal mengirim
 * HTML berisi skrip. Karena itu keputusan penyajian diambil dari magic bytes
 * yang dibaca server sendiri, dan hanya jenis yang memang dibutuhkan pelajaran
 * SD (gambar, PDF, video, audio) yang dianggap umum.
 *
 * Berkas arsip (zip/rar/7z — termasuk docx/xlsx/pptx yang bentuknya zip) masuk
 * kategori berisiko, dan apa pun yang tidak dikenali masuk kategori tidak
 * dikenal; keduanya hanya bisa **diunduh**, tidak pernah ditampilkan langsung.
 */
class KlasifikasiBerkas
{
    /**
     * Hasil klasifikasi: ekstensi sajian, mime sajian, dan kategori.
     *
     * @return array{ekstensi: string, mime: string, kategori: KategoriBerkas}
     */
    public function kenali(string $isi): array
    {
        $awal = substr($isi, 0, 16);
        $panjang = strlen($awal);

        if ($panjang === 0) {
            return $this->hasil('bin', 'application/octet-stream', KategoriBerkas::TidakDikenal);
        }

        if (str_starts_with($awal, "\xFF\xD8\xFF")) {
            return $this->hasil('jpg', 'image/jpeg', KategoriBerkas::Umum);
        }

        if (str_starts_with($awal, "\x89PNG\r\n\x1a\n")) {
            return $this->hasil('png', 'image/png', KategoriBerkas::Umum);
        }

        if (str_starts_with($awal, 'GIF87a') || str_starts_with($awal, 'GIF89a')) {
            return $this->hasil('gif', 'image/gif', KategoriBerkas::Umum);
        }

        if (str_starts_with($awal, 'RIFF') && $panjang >= 12) {
            $jenis = substr($awal, 8, 4);

            if ($jenis === 'WEBP') {
                return $this->hasil('webp', 'image/webp', KategoriBerkas::Umum);
            }

            if ($jenis === 'WAVE') {
                return $this->hasil('wav', 'audio/wav', KategoriBerkas::Umum);
            }
        }

        if (str_starts_with($awal, '%PDF-')) {
            return $this->hasil('pdf', 'application/pdf', KategoriBerkas::Umum);
        }

        // MP4 dan M4A sama-sama ber-`ftyp` pada byte ke-4.
        if ($panjang >= 8 && substr($awal, 4, 4) === 'ftyp') {
            return $this->hasil('mp4', 'video/mp4', KategoriBerkas::Umum);
        }

        if (str_starts_with($awal, "\x1A\x45\xDF\xA3")) {
            return $this->hasil('webm', 'video/webm', KategoriBerkas::Umum);
        }

        if (str_starts_with($awal, 'OggS')) {
            return $this->hasil('ogg', 'audio/ogg', KategoriBerkas::Umum);
        }

        // MP3: tag ID3 atau frame audio tanpa tag (0xFFEx/0xFFFx).
        if (str_starts_with($awal, 'ID3')) {
            return $this->hasil('mp3', 'audio/mpeg', KategoriBerkas::Umum);
        }

        if ($panjang >= 2 && ord($awal[0]) === 0xFF && (ord($awal[1]) & 0xE0) === 0xE0) {
            return $this->hasil('mp3', 'audio/mpeg', KategoriBerkas::Umum);
        }

        // Arsip: berisiko. Termasuk .docx/.xlsx/.pptx yang juga berawalan PK.
        if (str_starts_with($awal, "PK\x03\x04")) {
            return $this->hasil('zip', 'application/zip', KategoriBerkas::Berisiko);
        }

        if (str_starts_with($awal, "Rar!\x1A\x07")) {
            return $this->hasil('rar', 'application/vnd.rar', KategoriBerkas::Berisiko);
        }

        if (str_starts_with($awal, "7z\xBC\xAF\x27\x1C")) {
            return $this->hasil('7z', 'application/x-7z-compressed', KategoriBerkas::Berisiko);
        }

        // Termasuk SVG/XML/HTML: sengaja TIDAK pernah masuk kategori umum, karena
        // berkas teks semacam itu bisa membawa skrip yang berjalan di browser.
        return $this->hasil('bin', 'application/octet-stream', KategoriBerkas::TidakDikenal);
    }

    /**
     * Ekstensi dari nama berkas kiriman (hanya untuk penamaan; bukan dasar kategori).
     */
    public function ekstensiNama(string $namaAsli): string
    {
        $nama = mb_strtolower(pathinfo($namaAsli, PATHINFO_EXTENSION));
        $nama = preg_replace('/[^a-z0-9]/', '', $nama) ?? '';

        return $nama === '' ? 'bin' : mb_substr($nama, 0, 12);
    }

    /**
     * @return array{ekstensi: string, mime: string, kategori: KategoriBerkas}
     */
    private function hasil(string $ekstensi, string $mime, KategoriBerkas $kategori): array
    {
        return ['ekstensi' => $ekstensi, 'mime' => $mime, 'kategori' => $kategori];
    }
}
