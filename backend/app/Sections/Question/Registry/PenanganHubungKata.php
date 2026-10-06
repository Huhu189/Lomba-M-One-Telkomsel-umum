<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Hubung kata — menghubungkan kata kiri dengan pasangan kanannya.
 * konten: {teks, kiri:[{id,teks}], kanan:[{id,teks}], matematika?, media?}
 * kunci : {sambungan:{idKiri: idKanan}}
 *
 * Logika penilaiannya sama dengan menjodohkan; bedanya hanya nama kunci
 * (`sambungan`) dan sebutan pada pesan galat.
 */
final class PenanganHubungKata extends PenanganMenjodohkan
{
    protected const KUNCI_PETA = 'sambungan';

    public function nama(): string
    {
        return 'Hubung kata';
    }
}
