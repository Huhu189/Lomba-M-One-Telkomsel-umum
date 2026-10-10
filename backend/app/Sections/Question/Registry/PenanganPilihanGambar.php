<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Pilihan gambar — anak memilih satu gambar yang tepat.
 * konten: {teks?, opsi:[{id,media}] (min 2, maks 8), matematika?}
 * kunci : {benar:id}
 *
 * `konten.teks` boleh kosong karena soalnya memang gambar; kalau diisi, panjangnya
 * tetap dibatasi lewat `galatTeks` ringan di bawah. Alamat media tiap opsi
 * diperiksa aturan yang sama dengan media soal ({@see BantuanKonten::galatMedia}).
 */
final class PenanganPilihanGambar implements PenanganTipeSoal
{
    use BobotBiner;

    private const MIN_OPSI = 2;

    private const MAKS_OPSI = 8;

    public function validasiKonten(array $konten): array
    {
        $galat = [
            ...$this->galatTeksOpsional($konten),
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];

        $opsi = BantuanKonten::daftar($konten, 'opsi');

        if (count($opsi) < self::MIN_OPSI) {
            $galat[] = 'Pilihan gambar wajib punya minimal '.self::MIN_OPSI.' gambar.';
        }

        if (count($opsi) > self::MAKS_OPSI) {
            $galat[] = 'Pilihan gambar maksimal '.self::MAKS_OPSI.' gambar.';
        }

        foreach ($opsi as $satu) {
            if (! is_string($satu['media'] ?? null) || trim((string) $satu['media']) === '') {
                $galat[] = 'Setiap gambar wajib punya konten.opsi[].media.';
                break;
            }

            $galat = [...$galat, ...BantuanKonten::galatMedia(['media' => $satu['media']])];
        }

        return [...$galat, ...BantuanKonten::galatId($opsi, 'opsi')];
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $jawaban = $kunci['benar'] ?? null;

        if (! is_string($jawaban) && ! is_int($jawaban)) {
            return ['Kunci pilihan gambar wajib berisi kunci.benar (id gambar).'];
        }

        $idOpsi = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'opsi'));

        if (! in_array((string) $jawaban, $idOpsi, true)) {
            return ['kunci.benar harus salah satu id gambar yang ada.'];
        }

        return [];
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        if (! is_string($jawaban) && ! is_int($jawaban)) {
            return false;
        }

        return (string) $jawaban === (string) ($kunci['benar'] ?? '');
    }

    /**
     * Teks soal opsional: bila ada isinya tetap harus teks yang wajar.
     *
     * @param  array<string, mixed>  $konten
     * @return array<int, string>
     */
    private function galatTeksOpsional(array $konten): array
    {
        $teks = $konten['teks'] ?? null;

        if ($teks === null || $teks === '') {
            return [];
        }

        if (! is_string($teks) || mb_strlen($teks) > 1000) {
            return ['konten.teks wajib berupa teks maksimal 1000 karakter.'];
        }

        return [];
    }
}
