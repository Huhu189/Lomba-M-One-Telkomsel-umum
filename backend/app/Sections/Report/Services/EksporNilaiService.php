<?php

declare(strict_types=1);

namespace App\Sections\Report\Services;

use App\Sections\Attempt\Enums\JenisAttempt;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Murid;
use App\Sections\School\Services\EksporMuridService;
use App\Support\CsvExcel;
use Illuminate\Support\Collection;
use League\Csv\Writer;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Ekspor nilai satu kuis ke CSV untuk buku nilai guru (slice 10).
 *
 * Keputusan yang perlu diketahui pembaca:
 * - CSV, bukan xlsx. Chunk slice-10 mengizinkan "xlsx bila dibutuhkan (OpenSpout)
 *   atau tetap CSV"; proyek ini sudah memakai `league/csv` untuk impor/ekspor
 *   murid, dan menambah penulis xlsx berarti satu dependensi baru plus penulis
 *   format biner yang harus dirawat. CSV dibuka Excel/Google Sheets tanpa masalah.
 * - Hanya skor ASLI (percobaan pertama) yang diekspor, sama seperti peringkat.
 * - Setiap murid dapat satu baris. Pada mode tim, semua anggota mendapat baris
 *   dengan skor tim yang sama (persis seperti aturan "skor dibagi sama"), sehingga
 *   ekspor ini langsung bisa dipakai sebagai buku nilai.
 * - Sel diamankan dari CSV injection dengan pengaman yang sama seperti ekspor murid.
 */
class EksporNilaiService
{
    /**
     * Zona waktu jam dinding guru: berkas buku nilai dibaca di Indonesia,
     * sedangkan waktu di DB tersimpan UTC (selisih 7 jam dari WIB).
     */
    public const ZONA_WAKTU = 'Asia/Jakarta';

    /**
     * @param  string  $pemisah  pemisah kolom (`;` untuk Excel Indonesia)
     */
    public function ekspor(Kuis $kuis, string $pemisah = ','): StreamedResponse
    {
        $kuis->loadMissing(['kelas', 'mapel']);
        $soal = $kuis->soal()->orderBy('quiz_questions.urutan')->get();

        $namaBerkas = 'nilai-kuis-'.$kuis->getKey().'-'.now()->format('Ymd-His').'.csv';
        $pemisah = CsvExcel::pemisahAman($pemisah);

        return response()->streamDownload(function () use ($kuis, $soal, $pemisah): void {
            $keluaran = fopen('php://output', 'w');

            if ($keluaran === false) {
                return;
            }

            // BOM ditulis langsung: `Writer::setOutputBOM` hanya dipakai jalur
            // `output()`, tidak saat menulis lewat `insertOne`.
            fwrite($keluaran, CsvExcel::BOM_UTF8);

            $penulis = Writer::createFromStream($keluaran);
            // Pemisah terpilih supaya kolom terbaca rapi di Excel Indonesia (Q-16).
            $penulis->setDelimiter($pemisah);

            $judulKolom = [
                'nama', 'nis', 'nisn', 'kelas', 'tim', 'jumlah_anggota_tim',
                'skor', 'skor_maksimal', 'persen', 'jumlah_benar', 'jumlah_soal',
                'dikumpulkan_at', 'percobaan',
            ];

            foreach ($soal as $nomor => $satu) {
                $judulKolom[] = 'soal_'.($nomor + 1).' (maks '.$this->angka($satu->skor).')';
            }

            $penulis->insertOne($judulKolom);

            foreach ($this->baris($kuis, $soal) as $satu) {
                $attempt = $satu['attempt'];
                $murid = $satu['murid'];
                $maksimal = (float) $attempt->skor_maksimal;

                $baris = [
                    EksporMuridService::amankanSel($murid->user?->name),
                    EksporMuridService::amankanSel($murid->nis),
                    EksporMuridService::amankanSel($murid->nisn),
                    EksporMuridService::amankanSel($kuis->kelas?->nama),
                    EksporMuridService::amankanSel($satu['tim']),
                    (string) $satu['jumlah_anggota'],
                    $this->angka($attempt->skor),
                    $this->angka($maksimal),
                    $this->angka($maksimal > 0 ? round((float) $attempt->skor / $maksimal * 100, 1) : 0.0),
                    (string) $attempt->jumlah_benar,
                    (string) $attempt->jumlah_soal,
                    $attempt->dikumpulkan_at?->timezone(self::ZONA_WAKTU)->format('Y-m-d H:i') ?? '',
                    (string) $attempt->attempt_no,
                ];

                $jawaban = $attempt->jawaban->keyBy('question_id');

                foreach ($soal as $satuSoal) {
                    $nilai = $jawaban->get($satuSoal->getKey());
                    $baris[] = $this->angka($nilai?->skor);
                }

                $penulis->insertOne($baris);
            }

            fclose($keluaran);
        }, $namaBerkas, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * Susun baris ekspor: satu baris per murid, skor tim dibagi ke anggotanya.
     *
     * @param  Collection<int, Soal>  $soal
     * @return array<int, array{murid: Murid, attempt: Attempt, tim: string|null, jumlah_anggota: int}>
     */
    private function baris(Kuis $kuis, Collection $soal): array
    {
        $attempts = Attempt::query()
            ->where('quiz_id', $kuis->getKey())
            ->where('jenis', JenisAttempt::Ulangan->value)
            ->where('asli', true)
            ->whereNotNull('dikumpulkan_at')
            ->with(['murid.user', 'jawaban', 'tim.murid.user'])
            ->get();

        $baris = [];

        foreach ($attempts as $attempt) {
            $tim = $attempt->tim;

            /** @var array<int, Murid> $anggota */
            $anggota = $tim !== null
                ? $tim->murid->all()
                : array_filter([$attempt->murid]);

            foreach ($anggota as $murid) {
                $baris[] = [
                    'murid' => $murid,
                    'attempt' => $attempt,
                    'tim' => $tim?->nama,
                    'jumlah_anggota' => count($anggota),
                ];
            }
        }

        // Urut nama supaya cocok dengan daftar kelas yang biasa dilihat guru.
        // `strcasecmp`, bukan `strcmp`: tanpa ini huruf kecil jatuh setelah huruf
        // besar sehingga "andi" muncul setelah "Zahra" (Q-16).
        usort($baris, static fn (array $a, array $b): int => strcasecmp(
            (string) $a['murid']->user?->name,
            (string) $b['murid']->user?->name,
        ));

        return $baris;
    }

    /** Angka tanpa nol ekor yang mengganggu (10.00 → 10, 2.50 → 2.5). */
    private function angka(float|int|string|null $nilai): string
    {
        $angka = (float) $nilai;

        if ($angka === floor($angka)) {
            return (string) (int) $angka;
        }

        return rtrim(rtrim(number_format($angka, 2, '.', ''), '0'), '.');
    }
}
