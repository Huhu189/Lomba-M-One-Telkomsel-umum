<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

use App\Sections\Question\Enums\TipeSoal;
use InvalidArgumentException;

/**
 * Registry tipe soal: satu penangan (validator + penilai) per jenis soal objektif.
 * Menambah jenis baru = tambah penangan di sini + renderer frontend + test.
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

    public static function dukung(TipeSoal $tipe): bool
    {
        return $tipe->objektif();
    }

    /**
     * Penangan untuk tipe objektif.
     */
    public static function penangan(TipeSoal $tipe): PenanganTipeSoal
    {
        return match ($tipe) {
            TipeSoal::PilihanGanda => new PenanganPilihanGanda,
            TipeSoal::BenarSalah => new PenanganBenarSalah,
            TipeSoal::Menjodohkan => new PenanganMenjodohkan,
            TipeSoal::Mengurutkan => new PenanganMengurutkan,
            default => throw new InvalidArgumentException(
                "Tipe soal {$tipe->value} belum punya penangan (dijadwalkan pada slice 06).",
            ),
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
        if (! self::dukung($tipe)) {
            return ["Tipe soal {$tipe->value} belum didukung pada tahap ini."];
        }

        $penangan = self::penangan($tipe);

        return array_values(array_unique([
            ...$penangan->validasiKonten($konten),
            ...$penangan->validasiKunci($konten, $kunci),
        ]));
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
}
