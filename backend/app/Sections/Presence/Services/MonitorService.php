<?php

declare(strict_types=1);

namespace App\Sections\Presence\Services;

use App\Sections\Attempt\Models\Attempt;
use App\Sections\Cheat\Services\KecuranganService;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Snapshot Live Monitor untuk guru (slice 07).
 *
 * Satu panggilan mengembalikan seluruh yang dibutuhkan layar guru: siapa yang
 * sedang mengerjakan, sejauh mana, dan catatan kejadian apa yang perlu
 * ditanyakan. Snapshot inilah yang pertama dikirim, lalu aliran SSE melanjutkan
 * pembaruannya; tanpa SSE, guru cukup memanggil ulang endpoint ini (polling).
 */
class MonitorService
{
    public function __construct(
        private readonly PresenceService $presence,
        private readonly KecuranganService $kecurangan,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function snapshot(Kuis $kuis): array
    {
        // Sapuan sekali setiap guru membuka monitor: penjadwal cron tidak bisa
        // lebih rapat dari satu menit, sedangkan status yang dilihat guru harus
        // segar saat itu juga.
        $this->presence->sapu();

        $kuisId = (int) $kuis->getKey();
        $hadir = $this->presence->daftar($kuis);
        $petaHadir = [];

        foreach ($hadir as $entri) {
            $petaHadir[$entri['attempt_id']] = $entri;
        }

        $ringkasanKecurangan = $this->kecurangan->ringkasan($kuis);

        $attempt = Attempt::query()
            ->where('quiz_id', $kuisId)
            ->with(['murid.user'])
            ->orderBy('attempt_no')
            ->get();

        $progres = $this->progres($kuisId);

        $murid = [];

        foreach ($attempt as $satu) {
            $id = (int) $satu->getKey();
            $kehadiran = $petaHadir[$id] ?? null;
            $jumlahDijawab = $progres[$id] ?? 0;
            $jumlahSoal = max(1, (int) $satu->jumlah_soal);

            $murid[] = [
                'attempt_id' => $id,
                'student_id' => (int) $satu->student_id,
                'nama' => $satu->murid?->user?->name,
                'attempt_no' => (int) $satu->attempt_no,
                'status' => $satu->status->value,
                'status_label' => $satu->status->label(),
                'dijawab' => $jumlahDijawab,
                'jumlah_soal' => (int) $satu->jumlah_soal,
                'persen' => (int) round($jumlahDijawab / $jumlahSoal * 100),
                'online' => $kehadiran['online'] ?? false,
                'detik_terakhir' => $kehadiran['detik_terakhir'] ?? null,
                'skor' => $satu->skor,
                'kecurangan' => $ringkasanKecurangan[$id] ?? [
                    'jumlah' => 0,
                    'skor_tertinggi' => 0,
                    'belum_ditinjau' => 0,
                ],
            ];
        }

        return [
            'kuis' => [
                'id' => $kuisId,
                'judul' => $kuis->judul,
                'status' => $kuis->status->value,
                'kelas_nama' => $kuis->kelas?->nama,
            ],
            'murid' => $murid,
            'jumlah_online' => count(array_filter($murid, static fn (array $m): bool => $m['online'] === true)),
            'server_now' => Carbon::now()->toIso8601String(),
            // Ambang ini dikirim supaya klien bisa menampilkan status
            // online/offline tanpa menebak sendiri.
            'ambang_segar_detik' => PresenceService::AMBANG_SEGAR,
        ];
    }

    /**
     * Jumlah soal terjawab per attempt (satu query untuk seluruh kuis).
     *
     * @return array<int, int>
     */
    private function progres(int $kuisId): array
    {
        $baris = DB::table('answers')
            ->join('attempts', 'attempts.id', '=', 'answers.attempt_id')
            ->where('attempts.quiz_id', $kuisId)
            ->whereNotNull('answers.jawaban')
            ->selectRaw('answers.attempt_id, COUNT(*) as jumlah')
            ->groupBy('answers.attempt_id')
            ->get();

        $hasil = [];

        foreach ($baris as $satu) {
            $hasil[(int) $satu->attempt_id] = (int) $satu->jumlah;
        }

        return $hasil;
    }
}
