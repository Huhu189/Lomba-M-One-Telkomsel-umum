<?php

declare(strict_types=1);

namespace App\Sections\Report\Services;

use App\Sections\Attempt\Models\Jawaban;
use App\Sections\Question\Models\Soal;
use App\Sections\School\Models\Murid;
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Services\PengaturanService;

/**
 * Remedial otomatis (chunk slice-05).
 *
 * Menyusun daftar latihan dari tema (tag) yang masih lemah bagi seorang murid.
 * Sifatnya HANYA REKOMENDASI/MENYUSUN LATIHAN — tidak menulis apa pun ke
 * attempt asli, jadi skor asli tetap utuh. Saklar `remedial` mematikan fitur
 * ini tanpa menghapus riwayat.
 */
class RemedialService
{
    public const BATAS_SOAL = 8;

    public function __construct(
        private readonly PengaturanService $pengaturan,
        private readonly LaporanTagService $laporan,
    ) {}

    /**
     * @return array{diaktifkan: bool, tema_lemah: array<int, array<string, mixed>>, soal: array<int, array<string, mixed>>}
     */
    public function untukMurid(
        Murid $murid,
        int $sekolahId,
        ?int $kelasId = null,
        ?int $kuisId = null,
        int $batas = self::BATAS_SOAL,
    ): array {
        $peta = $this->pengaturan->semua($sekolahId, $kelasId, $kuisId)['pengaturan'];
        $aktif = (bool) ($peta[KunciPengaturan::Remedial->value]['nilai'] ?? KunciPengaturan::Remedial->bawaan());

        if (! $aktif) {
            return ['diaktifkan' => false, 'tema_lemah' => [], 'soal' => []];
        }

        $ambang = $this->laporan->ambang($sekolahId, $kelasId, $kuisId);
        $semuaTema = $this->laporan->untukMurid($murid, $ambang);

        $lemah = array_values(array_filter(
            $semuaTema,
            static fn (array $tema): bool => in_array($tema['tingkat'], [
                LaporanTagService::TINGKAT_BELUM_PAHAM,
                LaporanTagService::TINGKAT_MULAI_PAHAM,
            ], true),
        ));

        if ($lemah === []) {
            return ['diaktifkan' => true, 'tema_lemah' => [], 'soal' => []];
        }

        // Soal yang sudah pernah dijawab BENAR pada attempt asli tidak diulang.
        $sudahBenar = Jawaban::query()
            ->join('attempts', 'attempts.id', '=', 'answers.attempt_id')
            ->where('attempts.student_id', $murid->getKey())
            ->where('attempts.asli', true)
            ->where('answers.benar', true)
            ->pluck('answers.question_id')
            ->all();

        $soal = [];
        $sisa = max(1, $batas);

        foreach ($lemah as $tema) {
            if ($sisa <= 0) {
                break;
            }

            $kandidat = Soal::query()
                ->where('tag_id', $tema['tag_id'])
                ->where('school_id', $sekolahId)
                ->where('aktif', true)
                ->when($sudahBenar !== [], fn ($query) => $query->whereNotIn('id', $sudahBenar))
                ->with('tag')
                ->orderBy('id')
                ->limit($sisa)
                ->get();

            foreach ($kandidat as $satu) {
                $tipe = $satu->tipeAman();
                $konten = $satu->kontenSebagaiArray();

                $soal[] = [
                    'id' => (int) $satu->getKey(),
                    'tipe' => $tipe?->value ?? 'tidak_dikenal',
                    'tipe_label' => $tipe?->label() ?? 'Tidak dikenal',
                    'skor' => (float) $satu->skor,
                    'tag_id' => (int) $satu->tag_id,
                    'tag_nama' => $satu->tag?->nama,
                    'teks' => (string) ($konten['teks'] ?? ''),
                ];

                $sisa--;
            }
        }

        return ['diaktifkan' => true, 'tema_lemah' => $lemah, 'soal' => $soal];
    }
}
