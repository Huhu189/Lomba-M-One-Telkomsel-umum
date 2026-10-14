<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

use App\Sections\Question\Enums\TipeSoal;

/**
 * Mengubah kunci jawaban satu soal menjadi kalimat pendek yang bisa dibaca anak
 * (dipakai ringkasan soal dan kartu ingat setelah kuis sisipan).
 *
 * Hanya jenis yang kuncinya benar-benar bisa ditulis sebagai teks yang
 * dirangkum. Jenis berbasis gambar/koordinat/rubrik mengembalikan `null` —
 * pemanggil lalu jatuh ke pembahasan guru, bukan menebak. Kelas ini murni
 * (tanpa database) supaya mudah diuji.
 */
final class RangkumKunci
{
    /** Batas panjang rangkuman supaya satu kartu tidak berubah jadi esai. */
    private const MAKS = 240;

    /**
     * @param  array<string, mixed>  $konten
     * @param  array<string, mixed>  $kunci
     */
    public static function rangkum(?TipeSoal $tipe, array $konten, array $kunci): ?string
    {
        if ($tipe === null) {
            return null;
        }

        $hasil = match ($tipe) {
            TipeSoal::PilihanGanda => self::teksOpsi($konten, 'opsi', [$kunci['jawaban'] ?? null]),
            TipeSoal::PilihanGandaKompleks => self::teksOpsi($konten, 'opsi', (array) ($kunci['benar'] ?? [])),
            TipeSoal::BenarSalah => array_key_exists('benar', $kunci) ? ($kunci['benar'] ? 'Benar' : 'Salah') : null,
            TipeSoal::BenarSalahMajemuk => self::majemuk($konten, $kunci),
            TipeSoal::IsianSingkat => self::pertama((array) ($kunci['jawaban_baku'] ?? [])),
            TipeSoal::IsianAngka => self::angka($konten, $kunci),
            TipeSoal::IsianRumpang => self::rumpang($kunci),
            TipeSoal::Mengurutkan => self::urutan($konten, 'item', (array) ($kunci['urutan'] ?? []), ' → '),
            TipeSoal::Menjodohkan => self::pasangan($konten, 'kiri', 'kanan', (array) ($kunci['pasangan'] ?? [])),
            TipeSoal::HubungKata => self::pasangan($konten, 'kiri', 'kanan', (array) ($kunci['sambungan'] ?? [])),
            TipeSoal::Klasifikasi => self::klasifikasi($konten, (array) ($kunci['peta'] ?? [])),
            TipeSoal::LetakKata => self::pasangan($konten, 'kata', 'posisi', (array) ($kunci['penempatan'] ?? [])),
            TipeSoal::BacaJam => self::jam($kunci),
            TipeSoal::GarisBilangan => isset($kunci['nilai']) && is_numeric($kunci['nilai']) ? self::angkaRapi($kunci['nilai']) : null,
            TipeSoal::SusunHuruf => is_string($kunci['kata'] ?? null) ? mb_strtoupper($kunci['kata']) : null,
            default => null,
        };

        if ($hasil === null || trim($hasil) === '') {
            return null;
        }

        return mb_strlen($hasil) > self::MAKS ? mb_substr($hasil, 0, self::MAKS - 1).'…' : $hasil;
    }

    /**
     * Teks soal untuk bagian depan kartu / baris ringkasan.
     *
     * @param  array<string, mixed>  $konten
     */
    public static function teksSoal(array $konten): string
    {
        foreach (['teks', 'petunjuk'] as $kunci) {
            $nilai = $konten[$kunci] ?? null;

            if (is_string($nilai) && trim($nilai) !== '') {
                return trim($nilai);
            }
        }

        return 'Soal bergambar';
    }

    /**
     * @param  array<string, mixed>  $konten
     * @param  array<int, mixed>  $idDicari
     */
    private static function teksOpsi(array $konten, string $daftar, array $idDicari): ?string
    {
        $peta = self::petaTeks($konten, $daftar);
        $teks = [];

        foreach ($idDicari as $id) {
            if ($id === null) {
                continue;
            }

            $teks[] = $peta[(string) $id] ?? null;
        }

        $teks = array_values(array_filter($teks, static fn ($t): bool => is_string($t) && $t !== ''));

        return $teks === [] ? null : implode('; ', $teks);
    }

    /**
     * @param  array<string, mixed>  $konten
     * @return array<string, string>
     */
    private static function petaTeks(array $konten, string $daftar, string $kolom = 'teks'): array
    {
        $peta = [];

        foreach ((array) ($konten[$daftar] ?? []) as $satu) {
            if (is_array($satu) && isset($satu['id']) && is_string($satu[$kolom] ?? null)) {
                $peta[(string) $satu['id']] = $satu[$kolom];
            }
        }

        return $peta;
    }

    /**
     * @param  array<string, mixed>  $konten
     * @param  array<string, mixed>  $kunci
     */
    private static function majemuk(array $konten, array $kunci): ?string
    {
        $peta = self::petaTeks($konten, 'pernyataan');
        $baris = [];

        foreach ((array) ($kunci['jawaban'] ?? []) as $id => $benar) {
            if (isset($peta[(string) $id])) {
                $baris[] = $peta[(string) $id].' = '.($benar ? 'Benar' : 'Salah');
            }
        }

        return $baris === [] ? null : implode('; ', $baris);
    }

    /**
     * @param  array<int, mixed>  $daftar
     */
    private static function pertama(array $daftar): ?string
    {
        $teks = array_values(array_filter($daftar, static fn ($t): bool => is_string($t) && trim($t) !== ''));

        return $teks === [] ? null : implode(' / ', array_slice($teks, 0, 3));
    }

    /**
     * @param  array<string, mixed>  $konten
     * @param  array<string, mixed>  $kunci
     */
    private static function angka(array $konten, array $kunci): ?string
    {
        if (! isset($kunci['nilai']) || ! is_numeric($kunci['nilai'])) {
            return null;
        }

        $satuan = is_string($konten['satuan'] ?? null) ? ' '.trim($konten['satuan']) : '';

        return self::angkaRapi($kunci['nilai']).$satuan;
    }

    private static function angkaRapi(mixed $nilai): string
    {
        $angka = (float) $nilai;

        return $angka == floor($angka) ? (string) (int) $angka : rtrim(rtrim(number_format($angka, 4, ',', ''), '0'), ',');
    }

    /**
     * @param  array<string, mixed>  $kunci
     */
    private static function rumpang(array $kunci): ?string
    {
        $baris = [];

        foreach ((array) ($kunci['lubang'] ?? []) as $nomor => $diterima) {
            $jawaban = self::pertama((array) $diterima);

            if ($jawaban !== null) {
                $baris[] = $nomor.': '.$jawaban;
            }
        }

        return $baris === [] ? null : implode('; ', $baris);
    }

    /**
     * @param  array<string, mixed>  $konten
     * @param  array<int, mixed>  $urutan
     */
    private static function urutan(array $konten, string $daftar, array $urutan, string $pemisah): ?string
    {
        $peta = self::petaTeks($konten, $daftar);
        $teks = [];

        foreach ($urutan as $id) {
            if (isset($peta[(string) $id])) {
                $teks[] = $peta[(string) $id];
            }
        }

        return $teks === [] ? null : implode($pemisah, $teks);
    }

    /**
     * @param  array<string, mixed>  $konten
     * @param  array<string, mixed>  $pasangan
     */
    private static function pasangan(array $konten, string $kiri, string $kanan, array $pasangan): ?string
    {
        $petaKiri = self::petaTeks($konten, $kiri);
        $petaKanan = self::petaTeks($konten, $kanan);
        $baris = [];

        foreach ($pasangan as $idKiri => $idKanan) {
            if (isset($petaKiri[(string) $idKiri], $petaKanan[(string) $idKanan])) {
                $baris[] = $petaKiri[(string) $idKiri].' → '.$petaKanan[(string) $idKanan];
            }
        }

        return $baris === [] ? null : implode('; ', $baris);
    }

    /**
     * @param  array<string, mixed>  $konten
     * @param  array<string, mixed>  $peta
     */
    private static function klasifikasi(array $konten, array $peta): ?string
    {
        $item = self::petaTeks($konten, 'item');
        $kotak = self::petaTeks($konten, 'kotak', 'label');
        $baris = [];

        foreach ($peta as $idItem => $idKotak) {
            if (isset($item[(string) $idItem], $kotak[(string) $idKotak])) {
                $baris[] = $item[(string) $idItem].' → '.$kotak[(string) $idKotak];
            }
        }

        return $baris === [] ? null : implode('; ', $baris);
    }

    /**
     * @param  array<string, mixed>  $kunci
     */
    private static function jam(array $kunci): ?string
    {
        if (! isset($kunci['jam'], $kunci['menit']) || ! is_numeric($kunci['jam']) || ! is_numeric($kunci['menit'])) {
            return null;
        }

        return sprintf('%02d.%02d', (int) $kunci['jam'], (int) $kunci['menit']);
    }
}
