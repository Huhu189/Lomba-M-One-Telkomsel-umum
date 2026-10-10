<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Mengurutkan.
 * konten: {teks, item:[{id,teks}], matematika?, media?}
 * kunci : {urutan:[id, ...]}
 */
final class PenanganMengurutkan implements PenanganTipeSoal
{
    use BobotBiner;

    private const MIN_ITEM = 2;

    public function validasiKonten(array $konten): array
    {
        $galat = [
            ...BantuanKonten::galatTeks($konten),
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];

        $item = BantuanKonten::daftar($konten, 'item');

        if (count($item) < self::MIN_ITEM) {
            $galat[] = 'Mengurutkan wajib punya minimal '.self::MIN_ITEM.' item.';
        }

        foreach ($item as $satu) {
            if (! is_string($satu['teks'] ?? null) || trim((string) $satu['teks']) === '') {
                $galat[] = 'Setiap item wajib punya teks.';
                break;
            }
        }

        return [...$galat, ...BantuanKonten::galatId($item, 'item')];
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $urutan = $kunci['urutan'] ?? null;

        if (! is_array($urutan) || $urutan === []) {
            return ['Kunci mengurutkan wajib berisi kunci.urutan.'];
        }

        $id = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'item'));
        $urutan = array_values(array_map(static fn (mixed $satu): string => (string) $satu, $urutan));

        if (count($urutan) !== count($id)) {
            return ['kunci.urutan wajib memuat semua item tepat sekali.'];
        }

        sort($id);
        $urutSalin = $urutan;
        sort($urutSalin);

        if ($id !== $urutSalin) {
            return ['kunci.urutan wajib memuat semua item tepat sekali.'];
        }

        return [];
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        if (! is_array($jawaban)) {
            return false;
        }

        $urutan = $kunci['urutan'] ?? null;

        if (! is_array($urutan) || $urutan === []) {
            return false;
        }

        // Setiap elemen jawaban wajib skalar. Elemen berbentuk array/objek
        // (kiriman nakal) dulu dipaksa `(string)` sehingga memunculkan warning
        // "Array to string conversion" yang Laravel ubah jadi ErrorException —
        // soal jadi berstatus `gagal` (bukan salah biasa) dan guru kebanjiran
        // antrean tinjauan (Q-19).
        $jawabanUrut = [];

        foreach (array_values($jawaban) as $satu) {
            if (! is_scalar($satu)) {
                return false;
            }

            $jawabanUrut[] = (string) $satu;
        }

        $kunciUrut = array_values(array_map(static fn (mixed $satu): string => (string) $satu, $urutan));

        return $jawabanUrut === $kunciUrut;
    }
}
