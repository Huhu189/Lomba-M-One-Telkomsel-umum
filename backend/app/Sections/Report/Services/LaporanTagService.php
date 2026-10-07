<?php

declare(strict_types=1);

namespace App\Sections\Report\Services;

use App\Sections\Attempt\Enums\JenisAttempt;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Murid;
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Services\PengaturanService;

/**
 * Laporan pemahaman per tag/tema (chunk slice-05).
 *
 * Hanya attempt asli (percobaan pertama, jenis ulangan) yang dihitung, jadi
 * skor ulang tidak bisa menyamarkan pemahaman. Ambang "paham / mulai paham"
 * dan jumlah data minimum diatur guru lewat pengaturan tiga lapis.
 */
class LaporanTagService
{
    public const TINGKAT_PAHAM = 'paham';

    public const TINGKAT_MULAI_PAHAM = 'mulai_paham';

    public const TINGKAT_BELUM_PAHAM = 'belum_paham';

    public const TINGKAT_DATA_MINIMUM = 'data_belum_cukup';

    public function __construct(private readonly PengaturanService $pengaturan) {}

    /**
     * Ambang penilaian pemahaman yang berlaku untuk konteks ini.
     *
     * @return array{ambang_paham: int, ambang_mulai_paham: int, data_minimum: int}
     */
    public function ambang(int $sekolahId, ?int $kelasId = null, ?int $kuisId = null): array
    {
        $peta = $this->pengaturan->semua($sekolahId, $kelasId, $kuisId)['pengaturan'];

        $nilai = static fn (KunciPengaturan $kunci): int => (int) ($peta[$kunci->value]['nilai'] ?? $kunci->bawaan());

        return [
            'ambang_paham' => $nilai(KunciPengaturan::AmbangPaham),
            'ambang_mulai_paham' => $nilai(KunciPengaturan::AmbangMulaiPaham),
            'data_minimum' => $nilai(KunciPengaturan::MinimalDataTag),
        ];
    }

    public static function labelTingkat(string $tingkat): string
    {
        return match ($tingkat) {
            self::TINGKAT_PAHAM => 'Paham',
            self::TINGKAT_MULAI_PAHAM => 'Mulai paham',
            self::TINGKAT_BELUM_PAHAM => 'Belum paham',
            default => 'Data belum cukup',
        };
    }

    /**
     * Tingkat pemahaman satu tema dari jumlah soal & persen benar.
     *
     * @param  array{ambang_paham: int, ambang_mulai_paham: int, data_minimum: int}  $ambang
     */
    public function tingkat(int $jumlah, float $persen, array $ambang): string
    {
        if ($jumlah < $ambang['data_minimum']) {
            return self::TINGKAT_DATA_MINIMUM;
        }

        if ($persen >= $ambang['ambang_paham']) {
            return self::TINGKAT_PAHAM;
        }

        if ($persen >= $ambang['ambang_mulai_paham']) {
            return self::TINGKAT_MULAI_PAHAM;
        }

        return self::TINGKAT_BELUM_PAHAM;
    }

    /**
     * Pemahaman per tag seorang murid (dari seluruh ulangan aslinya).
     *
     * @param  array{ambang_paham: int, ambang_mulai_paham: int, data_minimum: int}  $ambang
     * @return array<int, array<string, mixed>>
     */
    public function untukMurid(Murid $murid, array $ambang): array
    {
        $attempts = Attempt::query()
            // Termasuk attempt tim yang diikuti murid ini: satu nilai tim dibagi
            // rata ke semua anggotanya (slice 09-C).
            ->milikMurid((int) $murid->getKey())
            ->where('jenis', JenisAttempt::Ulangan->value)
            ->where('asli', true)
            ->whereNotNull('dikumpulkan_at')
            ->with(['jawaban', 'kuis.soal.tag'])
            ->get();

        /** @var array<int, array<string, mixed>> $tema */
        $tema = [];

        foreach ($attempts as $attempt) {
            $jawaban = $attempt->jawaban->keyBy('question_id');

            foreach ($attempt->kuis?->soal ?? [] as $soal) {
                $tag = $soal->tag;

                if ($tag === null) {
                    continue;
                }

                $kunci = (int) $tag->getKey();

                if (! isset($tema[$kunci])) {
                    $tema[$kunci] = [
                        'tag_id' => $kunci,
                        'tag_nama' => $tag->nama,
                        'jumlah_soal' => 0,
                        'jumlah_benar' => 0,
                    ];
                }

                $tema[$kunci]['jumlah_soal']++;

                if ($jawaban->get($soal->getKey())?->benar === true) {
                    $tema[$kunci]['jumlah_benar']++;
                }
            }
        }

        $hasil = [];

        foreach ($tema as $satu) {
            $persen = $satu['jumlah_soal'] > 0
                ? round((int) $satu['jumlah_benar'] / (int) $satu['jumlah_soal'] * 100, 1)
                : 0.0;

            $tingkat = $this->tingkat((int) $satu['jumlah_soal'], $persen, $ambang);

            $hasil[] = [
                'tag_id' => $satu['tag_id'],
                'tag_nama' => $satu['tag_nama'],
                'jumlah_soal' => $satu['jumlah_soal'],
                'jumlah_benar' => $satu['jumlah_benar'],
                'persen' => $persen,
                'tingkat' => $tingkat,
                'tingkat_label' => self::labelTingkat($tingkat),
            ];
        }

        // Terlemah dulu supaya remedial dan tampilan guru langsung menunjuk tema kritis.
        usort($hasil, static fn (array $a, array $b): int => $a['persen'] <=> $b['persen']);

        return $hasil;
    }

    /**
     * Laporan satu kuis untuk guru: tiap murid di kelas + pemahaman per tema.
     *
     * @return array<string, mixed>
     */
    public function untukKuis(Kuis $kuis): array
    {
        $kuis->loadMissing(['kelas', 'mapel']);

        $ambang = $this->ambang((int) $kuis->school_id, (int) $kuis->class_id, (int) $kuis->getKey());

        $murid = Murid::query()
            ->where('class_id', $kuis->class_id)
            ->with('user')
            ->orderBy('id')
            ->get();

        $daftar = [];

        foreach ($murid as $satuMurid) {
            $tema = $this->untukMurid($satuMurid, $ambang);
            $ringkasan = array_fill_keys([
                self::TINGKAT_PAHAM,
                self::TINGKAT_MULAI_PAHAM,
                self::TINGKAT_BELUM_PAHAM,
                self::TINGKAT_DATA_MINIMUM,
            ], 0);

            foreach ($tema as $baris) {
                $ringkasan[$baris['tingkat']]++;
            }

            $daftar[] = [
                'murid_id' => (int) $satuMurid->getKey(),
                'nama' => (string) $satuMurid->user->name,
                'jumlah_tema' => count($tema),
                'tema' => $tema,
                'ringkasan' => $ringkasan,
            ];
        }

        return [
            'kuis_id' => $kuis->getKey(),
            'judul_kuis' => $kuis->judul,
            'mapel_nama' => $kuis->mapel?->nama,
            'kelas_nama' => $kuis->kelas?->nama,
            'ambang' => $ambang,
            'murid' => $daftar,
        ];
    }
}
