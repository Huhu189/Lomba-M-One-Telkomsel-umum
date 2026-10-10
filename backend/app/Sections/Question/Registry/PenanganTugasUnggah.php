<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Tugas unggah — anak mengunggah hasil pekerjaan (foto/coretan/suara).
 * konten: {teks (wajib), jenis_berkas (wajib), matematika?, media?}
 * kunci : {rubrik: [{butir, poin}, …]}
 *
 * Ini satu-satunya tipe yang BUKAN objektif: tidak ada jawaban yang bisa dicocokkan
 * mesin, jadi `nilai()` selalu salah dan `bobot()` selalu 0.0. Penilaiannya
 * ditentukan guru lewat rubrik di antrean koreksi (`StatusPenilaian::PerluTinjau`);
 * berkasnya sendiri memakai infrastruktur unggah jawaban yang sudah ada.
 */
final class PenanganTugasUnggah implements PenanganTipeSoal
{
    private const MAKS_BUTIR = 10;

    public function validasiKonten(array $konten): array
    {
        $galat = [
            ...BantuanKonten::galatTeks($konten),
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];

        $jenis = $konten['jenis_berkas'] ?? null;

        if (! is_string($jenis) || trim($jenis) === '') {
            $galat[] = 'Tugas unggah wajib menyebut jenis berkas yang boleh diunggah.';
        } elseif (mb_strlen(trim($jenis)) > 120) {
            $galat[] = 'konten.jenis_berkas maksimal 120 karakter.';
        }

        return $galat;
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $rubrik = BantuanKonten::daftar($kunci, 'rubrik');

        if ($rubrik === []) {
            return ['Kunci tugas unggah wajib berisi rubrik penilaian.'];
        }

        if (count($rubrik) > self::MAKS_BUTIR) {
            return ['Rubrik tugas unggah maksimal '.self::MAKS_BUTIR.' butir.'];
        }

        foreach ($rubrik as $satu) {
            $butir = $satu['butir'] ?? null;
            $poin = $satu['poin'] ?? null;

            if (! is_string($butir) || trim($butir) === '') {
                return ['Setiap butir rubrik wajib punya teks.'];
            }

            if ((! is_int($poin) && ! is_float($poin)) || (float) $poin <= 0.0) {
                return ['Setiap butir rubrik wajib punya poin lebih dari 0.'];
            }
        }

        return [];
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        // Tidak ada penilaian otomatis untuk tugas unggah; guru yang menilai.
        return false;
    }

    public function bobot(array $konten, array $kunci, mixed $jawaban): float
    {
        return 0.0;
    }
}
