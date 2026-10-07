<?php

declare(strict_types=1);

namespace App\Sections\Report\Services;

use App\Sections\Attempt\Enums\JenisAttempt;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Services\TimService;
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
 *
 * Pada kuis mode tim (slice 09-C) yang diperingkat adalah TIM, bukan anak:
 * satu attempt bersama = satu baris peringkat, dan anggotanya tidak muncul
 * sendiri-sendiri.
 */
class RankingService
{
    public const BAWAAN_TOP = 10;

    public const TOP_MAKSIMAL = 50;

    public function __construct(
        private readonly PengaturanService $pengaturan,
        private readonly TimService $tim,
    ) {}

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
        if ($this->tim->modeTim($kuis)) {
            return $this->semuaTim($kuis);
        }

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
                // Kunci ini sengaja selalu ada (null saat mode individu) supaya
                // klien memakai satu skema untuk kedua mode (slice 09-C).
                'tim_id' => null,
                'tim_nama' => null,
                'anggota' => [],
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
     * Peringkat versi tim: satu baris per tim, lengkap dengan anggotanya.
     *
     * @return array<int, array<string, mixed>>
     */
    private function semuaTim(Kuis $kuis): array
    {
        $baris = Attempt::query()
            ->join('teams', 'teams.id', '=', 'attempts.team_id')
            ->where('attempts.quiz_id', $kuis->getKey())
            ->where('attempts.jenis', JenisAttempt::Ulangan->value)
            ->where('attempts.asli', true)
            ->whereNotNull('attempts.dikumpulkan_at')
            ->orderByDesc('attempts.skor')
            ->orderBy('attempts.dikumpulkan_at')
            ->orderBy('teams.nama')
            ->get([
                'attempts.id as attempt_id',
                'attempts.skor',
                'attempts.skor_maksimal',
                'attempts.jumlah_benar',
                'attempts.jumlah_soal',
                'attempts.dikumpulkan_at',
                'teams.id as tim_id',
                'teams.nama as tim_nama',
            ]);

        $anggota = $this->tim->anggotaPerTim($kuis);
        $hasil = [];

        foreach ($baris as $indeks => $satu) {
            $maksimal = (float) $satu->skor_maksimal;
            $timId = (int) $satu->tim_id;

            $hasil[] = [
                'peringkat' => $indeks + 1,
                'attempt_id' => (int) $satu->attempt_id,
                // Baris tim tidak mewakili satu anak, jadi murid_id sengaja null.
                'murid_id' => null,
                'tim_id' => $timId,
                'tim_nama' => (string) $satu->tim_nama,
                'nama' => (string) $satu->tim_nama,
                'anggota' => $anggota[$timId] ?? [],
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
     * @param  int|null  $timId  pada mode tim: tim pemohon yang dicari
     * @return array<string, mixed>
     */
    public function untukKuis(
        Kuis $kuis,
        int $top,
        ?int $muridId = null,
        bool $selaluTampil = false,
        ?int $timId = null,
    ): array {
        $tampil = $this->tampil($kuis);
        $modeTim = $this->tim->modeTim($kuis);
        $semua = $this->semua($kuis);
        $batas = max(1, min($top, self::TOP_MAKSIMAL));

        $bolehLihat = $tampil || $selaluTampil;

        $peringkatSaya = null;

        foreach ($semua as $baris) {
            $cocok = $modeTim
                ? $timId !== null && ($baris['tim_id'] ?? null) === $timId
                : $muridId !== null && $baris['murid_id'] === $muridId;

            if ($cocok) {
                $peringkatSaya = $bolehLihat ? $baris : null;
                break;
            }
        }

        return [
            'kuis_id' => $kuis->getKey(),
            'judul_kuis' => $kuis->judul,
            'mode_tim' => $modeTim,
            'tampil' => $tampil,
            'total' => count($semua),
            'top' => $batas,
            'peringkat' => $bolehLihat ? array_slice($semua, 0, $batas) : [],
            'peringkat_saya' => $peringkatSaya,
        ];
    }
}
