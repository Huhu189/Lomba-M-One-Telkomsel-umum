<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Urut gambar — anak menyusun gambar sesuai urutan yang diminta.
 * konten: {teks?, item:[{id,media}] (min 2, maks 8), matematika?}
 * kunci : {urutan:[id, ...]} (permutasi semua item)
 *
 * Bobot parsial: banyak posisi yang tepat dibagi jumlah item, jadi urutan yang
 * hampir benar tetap dapat poin sebagian (tidak 0/1 seperti pilihan gambar).
 */
final class PenanganUrutGambar implements PenanganTipeSoal
{
    private const MIN_ITEM = 2;

    private const MAKS_ITEM = 8;

    public function validasiKonten(array $konten): array
    {
        $galat = [
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];

        $teks = $konten['teks'] ?? null;

        if ($teks !== null && $teks !== '' && (! is_string($teks) || mb_strlen($teks) > 1000)) {
            $galat[] = 'konten.teks wajib berupa teks maksimal 1000 karakter.';
        }

        $item = BantuanKonten::daftar($konten, 'item');

        if (count($item) < self::MIN_ITEM) {
            $galat[] = 'Urut gambar wajib punya minimal '.self::MIN_ITEM.' gambar.';
        }

        if (count($item) > self::MAKS_ITEM) {
            $galat[] = 'Urut gambar maksimal '.self::MAKS_ITEM.' gambar.';
        }

        foreach ($item as $satu) {
            if (! is_string($satu['media'] ?? null) || trim((string) $satu['media']) === '') {
                $galat[] = 'Setiap gambar wajib punya konten.item[].media.';
                break;
            }
        }

        return [...$galat, ...BantuanKonten::galatId($item, 'item')];
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $urutan = $kunci['urutan'] ?? null;

        if (! is_array($urutan) || $urutan === []) {
            return ['Kunci urut gambar wajib berisi kunci.urutan.'];
        }

        $id = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'item'));

        if (count($urutan) !== count($id)) {
            return ['kunci.urutan wajib memuat semua gambar tepat sekali.'];
        }

        $urut = array_values(array_map(static fn (mixed $satu): string => (string) $satu, $urutan));
        $salin = $urut;
        sort($id);
        sort($salin);

        if ($id !== $salin) {
            return ['kunci.urutan wajib memuat semua gambar tepat sekali.'];
        }

        return [];
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        return $this->bobot($konten, $kunci, $jawaban) === 1.0;
    }

    public function bobot(array $konten, array $kunci, mixed $jawaban): float
    {
        $kunciUrut = $this->urutanKunci($kunci);

        if ($kunciUrut === []) {
            return 0.0;
        }

        if (! is_array($jawaban) || count($jawaban) !== count($kunciUrut)) {
            return 0.0;
        }

        $posisi = 0;

        foreach ($kunciUrut as $i => $id) {
            $kirim = $jawaban[$i] ?? null;

            if (is_string($kirim) || is_int($kirim)) {
                if ((string) $kirim === $id) {
                    $posisi++;
                }
            }
        }

        return round($posisi / count($kunciUrut), 4);
    }

    /**
     * @param  array<string, mixed>  $kunci
     * @return array<int, string>
     */
    private function urutanKunci(array $kunci): array
    {
        $urutan = $kunci['urutan'] ?? null;

        if (! is_array($urutan) || $urutan === []) {
            return [];
        }

        $hasil = [];

        foreach ($urutan as $satu) {
            if (! is_string($satu) && ! is_int($satu)) {
                return [];
            }

            $hasil[] = (string) $satu;
        }

        return $hasil;
    }
}
