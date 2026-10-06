<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Isian singkat.
 * konten: {teks, petunjuk?, matematika?, media?}
 * kunci : {jawaban_baku:[teks, ...], sinonim?:[[alias, ...], ...], ambang?:0..1,
 *          angka_persis?:bool, negasi?:[kata, ...]}
 *
 * Aturan penilaian: normalisasi → angka harus persis (bila angka_persis) →
 * penjaga negasi → toleransi typo per kata dengan kemiripan huruf ≥ ambang.
 */
final class PenanganIsianSingkat implements PenanganTipeSoal
{
    public const AMBANG_BAWAAN = 0.8;

    public function validasiKonten(array $konten): array
    {
        return [
            ...BantuanKonten::galatTeks($konten),
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $galat = [];
        $baku = $kunci['jawaban_baku'] ?? null;

        if (! is_array($baku) || $baku === []) {
            return ['Kunci isian wajib berisi kunci.jawaban_baku (minimal satu jawaban).'];
        }

        foreach ($baku as $satu) {
            if (! is_string($satu) || trim($satu) === '') {
                $galat[] = 'Setiap jawaban_baku wajib berupa teks.';
                break;
            }
        }

        $sinonim = $kunci['sinonim'] ?? null;

        if ($sinonim !== null) {
            if (! is_array($sinonim)) {
                $galat[] = 'kunci.sinonim wajib berupa daftar daftar alias.';
            } elseif (count($sinonim) > count($baku)) {
                $galat[] = 'Jumlah kunci.sinonim tidak boleh melebihi jawaban_baku.';
            }
        }

        if (isset($kunci['ambang'])) {
            $ambang = $kunci['ambang'];

            if (! is_numeric($ambang) || (float) $ambang <= 0 || (float) $ambang > 1) {
                $galat[] = 'kunci.ambang wajib berupa bilangan antara 0 dan 1.';
            }
        }

        if (isset($kunci['negasi']) && ! is_array($kunci['negasi'])) {
            $galat[] = 'kunci.negasi wajib berupa daftar kata.';
        }

        return array_values(array_unique($galat));
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        if (! is_string($jawaban) || trim($jawaban) === '') {
            return false;
        }

        return self::kemiripanTerbaik($kunci, $jawaban) >= self::ambang($kunci);
    }

    /**
     * Kandidat jawaban baku + sinonimnya untuk satu indeks.
     *
     * @param  array<string, mixed>  $kunci
     * @return array<int, string>
     */
    public static function kandidat(array $kunci, int $indeks): array
    {
        $baku = (string) ($kunci['jawaban_baku'][$indeks] ?? '');
        $kandidat = [$baku];
        $sinonim = $kunci['sinonim'][$indeks] ?? null;

        if (is_array($sinonim)) {
            foreach ($sinonim as $alias) {
                if (is_string($alias) && trim($alias) !== '') {
                    $kandidat[] = $alias;
                }
            }
        }

        return $kandidat;
    }

    /**
     * @param  array<string, mixed>  $kunci
     */
    public static function ambang(array $kunci): float
    {
        $ambang = $kunci['ambang'] ?? null;

        return is_numeric($ambang) ? (float) $ambang : self::AMBANG_BAWAAN;
    }

    /**
     * Kemiripan terbaik terhadap semua kandidat jawaban baku (0 bila kena
     * penjaga negasi atau angka tidak persis).
     *
     * @param  array<string, mixed>  $kunci
     */
    public static function kemiripanTerbaik(array $kunci, string $jawaban): float
    {
        $baku = $kunci['jawaban_baku'] ?? null;

        if (! is_array($baku) || $baku === []) {
            return 0.0;
        }

        $angkaPersis = $kunci['angka_persis'] ?? true;
        $negasi = $kunci['negasi'] ?? null;
        $negasi = is_array($negasi) ? array_values(array_filter($negasi, 'is_string')) : BantuanTeks::NEGASI_BAWAAN;

        $terbaik = 0.0;

        foreach (array_keys($baku) as $indeks) {
            $kandidat = self::kandidat($kunci, (int) $indeks);

            if ($angkaPersis && ! BantuanTeks::angkaCocok(implode(' ', $kandidat), $jawaban)) {
                continue;
            }

            if (BantuanTeks::melawanNegasi($jawaban, $kandidat, $negasi)) {
                continue;
            }

            foreach ($kandidat as $satu) {
                $terbaik = max($terbaik, BantuanTeks::kemiripan($satu, $jawaban));
            }
        }

        return $terbaik;
    }
}
