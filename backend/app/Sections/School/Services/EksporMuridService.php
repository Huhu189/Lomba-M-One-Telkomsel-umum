<?php

declare(strict_types=1);

namespace App\Sections\School\Services;

use App\Sections\School\Models\Murid;
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

    public function ekspor(int $sekolahId): StreamedResponse
    {
        $namaBerkas = 'murid-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($sekolahId): void {
            $keluaran = fopen('php://output', 'w');

            if ($keluaran === false) {
                return;
            }

            $penulis = Writer::createFromStream($keluaran);
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
