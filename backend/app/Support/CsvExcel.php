<?php

declare(strict_types=1);

namespace App\Support;

use League\Csv\CharsetConverter;
use League\Csv\Reader;

/**
 * Helper CSV yang ramah Excel dengan regional Indonesia (Q-16).
 *
 * Excel berbahasa Indonesia memakai `;` sebagai pemisah daftar dan kerap
 * menyimpan berkas sebagai ANSI (Windows-1252), sedangkan PHP/Eloquent bekerja
 * dalam UTF-8 dan koma. Kelas ini menyembunyikan perbedaan itu:
 *
 * - `BOM_UTF8` ditulis di awal berkas ekspor agar Excel mengenali UTF-8.
 * - `reader()` mendeteksi pemisah dan mengonversi encoding saat impor.
 */
final class CsvExcel
{
    /** Byte-order mark UTF-8 yang membuat Excel membaca aksen dengan benar. */
    public const BOM_UTF8 = "\xEF\xBB\xBF";

    /** Pemisah yang boleh dipakai (aman untuk satu kolom CSV). */
    public const PEMISAH = [',', ';', "\t"];

    /**
     * Pilih pemisah yang paling mungkin dari baris pertama yang tidak kosong.
     */
    public static function deteksiPemisah(string $path): string
    {
        $berkas = @fopen($path, 'r');

        if ($berkas === false) {
            return ',';
        }

        $baris = '';

        while (($teks = fgets($berkas)) !== false) {
            $teks = str_replace(self::BOM_UTF8, '', $teks);

            if (trim($teks) !== '') {
                $baris = $teks;
                break;
            }
        }

        fclose($berkas);

        $jumlah = [];

        foreach (self::PEMISAH as $pemisah) {
            $jumlah[$pemisah] = substr_count($baris, $pemisah);
        }

        arsort($jumlah);
        $teratas = (string) array_key_first($jumlah);

        return $jumlah[$teratas] > 0 ? $teratas : ',';
    }

    /**
     * Deteksi encoding berkas. Berkas ANSI ditandai sebagai Windows-1252.
     */
    public static function deteksiEncoding(string $path): string
    {
        $berkas = @fopen($path, 'r');

        if ($berkas === false) {
            return 'UTF-8';
        }

        $sampel = (string) fread($berkas, 65536);
        fclose($berkas);

        // Buang beberapa byte terakhir: potongan karakter multibyte di ujung
        // sampel bisa membuat berkas UTF-8 yang sah terdeteksi sebagai ANSI.
        $sampel = substr($sampel, 0, max(0, strlen($sampel) - 4));

        if (mb_check_encoding($sampel, 'UTF-8')) {
            return 'UTF-8';
        }

        return mb_detect_encoding($sampel, ['Windows-1252', 'ISO-8859-1'], true) ?: 'Windows-1252';
    }

    /**
     * Reader siap pakai: pemisah terdeteksi, encoding dikonversi ke UTF-8, dan
     * BOM di header dilewati.
     */
    public static function reader(string $path): Reader
    {
        $reader = Reader::createFromPath($path, 'r');
        $reader->setDelimiter(self::deteksiPemisah($path));

        $encoding = self::deteksiEncoding($path);

        if ($encoding !== 'UTF-8') {
            CharsetConverter::addTo($reader, $encoding, 'UTF-8');
        }

        $reader->skipInputBOM();

        return $reader;
    }

    /**
     * Rapikan pemisah yang diminta klien; kembalikan `,` bila tidak dikenali.
     */
    public static function pemisahAman(?string $pemisah): string
    {
        return in_array($pemisah, self::PEMISAH, true) ? (string) $pemisah : ',';
    }
}
