<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Tabel isian — anak mengisi sel-sel tabel.
 * konten: {teks, kolom:[label, …], baris:[{id, sel:[{kode, teks?}]}], matematika?, media?}
 * kunci : {sel: {kode: [jawaban diterima, …]}}
 *
 * `kode` sel unik se-aplikasi soal (mis. "r1c2"); jawaban murid datang sebagai
 * peta `{kode: jawaban}`. Sel yang sudah punya `teks` adalah bagian tabel yang
 * sudah terisi (label/petunjuk), jadi yang diisi murid dan dinilai hanya sel
 * KOSONG — bobot = sel kosong yang benar dibagi jumlah sel kosong.
 */
final class PenanganTabelIsian implements PenanganTipeSoal
{
    private const MAKS_SEL = 40;

    public function validasiKonten(array $konten): array
    {
        $galat = [
            ...BantuanKonten::galatTeks($konten),
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];

        $kolom = $konten['kolom'] ?? null;

        if (! is_array($kolom) || $kolom === []) {
            $galat[] = 'Tabel isian wajib punya minimal satu kolom.';
        } else {
            foreach ($kolom as $satu) {
                if (! is_scalar($satu) || trim((string) $satu) === '') {
                    $galat[] = 'Setiap kolom wajib punya label.';
                    break;
                }
            }
        }

        $baris = BantuanKonten::daftar($konten, 'baris');

        if ($baris === []) {
            $galat[] = 'Tabel isian wajib punya minimal satu baris.';
        }

        $kode = [];

        foreach ($baris as $satu) {
            $sel = $satu['sel'] ?? null;

            if (! is_array($sel) || $sel === []) {
                $galat[] = 'Setiap baris wajib punya minimal satu sel.';
                break;
            }

            foreach ($sel as $isi) {
                if (! is_array($isi) || ! is_scalar($isi['kode'] ?? null) || trim((string) $isi['kode']) === '') {
                    $galat[] = 'Setiap sel wajib punya kode.';
                    break 2;
                }

                $kode[] = (string) $isi['kode'];
            }
        }

        if (count($kode) > self::MAKS_SEL) {
            $galat[] = 'Tabel isian maksimal '.self::MAKS_SEL.' sel.';
        }

        if (count($kode) !== count(array_unique($kode))) {
            $galat[] = 'Kode sel tidak boleh duplikat.';
        }

        return [...$galat, ...BantuanKonten::galatId($baris, 'baris')];
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $sel = $kunci['sel'] ?? null;

        if (! is_array($sel) || $sel === []) {
            return ['Kunci tabel isian wajib berisi kunci.sel.'];
        }

        $kodeKonten = $this->kodeSel($konten);
        $galat = [];

        foreach ($kodeKonten as $kode) {
            if (! is_array($sel[$kode] ?? null) || $this->daftarJawaban($sel[$kode]) === []) {
                $galat[] = "Sel {$kode} wajib punya minimal satu jawaban diterima.";
            }
        }

        $semuaKode = $this->kodeSel($konten);

        foreach (array_keys($sel) as $kode) {
            if (! in_array((string) $kode, $semuaKode, true)) {
                $galat[] = "kunci.sel memakai kode sel tak dikenal ({$kode}).";
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
        $kode = $this->kodeSel($konten);

        if ($kode === []) {
            return 0.0;
        }

        /** @var array<string, mixed> $dijawab */
        $dijawab = is_array($jawaban) ? $jawaban : [];
        $sel = is_array($kunci['sel'] ?? null) ? $kunci['sel'] : [];
        $cocok = 0;

        foreach ($kode as $satu) {
            $terima = $this->daftarJawaban($sel[$satu] ?? null);
            $isi = $dijawab[$satu] ?? null;

            if (is_scalar($isi) && in_array(self::norm((string) $isi), $terima, true)) {
                $cocok++;
            }
        }

        return $cocok / count($kode);
    }

    /**
     * Kode sel yang harus diisi murid (sel tanpa teks), menurut urutan tabel.
     *
     * @param  array<string, mixed>  $konten
     * @return array<int, string>
     */
    private function kodeSel(array $konten): array
    {
        $kode = [];

        foreach (BantuanKonten::daftar($konten, 'baris') as $baris) {
            foreach (
                is_array($baris['sel'] ?? null) ? $baris['sel'] : [] as $sel
            ) {
                if (! is_array($sel) || ! is_scalar($sel['kode'] ?? null)) {
                    continue;
                }

                $teks = $sel['teks'] ?? null;

                // Sel berisi teks = bagian tabel yang sudah terisi; hanya sel
                // kosong yang diisi dan dinilai.
                if (is_scalar($teks) && trim((string) $teks) !== '') {
                    continue;
                }

                $kode[] = (string) $sel['kode'];
            }
        }

        return $kode;
    }

    /**
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
