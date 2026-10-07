<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Attempt\Models\UnggahanJawaban;
use App\Sections\Attempt\Services\PenyimpananJawaban;
use App\Sections\Material\Enums\StatusUnggahan;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Penyajian lampiran jawaban lewat URL bertanda tangan berumur pendek.
 *
 * Berkas fisik ada di `storage/app/private`, jadi tidak ada alamat yang bisa
 * ditebak: URL hanya diberikan kepada pemilik attempt dan guru, dan kedaluwarsa
 * setelah 30 menit (bawaan). Lampiran hasil karya anak tetap tidak pernah
 * terbuka di folder publik.
 *
 * Seperti penyajian berkas materi: `nosniff` selalu dikirim, gambar/audio/video
 * boleh inline, sedangkan kategori berisiko/tidak dikenal **wajib** diunduh
 * sebagai `.upload`.
 */
class BerkasJawabanController extends Controller
{
    public function __invoke(string $kode, PenyimpananJawaban $penyimpanan): Response
    {
        $unggahan = UnggahanJawaban::query()
            ->where('kode', $kode)
            ->where('status', StatusUnggahan::Selesai->value)
            ->firstOrFail();

        $tampilLangsung = $unggahan->tampilLangsung();
        $namaUnduh = $this->namaAman($unggahan->nama_asli ?? ($unggahan->jenis->value.'.'.$unggahan->ekstensi));

        $headers = [
            'X-Content-Type-Options' => 'nosniff',
            'Content-Type' => (string) $unggahan->mime,
            'Cache-Control' => 'private, max-age=0, must-revalidate',
            'Content-Disposition' => $tampilLangsung
                ? 'inline; filename="'.$namaUnduh.'"'
                : 'attachment; filename="'.$namaUnduh.'.upload"',
        ];

        $prefix = (string) config('jawaban.x_accel_prefix', '');

        if ($prefix !== '') {
            $headers['X-Accel-Redirect'] = $penyimpanan->pathInternal($unggahan);

            return response('', 200, $headers);
        }

        $path = (string) $unggahan->path;

        if ($path === '' || ! $penyimpanan->disk()->exists($path)) {
            abort(404, 'Berkas tidak ditemukan.');
        }

        return new BinaryFileResponse($penyimpanan->disk()->path($path), 200, $headers);
    }

    /** Nama unduhan tanpa jalur maupun kuotasi yang bisa merusak header. */
    private function namaAman(string $nama): string
    {
        $bersih = str_replace(['"', "\r", "\n", '\\', '/'], '', $nama);

        return $bersih === '' ? 'lampiran' : mb_substr($bersih, 0, 120);
    }
}
