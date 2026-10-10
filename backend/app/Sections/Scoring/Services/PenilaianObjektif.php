<?php

declare(strict_types=1);

namespace App\Sections\Scoring\Services;

use App\Sections\Question\Models\Soal;
use App\Sections\Question\Registry\RegistryTipeSoal;
use App\Sections\Scoring\Enums\StatusPenilaian;
use Throwable;

/**
 * Penilaian satu soal objektif (chunk security: penilaian gagal per soal tidak
 * menjatuhkan seluruh ulangan).
 *
 * Hasil selalu berupa array status + benar + skor sehingga pemanggil tidak
 * pernah menerima exception; soal yang tidak bisa dinilai ditandai `gagal`
 * (data rusak/tipe tak dikenal) dan guru bisa meninjaunya.
 *
 * Sejak slice 06 soal bertingkat (isian singkat, uraian) ditangani
 * `PenilaianTeks`; `PenilaiSoal` yang memilih jalurnya. Tipe non-objektif yang
 * sampai ke kelas ini (pemanggilan langsung) tetap ditandai `perlu_tinjau`.
 */
/**
 * Sejak gelombang bobot (Objektif 1A) kelas ini memakai `bobot()` penangan
 * sehingga tipe yang bisa dinilai sebagian (mis. pilihan ganda kompleks)
 * mendapat skor proporsional lewat `skor = bobot * skor_soal`.
 */
final class PenilaianObjektif
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

        if (! $tipe->objektif()) {
            // Esai/isian belum dinilai otomatis — ditinjau guru pada slice 06.
            return ['status' => StatusPenilaian::PerluTinjau, 'benar' => null, 'skor' => 0.0];
        }

        if ($jawaban === null) {
            return ['status' => StatusPenilaian::Dinilai, 'benar' => false, 'skor' => 0.0];
        }

        try {
            $bobot = RegistryTipeSoal::bobot(
                $tipe,
                $soal->kontenSebagaiArray(),
                $soal->kunciSebagaiArray(),
                $jawaban,
            );
        } catch (Throwable) {
            return ['status' => StatusPenilaian::Gagal, 'benar' => null, 'skor' => 0.0];
        }

        // Bobot di luar 0–1 hanya bisa datang dari penangan yang salah tulis;
        // dijepit di sini supaya skor tidak pernah melebihi skor soal.
        $bobot = max(0.0, min(1.0, $bobot));

        return [
            'status' => StatusPenilaian::Dinilai,
            // "benar" tetap berarti benar utuh; skor sebagian punya kolom skor
            // sendiri (`answers.skor` decimal(8,2)).
            'benar' => $bobot === 1.0,
            'skor' => round($bobot * (float) $soal->skor, 2),
        ];
    }
}
