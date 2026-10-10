<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Benar / salah.
 * konten: {teks, matematika?, media?}
 * kunci : {benar: bool}
 */
final class PenanganBenarSalah implements PenanganTipeSoal
{
    use BobotBiner;

    public function validasiKonten(array $konten): array
    {
        return [
            ...BantuanKonten::galatTeks($konten),
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        if (! is_bool($kunci['benar'] ?? null)) {
            return ['Kunci benar/salah wajib berisi kunci.benar (true/false).'];
        }

        return [];
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        if (! is_bool($jawaban)) {
            return false;
        }

        return $jawaban === ($kunci['benar'] ?? null);
    }
}
