<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Teka silang mini — anak mengisi huruf pada kotak-kotak teka-teki.
 * konten: {grid: [[sel]], mendatar: [{nomor, teks, sel: ["r,c", …]}], menurun: […]}
 * kunci : {sel: {"r,c": "h"}} — satu huruf per kotak yang diisi murid
 * jawaban: {"r,c": "h"} — huruf besar/kecil sama saja
 *
 * Isi `grid` hanya menentukan bentuk kotak: `''` = kotak yang diisi murid,
 * `'#'` = kotak hitam penyekat. Huruf jawabannya TIDAK pernah ada di konten,
 * melainkan di `kunci.sel`, jadi perangkat murid hanya menerima bentuk kotak dan
 * petunjuknya. Bobot = kata benar dibagi jumlah kata (mendatar + menurun); satu
 * kata dihitung benar bila seluruh hurufnya cocok (huruf besar/kecil sama saja).
 */
final class PenanganTekaSilangMini implements PenanganTipeSoal
{
    private const MIN_SISI = 2;

    private const MAKS_SISI = 12;

    private const MAKS_PETUNJUK = 12;

    private const MIN_HURUF = 2;

    public function validasiKonten(array $konten): array
    {
        return [
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
            ...$this->galatGrid($konten),
            ...$this->galatPetunjuk($konten),
        ];
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $sel = $kunci['sel'] ?? null;

        if (! is_array($sel) || $sel === []) {
            return ['Kunci teka silang wajib berisi kunci.sel.'];
        }

        $grid = $this->bentukGrid($konten);

        if ($grid === null) {
            return ['Kunci teka silang tidak bisa diperiksa karena konten.grid belum sah.'];
        }

        $galat = [];
        $huruf = [];

        foreach ($sel as $kode => $isi) {
            $kode = (string) $kode;

            if ($this->bacaKode($kode) === null) {
                $galat[] = 'Setiap kunci sel wajib memakai kode "baris,kolom".';

                continue;
            }

            if (! array_key_exists($kode, $grid)) {
                $galat[] = "Kunci sel {$kode} berada di luar grid.";

                continue;
            }

            if ($grid[$kode] !== '') {
                $galat[] = "Kunci sel {$kode} menunjuk kotak hitam.";

                continue;
            }

            if (! is_string($isi) || preg_match('/^[a-zA-Z]$/', $isi) !== 1) {
                $galat[] = "Kunci sel {$kode} wajib berisi satu huruf.";

                continue;
            }

            $huruf[$kode] = mb_strtoupper($isi);
        }

        foreach (array_keys(array_filter($grid, static fn (string $satu): bool => $satu === '')) as $kode) {
            if (! array_key_exists($kode, $huruf)) {
                $galat[] = "Kotak {$kode} wajib punya huruf di kunci.";
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
        $kata = [...$this->daftarKata($konten, 'mendatar'), ...$this->daftarKata($konten, 'menurun')];

        if ($kata === []) {
            return 0.0;
        }

        /** @var array<string, mixed> $dijawab */
        $dijawab = is_array($jawaban) ? $jawaban : [];
        $hurufKunci = $this->hurufKunci($kunci);
        $benar = 0;

        foreach ($kata as $satu) {
            if ($this->kataBenar($satu, $dijawab, $hurufKunci)) {
                $benar++;
            }
        }

        return $benar / count($kata);
    }

    /**
     * @param  array<int, string>  $sel
     * @param  array<string, mixed>  $dijawab
     * @param  array<string, string>  $hurufKunci
     */
    private function kataBenar(array $sel, array $dijawab, array $hurufKunci): bool
    {
        foreach ($sel as $kode) {
            $kunci = $hurufKunci[$kode] ?? null;
            $jawab = $dijawab[$kode] ?? null;

            if ($kunci === null || ! is_string($jawab) || mb_strtoupper(trim($jawab)) !== $kunci) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $kunci
     * @return array<string, string>
     */
    private function hurufKunci(array $kunci): array
    {
        $sel = $kunci['sel'] ?? null;

        if (! is_array($sel)) {
            return [];
        }

        $hasil = [];

        foreach ($sel as $kode => $huruf) {
            if (is_string($huruf) && preg_match('/^[a-zA-Z]$/', $huruf) === 1) {
                $hasil[(string) $kode] = mb_strtoupper($huruf);
            }
        }

        return $hasil;
    }

    /**
     * Daftar kata satu arah: tiap kata berisi kode sel yang sudah sah.
     *
     * @param  array<string, mixed>  $konten
     * @return array<int, array<int, string>>
     */
    private function daftarKata(array $konten, string $arah): array
    {
        $kata = [];

        foreach (BantuanKonten::daftar($konten, $arah) as $baris) {
            $sel = $baris['sel'] ?? null;

            if (! is_array($sel)) {
                continue;
            }

            $kode = array_values(array_filter(array_map(
                static fn (mixed $satu): string => is_scalar($satu) ? (string) $satu : '',
                $sel,
            ), static fn (string $satu): bool => $satu !== ''));

            if ($kode !== []) {
                $kata[] = $kode;
            }
        }

        return $kata;
    }

    /**
     * @param  array<string, mixed>  $konten
     * @return array<int, string>
     */
    private function galatGrid(array $konten): array
    {
        $grid = $konten['grid'] ?? null;

        if (! is_array($grid) || $grid === []) {
            return ['Teka silang wajib berisi konten.grid.'];
        }

        $baris = array_values($grid);
        $jumlahBaris = count($baris);
        $galat = [];

        if ($jumlahBaris < self::MIN_SISI) {
            $galat[] = 'Teka silang minimal '.self::MIN_SISI.' baris.';
        } elseif ($jumlahBaris > self::MAKS_SISI) {
            $galat[] = 'Teka silang maksimal '.self::MAKS_SISI.' baris.';
        }

        $lebar = null;

        foreach ($baris as $satu) {
            if (! is_array($satu) || $satu === []) {
                $galat[] = 'Setiap baris teka silang wajib berupa daftar kotak.';

                return array_values(array_unique($galat));
            }

            $kolom = count($satu);

            if ($lebar === null) {
                $lebar = $kolom;

                if ($kolom < self::MIN_SISI) {
                    $galat[] = 'Teka silang minimal '.self::MIN_SISI.' kolom.';
                } elseif ($kolom > self::MAKS_SISI) {
                    $galat[] = 'Teka silang maksimal '.self::MAKS_SISI.' kolom.';
                }
            } elseif ($kolom !== $lebar) {
                $galat[] = 'Setiap baris teka silang wajib sama panjang.';

                return array_values(array_unique($galat));
            }

            foreach ($satu as $kotak) {
                if (! is_string($kotak) || ($kotak !== '' && $kotak !== '#')) {
                    $galat[] = "Kotak teka silang hanya boleh '' (diisi murid) atau '#' (kotak hitam).";

                    return array_values(array_unique($galat));
                }
            }
        }

        $bentuk = $this->bentukGrid($konten);

        if ($bentuk !== null && array_filter($bentuk, static fn (string $satu): bool => $satu === '') === []) {
            $galat[] = 'Teka silang wajib punya minimal satu kotak yang diisi murid.';
        }

        return array_values(array_unique($galat));
    }

    /**
     * @param  array<string, mixed>  $konten
     * @return array<int, string>
     */
    private function galatPetunjuk(array $konten): array
    {
        $galat = [];
        $bentuk = $this->bentukGrid($konten);

        foreach (['mendatar', 'menurun'] as $arah) {
            $daftar = BantuanKonten::daftar($konten, $arah);

            if (count($daftar) > self::MAKS_PETUNJUK) {
                $galat[] = "Petunjuk {$arah} maksimal ".self::MAKS_PETUNJUK.' kata.';
            }

            $nomor = [];

            foreach ($daftar as $baris) {
                $n = $baris['nomor'] ?? null;
                $teks = $baris['teks'] ?? null;

                if (! is_int($n) || $n < 1) {
                    $galat[] = "Setiap petunjuk {$arah} wajib punya nomor bulat minimal 1.";

                    continue;
                }

                $nomor[] = $n;

                if (! is_string($teks) || trim($teks) === '') {
                    $galat[] = "Setiap petunjuk {$arah} wajib punya teks.";
                }

                if ($bentuk === null) {
                    continue;
                }

                $galat = [...$galat, ...$this->galatKata($baris, $arah, $bentuk)];
            }

            if (count($nomor) !== count(array_unique($nomor))) {
                $galat[] = "Nomor petunjuk {$arah} tidak boleh kembar.";
            }
        }

        return array_values(array_unique($galat));
    }

    /**
     * Kata pada satu petunjuk wajib berada di satu baris/kolom yang berurutan.
     *
     * @param  array<string, mixed>  $baris
     * @param  array<string, string>  $bentuk
     * @return array<int, string>
     */
    private function galatKata(array $baris, string $arah, array $bentuk): array
    {
        $sel = $baris['sel'] ?? null;

        if (! is_array($sel) || $sel === []) {
            return ["Setiap petunjuk {$arah} wajib punya daftar sel."];
        }

        $kode = [];

        foreach ($sel as $satu) {
            if (! is_scalar($satu)) {
                return ["Petunjuk {$arah} memakai kode sel yang tidak sah."];
            }

            $kode[] = (string) $satu;
        }

        if (count($kode) < self::MIN_HURUF) {
            return ["Kata pada petunjuk {$arah} minimal ".self::MIN_HURUF.' huruf.'];
        }

        if (count($kode) !== count(array_unique($kode))) {
            return ["Kata pada petunjuk {$arah} memakai kode sel kembar."];
        }

        $posisi = [];

        foreach ($kode as $satu) {
            $pecah = $this->bacaKode($satu);

            if ($pecah === null || ! array_key_exists($satu, $bentuk)) {
                return ["Petunjuk {$arah} memakai kode sel tak dikenal ({$satu})."];
            }

            if ($bentuk[$satu] !== '') {
                return ["Petunjuk {$arah} memakai kotak hitam ({$satu})."];
            }

            $posisi[] = $pecah;
        }

        $kolomTetap = count(array_unique(array_column($posisi, 1))) === 1;
        $barisTetap = count(array_unique(array_column($posisi, 0))) === 1;

        if ($arah === 'mendatar' && ! $barisTetap) {
            return ['Kata mendatar wajib berada pada satu baris.'];
        }

        if ($arah === 'menurun' && ! $kolomTetap) {
            return ['Kata menurun wajib berada pada satu kolom.'];
        }

        $urut = $arah === 'mendatar' ? array_column($posisi, 1) : array_column($posisi, 0);
        sort($urut);

        for ($i = 1; $i < count($urut); $i++) {
            if ($urut[$i] !== $urut[$i - 1] + 1) {
                return ["Kata pada petunjuk {$arah} wajib berurutan tanpa lompatan."];
            }
        }

        return [];
    }

    /**
     * Bentuk grid sebagai peta kode → isi kotak (`''` diisi murid, `'#'` kotak
     * hitam). `null` bila bentuknya belum sah.
     *
     * @param  array<string, mixed>  $konten
     * @return array<string, string>|null
     */
    private function bentukGrid(array $konten): ?array
    {
        $grid = $konten['grid'] ?? null;

        if (! is_array($grid) || $grid === []) {
            return null;
        }

        $lebar = null;
        $hasil = [];

        foreach (array_values($grid) as $r => $baris) {
            if (! is_array($baris) || $baris === []) {
                return null;
            }

            $lebar ??= count($baris);

            if (count($baris) !== $lebar) {
                return null;
            }

            foreach (array_values($baris) as $c => $kotak) {
                if (! is_string($kotak) || ($kotak !== '' && $kotak !== '#')) {
                    return null;
                }

                $hasil[$this->kode($r, $c)] = $kotak;
            }
        }

        return $hasil;
    }

    private function kode(int $baris, int $kolom): string
    {
        return $baris.','.$kolom;
    }

    /**
     * @return array{0: int, 1: int}|null
     */
    private function bacaKode(string $kode): ?array
    {
        if (preg_match('/^(\d{1,2}),(\d{1,2})$/', $kode, $cocok) !== 1) {
            return null;
        }

        return [(int) $cocok[1], (int) $cocok[2]];
    }
}
