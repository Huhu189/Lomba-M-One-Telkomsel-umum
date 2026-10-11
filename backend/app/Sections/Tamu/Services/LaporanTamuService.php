<?php

declare(strict_types=1);

namespace App\Sections\Tamu\Services;

use App\Sections\Attempt\Models\Attempt;
use App\Sections\Quiz\Models\Kuis;

/**
 * Hasil siswa tamu pada satu kuis — untuk guru pemilik kuis itu.
 *
 * Laporan kelas biasa tidak memuat tamu (tamu tidak punya kelas, dan tidak
 * masuk ranking kelas), jadi tanpa jalur ini guru yang membuka kuis untuk tamu
 * tidak punya cara melihat nilai mereka. Satu baris per attempt, terbaru
 * dikumpulkan lebih dulu, lengkap dengan penanda `izinkan_tamu` supaya guru
 * tahu pintunya masih terbuka atau sudah ditutup.
 */
class LaporanTamuService
{
    /**
     * @return array<string, mixed>
     */
    public function untukKuis(Kuis $kuis): array
    {
        $baris = Attempt::query()
            ->join('students', 'students.id', '=', 'attempts.student_id')
            ->join('users', 'users.id', '=', 'students.user_id')
            ->where('attempts.quiz_id', $kuis->getKey())
            ->where('users.is_tamu', true)
            ->orderByDesc('attempts.skor')
            ->orderBy('attempts.dikumpulkan_at')
            ->get([
                'attempts.id as attempt_id',
                'attempts.jenis',
                'attempts.attempt_no',
                'attempts.asli',
                'attempts.status',
                'attempts.skor',
                'attempts.skor_maksimal',
                'attempts.jumlah_benar',
                'attempts.jumlah_soal',
                'attempts.mulai_at',
                'attempts.dikumpulkan_at',
                'students.id as murid_id',
                'users.name as nama',
            ]);

        $tamu = [];

        foreach ($baris as $satu) {
            $maksimal = (float) $satu->skor_maksimal;

            $tamu[] = [
                'attempt_id' => (int) $satu->attempt_id,
                'murid_id' => (int) $satu->murid_id,
                'nama' => (string) $satu->nama,
                // Kolomnya di-cast enum oleh model, jadi nilainya diambil dari
                // enum-nya — bukan di-cast ke string langsung.
                'jenis' => $satu->jenis->value,
                'attempt_no' => (int) $satu->attempt_no,
                'asli' => (bool) $satu->asli,
                'status' => $satu->status->value,
                'skor' => (float) $satu->skor,
                'skor_maksimal' => $maksimal,
                'persen' => $maksimal > 0 ? round((float) $satu->skor / $maksimal * 100, 1) : 0.0,
                'jumlah_benar' => (int) $satu->jumlah_benar,
                'jumlah_soal' => (int) $satu->jumlah_soal,
                'mulai_at' => $satu->mulai_at,
                'dikumpulkan_at' => $satu->dikumpulkan_at,
            ];
        }

        return [
            'kuis_id' => (int) $kuis->getKey(),
            'judul_kuis' => $kuis->judul,
            'jumlah' => count($tamu),
            'tamu' => $tamu,
        ];
    }
}
