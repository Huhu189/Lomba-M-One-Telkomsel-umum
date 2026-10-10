<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Isian angka dengan toleransi.
 * konten: {teks, satuan?, matematika?, media?}
 * kunci : {nilai: number, toleransi: number >= 0}
 *
 * Jawaban anak ditulis bebas ("12", "12 cm", "1,5"), jadi angka dibaca toleran:
 * satuan pada `konten.satuan` dibuang, spasi diabaikan, dan koma dibaca sebagai
 * pemisah desimal (kebiasaan Indonesia). Selama selisihnya masuk `toleransi`,
 * bobotnya 1.0 — kalau tidak, 0.0 (tidak ada nilai sebagian untuk angka).
 */
final class PenanganIsianAngka implements PenanganTipeSoal
{
    use BobotBiner;

    public function validasiKonten(array $konten): array
    {
        $galat = [
            ...BantuanKonten::galatTeks($konten),
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];

        $satuan = $konten['satuan'] ?? null;

        if ($satuan !== null && $satuan !== '') {
            if (! is_string($satuan) || mb_strlen(trim($satuan)) > 20) {
                $galat[] = 'konten.satuan wajib berupa teks maksimal 20 karakter.';
            }
        }

        return $galat;
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $nilai = $kunci['nilai'] ?? null;

        if (! is_int($nilai) && ! is_float($nilai)) {
            return ['Kunci isian angka wajib berisi kunci.nilai berupa angka.'];
        }

        $toleransi = $kunci['toleransi'] ?? 0;

        if (! is_int($toleransi) && ! is_float($toleransi)) {
            return ['Kunci isian angka wajib berisi kunci.toleransi berupa angka.'];
        }

        if ((float) $toleransi < 0) {
            return ['kunci.toleransi tidak boleh negatif.'];
        }

        return [];
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        $kunciNilai = $kunci['nilai'] ?? null;

        if (! is_int($kunciNilai) && ! is_float($kunciNilai)) {
            return false;
        }

        $dijawab = $this->bacaAngka($jawaban, $konten);

        if ($dijawab === null) {
            return false;
        }

        $toleransi = (float) ($kunci['toleransi'] ?? 0);

        return abs($dijawab - (float) $kunciNilai) <= $toleransi;
    }

    /**
     * Baca nilai angka dari jawaban murid; null bila tidak terbaca sebagai angka.
     *
     * @param  array<string, mixed>  $konten
     */
    private function bacaAngka(mixed $jawaban, array $konten): ?float
    {
        if (is_int($jawaban) || is_float($jawaban)) {
            return (float) $jawaban;
        }

        if (! is_string($jawaban)) {
            return null;
        }

        $teks = trim($jawaban);

        if ($teks === '') {
            return null;
        }

        $satuan = trim((string) ($konten['satuan'] ?? ''));

        if ($satuan !== '') {
            $teks = $this->buangSatuan($teks, $satuan);
        }

        // Spasi (termasuk non-breaking) dan pemisah ribuan gaya Indonesia dibuang.
        $teks = str_replace(["\u{00A0}", ' ', "\u{202F}"], '', $teks);

        if ($teks === '') {
            return null;
        }

        $teks = $this->normalisasiPemisah($teks);

        if (! preg_match('/^[+-]?(?:\d+\.?\d*|\.\d+)$/', $teks)) {
            return null;
        }

        return (float) $teks;
    }

    /**
     * Buang satuan di ujung jawaban ("12 cm" → "12", "cm" → "").
     */
    private function buangSatuan(string $teks, string $satuan): string
    {
        $panjang = mb_strlen($satuan);

        if ($panjang === 0 || mb_strlen($teks) < $panjang) {
            return $teks;
        }

        $ekor = mb_substr($teks, -$panjang);

        return mb_strtolower($ekor) === mb_strtolower($satuan)
            ? trim(mb_substr($teks, 0, mb_strlen($teks) - $panjang))
            : $teks;
    }

    /**
     * Seragamkan pemisah desimal menjadi titik.
     *
     * Aturannya sengaja sederhana dan bisa dijelaskan ke guru:
     * - koma dan titik bersama-sama → yang muncul TERAKHIR adalah pemisah
     *   desimal, sisanya pemisah ribuan ("1.500,5" → 1500.5; "1,500.5" → 1500.5);
     * - hanya satu pemisah → itu pemisah desimal ("1,5" → 1.5; "2.5" → 2.5);
     * - pemisah yang sama muncul beberapa kali → semuanya pemisah ribuan
     *   ("1.500.000" → 1500000).
     */
    private function normalisasiPemisah(string $teks): string
    {
        $koma = substr_count($teks, ',');
        $titik = substr_count($teks, '.');

        if ($koma > 0 && $titik > 0) {
            $desimal = strrpos($teks, ',') > strrpos($teks, '.') ? ',' : '.';
            $lain = $desimal === ',' ? '.' : ',';
            $teks = str_replace($lain, '', $teks);

            return str_replace($desimal, '.', $teks);
        }

        if ($koma > 1 || $titik > 1) {
            return str_replace([',', '.'], '', $teks);
        }

        return str_replace(',', '.', $teks);
    }
}
