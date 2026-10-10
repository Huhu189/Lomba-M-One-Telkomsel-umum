<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Benar / salah majemuk — beberapa pernyataan, tiap baris dinilai sendiri.
 * konten: {teks, pernyataan:[{id,teks}] (min 2), matematika?, media?}
 * kunci : {jawaban: {id: bool}}
 *
 * Bobot = baris yang cocok / jumlah pernyataan. Baris yang belum dijawab
 * dihitung belum cocok (bukan galat).
 */
final class PenanganBenarSalahMajemuk implements PenanganTipeSoal
{
    private const MIN_PERNYATAAN = 2;

    private const MAKS_PERNYATAAN = 8;

    public function validasiKonten(array $konten): array
    {
        $galat = [
            ...BantuanKonten::galatTeks($konten),
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];

        $pernyataan = BantuanKonten::daftar($konten, 'pernyataan');

        if (count($pernyataan) < self::MIN_PERNYATAAN) {
            $galat[] = 'Benar/salah majemuk wajib punya minimal '.self::MIN_PERNYATAAN.' pernyataan.';
        }

        if (count($pernyataan) > self::MAKS_PERNYATAAN) {
            $galat[] = 'Benar/salah majemuk maksimal '.self::MAKS_PERNYATAAN.' pernyataan.';
        }

        foreach ($pernyataan as $satu) {
            if (! is_string($satu['teks'] ?? null) || trim((string) $satu['teks']) === '') {
                $galat[] = 'Setiap pernyataan wajib punya teks.';
                break;
            }
        }

        return [...$galat, ...BantuanKonten::galatId($pernyataan, 'pernyataan')];
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $jawaban = $kunci['jawaban'] ?? null;

        if (! is_array($jawaban) || $jawaban === []) {
            return ['Kunci benar/salah majemuk wajib berisi kunci.jawaban (peta id → true/false).'];
        }

        $idPernyataan = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'pernyataan'));
        $galat = [];

        foreach ($jawaban as $id => $nilai) {
            if (! in_array((string) $id, $idPernyataan, true)) {
                $galat[] = "kunci.jawaban memakai id pernyataan tak dikenal ({$id}).";
            }

            if (! is_bool($nilai)) {
                $galat[] = 'kunci.jawaban wajib bernilai true/false per pernyataan.';
            }
        }

        $tanpaJawaban = array_diff($idPernyataan, array_map('strval', array_keys($jawaban)));

        if ($tanpaJawaban !== []) {
            $galat[] = 'Setiap pernyataan wajib punya kunci benar/salah.';
        }

        return array_values(array_unique($galat));
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        return $this->bobot($konten, $kunci, $jawaban) === 1.0;
    }

    public function bobot(array $konten, array $kunci, mixed $jawaban): float
    {
        $kunciJawaban = $kunci['jawaban'] ?? null;

        if (! is_array($kunciJawaban) || $kunciJawaban === [] || ! is_array($jawaban)) {
            return 0.0;
        }

        /** @var array<string, mixed> $dijawab */
        $dijawab = $jawaban;
        $cocok = 0;
        $total = 0;

        foreach ($kunciJawaban as $id => $benar) {
            if (! is_bool($benar)) {
                continue;
            }

            $total += 1;

            // Klien mengirim peta id → true/false; nilai string "true" dari JSON
            // yang salah bentuk tidak dianggap cocok.
            $nilai = $dijawab[(string) $id] ?? $dijawab[$id] ?? null;

            if (is_bool($nilai) && $nilai === $benar) {
                $cocok += 1;
            }
        }

        return $total === 0 ? 0.0 : $cocok / $total;
    }
}
