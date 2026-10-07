<?php

declare(strict_types=1);

namespace App\Sections\Report\Services;

use App\Sections\Attempt\Enums\JenisAttempt;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\School\Models\Murid;

/**
 * Badge per mapel (chunk slice-05).
 *
 * Dihitung dari rata-rata persentase skor ASLI (percobaan pertama) murid pada
 * tiap mapel. Skor ulang sengaja tidak dihitung supaya lencana tetap jujur.
 */
class BadgeService
{
    public const AMBANG_EMAS = 90.0;

    public const AMBANG_PERAK = 75.0;

    public const AMBANG_PERUNGGU = 60.0;

    /**
     * Tingkat lencana dari persentase.
     *
     * @return array{kode: string, label: string, level: int}
     */
    public static function lencana(float $persen): array
    {
        return match (true) {
            $persen >= self::AMBANG_EMAS => ['kode' => 'emas', 'label' => 'Emas', 'level' => 3],
            $persen >= self::AMBANG_PERAK => ['kode' => 'perak', 'label' => 'Perak', 'level' => 2],
            $persen >= self::AMBANG_PERUNGGU => ['kode' => 'perunggu', 'label' => 'Perunggu', 'level' => 1],
            default => ['kode' => 'belum', 'label' => 'Belum ada', 'level' => 0],
        };
    }

    /**
     * Badge per mapel untuk satu murid.
     *
     * @return array{murid_id: int, nama: string, jumlah_lencana: int, badge: array<int, array<string, mixed>>}
     */
    public function untukMurid(Murid $murid): array
    {
        $murid->loadMissing('user');

        $attempts = Attempt::query()
            // Attempt tim ikut dihitung untuk seluruh anggotanya (slice 09-C),
            // jadi lencana tidak menghukum anak yang mengerjakan berkelompok.
            ->milikMurid((int) $murid->getKey())
            ->where('jenis', JenisAttempt::Ulangan->value)
            ->where('asli', true)
            ->whereNotNull('dikumpulkan_at')
            ->with(['kuis.mapel'])
            ->get();

        /** @var array<int, array<string, mixed>> $kelompok */
        $kelompok = [];

        foreach ($attempts as $attempt) {
            $mapel = $attempt->kuis?->mapel;
            $kunci = $mapel !== null ? (int) $mapel->getKey() : 0;
            $maksimal = (float) $attempt->skor_maksimal;
            $persen = $maksimal > 0 ? (float) $attempt->skor / $maksimal * 100 : 0.0;

            if (! isset($kelompok[$kunci])) {
                $kelompok[$kunci] = [
                    'mapel_id' => $mapel?->getKey(),
                    'mapel_nama' => $mapel?->nama ?? 'Tanpa mapel',
                    'jumlah_ulangan' => 0,
                    'total_skor' => 0.0,
                    'total_maksimal' => 0.0,
                ];
            }

            $kelompok[$kunci]['jumlah_ulangan']++;
            $kelompok[$kunci]['total_skor'] += (float) $attempt->skor;
            $kelompok[$kunci]['total_maksimal'] += $maksimal;
        }

        $badge = [];

        foreach ($kelompok as $satu) {
            $total = (float) $satu['total_maksimal'];
            $persen = $total > 0 ? round((float) $satu['total_skor'] / $total * 100, 1) : 0.0;

            $badge[] = [
                'mapel_id' => $satu['mapel_id'],
                'mapel_nama' => $satu['mapel_nama'],
                'jumlah_ulangan' => $satu['jumlah_ulangan'],
                'rata_rata' => $persen,
                'lencana' => self::lencana($persen),
            ];
        }

        usort($badge, static fn (array $a, array $b): int => $b['rata_rata'] <=> $a['rata_rata']);

        return [
            'murid_id' => (int) $murid->getKey(),
            'nama' => (string) $murid->user->name,
            'jumlah_lencana' => count(array_filter($badge, static fn (array $satu): bool => $satu['lencana']['level'] > 0)),
            'badge' => $badge,
        ];
    }
}
