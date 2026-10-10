<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Garis bilangan — anak menandai/menulis satu nilai pada garis bilangan.
 * konten: {teks?, min, max, langkah, matematika?, media?}
 * kunci : {nilai, toleransi}
 *
 * Nilainya dinilai seperti isian angka (boleh desimal, koma dibaca sebagai
 * pemisah desimal); hanya nilai yang masuk toleransi yang dianggap benar.
 */
final class PenanganGarisBilangan implements PenanganTipeSoal
{
    use BobotBiner;

    private const MAKS_RENTANG = 1000;

    public function validasiKonten(array $konten): array
    {
        $galat = [
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];

        $min = $konten['min'] ?? null;
        $max = $konten['max'] ?? null;
        $langkah = $konten['langkah'] ?? null;

        if (! is_int($min) && ! is_float($min)) {
            $galat[] = 'Garis bilangan wajib berisi konten.min berupa angka.';
        }

        if (! is_int($max) && ! is_float($max)) {
            $galat[] = 'Garis bilangan wajib berisi konten.max berupa angka.';
        }

        if (! is_int($langkah) && ! is_float($langkah)) {
            $galat[] = 'Garis bilangan wajib berisi konten.langkah berupa angka.';
        }

        if ((is_int($min) || is_float($min)) && (is_int($max) || is_float($max)) && (is_int($langkah) || is_float($langkah))) {
            if ((float) $max <= (float) $min) {
                $galat[] = 'konten.max wajib lebih besar dari konten.min.';
            }

            if ((float) $langkah <= 0) {
                $galat[] = 'konten.langkah wajib lebih besar dari 0.';
            }

            if ((float) $max - (float) $min > self::MAKS_RENTANG) {
                $galat[] = 'Rentang garis bilangan maksimal '.self::MAKS_RENTANG.'.';
            }
        }

        return $galat;
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $nilai = $kunci['nilai'] ?? null;

        if (! is_int($nilai) && ! is_float($nilai)) {
            return ['Kunci garis bilangan wajib berisi kunci.nilai berupa angka.'];
        }

        $toleransi = $kunci['toleransi'] ?? 0;

        if (! is_int($toleransi) && ! is_float($toleransi)) {
            return ['Kunci garis bilangan wajib berisi kunci.toleransi berupa angka.'];
        }

        if ((float) $toleransi < 0) {
            return ['kunci.toleransi tidak boleh negatif.'];
        }

        $min = $konten['min'] ?? null;
        $max = $konten['max'] ?? null;

        if ((is_int($min) || is_float($min)) && (is_int($max) || is_float($max))) {
            if ((float) $nilai < (float) $min || (float) $nilai > (float) $max) {
                return ['kunci.nilai wajib berada di antara konten.min dan konten.max.'];
            }
        }

        return [];
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        $nilai = $kunci['nilai'] ?? null;

        if (! is_int($nilai) && ! is_float($nilai)) {
            return false;
        }

        $dijawab = $this->bacaAngka($jawaban);

        if ($dijawab === null) {
            return false;
        }

        return abs($dijawab - (float) $nilai) <= (float) ($kunci['toleransi'] ?? 0);
    }

    /**
     * Baca angka dari jawaban murid (angka langsung, atau teks "1,5"/"-2").
     */
    private function bacaAngka(mixed $jawaban): ?float
    {
        if (is_int($jawaban) || is_float($jawaban)) {
            return (float) $jawaban;
        }

        if (! is_string($jawaban)) {
            return null;
        }

        $teks = str_replace(["\u{00A0}", ' ', "\u{202F}"], '', trim($jawaban));

        if ($teks === '') {
            return null;
        }

        $koma = substr_count($teks, ',');
        $titik = substr_count($teks, '.');

        if ($koma > 1 || $titik > 1) {
            $teks = str_replace([',', '.'], '', $teks);
        } else {
            $teks = str_replace(',', '.', $teks);
        }

        if (! preg_match('/^[+-]?(?:\d+\.?\d*|\.\d+)$/', $teks)) {
            return null;
        }

        return (float) $teks;
    }
}
