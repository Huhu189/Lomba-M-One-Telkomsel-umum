<?php

declare(strict_types=1);

namespace App\Sections\Scoring\Services;

use App\Sections\Question\Enums\TipeSoal;
use App\Sections\Question\Models\Soal;
use App\Sections\Question\Registry\PenanganUraian;
use App\Sections\Question\Registry\RegistryTipeSoal;
use App\Sections\Scoring\Enums\StatusPenilaian;
use Throwable;

/**
 * Penilaian soal bertingkat (isian singkat + uraian) — chunk slice-06.
 *
 * Sama seperti penilaian objektif: tidak pernah melempar exception, sehingga
 * satu soal bermasalah tidak menjatuhkan seluruh ulangan.
 *
 * Aturan:
 * - isian singkat: benar/salah pasti dari registry (normalisasi, angka persis,
 *   penjaga negasi, toleransi typo per kata ≥ 80%).
 * - uraian: skor parsial dari kata kunci berbobot; bila rasio di bawah ambang
 *   atau kata kunci belum diisi, soal ditandai `perlu_tinjau` untuk guru
 *   (tahap AI menyusul di slice 09).
 */
final class PenilaianTeks
{
    /**
     * @return array{status: StatusPenilaian, benar: bool|null, skor: float}
     */
    public function nilai(Soal $soal, mixed $jawaban): array
    {
        $tipe = $soal->tipeAman();

        if ($tipe === null) {
            return ['status' => StatusPenilaian::Gagal, 'benar' => null, 'skor' => 0.0];
        }

        $skorSoal = (float) $soal->skor;

        if (! is_string($jawaban) || trim($jawaban) === '') {
            // Tidak dijawab: bukan kegagalan penilaian, cukup dinilai 0.
            return ['status' => StatusPenilaian::Dinilai, 'benar' => false, 'skor' => 0.0];
        }

        try {
            if ($tipe === TipeSoal::Uraian) {
                return $this->nilaiUraian($soal, $jawaban, $skorSoal);
            }

            $benar = RegistryTipeSoal::nilai(
                $tipe,
                $soal->kontenSebagaiArray(),
                $soal->kunciSebagaiArray(),
                $jawaban,
            );

            return [
                'status' => StatusPenilaian::Dinilai,
                'benar' => $benar,
                'skor' => $benar ? $skorSoal : 0.0,
            ];
        } catch (Throwable) {
            return ['status' => StatusPenilaian::Gagal, 'benar' => null, 'skor' => 0.0];
        }
    }

    /**
     * @return array{status: StatusPenilaian, benar: bool|null, skor: float}
     */
    private function nilaiUraian(Soal $soal, string $jawaban, float $skorSoal): array
    {
        $konten = $soal->kontenSebagaiArray();
        $kunci = $soal->kunciSebagaiArray();

        if (($kunci['kata_kunci'] ?? []) === []) {
            // Tanpa kata kunci tidak ada dasar penilaian otomatis: guru meninjau.
            return ['status' => StatusPenilaian::PerluTinjau, 'benar' => null, 'skor' => 0.0];
        }

        /** @var PenanganUraian $penangan */
        $penangan = RegistryTipeSoal::penangan(TipeSoal::Uraian);
        $rasio = $penangan->rasio($konten, $kunci, $jawaban);
        $lulus = $rasio >= $penangan->ambangLulus($kunci);

        if (! $lulus) {
            return ['status' => StatusPenilaian::PerluTinjau, 'benar' => null, 'skor' => 0.0];
        }

        // Skor parsial: sebesar rasio bobot kata kunci yang muncul.
        return [
            'status' => StatusPenilaian::Dinilai,
            'benar' => true,
            'skor' => round($rasio * $skorSoal, 2),
        ];
    }
}
