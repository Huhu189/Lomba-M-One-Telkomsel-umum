<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

use App\Sections\Question\Enums\TeknikKoreksi;
use App\Sections\Question\Enums\TipeSoal;

/**
 * Registry tipe soal: satu penangan (validator + penilai) per jenis soal.
 * Delapan jenis kini punya penangan; menambah jenis baru = tambah penangan di
 * sini + renderer frontend + test.
 */
final class RegistryTipeSoal
{
    /**
     * @return array<int, TipeSoal>
     */
    public static function objektif(): array
    {
        return array_values(array_filter(
            TipeSoal::cases(),
            static fn (TipeSoal $tipe): bool => $tipe->objektif(),
        ));
    }

    /**
     * @return array<int, string> nilai enum semua tipe (untuk validasi request)
     */
    public static function semuaNilai(): array
    {
        return array_map(static fn (TipeSoal $tipe): string => $tipe->value, TipeSoal::cases());
    }

    /**
     * Semua delapan jenis punya penangan sejak slice 06.
     */
    public static function dukung(TipeSoal $tipe): bool
    {
        return true;
    }

    /**
     * Penangan (validator + penilai) untuk satu tipe soal.
     */
    public static function penangan(TipeSoal $tipe): PenanganTipeSoal
    {
        return match ($tipe) {
            TipeSoal::PilihanGanda => new PenanganPilihanGanda,
            TipeSoal::BenarSalah => new PenanganBenarSalah,
            TipeSoal::Menjodohkan => new PenanganMenjodohkan,
            TipeSoal::Mengurutkan => new PenanganMengurutkan,
            TipeSoal::LetakKata => new PenanganLetakKata,
            TipeSoal::HubungKata => new PenanganHubungKata,
            TipeSoal::IsianSingkat => new PenanganIsianSingkat,
            TipeSoal::Uraian => new PenanganUraian,
            TipeSoal::PilihanGandaKompleks => new PenanganPilihanGandaKompleks,
            TipeSoal::BenarSalahMajemuk => new PenanganBenarSalahMajemuk,
            TipeSoal::IsianAngka => new PenanganIsianAngka,
            TipeSoal::PilihanGambar => new PenanganPilihanGambar,
            TipeSoal::UrutGambar => new PenanganUrutGambar,
            TipeSoal::SusunHuruf => new PenanganSusunHuruf,
            TipeSoal::IsianRumpang => new PenanganIsianRumpang,
            TipeSoal::Klasifikasi => new PenanganKlasifikasi,
            TipeSoal::TabelIsian => new PenanganTabelIsian,
            TipeSoal::GarisBilangan => new PenanganGarisBilangan,
            TipeSoal::HotspotGambar => new PenanganHotspotGambar,
            TipeSoal::BacaJam => new PenanganBacaJam,
            TipeSoal::TugasUnggah => new PenanganTugasUnggah,
            TipeSoal::TekaSilangMini => new PenanganTekaSilangMini,
        };
    }

    /**
     * Validasi penuh konten + kunci (dipakai Form Request dan service).
     *
     * @param  array<string, mixed>  $konten
     * @param  array<string, mixed>  $kunci
     * @return array<int, string>
     */
    public static function validasi(TipeSoal $tipe, array $konten, array $kunci): array
    {
        $penangan = self::penangan($tipe);

        return array_values(array_unique([
            ...$penangan->validasiKonten($konten),
            ...$penangan->validasiKunci($konten, $kunci),
            ...self::galatTeknikKoreksi($tipe, $kunci),
        ]));
    }

    /**
     * Pilihan teknik koreksi guru harus termasuk yang bisa dikerjakan jenis
     * soal itu (14 Oktober 2026).
     *
     * Tanpa pagar ini, guru bisa memilih "Otomatis" untuk tugas unggah (tidak
     * ada kuncinya), atau "Otomatis teks" untuk pilihan ganda — permintaan yang
     * tidak bisa ditepati mesin, dan diam-diam jadi "semua perlu ditinjau".
     * Kunci tanpa `teknik_koreksi` tetap sah: itu soal lama, dan bawaannya
     * sudah sama dengan perilaku lamanya.
     *
     * @param  array<string, mixed>  $kunci
     * @return array<int, string>
     */
    public static function galatTeknikKoreksi(TipeSoal $tipe, array $kunci): array
    {
        $nilai = $kunci['teknik_koreksi'] ?? null;

        if ($nilai === null) {
            return [];
        }

        $tersedia = $tipe->teknikKoreksiTersedia();
        $pilihan = is_string($nilai) ? TeknikKoreksi::tryFrom($nilai) : null;

        if ($pilihan !== null && in_array($pilihan, $tersedia, true)) {
            return [];
        }

        $nama = array_map(static fn (TeknikKoreksi $satu): string => $satu->label(), $tersedia);

        return [
            'kunci.teknik_koreksi tidak cocok untuk '.$tipe->label()
            .' — pilihan yang tersedia: '.implode(' atau ', $nama).'.',
        ];
    }

    /**
     * Nilai satu jawaban (dipakai mesin kuis slice 04).
     *
     * @param  array<string, mixed>  $konten
     * @param  array<string, mixed>  $kunci
     */
    public static function nilai(TipeSoal $tipe, array $konten, array $kunci, mixed $jawaban): bool
    {
        return self::penangan($tipe)->nilai($konten, $kunci, $jawaban);
    }

    /**
     * Bobot jawaban 0.0–1.0 (Objektif 1A) — mesin skor memakai ini supaya soal
     * yang dinilai sebagian tidak dipaksa benar/salah.
     *
     * @param  array<string, mixed>  $konten
     * @param  array<string, mixed>  $kunci
     */
    public static function bobot(TipeSoal $tipe, array $konten, array $kunci, mixed $jawaban): float
    {
        return self::penangan($tipe)->bobot($konten, $kunci, $jawaban);
    }
}
