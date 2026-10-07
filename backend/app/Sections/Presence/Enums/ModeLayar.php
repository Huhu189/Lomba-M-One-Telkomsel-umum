<?php

declare(strict_types=1);

namespace App\Sections\Presence\Enums;

/**
 * Apa yang sedang ditampilkan di layar guru (slice 10).
 *
 * Sengaja hanya empat keadaan: layar kelas dipakai di tengah ulangan, jadi guru
 * butuh tombol yang bisa ditekan cepat — bukan editor bebas.
 */
enum ModeLayar: string
{
    /** Tidak ada apa-apa: perangkat murid kembali ke tampilan ulangan biasa. */
    case Kosong = 'kosong';

    /** Pengumuman singkat (mis. "waktu tersisa 10 menit" / "nomor 5 salah baca"). */
    case Pengumuman = 'pengumuman';

    /** Sorot satu soal: guru membahas soal tertentu bersama kelas. */
    case Soal = 'soal';

    /** Hasil/kesimpulan setelah ulangan, mis. tautan atau instruksi lanjutan. */
    case Hasil = 'hasil';

    public function label(): string
    {
        return match ($this) {
            self::Kosong => 'Kosong (ulangan biasa)',
            self::Pengumuman => 'Pengumuman singkat',
            self::Soal => 'Sorot satu soal',
            self::Hasil => 'Instruksi setelah ulangan',
        };
    }

    /** Mode yang wajib menyertakan soal yang disorot. */
    public function butuhSoal(): bool
    {
        return $this === self::Soal;
    }

    /** Mode yang wajib punya bahan tulisan (judul dan/atau isi). */
    public function butuhTulisan(): bool
    {
        return $this === self::Pengumuman || $this === self::Hasil;
    }
}
