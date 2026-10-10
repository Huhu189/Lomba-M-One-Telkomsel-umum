<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Bobot bawaan untuk soal yang dinilai benar/salah tanpa sebagian: 1.0 bila
 * jawabannya benar, 0.0 bila salah.
 *
 * Dipakai delapan tipe lama supaya penambahan `bobot()` sama sekali tidak
 * mengubah nilainya (trait ini memang menyusun bobot dari `nilai()` yang sudah
 * ada), dan dipakai juga tipe baru yang penilaiannya biner (mis. isian angka
 * yang hanya benar bila masuk toleransi).
 */
trait BobotBiner
{
    /**
     * @param  array<string, mixed>  $konten
     * @param  array<string, mixed>  $kunci
     */
    public function bobot(array $konten, array $kunci, mixed $jawaban): float
    {
        return $this->nilai($konten, $kunci, $jawaban) ? 1.0 : 0.0;
    }
}
