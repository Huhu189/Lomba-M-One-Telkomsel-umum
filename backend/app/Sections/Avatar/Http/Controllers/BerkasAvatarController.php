<?php

declare(strict_types=1);

namespace App\Sections\Avatar\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Avatar\Enums\StatusAvatar;
use App\Sections\Avatar\Models\Avatar;
use App\Sections\Avatar\Services\PenyimpananAvatar;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Penyajian gambar avatar lewat URL bertanda tangan berumur pendek.
 *
 * Berkas fisik ada di `storage/app/private`, jadi tidak ada alamat yang bisa
 * ditebak. Meski isinya selalu gambar hasil encode ulang server, responsnya
 * tetap dikunci: `nosniff`, `Content-Disposition: inline` dengan nama acak, dan
 * CSP `default-src 'none'; sandbox` supaya berkas ini tidak pernah menjadi
 * dokumen yang bisa menjalankan apa pun.
 */
class BerkasAvatarController extends Controller
{
    public function __invoke(string $kode, PenyimpananAvatar $penyimpanan): Response
    {
        $avatar = Avatar::query()
            ->where('kode', $kode)
            ->where('status', '!=', StatusAvatar::Dihapus->value)
            ->firstOrFail();

        $headers = [
            'X-Content-Type-Options' => 'nosniff',
            'Content-Type' => (string) $avatar->mime,
            'Cache-Control' => 'private, max-age=0, must-revalidate',
            'Content-Disposition' => 'inline; filename="avatar-'.$avatar->kode.'.jpg"',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
        ];

        $prefix = (string) config('avatar.x_accel_prefix', '');

        if ($prefix !== '') {
            $headers['X-Accel-Redirect'] = $penyimpanan->pathInternal($avatar);

            return response('', 200, $headers);
        }

        $path = (string) $avatar->path;

        if ($path === '' || ! $penyimpanan->disk()->exists($path)) {
            abort(404, 'Gambar tidak ditemukan.');
        }

        return new BinaryFileResponse($penyimpanan->disk()->path($path), 200, $headers);
    }
}
