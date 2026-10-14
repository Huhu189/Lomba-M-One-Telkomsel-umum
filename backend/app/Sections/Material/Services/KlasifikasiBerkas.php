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
 * Berkas arsip (zip/rar/7z) masuk kategori berisiko, dan apa pun yang tidak
 * dikenali masuk kategori tidak dikenal; keduanya hanya bisa **diunduh**, tidak
 * pernah ditampilkan langsung. Paket dokumen kantor (docx/xlsx/pptx) juga
 * berbentuk zip, tetapi isinya bahan pelajaran — jadi dibaca lebih dulu lewat
 * daftar isinya dan digolongkan sebagai `Dokumen` (14 Oktober 2026).
 *
 * Dokumen lama bergaya OLE (`\xD0\xCF\x11\xE0…` — .doc/.ppt/.xls) sengaja
 * **tidak** digolongkan dokumen: bentuk itu bisa membawa makro VBA, dan tidak
 * ada cara menjalankannya dengan aman hanya dari magic bytes.
 */
class KlasifikasiBerkas
{
    /**
     * Byte yang perlu dibaca pemanggil untuk mengenali isi berkas.
     *
     * Enam belas byte cukup untuk semua tanda tangan berkas, tetapi paket OOXML
     * perlu lebih: daftar isinya (`[Content_Types].xml`, `word/`, `xl/`, `ppt/`)
     * muncul beberapa kilobyte setelah kepala.
     */
    public const KEPALA_BYTE = 8192;

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

        // Zip: berisiko — kecuali paket dokumen kantor, yang dibaca lebih dulu.
        if (str_starts_with($awal, "PK\x03\x04")) {
            return $this->dokumenKantor($isi)
                ?? $this->hasil('zip', 'application/zip', KategoriBerkas::Berisiko);
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
     * Paket OOXML (Word/Excel/PowerPoint) dari daftar isi zip-nya.
     *
     * Karena entri berkas ditulis berurutan di awal arsip, nama-nama itu biasanya
     * sudah terlihat di kepala berkas. Ini sengaja **heuristik**, bukan pembaca
     * zip penuh: kalau daftar isinya tidak terlihat di kepala berkas (mis. entri
     * pertamanya dikompresi), hasilnya `null` dan berkasnya jatuh kembali ke
     * golongan `zip` yang harus diunduh — guru tetap bisa membukanya, hanya tidak
     * disajikan sebagai dokumen. Arah salahnya aman: tidak ada berkas yang keliru
     * naik menjadi "boleh ditampilkan".
     *
     * @return array{ekstensi: string, mime: string, kategori: KategoriBerkas}|null
     */
    private function dokumenKantor(string $isi): ?array
    {
        $kepala = substr($isi, 0, self::KEPALA_BYTE);

        // Tanpa [Content_Types].xml, ini zip biasa (atau paket yang tidak utuh).
        if (! str_contains($kepala, '[Content_Types].xml')) {
            return null;
        }

        if (str_contains($kepala, 'word/')) {
            return $this->hasil(
                'docx',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                KategoriBerkas::Dokumen,
            );
        }

        if (str_contains($kepala, 'xl/')) {
            return $this->hasil(
                'xlsx',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                KategoriBerkas::Dokumen,
            );
        }

        if (str_contains($kepala, 'ppt/')) {
            return $this->hasil(
                'pptx',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                KategoriBerkas::Dokumen,
            );
        }

        return null;
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
