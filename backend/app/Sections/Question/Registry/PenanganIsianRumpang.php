<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Isian rumpang — teks dengan penanda `{{1}}` … `{{n}}` yang harus diisi anak.
 * konten: {teks (memuat penanda), matematika?, media?}
 * kunci : {lubang: {"1": [jawaban diterima, …], …}}
 *
 * Bobot = lubang yang cocok dibagi jumlah lubang. Pencocokan jawaban
 * dinormalisasi huruf kecil + trim saja (tanpa membuang tanda baca), karena
 * untuk anak SD "Rp" dan "Rp." sebaiknya sama tetapi "1.500" dan "1500" bukan
 * urusan tipe ini. Jawaban diterima ditulis guru sebagai daftar sinonim.
 */
final class PenanganIsianRumpang implements PenanganTipeSoal
{
    private const MAKS_LUBANG = 10;

    public function validasiKonten(array $konten): array
    {
        $galat = [
            ...BantuanKonten::galatTeks($konten),
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];

        $nomor = self::nomorLubang((string) ($konten['teks'] ?? ''));

        if ($nomor === []) {
            $galat[] = 'Isian rumpang wajib memuat penanda {{1}}, {{2}}, … pada teks.';
        } elseif ($nomor !== range(1, count($nomor))) {
            $galat[] = 'Penanda isian rumpang wajib berurutan mulai dari {{1}} tanpa lompatan.';
        } elseif (count($nomor) > self::MAKS_LUBANG) {
            $galat[] = 'Isian rumpang maksimal '.self::MAKS_LUBANG.' lubang.';
        }

        return $galat;
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $lubang = $kunci['lubang'] ?? null;

        if (! is_array($lubang) || $lubang === []) {
            return ['Kunci isian rumpang wajib berisi kunci.lubang.'];
        }

        $nomor = self::nomorLubang((string) ($konten['teks'] ?? ''));
        $galat = [];

        foreach ($nomor as $satu) {
            $daftar = $lubang[(string) $satu] ?? $lubang[$satu] ?? null;

            if (! is_array($daftar) || $this->daftarJawaban($daftar) === []) {
                $galat[] = "Lubang {{$satu}} wajib punya minimal satu jawaban diterima.";
            }
        }

        foreach (array_keys($lubang) as $kode) {
            if (! in_array((string) $kode, array_map('strval', $nomor), true)) {
                $galat[] = "kunci.lubang memakai penanda {{$kode}} yang tidak ada di teks.";
            }
        }

        return array_values(array_unique($galat));
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        return $this->bobot($konten, $kunci, $jawaban) === 1.0;
    }

    public function bobot(array $konten, array $kunci, mixed $jawaban): float
    {
        $nomor = self::nomorLubang((string) ($konten['teks'] ?? ''));

        if ($nomor === []) {
            return 0.0;
        }

        /** @var array<string, mixed> $dijawab */
        $dijawab = is_array($jawaban) ? $jawaban : [];
        $lubang = is_array($kunci['lubang'] ?? null) ? $kunci['lubang'] : [];
        $cocok = 0;

        foreach ($nomor as $satu) {
            $terima = $this->daftarJawaban($lubang[(string) $satu] ?? $lubang[$satu] ?? null);
            $isi = $dijawab[(string) $satu] ?? $dijawab[$satu] ?? null;

            if (! is_scalar($isi)) {
                continue;
            }

            if (in_array(self::norm((string) $isi), $terima, true)) {
                $cocok++;
            }
        }

        return $cocok / count($nomor);
    }

    /**
     * Nomor lubang unik yang muncul di teks, terurut menaik.
     *
     * @return array<int, int>
     */
    private static function nomorLubang(string $teks): array
    {
        if (preg_match_all('/\{\{\s*(\d+)\s*\}\}/u', $teks, $cocok) === false) {
            return [];
        }

        $nomor = array_map('intval', $cocok[1] ?? []);
        $nomor = array_values(array_unique($nomor));
        sort($nomor);

        return $nomor;
    }

    /**
     * Daftar jawaban diterima, sudah dinormalisasi dan dibersihkan.
     *
     * @return array<int, string>
     */
    private function daftarJawaban(mixed $daftar): array
    {
        if (! is_array($daftar)) {
            return [];
        }

        $hasil = [];

        foreach ($daftar as $satu) {
            if (! is_scalar($satu)) {
                continue;
            }

            $bersih = self::norm((string) $satu);

            if ($bersih !== '') {
                $hasil[] = $bersih;
            }
        }

        return array_values(array_unique($hasil));
    }

    private static function norm(string $teks): string
    {
        return mb_strtolower(trim($teks));
    }
}
