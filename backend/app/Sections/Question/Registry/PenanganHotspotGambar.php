<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Hotspot gambar — anak mengetuk satu titik pada gambar.
 * konten: {teks?, media (wajib), area:[{id, x, y, w, h}]}
 * kunci : {area_benar: [id, …]}
 * jawaban: {x, y} — koordinat ternormalisasi 0–1, dihitung klien lalu diperiksa server
 *
 * Semua koordinat ternormalisasi 0–1 supaya ukuran gambar di layar (ponsel atau
 * desktop) tidak mengubah arti jawaban. Titik dikatakan benar bila jatuh di
 * salah satu area benar; area lain tetap dikirim ke murid karena area itu memang
 * bagian yang bisa diketuk, sedangkan mana yang benar hanya ada di `kunci`.
 */
final class PenanganHotspotGambar implements PenanganTipeSoal
{
    use BobotBiner;

    private const MIN_AREA = 1;

    private const MAKS_AREA = 12;

    public function validasiKonten(array $konten): array
    {
        $galat = [...BantuanKonten::galatMedia($konten), ...BantuanKonten::galatMatematika($konten)];

        if (! isset($konten['media']) || ! is_string($konten['media']) || trim($konten['media']) === '') {
            $galat[] = 'Hotspot gambar wajib berisi konten.media (gambar yang bisa diketuk).';
        }

        $area = BantuanKonten::daftar($konten, 'area');

        if (count($area) < self::MIN_AREA) {
            $galat[] = 'Hotspot gambar wajib punya minimal '.self::MIN_AREA.' area.';
        } elseif (count($area) > self::MAKS_AREA) {
            $galat[] = 'Hotspot gambar maksimal '.self::MAKS_AREA.' area.';
        }

        foreach ($area as $satu) {
            if (! $this->kotakWajar($satu)) {
                $galat[] = 'Setiap area wajib punya x, y, w, h angka 0–1 dan tidak keluar dari gambar.';
                break;
            }
        }

        return [...$galat, ...BantuanKonten::galatId($area, 'area')];
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $benar = $kunci['area_benar'] ?? null;

        if (! is_array($benar) || $benar === []) {
            return ['Kunci hotspot gambar wajib berisi kunci.area_benar.'];
        }

        $id = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'area'));
        $galat = [];

        foreach ($benar as $satu) {
            if (! is_scalar($satu) || ! in_array((string) $satu, $id, true)) {
                $galat[] = 'kunci.area_benar memakai id area tak dikenal ('.(is_scalar($satu) ? (string) $satu : '?').').';
            }
        }

        return array_values(array_unique($galat));
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        $titik = $this->bacaTitik($jawaban);

        if ($titik === null) {
            return false;
        }

        $benar = is_array($kunci['area_benar'] ?? null) ? $kunci['area_benar'] : [];
        $idBenar = array_map('strval', $benar);

        foreach (BantuanKonten::daftar($konten, 'area') as $area) {
            if (! in_array((string) ($area['id'] ?? ''), $idBenar, true) || ! $this->kotakWajar($area)) {
                continue;
            }

            if ($this->titikDiDalam($titik, $area)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Baca titik jawaban murid: `{x, y}` atau `[x, y]`, angka 0–1.
     *
     * @return array{x: float, y: float}|null
     */
    private function bacaTitik(mixed $jawaban): ?array
    {
        if (! is_array($jawaban)) {
            return null;
        }

        $x = $jawaban['x'] ?? ($jawaban[0] ?? null);
        $y = $jawaban['y'] ?? ($jawaban[1] ?? null);

        if ((! is_int($x) && ! is_float($x)) || (! is_int($y) && ! is_float($y))) {
            return null;
        }

        $x = (float) $x;
        $y = (float) $y;

        if ($x < 0.0 || $x > 1.0 || $y < 0.0 || $y > 1.0) {
            return null;
        }

        return ['x' => $x, 'y' => $y];
    }

    /**
     * @param  array<string, mixed>  $area
     */
    private function kotakWajar(array $area): bool
    {
        foreach (['x', 'y', 'w', 'h'] as $nama) {
            $nilai = $area[$nama] ?? null;

            if ((! is_int($nilai) && ! is_float($nilai))) {
                return false;
            }

            $nilai = (float) $nilai;

            if ($nilai < 0.0 || $nilai > 1.0) {
                return false;
            }
        }

        $x = (float) $area['x'];
        $y = (float) $area['y'];
        $w = (float) $area['w'];
        $h = (float) $area['h'];

        if ($w <= 0.0 || $h <= 0.0) {
            return false;
        }

        return $x + $w <= 1.0 && $y + $h <= 1.0;
    }

    /**
     * @param  array{x: float, y: float}  $titik
     * @param  array<string, mixed>  $area
     */
    private function titikDiDalam(array $titik, array $area): bool
    {
        $x = (float) $area['x'];
        $y = (float) $area['y'];
        $w = (float) $area['w'];
        $h = (float) $area['h'];

        return $titik['x'] >= $x && $titik['x'] <= $x + $w
            && $titik['y'] >= $y && $titik['y'] <= $y + $h;
    }
}
