<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Normalisasi & kemiripan teks untuk soal isian singkat dan uraian (slice 06).
 *
 * Aturan yang ditegakkan di sini (chunk slice-06): angka harus persis, ada
 * penjaga negasi, toleransi typo per kata, dan kemiripan huruf > 80%.
 */
final class BantuanTeks
{
    /** Kemiripan huruf minimum agar sebuah kata dianggap "kata yang sama". */
    public const AMBANG_MIRIP_KATA = 0.8;

    /**
     * Kata negasi bawaan: muncul di jawaban murid tetapi tidak ada di jawaban
     * baku = jawaban dianggap salah walau hurufnya mirip.
     *
     * @var array<int, string>
     */
    public const NEGASI_BAWAAN = ['tidak', 'bukan', 'bukanlah', 'jangan', 'tanpa', 'kecuali'];

    /**
     * Normalisasi: huruf kecil, tanda baca jadi spasi, spasi dirapikan.
     */
    public static function normalisasi(string $teks): string
    {
        $teks = mb_strtolower(trim($teks));
        $teks = (string) preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $teks);

        return trim((string) preg_replace('/\s+/u', ' ', $teks));
    }

    /**
     * @return array<int, string>
     */
    public static function kata(string $teks): array
    {
        $bersih = self::normalisasi($teks);

        return $bersih === '' ? [] : explode(' ', $bersih);
    }

    /**
     * Token angka (termasuk desimal) pada teks. Dipakai agar angka harus persis:
     * "1/2" dan "0,5" tidak dianggap mirip, tetapi "1,5" dan "1.5" sama.
     *
     * @return array<int, string>
     */
    public static function angka(string $teks): array
    {
        preg_match_all('/\d+(?:[.,]\d+)?/u', $teks, $cocok);

        return array_map(
            static fn (string $satu): string => str_replace(',', '.', $satu),
            $cocok[0],
        );
    }

    public static function miripHuruf(string $a, string $b): float
    {
        $a = self::normalisasi($a);
        $b = self::normalisasi($b);

        if ($a === '' || $b === '') {
            return 0.0;
        }

        if ($a === $b) {
            return 1.0;
        }

        similar_text($a, $b, $persen);

        return $persen / 100;
    }

    /**
     * Dua kata dianggap sama bila identik atau mirip ≥ 80%. Kata berupa angka
     * tidak pernah dianggap mirip — angka harus persis.
     */
    public static function miripKata(string $a, string $b): bool
    {
        if ($a === $b) {
            return true;
        }

        if ($a === '' || $b === '') {
            return false;
        }

        if (ctype_digit($a) || ctype_digit($b)) {
            return false;
        }

        return self::miripHuruf($a, $b) >= self::AMBANG_MIRIP_KATA;
    }

    /**
     * Kemiripan per kata: setiap kata baku dicari pasangannya di jawaban.
     * Hasil 0..1 dibagi jumlah kata terbanyak supaya kalimat yang terlalu
     * panjang (mis. ditambah kata sanggahan) tidak otomatis lolos.
     */
    public static function kemiripanKata(string $baku, string $jawaban): float
    {
        $kataBaku = self::kata($baku);
        $sisa = self::kata($jawaban);

        if ($kataBaku === [] || $sisa === []) {
            return 0.0;
        }

        $cocok = 0;

        foreach ($kataBaku as $kata) {
            foreach ($sisa as $indeks => $lain) {
                if (self::miripKata($kata, $lain)) {
                    $cocok++;
                    unset($sisa[$indeks]);
                    break;
                }
            }
        }

        return $cocok / max(count($kataBaku), count($sisa));
    }

    /**
     * Penjaga negasi: ada kata negasi di jawaban murid yang tidak ada di
     * jawaban baku.
     *
     * @param  array<int, string>  $baku  daftar jawaban baku/sinonim
     * @param  array<int, string>  $negasi
     */
    public static function melawanNegasi(string $jawaban, array $baku, array $negasi = self::NEGASI_BAWAAN): bool
    {
        $kataJawaban = self::kata($jawaban);
        $kataBaku = self::kata(implode(' ', $baku));

        foreach ($negasi as $satu) {
            $satu = self::normalisasi($satu);

            if ($satu !== '' && in_array($satu, $kataJawaban, true) && ! in_array($satu, $kataBaku, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Angka pada jawaban baku wajib muncul persis di jawaban murid.
     */
    public static function angkaCocok(string $baku, string $jawaban): bool
    {
        $angkaBaku = self::angka($baku);

        if ($angkaBaku === []) {
            return true;
        }

        // Dibandingkan sebagai angka supaya "12" dan "12.0" dianggap sama,
        // tetapi "1/2" tetap berbeda dari "0,5".
        $angkaJawaban = array_map('floatval', self::angka($jawaban));
        sort($angkaBaku);
        sort($angkaJawaban);

        return array_map('floatval', $angkaBaku) === $angkaJawaban;
    }

    /**
     * Kemiripan sebuah jawaban murid terhadap satu kandidat jawaban baku.
     * 1.0 = pasti sama; 0.0 = tidak mirip.
     */
    public static function kemiripan(string $baku, string $jawaban): float
    {
        if (self::normalisasi($baku) === self::normalisasi($jawaban)) {
            return 1.0;
        }

        return max(
            self::kemiripanKata($baku, $jawaban),
            self::miripHuruf($baku, $jawaban),
        );
    }
}
