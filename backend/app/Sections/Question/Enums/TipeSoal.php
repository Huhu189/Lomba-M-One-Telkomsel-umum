<?php

declare(strict_types=1);

namespace App\Sections\Question\Enums;

/**
 * Delapan jenis soal. Enam di antaranya dinilai pasti (pilihan ganda, benar/salah,
 * menjodohkan, mengurutkan, letak kata, hubung kata); isian singkat dan uraian
 * dinilai bertingkat lewat kata kunci (slice 06).
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

    /**
     * Soal objektif = dinilai pasti tanpa toleransi/tafsir; koreksi guru tidak
     * diperlukan. Isian singkat dan uraian bukan objektif (lihat `bertingkat()`).
     */
    public function objektif(): bool
    {
        return match ($this) {
            self::PilihanGanda, self::BenarSalah, self::Menjodohkan, self::Mengurutkan,
            self::LetakKata, self::HubungKata => true,
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
        };
    }
}
