<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Susun huruf — huruf kata diacak SERVER (lihat `Pengacakan::urutHuruf`), anak
 * menyusunnya kembali menjadi kata yang benar.
 * konten: {petunjuk} (petunjuk singkat, mis. "nama hewan berkaki empat")
 * kunci : {kata}
 *
 * Huruf mentah tidak pernah dikirim ke murid sebagai `konten.kata`; layar anak
 * hanya menerima `konten.huruf` (hasil acak) dan `konten.petunjuk`, sehingga
 * kunci tidak bisa dibaca dari respons. Pembandingan kata mengabaikan huruf
 * besar/kecil dan spasi tepi, tapi tetap menghitung panjang kata.
 */
final class PenanganSusunHuruf implements PenanganTipeSoal
{
    use BobotBiner;

    private const MIN_HURUF = 2;

    private const MAKS_HURUF = 20;

    public function validasiKonten(array $konten): array
    {
        $galat = [
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];

        $petunjuk = $konten['petunjuk'] ?? null;

        if (! is_string($petunjuk) || trim($petunjuk) === '') {
            $galat[] = 'Susun huruf wajib punya konten.petunjuk.';
        } elseif (mb_strlen(trim($petunjuk)) > 500) {
            $galat[] = 'konten.petunjuk maksimal 500 karakter.';
        }

        return $galat;
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $kata = $kunci['kata'] ?? null;

        if (! is_string($kata) || trim($kata) === '') {
            return ['Kunci susun huruf wajib berisi kunci.kata.'];
        }

        $kata = trim($kata);

        if (preg_match('/\s/u', $kata) === 1) {
            return ['kunci.kata tidak boleh memuat spasi — susun huruf untuk satu kata.'];
        }

        $jumlah = mb_strlen($kata);

        if ($jumlah < self::MIN_HURUF) {
            return ['kunci.kata minimal '.self::MIN_HURUF.' huruf.'];
        }

        if ($jumlah > self::MAKS_HURUF) {
            return ['kunci.kata maksimal '.self::MAKS_HURUF.' huruf.'];
        }

        return [];
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        $kata = $kunci['kata'] ?? null;

        if (! is_string($kata) || ! is_string($jawaban)) {
            return false;
        }

        return mb_strtolower(trim($jawaban)) === mb_strtolower(trim($kata));
    }
}
