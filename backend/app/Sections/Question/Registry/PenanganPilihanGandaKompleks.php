<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Pilihan ganda kompleks — jawaban benar lebih dari satu.
 * konten: {teks, opsi:[{id,teks}] (min 3), matematika?, media?}
 * kunci : {benar:[id, ...]} (min 1, tidak boleh seluruh opsi)
 *
 * Penilaian sebagian (Objektif 1A): himpunan jawaban sama = 1.0; selain itu
 * `max(0, (benar yang dipilih − salah yang dipilih) / jumlah benar)`. Memilih
 * opsi yang salah menurunkan bobot, jadi "centang semua" tidak pernah menang.
 */
final class PenanganPilihanGandaKompleks implements PenanganTipeSoal
{
    private const MIN_OPSI = 3;

    private const MAKS_OPSI = 8;

    public function validasiKonten(array $konten): array
    {
        $galat = [
            ...BantuanKonten::galatTeks($konten),
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];

        $opsi = BantuanKonten::daftar($konten, 'opsi');

        if (count($opsi) < self::MIN_OPSI) {
            $galat[] = 'Pilihan ganda kompleks wajib punya minimal '.self::MIN_OPSI.' opsi.';
        }

        if (count($opsi) > self::MAKS_OPSI) {
            $galat[] = 'Pilihan ganda kompleks maksimal '.self::MAKS_OPSI.' opsi.';
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
        $benar = $kunci['benar'] ?? null;

        if (! is_array($benar) || $benar === []) {
            return ['Kunci pilihan ganda kompleks wajib berisi kunci.benar (minimal satu id opsi).'];
        }

        $idOpsi = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'opsi'));
        $galat = [];
        $dipakai = [];

        foreach ($benar as $satu) {
            if (! is_string($satu) && ! is_int($satu)) {
                return ['kunci.benar wajib berisi daftar id opsi.'];
            }

            $id = (string) $satu;

            if (! in_array($id, $idOpsi, true)) {
                $galat[] = "kunci.benar memakai id opsi tak dikenal ({$id}).";
            }

            $dipakai[] = $id;
        }

        if (count($dipakai) !== count(array_unique($dipakai))) {
            $galat[] = 'kunci.benar tidak boleh memuat id yang sama dua kali.';
        }

        if ($idOpsi !== [] && count(array_unique($dipakai)) >= count($idOpsi)) {
            $galat[] = 'Pilihan ganda kompleks wajib menyisakan minimal satu opsi yang bukan kunci.';
        }

        return array_values(array_unique($galat));
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        return $this->bobot($konten, $kunci, $jawaban) === 1.0;
    }

    public function bobot(array $konten, array $kunci, mixed $jawaban): float
    {
        $kunciBenar = array_values(array_unique($this->daftarId($kunci['benar'] ?? null)));
        $dipilih = array_values(array_unique($this->daftarId($jawaban)));

        if ($kunciBenar === [] || $dipilih === []) {
            return 0.0;
        }

        $kurang = array_diff($kunciBenar, $dipilih);
        $lebih = array_diff($dipilih, $kunciBenar);

        if ($kurang === [] && $lebih === []) {
            return 1.0;
        }

        $benarDipilih = count(array_intersect($dipilih, $kunciBenar));
        $salahDipilih = count($lebih);

        return max(0.0, ($benarDipilih - $salahDipilih) / count($kunciBenar));
    }

    /**
     * Daftar id dari jawaban murid; elemen non-skalar (kiriman nakal) dibuang
     * supaya tidak memunculkan warning "Array to string conversion".
     *
     * @return array<int, string>
     */
    private function daftarId(mixed $nilai): array
    {
        if (! is_array($nilai)) {
            return [];
        }

        $hasil = [];

        // Bentuknya daftar id (mis. ["A", "C"]). Elemen lain diabaikan, bukan
        // dipaksa jadi id — klien yang mengirim peta {id: true} memang salah
        // bentuk, dan menebak-nebak justru membuka jalan nilai palsu.
        foreach ($nilai as $satu) {
            if (is_string($satu) || is_int($satu)) {
                $hasil[] = (string) $satu;
            }
        }

        return $hasil;
    }
}
