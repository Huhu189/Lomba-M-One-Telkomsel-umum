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
    public const NEGASI_BAWAAN = [
        'tidak', 'bukan', 'bukanlah', 'jangan', 'tanpa', 'kecuali',
        // Bentuk yang benar-benar dipakai anak SD sehari-hari (Q-11): tanpa ini
        // "air tak mengalir dari tempat tinggi" dinilai sama dengan kalimatnya
        // yang tanpa sanggahan.
        'tak', 'nggak', 'gak', 'ga', 'belum', 'non',
    ];

    /**
     * Imbuhan pembalik arti yang MENEMPEL pada kata dasarnya, bukan kata terpisah.
     *
     * "vertebrata" dan "invertebrata" mirip 0,91 dan "organik" dengan
     * "anorganik" 0,88 menurut hitung miripHuruf, padahal artinya berlawanan —
     * jadi kemiripan huruf saja tidak cukup untuk menyatakan dua kata itu sama
     * (Q-11).
     *
     * @var array<int, string>
     */
    public const AWALAN_PEMBALIK = ['a', 'an', 'anti', 'i', 'il', 'im', 'in', 'non', 'tak', 'tidak', 'tanpa'];

    /**
     * Panjang minimum kata dasar sebelum aturan imbuhan pembalik berlaku.
     * Tanpa batas ini "atas" vs "tas" ikut dianggap berlawanan arti.
     */
    public const MIN_KATA_DASAR = 4;

    /**
     * Apakah dua kata berlawanan arti karena imbuhan pembalik?
     *
     * Hanya berlaku bila kata yang lebih pendek persis sama dengan sisa kata
     * yang lebih panjang setelah awalannya dilepas (mis. "organik" ⊂
     * "anorganik"), supaya kata yang kebetulan berawalan huruf sama tidak ikut
     * tertuduh.
     */
    public static function melawanAntonim(string $a, string $b): bool
    {
        $a = self::normalisasi($a);
        $b = self::normalisasi($b);

        if ($a === '' || $b === '' || $a === $b) {
            return false;
        }

        [$pendek, $panjang] = mb_strlen($a) <= mb_strlen($b) ? [$a, $b] : [$b, $a];

        if (mb_strlen($pendek) < self::MIN_KATA_DASAR) {
            return false;
        }

        foreach (self::AWALAN_PEMBALIK as $awalan) {
            if (str_starts_with($panjang, $awalan)
                && mb_substr($panjang, mb_strlen($awalan)) === $pendek) {
                return true;
            }
        }

        return false;
    }

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
     * Dua kata dianggap sama bila identik, cukup dekat menurut jarak edit
     * (toleransi typo satu huruf — dua huruf untuk kata panjang), atau mirip
     * ≥ 80%. Kata berupa angka tidak pernah dianggap mirip — angka harus persis —
     * dan kata berlawanan arti karena imbuhan pembalik selalu dianggap berbeda.
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

        if (self::melawanAntonim($a, $b)) {
            return false;
        }

        return self::salahKetikWajar($a, $b) || self::miripHuruf($a, $b) >= self::AMBANG_MIRIP_KATA;
    }

    /**
     * Toleransi typo: selisih panjang paling banyak satu huruf, dan jarak edit
     * paling banyak satu (dua untuk kata lebih dari 8 huruf, tempat typo ganda
     * lebih mungkin terjadi saat mengetik di ponsel).
     */
    private static function salahKetikWajar(string $a, string $b): bool
    {
        $panjangA = mb_strlen($a);
        $panjangB = mb_strlen($b);

        if (abs($panjangA - $panjangB) > 1) {
            return false;
        }

        $batas = max($panjangA, $panjangB) > 8 ? 2 : 1;

        return levenshtein($a, $b) <= $batas;
    }

    /**
     * Kemiripan per kata: setiap kata baku dicari pasangannya di jawaban.
     *
     * Sumbangan tiap pasangan memakai kemiripan huruf sungguhan (bukan 1/0),
     * supaya perbedaan tipis seperti satu huruf typo tetap terlihat oleh ambang
     * yang diatur guru — dulu begitu semua kata "cocok", hasilnya selalu 1,0
     * sehingga ambang 0,95 tidak berpengaruh apa pun.
     *
     * Penyebutnya memakai panjang ASLI jawaban murid, bukan sisa daftar setelah
     * kata yang cocok dibuang: dengan sisa, mengulang kata baku justru memberi
     * skor sempurna (Q-11).
     */
    public static function kemiripanKata(string $baku, string $jawaban): float
    {
        $kataBaku = self::kata($baku);
        $kataJawaban = self::kata($jawaban);

        if ($kataBaku === [] || $kataJawaban === []) {
            return 0.0;
        }

        $sisa = $kataJawaban;
        $cocok = 0.0;

        foreach ($kataBaku as $kata) {
            foreach ($sisa as $indeks => $lain) {
                if (self::miripKata($kata, $lain)) {
                    $cocok += self::miripHuruf($kata, $lain);
                    unset($sisa[$indeks]);
                    break;
                }
            }
        }

        return $cocok / max(count($kataBaku), count($kataJawaban));
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

            if ($satu === '' || ! in_array($satu, $kataJawaban, true) || in_array($satu, $kataBaku, true)) {
                continue;
            }

            // Kata negasi yang menempel pada kata baku tidak dihitung sebagai
            // sanggahan: murid yang menulis "non fiksi" untuk kunci "nonfiksi"
            // cuma memisahkan kata gabungannya, bukan membalik artinya.
            if (self::awalanKataBaku($satu, $kataBaku)) {
                continue;
            }

            return true;
        }

        return false;
    }

    /**
     * Apakah ada kata baku yang berawalan kata ini (mis. "non" pada "nonfiksi")?
     *
     * @param  array<int, string>  $kataBaku
     */
    private static function awalanKataBaku(string $kata, array $kataBaku): bool
    {
        foreach ($kataBaku as $satu) {
            if ($satu !== $kata && str_starts_with($satu, $kata)) {
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

        // Jawaban yang angkanya persis sama dinilai sama walau penulisannya beda
        // ("12" vs "12.0"): tanda desimal ikut terpecah jadi token saat
        // normalisasi, sehingga perbandingan kata menghukum jawaban yang secara
        // angka sudah tepat. Diperiksa lebih dulu agar angka tidak dihukum.
        $angkaBaku = array_map('floatval', self::angka($baku));
        $angkaJawaban = array_map('floatval', self::angka($jawaban));

        if ($angkaBaku !== [] && $angkaBaku === $angkaJawaban) {
            return 1.0;
        }

        // Imbuhan pembalik membuat dua kalimat berlawanan arti tetap mirip
        // hurufnya (mis. "vertebrata" vs "invertebrata" = 0,91), jadi jalur
        // miripHuruf tidak boleh dipakai untuk keduanya (Q-11).
        if (self::melawanAntonim($baku, $jawaban)) {
            return 0.0;
        }

        return max(
            self::kemiripanKata($baku, $jawaban),
            self::miripHuruf($baku, $jawaban),
        );
    }
}
