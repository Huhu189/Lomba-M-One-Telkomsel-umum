<?php

declare(strict_types=1);

namespace App\Sections\Question\Enums;

/**
 * Cara sebuah soal dikoreksi (14 Oktober 2026).
 *
 * Pemilik produk: guru harus bisa **memilih** teknik koreksi untuk setiap jenis
 * soal, tetapi pilihannya tidak boleh menjanjikan hal yang mesin tidak bisa
 * kerjakan. Karena itu tiap jenis soal punya daftar tekniknya sendiri
 * (`TipeSoal::teknikKoreksiTersedia()`):
 *
 * - `Otomatis` — mesin menilai dengan kunci pasti (pilihan ganda, menjodohkan,
 *   angka, dan seterusnya). Tidak ada tafsir.
 * - `OtomatisTeks` — mesin menilai teks dengan toleransi ejaan/sinonim dan
 *   ambang; yang masih ragu ditandai **perlu ditinjau** supaya tidak ditebak.
 *   Hanya jenis yang memang punya penilai teks (isian singkat, uraian).
 * - `Manual` — mesin tidak menilai sama sekali; setiap jawaban masuk antrean
 *   koreksi guru. Ini satu-satunya pilihan yang tersedia untuk tugas unggah,
 *   dan selalu tersedia untuk jenis lain (guru boleh menilai sendiri, mis.
 *   saat ingin menilai cara berpikir anak, bukan jawabannya saja).
 *
 * Yang dipilih guru ikut tersimpan di `kunci.teknik_koreksi` — di dalam kunci
 * supaya **tidak pernah** ikut ke perangkat murid.
 */
enum TeknikKoreksi: string
{
    case Otomatis = 'otomatis';

    case OtomatisTeks = 'otomatis_teks';

    case Manual = 'manual';

    /** Label pendek untuk tombol pilihan guru. */
    public function label(): string
    {
        return match ($this) {
            self::Otomatis => 'Otomatis',
            self::OtomatisTeks => 'Otomatis (teks)',
            self::Manual => 'Manual (guru)',
        };
    }

    /** Satu kalimat yang menjelaskan akibat pilihannya. */
    public function keterangan(): string
    {
        return match ($this) {
            self::Otomatis => 'Dinilai mesin dengan kunci pasti; tidak ada jawaban yang perlu ditinjau.',
            self::OtomatisTeks => 'Dinilai mesin dengan toleransi ejaan/sinonim dan ambang; jawaban yang ragu masuk antrean koreksi guru.',
            self::Manual => 'Tidak dinilai mesin; semua jawaban masuk antrean koreksi guru.',
        };
    }

    /**
     * Teknik yang benar-benar dipakai satu soal: pilihan guru bila sah, kalau
     * tidak kembali ke bawaan jenis soalnya.
     *
     * Kunci lama (sebelum fitur ini) tidak memuat `teknik_koreksi` sama sekali,
     * jadi soal-soal yang sudah ada tetap berperilaku seperti sebelumnya.
     *
     * @param  array<string, mixed>  $kunci
     */
    public static function untuk(TipeSoal $tipe, array $kunci): self
    {
        $nilai = $kunci['teknik_koreksi'] ?? null;

        if (is_string($nilai)) {
            $pilihan = self::tryFrom($nilai);

            if ($pilihan !== null && in_array($pilihan, $tipe->teknikKoreksiTersedia(), true)) {
                return $pilihan;
            }
        }

        return $tipe->teknikKoreksiBawaan();
    }
}
