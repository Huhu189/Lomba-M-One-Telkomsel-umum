<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Menjodohkan.
 * konten: {teks, kiri:[{id,teks}], kanan:[{id,teks}], matematika?, media?}
 * kunci : {pasangan:{idKiri: idKanan}}
 *
 * Dipakai juga oleh hubung kata (slice 06) yang hanya berbeda nama kunci
 * pemetaan dan sebutannya — logikanya sama persis.
 */
class PenanganMenjodohkan implements PenanganTipeSoal
{
    private const MIN_PASANGAN = 2;

    /** Nama kunci pemetaan di `kunci` (hubung kata memakai `sambungan`). */
    protected const KUNCI_PETA = 'pasangan';

    /** Sebutan jenis soal untuk pesan galat. */
    public function nama(): string
    {
        return 'Menjodohkan';
    }

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
            $galat[] = $this->nama().' wajib punya minimal '.self::MIN_PASANGAN.' pasangan kiri dan kanan.';
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
        $pasangan = $kunci[static::KUNCI_PETA] ?? null;

        if (! is_array($pasangan) || $pasangan === []) {
            return ['Kunci '.mb_strtolower($this->nama()).' wajib berisi kunci.'.static::KUNCI_PETA.'.'];
        }

        $idKiri = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'kiri'));
        $idKanan = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'kanan'));
        $galat = [];

        foreach ($pasangan as $dari => $ke) {
            if (! in_array((string) $dari, $idKiri, true)) {
                $galat[] = 'kunci.'.static::KUNCI_PETA." memakai id kiri tak dikenal ({$dari}).";
            }

            if (! is_string($ke) && ! is_int($ke)) {
                $galat[] = 'kunci.'.static::KUNCI_PETA.' wajib memetakan id kiri ke id kanan.';
            } elseif (! in_array((string) $ke, $idKanan, true)) {
                $galat[] = 'kunci.'.static::KUNCI_PETA." memakai id kanan tak dikenal ({$ke}).";
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

        $pasangan = $kunci[static::KUNCI_PETA] ?? null;

        if (! is_array($pasangan) || $pasangan === []) {
            return false;
        }

        if (count($jawaban) !== count($pasangan)) {
            return false;
        }

        foreach ($pasangan as $dari => $ke) {
            $dijawab = $jawaban[$dari] ?? $jawaban[(string) $dari] ?? null;

            // Elemen berbentuk array/objek (kiriman nakal) bukan jawaban yang
            // bisa dicocokkan. Tanpa penjagaan ini `(string) array` memunculkan
            // warning "Array to string conversion" yang Laravel ubah jadi
            // ErrorException, sehingga soal berstatus `gagal` (bukan salah biasa)
            // dan guru kebanjiran antrean tinjauan (Q-19).
            if (! is_scalar($dijawab)) {
                return false;
            }

            if ((string) $dijawab !== (string) $ke) {
                return false;
            }
        }

        return true;
    }
}
