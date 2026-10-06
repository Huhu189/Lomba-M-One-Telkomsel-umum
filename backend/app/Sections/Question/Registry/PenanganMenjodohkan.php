<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Menjodohkan.
 * konten: {teks, kiri:[{id,teks}], kanan:[{id,teks}], matematika?, media?}
 * kunci : {pasangan:{idKiri: idKanan}}
 */
final class PenanganMenjodohkan implements PenanganTipeSoal
{
    private const MIN_PASANGAN = 2;

    public function validasiKonten(array $konten): array
    {
        $galat = [
            ...BantuanKonten::galatTeks($konten),
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];

        $kiri = BantuanKonten::daftar($konten, 'kiri');
        $kanan = BantuanKonten::daftar($konten, 'kanan');

        if (count($kiri) < self::MIN_PASANGAN || count($kanan) < self::MIN_PASANGAN) {
            $galat[] = 'Menjodohkan wajib punya minimal '.self::MIN_PASANGAN.' pasangan kiri dan kanan.';
        }

        foreach (['kiri' => $kiri, 'kanan' => $kanan] as $nama => $daftar) {
            foreach ($daftar as $satu) {
                if (! is_string($satu['teks'] ?? null) || trim((string) $satu['teks']) === '') {
                    $galat[] = "Setiap {$nama} wajib punya teks.";
                    break;
                }
            }

            $galat = [...$galat, ...BantuanKonten::galatId($daftar, $nama)];
        }

        return $galat;
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $pasangan = $kunci['pasangan'] ?? null;

        if (! is_array($pasangan) || $pasangan === []) {
            return ['Kunci menjodohkan wajib berisi kunci.pasangan.'];
        }

        $idKiri = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'kiri'));
        $idKanan = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'kanan'));
        $galat = [];

        foreach ($pasangan as $dari => $ke) {
            if (! in_array((string) $dari, $idKiri, true)) {
                $galat[] = "kunci.pasangan memakai id kiri tak dikenal ({$dari}).";
            }

            if (! is_string($ke) && ! is_int($ke)) {
                $galat[] = 'kunci.pasangan wajib memetakan id kiri ke id kanan.';
            } elseif (! in_array((string) $ke, $idKanan, true)) {
                $galat[] = "kunci.pasangan memakai id kanan tak dikenal ({$ke}).";
            }
        }

        $tanpaPasangan = array_diff($idKiri, array_map('strval', array_keys($pasangan)));

        if ($tanpaPasangan !== []) {
            $galat[] = 'Setiap item kiri wajib punya pasangan di kunci.';
        }

        return array_values(array_unique($galat));
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        if (! is_array($jawaban)) {
            return false;
        }

        $pasangan = $kunci['pasangan'] ?? null;

        if (! is_array($pasangan) || $pasangan === []) {
            return false;
        }

        if (count($jawaban) !== count($pasangan)) {
            return false;
        }

        foreach ($pasangan as $dari => $ke) {
            $dijawab = $jawaban[$dari] ?? $jawaban[(string) $dari] ?? null;

            if ((string) $dijawab !== (string) $ke) {
                return false;
            }
        }

        return true;
    }
}
