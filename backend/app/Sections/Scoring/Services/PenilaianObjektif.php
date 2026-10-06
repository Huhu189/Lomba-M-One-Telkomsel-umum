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
            $benar = RegistryTipeSoal::nilai(
                $tipe,
                $soal->kontenSebagaiArray(),
                $soal->kunciSebagaiArray(),
                $jawaban,
            );
        } catch (Throwable) {
            return ['status' => StatusPenilaian::Gagal, 'benar' => null, 'skor' => 0.0];
        }

        return [
            'status' => StatusPenilaian::Dinilai,
            'benar' => $benar,
            'skor' => $benar ? (float) $soal->skor : 0.0,
        ];
    }
}
