<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Pilihan ganda.
 * konten: {teks, opsi:[{id,teks}], matematika?, media?}
 * kunci : {jawaban: id}
 */
final class PenanganPilihanGanda implements PenanganTipeSoal
{
    private const MIN_OPSI = 2;

    private const MAKS_OPSI = 6;

    public function validasiKonten(array $konten): array
    {
        $galat = [
            ...BantuanKonten::galatTeks($konten),
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];

        $opsi = BantuanKonten::daftar($konten, 'opsi');

        if (count($opsi) < self::MIN_OPSI) {
            $galat[] = 'Pilihan ganda wajib punya minimal '.self::MIN_OPSI.' opsi.';
        }

        if (count($opsi) > self::MAKS_OPSI) {
            $galat[] = 'Pilihan ganda maksimal '.self::MAKS_OPSI.' opsi.';
        }

        foreach ($opsi as $satu) {
            if (! is_string($satu['teks'] ?? null) || trim((string) $satu['teks']) === '') {
                $galat[] = 'Setiap opsi wajib punya teks.';
                break;
            }
        }

        return [...$galat, ...BantuanKonten::galatId($opsi, 'opsi')];
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $jawaban = $kunci['jawaban'] ?? null;

        if (! is_string($jawaban) && ! is_int($jawaban)) {
            return ['Kunci pilihan ganda wajib berisi kunci.jawaban.'];
        }

        $id = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'opsi'));

        if (! in_array((string) $jawaban, $id, true)) {
            return ['kunci.jawaban harus salah satu id opsi yang ada.'];
        }

        return [];
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        if (! is_string($jawaban) && ! is_int($jawaban)) {
            return false;
        }

        return (string) $jawaban === (string) ($kunci['jawaban'] ?? '');
    }
}
