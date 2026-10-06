<?php

declare(strict_types=1);

namespace App\Sections\Report\Services;

use App\Sections\Attempt\Enums\JenisAttempt;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Services\PengaturanService;

/**
 * Ranking (chunk slice-05).
 *
 * Aturan keras: peringkat HANYA dihitung dari attempt ber-tanda `asli`
 * (percobaan pertama) berjenis ulangan. Skor ulang tidak pernah masuk sini,
 * jadi mengulang kuis tidak bisa menaikkan (atau menurunkan) peringkat.
 * Seri dipecah: yang lebih cepat mengumpulkan menang, lalu nama (A–Z).
 *
 * Saklar `ranking` mengatur keterlihatan bagi murid; guru selalu boleh melihat
 * (dipakai untuk laporan). Saklar bawaan mati.
 */
class RankingService
{
    public const BAWAAN_TOP = 10;

    public const TOP_MAKSIMAL = 50;

    public function __construct(private readonly PengaturanService $pengaturan) {}

    /** Apakah ranking ditampilkan untuk murid pada kuis ini. */
    public function tampil(Kuis $kuis): bool
    {
        $peta = $this->pengaturan
            ->semua((int) $kuis->school_id, (int) $kuis->class_id, (int) $kuis->getKey())['pengaturan'];

        return (bool) ($peta[KunciPengaturan::Ranking->value]['nilai'] ?? KunciPengaturan::Ranking->bawaan());
    }

    /**
     * Seluruh peringkat (belum dipotong) dari skor asli.
     *
     * @return array<int, array<string, mixed>>
     */
    public function semua(Kuis $kuis): array
    {
        $baris = Attempt::query()
            ->join('students', 'students.id', '=', 'attempts.student_id')
            ->join('users', 'users.id', '=', 'students.user_id')
            ->where('attempts.quiz_id', $kuis->getKey())
            ->where('attempts.jenis', JenisAttempt::Ulangan->value)
            ->where('attempts.asli', true)
            ->whereNotNull('attempts.dikumpulkan_at')
            // Seri: waktu selesai lebih cepat menang, lalu nama.
            ->orderByDesc('attempts.skor')
            ->orderBy('attempts.dikumpulkan_at')
            ->orderBy('users.name')
            ->get([
                'attempts.id as attempt_id',
                'attempts.skor',
                'attempts.skor_maksimal',
                'attempts.jumlah_benar',
                'attempts.jumlah_soal',
                'attempts.dikumpulkan_at',
                'students.id as murid_id',
                'users.name as nama',
            ]);

        $hasil = [];

        foreach ($baris as $indeks => $satu) {
            $maksimal = (float) $satu->skor_maksimal;

            $hasil[] = [
                'peringkat' => $indeks + 1,
                'attempt_id' => (int) $satu->attempt_id,
                'murid_id' => (int) $satu->murid_id,
                'nama' => (string) $satu->nama,
                'skor' => (float) $satu->skor,
                'skor_maksimal' => $maksimal,
                'persen' => $maksimal > 0 ? round((float) $satu->skor / $maksimal * 100, 1) : 0.0,
                'jumlah_benar' => (int) $satu->jumlah_benar,
                'jumlah_soal' => (int) $satu->jumlah_soal,
                'dikumpulkan_at' => $satu->dikumpulkan_at,
            ];
        }

        return $hasil;
    }

    /**
     * Payload siap kirim untuk layar peringkat.
     *
     * @param  int|null  $muridId  bila pemohon murid: dipakai mencari peringkatnya
     * @param  bool  $selaluTampil  guru selalu melihat peringkat walau saklar mati
     * @return array<string, mixed>
     */
    public function untukKuis(Kuis $kuis, int $top, ?int $muridId = null, bool $selaluTampil = false): array
    {
        $tampil = $this->tampil($kuis);
        $semua = $this->semua($kuis);
        $batas = max(1, min($top, self::TOP_MAKSIMAL));

        $bolehLihat = $tampil || $selaluTampil;

        $peringkatSaya = null;

        if ($muridId !== null) {
            foreach ($semua as $baris) {
                if ($baris['murid_id'] === $muridId) {
                    $peringkatSaya = $bolehLihat ? $baris : null;
                    break;
                }
            }
        }

        return [
            'kuis_id' => $kuis->getKey(),
            'judul_kuis' => $kuis->judul,
            'tampil' => $tampil,
            'total' => count($semua),
            'top' => $batas,
            'peringkat' => $bolehLihat ? array_slice($semua, 0, $batas) : [],
            'peringkat_saya' => $peringkatSaya,
        ];
    }
}
