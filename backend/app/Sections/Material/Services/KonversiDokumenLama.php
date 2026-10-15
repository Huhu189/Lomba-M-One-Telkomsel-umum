<?php

declare(strict_types=1);

namespace App\Sections\Material\Services;

use Symfony\Component\Process\Process;
use Throwable;

/**
 * Ubah dokumen kantor lama (.doc/.ppt/.xls, bentuk OLE) menjadi bentuk modern
 * (.docx/.pptx/.xlsx) lewat LibreOffice tanpa antarmuka, supaya murid bisa
 * **melihat isinya** di halaman — bukan sekadar mengunduh.
 *
 * Kenapa aman: hasil konversi adalah paket OOXML tanpa makro (VBA tidak ikut
 * terbawa), dan yang disajikan ke murid hanya hasil itu — berkas OLE asli dibuang.
 * LibreOffice dijalankan dengan profil sementara, batas waktu, dan tanpa jaringan
 * bagi pemanggil: kalau gagal/tidak terpasang, hasilnya `null` dan berkas jatuh
 * ke perilaku lama (tidak dikenali, hanya bisa diunduh). Tidak pernah melempar.
 *
 * Memerlukan `soffice` di server (`apt install libreoffice-writer
 * libreoffice-impress libreoffice-calc`); lokasinya bisa diatur lewat
 * `LIBREOFFICE_BIN`.
 */
class KonversiDokumenLama
{
    /** Ekstensi lama → [format tujuan, filter LibreOffice]. */
    private const PETA = [
        'doc' => ['docx', 'docx'],
        'dot' => ['docx', 'docx'],
        'rtf' => ['docx', 'docx'],
        'odt' => ['docx', 'docx'],
        'ppt' => ['pptx', 'pptx'],
        'pps' => ['pptx', 'pptx'],
        'odp' => ['pptx', 'pptx'],
        'xls' => ['xlsx', 'xlsx'],
        'xlt' => ['xlsx', 'xlsx'],
        'ods' => ['xlsx', 'xlsx'],
    ];

    /** Tanda tangan berkas OLE (CFB) — .doc/.ppt/.xls lama. */
    public const MAGIC_OLE = "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1";

    private const BATAS_DETIK = 90;

    public function adaKonverter(): bool
    {
        return $this->biner() !== null;
    }

    public function dikenali(string $ekstensi): bool
    {
        return isset(self::PETA[strtolower($ekstensi)]);
    }

    /**
     * @return array{path: string, ekstensi: string}|null jalur berkas hasil di folder sementara
     */
    public function ubah(string $jalurAsal, string $ekstensiAsal): ?array
    {
        $ekstensiAsal = strtolower($ekstensiAsal);
        $biner = $this->biner();

        if ($biner === null || ! isset(self::PETA[$ekstensiAsal])) {
            return null;
        }

        [$tujuan, $filter] = self::PETA[$ekstensiAsal];

        $kerja = sys_get_temp_dir().'/konversi-'.bin2hex(random_bytes(8));

        try {
            if (! mkdir($kerja.'/masuk', 0o700, true) || ! mkdir($kerja.'/keluar', 0o700, true)) {
                return null;
            }

            $salinan = $kerja.'/masuk/dokumen.'.$ekstensiAsal;
            if (! copy($jalurAsal, $salinan)) {
                return null;
            }

            $proses = new Process([
                $biner,
                '--headless', '--norestore', '--nolockcheck', '--nodefault', '--nofirststartwizard',
                '-env:UserInstallation=file://'.$kerja.'/profil',
                '--convert-to', $filter,
                '--outdir', $kerja.'/keluar',
                $salinan,
            ], $kerja, ['HOME' => $kerja], null, self::BATAS_DETIK);

            $proses->run();

            $hasil = $kerja.'/keluar/dokumen.'.$tujuan;

            if (! $proses->isSuccessful() || ! is_file($hasil) || filesize($hasil) === 0) {
                return null;
            }

            // Pindahkan keluar dari folder kerja yang akan dibersihkan.
            $akhir = tempnam(sys_get_temp_dir(), 'konv');
            if ($akhir === false || ! rename($hasil, $akhir)) {
                return null;
            }

            return ['path' => $akhir, 'ekstensi' => $tujuan];
        } catch (Throwable) {
            return null;
        } finally {
            $this->bersihkan($kerja);
        }
    }

    private function biner(): ?string
    {
        $diatur = env('LIBREOFFICE_BIN');

        foreach (array_filter([$diatur, 'soffice', 'libreoffice', '/usr/bin/soffice', '/usr/bin/libreoffice']) as $kandidat) {
            if (str_contains((string) $kandidat, '/')) {
                if (is_executable((string) $kandidat)) {
                    return (string) $kandidat;
                }

                continue;
            }

            $cari = new Process(['which', (string) $kandidat]);
            $cari->run();

            if ($cari->isSuccessful()) {
                return trim($cari->getOutput());
            }
        }

        return null;
    }

    private function bersihkan(string $folder): void
    {
        if (! is_dir($folder)) {
            return;
        }

        $isi = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($folder, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST,
        );

        foreach ($isi as $satu) {
            $satu->isDir() && ! $satu->isLink() ? @rmdir($satu->getPathname()) : @unlink($satu->getPathname());
        }

        @rmdir($folder);
    }
}
