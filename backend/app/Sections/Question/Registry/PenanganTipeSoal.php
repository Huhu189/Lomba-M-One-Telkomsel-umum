<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Kontrak per jenis soal: validator isi soal + penilai jawaban.
 * Renderer pasangannya ada di frontend (sections/question/renderer).
 */
interface PenanganTipeSoal
{
    /**
     * Validasi struktur `konten` (isi soal) apa adanya dari klien.
     *
     * @param  array<string, mixed>  $konten
     * @return array<int, string> daftar pesan galat (kosong = valid)
     */
    public function validasiKonten(array $konten): array;

    /**
     * Validasi `kunci` terhadap `konten` (mis. id opsi wajib ada).
     *
     * @param  array<string, mixed>  $konten
     * @param  array<string, mixed>  $kunci
     * @return array<int, string>
     */
    public function validasiKunci(array $konten, array $kunci): array;

    /**
     * Nilai satu jawaban murid. Hanya tipe objektif yang punya penilaian pasti.
     *
     * @param  array<string, mixed>  $konten
     * @param  array<string, mixed>  $kunci
     */
    public function nilai(array $konten, array $kunci, mixed $jawaban): bool;

    /**
     * Bobot jawaban 0.0–1.0 — dipakai mesin skor supaya tipe yang bisa dinilai
     * sebagian (mis. pilihan ganda kompleks: tiga dari empat benar) tidak dipaksa
     * benar/salah. Mesin skor menghitung `skor = bobot * skor_soal` dan menandai
     * `benar` hanya saat bobotnya 1.0.
     *
     * Tipe yang memang biner memakai trait `BobotBiner`, sehingga bobotnya selalu
     * sama dengan `nilai()` — perilaku tipe lama tidak berubah.
     *
     * @param  array<string, mixed>  $konten
     * @param  array<string, mixed>  $kunci
     */
    public function bobot(array $konten, array $kunci, mixed $jawaban): float;
}
