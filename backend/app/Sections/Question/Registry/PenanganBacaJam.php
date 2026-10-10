<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Baca jam — anak menunjukkan pukul berapa sesuai perintah di teks soal.
 * konten: {teks (wajib), matematika?, media?}
 * kunci : {jam: 0–11, menit: 0–59}
 * jawaban: {jam, menit}
 *
 * Waktu yang harus ditunjukkan TIDAK pernah ada di konten — kalau ada, jawabannya
 * ikut terkirim ke perangkat murid. Perintahnya ditulis sebagai kalimat ("setengah
 * delapan pagi"), lalu murid memilih angka jam dan menit; server membandingkannya
 * persis dengan kunci. Format 12 jam dipakai karena itu yang diajarkan di SD.
 */
final class PenanganBacaJam implements PenanganTipeSoal
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
        $galat = [];

        $jam = $kunci['jam'] ?? null;

        if (! is_int($jam) || $jam < 0 || $jam > 11) {
            $galat[] = 'Kunci baca jam wajib berisi kunci.jam berupa bilangan bulat 0–11.';
        }

        $menit = $kunci['menit'] ?? null;

        if (! is_int($menit) || $menit < 0 || $menit > 59) {
            $galat[] = 'Kunci baca jam wajib berisi kunci.menit berupa bilangan bulat 0–59.';
        }

        return $galat;
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        $jamKunci = $kunci['jam'] ?? null;
        $menitKunci = $kunci['menit'] ?? null;

        if (! is_int($jamKunci) || ! is_int($menitKunci) || ! is_array($jawaban)) {
            return false;
        }

        $jam = $this->bacaBulat($jawaban['jam'] ?? null, 0, 11);
        $menit = $this->bacaBulat($jawaban['menit'] ?? null, 0, 59);

        if ($jam === null || $menit === null) {
            return false;
        }

        return $jam === $jamKunci && $menit === $menitKunci;
    }

    /**
     * Baca bilangan bulat dari jawaban murid (angka atau teks "07"), hanya bila
     * masuk rentang yang diminta.
     */
    private function bacaBulat(mixed $nilai, int $min, int $maks): ?int
    {
        if (is_int($nilai)) {
            $angka = $nilai;
        } elseif (is_float($nilai)) {
            $angka = (int) round($nilai);
        } elseif (is_string($nilai) && preg_match('/^\d{1,2}$/', trim($nilai)) === 1) {
            $angka = (int) trim($nilai);
        } else {
            return null;
        }

        return $angka >= $min && $angka <= $maks ? $angka : null;
    }
}
