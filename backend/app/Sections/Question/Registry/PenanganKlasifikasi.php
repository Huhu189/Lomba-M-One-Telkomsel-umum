<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Klasifikasi — anak memasukkan tiap item ke kotak/kategori yang tepat.
 * konten: {teks, item:[{id,teks}] (min 2), kotak:[{id,label}] (min 2), matematika?, media?}
 * kunci : {peta: {idItem: idKotak}}
 *
 * Bobot = item yang masuk kotak benar dibagi jumlah item. Semua item wajib
 * punya kotak di kunci, jadi guru tidak bisa lupa menetapkan satu item.
 */
final class PenanganKlasifikasi implements PenanganTipeSoal
{
    private const MIN_ITEM = 2;

    private const MAKS_ITEM = 12;

    private const MIN_KOTAK = 2;

    private const MAKS_KOTAK = 6;

    public function validasiKonten(array $konten): array
    {
        $galat = [
            ...BantuanKonten::galatTeks($konten),
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];

        $item = BantuanKonten::daftar($konten, 'item');
        $kotak = BantuanKonten::daftar($konten, 'kotak');

        if (count($item) < self::MIN_ITEM) {
            $galat[] = 'Klasifikasi wajib punya minimal '.self::MIN_ITEM.' item.';
        } elseif (count($item) > self::MAKS_ITEM) {
            $galat[] = 'Klasifikasi maksimal '.self::MAKS_ITEM.' item.';
        }

        if (count($kotak) < self::MIN_KOTAK) {
            $galat[] = 'Klasifikasi wajib punya minimal '.self::MIN_KOTAK.' kotak.';
        } elseif (count($kotak) > self::MAKS_KOTAK) {
            $galat[] = 'Klasifikasi maksimal '.self::MAKS_KOTAK.' kotak.';
        }

        foreach ($item as $satu) {
            if (! is_string($satu['teks'] ?? null) || trim((string) $satu['teks']) === '') {
                $galat[] = 'Setiap item wajib punya teks.';
                break;
            }
        }

        foreach ($kotak as $satu) {
            if (! is_string($satu['label'] ?? null) || trim((string) $satu['label']) === '') {
                $galat[] = 'Setiap kotak wajib punya label.';
                break;
            }
        }

        return [
            ...$galat,
            ...BantuanKonten::galatId($item, 'item'),
            ...BantuanKonten::galatId($kotak, 'kotak'),
        ];
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $peta = $kunci['peta'] ?? null;

        if (! is_array($peta) || $peta === []) {
            return ['Kunci klasifikasi wajib berisi kunci.peta.'];
        }

        $idItem = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'item'));
        $idKotak = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'kotak'));
        $galat = [];

        foreach ($peta as $item => $kotak) {
            if (! in_array((string) $item, $idItem, true)) {
                $galat[] = "kunci.peta memakai id item tak dikenal ({$item}).";
            }

            if (! in_array((string) $kotak, $idKotak, true)) {
                $galat[] = "kunci.peta memakai id kotak tak dikenal ({$kotak}).";
            }
        }

        if (array_diff($idItem, array_map('strval', array_keys($peta))) !== []) {
            $galat[] = 'Setiap item wajib punya kotak di kunci.';
        }

        return array_values(array_unique($galat));
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        return $this->bobot($konten, $kunci, $jawaban) === 1.0;
    }

    public function bobot(array $konten, array $kunci, mixed $jawaban): float
    {
        $peta = $kunci['peta'] ?? null;

        if (! is_array($peta) || $peta === []) {
            return 0.0;
        }

        /** @var array<string, mixed> $dijawab */
        $dijawab = is_array($jawaban) ? $jawaban : [];
        $cocok = 0;
        $total = 0;

        foreach ($peta as $item => $kotak) {
            $total++;

            $isi = $dijawab[(string) $item] ?? $dijawab[$item] ?? null;

            if (is_scalar($isi) && (string) $isi === (string) $kotak) {
                $cocok++;
            }
        }

        return $total === 0 ? 0.0 : $cocok / $total;
    }
}
