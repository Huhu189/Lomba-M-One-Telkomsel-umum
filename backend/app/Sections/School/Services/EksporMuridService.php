<?php

declare(strict_types=1);

namespace App\Sections\School\Services;

use App\Sections\School\Models\Murid;
use App\Support\CsvExcel;
use League\Csv\Writer;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Ekspor murid ke CSV secara streaming (chunk) dengan pengamanan sel
 * yang berawalan = + - @ agar tidak dieksekusi sebagai rumus spreadsheet
 * (CSV injection) — chunk slice-02.
 */
class EksporMuridService
{
    /**
     * Amankan satu sel CSV: beri awalan tanda kutip tunggal bila berbahaya.
     */
    public static function amankanSel(?string $nilai): string
    {
        $teks = (string) $nilai;

        if ($teks !== '' && in_array($teks[0], ['=', '+', '-', '@'], true)) {
            return "'".$teks;
        }

        return $teks;
    }

    /**
     * @param  string  $pemisah  pemisah kolom (`;` untuk Excel Indonesia)
     */
    public function ekspor(int $sekolahId, string $pemisah = ','): StreamedResponse
    {
        $namaBerkas = 'murid-'.now()->format('Ymd-His').'.csv';
        $pemisah = CsvExcel::pemisahAman($pemisah);

        return response()->streamDownload(function () use ($sekolahId, $pemisah): void {
            $keluaran = fopen('php://output', 'w');

            if ($keluaran === false) {
                return;
            }

            // BOM ditulis langsung: `Writer::setOutputBOM` hanya dipakai jalur
            // `output()`, bukan saat menulis lewat `insertOne`.
            fwrite($keluaran, CsvExcel::BOM_UTF8);

            $penulis = Writer::createFromStream($keluaran);
            // Pemisah bisa dipilih: Excel Indonesia memakai `;` (Q-16).
            $penulis->setDelimiter($pemisah);
            $penulis->insertOne(['nis', 'nisn', 'nama', 'email', 'kelas']);

            Murid::query()
                ->with(['user', 'kelas'])
                ->where('school_id', $sekolahId)
                ->orderBy('id')
                ->chunk(200, function ($daftar) use ($penulis): void {
                    foreach ($daftar as $murid) {
                        $penulis->insertOne([
                            self::amankanSel($murid->nis),
                            self::amankanSel($murid->nisn),
                            self::amankanSel($murid->user?->name),
                            self::amankanSel($murid->user?->email),
                            self::amankanSel($murid->kelas?->nama),
                        ]);
                    }
                });

            fclose($keluaran);
        }, $namaBerkas, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
