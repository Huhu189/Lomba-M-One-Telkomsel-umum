<?php

declare(strict_types=1);

namespace App\Sections\Question\Enums;

/**
 * Delapan jenis soal. Slice 03 baru memakai empat jenis objektif;
 * empat jenis lain disiapkan untuk slice 06.
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
     * Soal objektif = bisa dinilai otomatis tanpa koreksi guru.
     */
    public function objektif(): bool
    {
        return match ($this) {
            self::PilihanGanda, self::BenarSalah, self::Menjodohkan, self::Mengurutkan => true,
            default => false,
        };
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
