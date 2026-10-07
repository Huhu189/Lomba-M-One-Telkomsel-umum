<?php

declare(strict_types=1);

namespace App\Sections\Material\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Material\Enums\StatusUnggahan;
use App\Sections\Material\Models\UnggahanMateri;
use App\Sections\Material\Services\PenyimpananMateri;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Penyajian berkas materi lewat URL bertanda tangan berumur pendek.
 *
 * Berkas fisik berada di `storage/app/private` (di luar folder publik), jadi
 * tidak ada alamat yang bisa ditebak. Dua hal yang selalu dikirim:
 *
 * - `X-Content-Type-Options: nosniff` — browser tidak boleh menebak tipe sendiri.
 * - Berkas kategori berisiko/tidak dikenal **wajib** diunduh (`attachment`),
 *   dengan nama berakhiran `.upload`, sehingga tidak pernah dijalankan inline.
 *
 * Bila ada reverse proxy (nginx) yang menyajikan langsung dari disk, header
 * `X-Accel-Redirect` dipakai supaya berkas besar tidak melewati PHP.
 */
class BerkasController extends Controller
{
    public function __invoke(string $kode, PenyimpananMateri $penyimpanan): Response
    {
        $unggahan = UnggahanMateri::query()
            ->where('kode', $kode)
            ->where('status', StatusUnggahan::Selesai->value)
            ->firstOrFail();

        $namaUnduh = $this->namaAman((string) $unggahan->nama_asli);
        $tampilLangsung = $unggahan->kategori->bolehTampilLangsung();

        $headers = [
            'X-Content-Type-Options' => 'nosniff',
            'Content-Type' => (string) $unggahan->mime,
            'Cache-Control' => 'private, max-age=0, must-revalidate',
            'Content-Disposition' => $tampilLangsung
                ? 'inline; filename="'.$namaUnduh.'"'
                : 'attachment; filename="'.$namaUnduh.'.upload"',
        ];

        $prefix = (string) config('material.x_accel_prefix', '');

        if ($prefix !== '') {
            $headers['X-Accel-Redirect'] = $penyimpanan->pathInternal($unggahan);

            return response('', 200, $headers);
        }

        $path = (string) $unggahan->path;

        if ($path === '' || ! $penyimpanan->disk()->exists($path)) {
            abort(404, 'Berkas tidak ditemukan.');
        }

        return $this->berkas($penyimpanan->disk()->path($path), $headers);
    }

    /**
     * @param  array<string, string>  $headers
     */
    private function berkas(string $path, array $headers): BinaryFileResponse
    {
        return response()->file($path, $headers);
    }

    /** Nama unduhan tanpa jalur maupun kuotasi yang bisa merusak header. */
    private function namaAman(string $nama): string
    {
        $bersih = str_replace(['"', "\r", "\n", '\\', '/'], '', $nama);

        return $bersih === '' ? 'berkas' : mb_substr($bersih, 0, 120);
    }
}
