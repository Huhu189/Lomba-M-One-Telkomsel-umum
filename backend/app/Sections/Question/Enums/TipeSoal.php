<?php

declare(strict_types=1);

namespace App\Sections\Question\Enums;

/**
 * Delapan jenis soal lama, ditambah jenis baru dari Objektif 1 (22 tipe pada
 * akhir ketiga gelombang). Enam tipe lama dinilai pasti (pilihan ganda,
 * benar/salah, menjodohkan, mengurutkan, letak kata, hubung kata); isian
 * singkat dan uraian dinilai bertingkat lewat kata kunci (slice 06).
 *
 * Tipe baru yang objektif dinilai mesin skor lewat `bobot()`; satu tipe
 * (`tugas_unggah`) bukan objektif karena hasilnya dinilai guru dari rubrik.
 */
enum TipeSoal: string
{
    case PilihanGanda = 'pilihan_ganda';
    case BenarSalah = 'benar_salah';
    case Menjodohkan = 'menjodohkan';
    case Mengurutkan = 'mengurutkan';
    case IsianSingkat = 'isian_singkat';
    case Uraian = 'uraian';
    case LetakKata = 'letak_kata';
    case HubungKata = 'hubung_kata';

    // Gelombang 1 (Objektif 1B): tipe 1, 2, 3, 6, 7, 9.
    case PilihanGandaKompleks = 'pilihan_ganda_kompleks';
    case BenarSalahMajemuk = 'benar_salah_majemuk';
    case IsianAngka = 'isian_angka';
    case PilihanGambar = 'pilihan_gambar';
    case UrutGambar = 'urut_gambar';
    case SusunHuruf = 'susun_huruf';

    // Gelombang 2 (Objektif 1B): tipe 4, 5, 10, 11.
    case IsianRumpang = 'isian_rumpang';
    case Klasifikasi = 'klasifikasi';
    case TabelIsian = 'tabel_isian';
    case GarisBilangan = 'garis_bilangan';

    // Gelombang 3 (Objektif 1B): tipe 8, 12, 13, 14.
    case HotspotGambar = 'hotspot_gambar';
    case BacaJam = 'baca_jam';
    case TugasUnggah = 'tugas_unggah';
    case TekaSilangMini = 'teka_silang_mini';

    /**
     * Soal objektif = dinilai pasti tanpa toleransi/tafsir; koreksi guru tidak
     * diperlukan. Isian singkat dan uraian bukan objektif (lihat `bertingkat()`).
     */
    public function objektif(): bool
    {
        return match ($this) {
            self::PilihanGanda, self::BenarSalah, self::Menjodohkan, self::Mengurutkan,
            self::LetakKata, self::HubungKata,
            self::PilihanGandaKompleks, self::BenarSalahMajemuk, self::IsianAngka,
            self::PilihanGambar, self::UrutGambar, self::SusunHuruf,
            self::IsianRumpang, self::Klasifikasi, self::TabelIsian,
            self::GarisBilangan, self::HotspotGambar, self::BacaJam,
            self::TekaSilangMini => true,
            // Tugas unggah tidak pernah dinilai mesin: guru menilai berkasnya
            // lewat rubrik di antrean koreksi.
            default => false,
        };
    }

    /**
     * Soal bertingkat = dinilai otomatis sebisanya (kata kunci), lalu guru
     * mengoreksi lewat antrean koreksi manual bila perlu.
     */
    public function bertingkat(): bool
    {
        return ! $this->objektif();
    }

    public function label(): string
    {
        return match ($this) {
            self::PilihanGanda => 'Pilihan ganda',
            self::BenarSalah => 'Benar / salah',
            self::Menjodohkan => 'Menjodohkan',
            self::Mengurutkan => 'Mengurutkan',
            self::IsianSingkat => 'Isian singkat',
            self::Uraian => 'Uraian',
            self::LetakKata => 'Letak kata',
            self::HubungKata => 'Hubung kata',
            self::PilihanGandaKompleks => 'Pilihan ganda kompleks',
            self::BenarSalahMajemuk => 'Benar / salah majemuk',
            self::IsianAngka => 'Isian angka',
            self::PilihanGambar => 'Pilihan gambar',
            self::UrutGambar => 'Urut gambar',
            self::SusunHuruf => 'Susun huruf',
            self::IsianRumpang => 'Isian rumpang',
            self::Klasifikasi => 'Klasifikasi',
            self::TabelIsian => 'Tabel isian',
            self::GarisBilangan => 'Garis bilangan',
            self::HotspotGambar => 'Hotspot gambar',
            self::BacaJam => 'Baca jam',
            self::TugasUnggah => 'Tugas unggah',
            self::TekaSilangMini => 'Teka silang mini',
        };
    }
}
