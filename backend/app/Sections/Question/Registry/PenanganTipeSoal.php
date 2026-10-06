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
}
