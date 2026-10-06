<?php

declare(strict_types=1);

namespace App\Sections\Scoring\Services;

use App\Sections\Question\Models\Soal;
use App\Sections\Scoring\Enums\StatusPenilaian;

/**
 * Pintu masuk penilaian satu soal (chunk slice-06): memilih jalur sesuai tipe.
 *
 * - Soal objektif (pilihan ganda, benar/salah, menjodohkan, mengurutkan,
 *   letak kata, hubung kata) → `PenilaianObjektif` (benar/salah pasti).
 * - Soal bertingkat (isian singkat, uraian) → `PenilaianTeks` (kata kunci,
 *   boleh skor parsial, boleh `perlu_tinjau` untuk guru).
 *
 * Kontraknya tetap sama untuk pemanggil: selalu mengembalikan array status +
 * benar + skor, tidak pernah melempar exception.
 */
final class PenilaiSoal
{
    public function __construct(
        private readonly PenilaianObjektif $objektif,
        private readonly PenilaianTeks $teks,
    ) {}

    /**
     * @return array{status: StatusPenilaian, benar: bool|null, skor: float}
     */
    public function nilai(Soal $soal, mixed $jawaban): array
    {
        $tipe = $soal->tipeAman();

        if ($tipe === null) {
            return ['status' => StatusPenilaian::Gagal, 'benar' => null, 'skor' => 0.0];
        }

        if ($tipe->objektif()) {
            return $this->objektif->nilai($soal, $jawaban);
        }

        return $this->teks->nilai($soal, $jawaban);
    }
}
