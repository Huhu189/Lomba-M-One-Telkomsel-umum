<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Letak kata — murid menempatkan setiap kata pada kolom/posisi yang benar.
 * konten: {teks, kata:[{id,teks}], posisi:[{id,teks}], matematika?, media?}
 * kunci : {penempatan:{idKata: idPosisi}}
 *
 * Penilaian deterministik (semua kata harus tepat) sehingga dinilai otomatis
 * lewat registry seperti soal objektif.
 */
final class PenanganLetakKata implements PenanganTipeSoal
{
    use BobotBiner;

    private const MIN_ITEM = 2;

    public function validasiKonten(array $konten): array
    {
        $galat = [
            ...BantuanKonten::galatTeks($konten),
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];

        $kata = BantuanKonten::daftar($konten, 'kata');
        $posisi = BantuanKonten::daftar($konten, 'posisi');

        if (count($kata) < self::MIN_ITEM || count($posisi) < self::MIN_ITEM) {
            $galat[] = 'Letak kata wajib punya minimal '.self::MIN_ITEM.' kata dan '.self::MIN_ITEM.' posisi.';
        }

        foreach (['kata' => $kata, 'posisi' => $posisi] as $nama => $daftar) {
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
        $penempatan = $kunci['penempatan'] ?? null;

        if (! is_array($penempatan) || $penempatan === []) {
            return ['Kunci letak kata wajib berisi kunci.penempatan.'];
        }

        $idKata = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'kata'));
        $idPosisi = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'posisi'));
        $galat = [];

        foreach ($penempatan as $dari => $ke) {
            if (! in_array((string) $dari, $idKata, true)) {
                $galat[] = "kunci.penempatan memakai id kata tak dikenal ({$dari}).";
            }

            if (! is_string($ke) && ! is_int($ke)) {
                $galat[] = 'kunci.penempatan wajib memetakan id kata ke id posisi.';
            } elseif (! in_array((string) $ke, $idPosisi, true)) {
                $galat[] = "kunci.penempatan memakai id posisi tak dikenal ({$ke}).";
            }
        }

        $tanpaTempat = array_diff($idKata, array_map('strval', array_keys($penempatan)));

        if ($tanpaTempat !== []) {
            $galat[] = 'Setiap kata wajib punya posisi di kunci.';
        }

        return array_values(array_unique($galat));
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        if (! is_array($jawaban)) {
            return false;
        }

        $penempatan = $kunci['penempatan'] ?? null;

        if (! is_array($penempatan) || $penempatan === []) {
            return false;
        }

        if (count($jawaban) !== count($penempatan)) {
            return false;
        }

        foreach ($penempatan as $dari => $ke) {
            $ditempatkan = $jawaban[$dari] ?? $jawaban[(string) $dari] ?? null;

            if ((string) $ditempatkan !== (string) $ke) {
                return false;
            }
        }

        return true;
    }
}
