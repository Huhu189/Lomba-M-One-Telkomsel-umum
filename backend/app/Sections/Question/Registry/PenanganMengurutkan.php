<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Mengurutkan.
 * konten: {teks, item:[{id,teks}], matematika?, media?}
 * kunci : {urutan:[id, ...]}
 * jawaban: {idItem: posisi} — bentuk yang dikirim renderer `SoalMengurutkan`
 *          (murid mengisi nomor urut tiap item); daftar id berurutan tetap
 *          diterima untuk jawaban lama yang sudah tersimpan.
 */
final class PenanganMengurutkan implements PenanganTipeSoal
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

        $item = BantuanKonten::daftar($konten, 'item');

        if (count($item) < self::MIN_ITEM) {
            $galat[] = 'Mengurutkan wajib punya minimal '.self::MIN_ITEM.' item.';
        }

        foreach ($item as $satu) {
            if (! is_string($satu['teks'] ?? null) || trim((string) $satu['teks']) === '') {
                $galat[] = 'Setiap item wajib punya teks.';
                break;
            }
        }

        return [...$galat, ...BantuanKonten::galatId($item, 'item')];
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $urutan = $kunci['urutan'] ?? null;

        if (! is_array($urutan) || $urutan === []) {
            return ['Kunci mengurutkan wajib berisi kunci.urutan.'];
        }

        $id = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'item'));
        $urutan = array_values(array_map(static fn (mixed $satu): string => (string) $satu, $urutan));

        if (count($urutan) !== count($id)) {
            return ['kunci.urutan wajib memuat semua item tepat sekali.'];
        }

        sort($id);
        $urutSalin = $urutan;
        sort($urutSalin);

        if ($id !== $urutSalin) {
            return ['kunci.urutan wajib memuat semua item tepat sekali.'];
        }

        return [];
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        if (! is_array($jawaban)) {
            return false;
        }

        $urutan = $kunci['urutan'] ?? null;

        if (! is_array($urutan) || $urutan === []) {
            return false;
        }

        $kunciUrut = array_values(array_map(static fn (mixed $satu): string => (string) $satu, $urutan));
        $jawabanUrut = $this->urutanJawaban($konten, $jawaban);

        return $jawabanUrut !== null && $jawabanUrut === $kunciUrut;
    }

    /**
     * Urutan jawaban murid sebagai daftar id, dari salah satu bentuk:
     *
     * 1. **peta `{idItem: posisi}`** — bentuk yang benar-benar dikirim renderer
     *    `SoalMengurutkan` (murid mengetik nomor urut tiap item). Hanya sah bila
     *    kuncinya persis seluruh item, nomornya bulat 1..n, dan tidak ada nomor
     *    kembar. Sebelum perbaikan ini jawaban peta dibaca sebagai daftar,
     *    sehingga murid yang menjawab BENAR selalu mendapat skor 0;
     * 2. **daftar id berurutan** — bentuk jawaban lama yang sudah tersimpan di
     *    basis data.
     *
     * Elemen non-skalar tidak pernah dipaksa `(string)` (dulu memunculkan
     * warning "Array to string conversion" yang Laravel ubah jadi
     * ErrorException sehingga soal berstatus `gagal`, bukan salah biasa — Q-19).
     *
     * @return array<int, string>|null null = bentuk jawaban tidak sah
     */
    private function urutanJawaban(array $konten, array $jawaban): ?array
    {
        $id = BantuanKonten::idDaftar(BantuanKonten::daftar($konten, 'item'));
        $kunciPeta = array_map(static fn (mixed $satu): string => (string) $satu, array_keys($jawaban));

        // Peta dikenali dari kuncinya yang sama persis dengan id item (bukan
        // dari `array_is_list()`, karena id item berupa angka bisa membuat peta
        // ikut terbaca sebagai daftar).
        if ($id !== [] && count($jawaban) === count($id)
            && array_diff($kunciPeta, $id) === [] && array_diff($id, $kunciPeta) === []) {
            $posisi = [];

            foreach ($jawaban as $kunciItem => $nilaiPosisi) {
                if (! is_scalar($nilaiPosisi) || ! is_numeric($nilaiPosisi)) {
                    return null;
                }

                $angka = (int) $nilaiPosisi;

                if ($angka < 1 || $angka > count($id)) {
                    return null;
                }

                $posisi[(string) $kunciItem] = $angka;
            }

            if (count(array_unique(array_values($posisi))) !== count($id)) {
                return null;
            }

            $urut = $id;
            usort($urut, static fn (string $a, string $b): int => $posisi[$a] <=> $posisi[$b]);

            return $urut;
        }

        $hasil = [];

        foreach (array_values($jawaban) as $satu) {
            if (! is_scalar($satu)) {
                return null;
            }

            $hasil[] = (string) $satu;
        }

        return $hasil;
    }
}
