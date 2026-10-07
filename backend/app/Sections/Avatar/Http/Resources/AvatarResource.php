<?php

declare(strict_types=1);

namespace App\Sections\Avatar\Http\Resources;

use App\Sections\Avatar\Models\Avatar;
use App\Sections\Avatar\Services\PenyimpananAvatar;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Avatar seperti yang boleh dilihat pemanggilnya.
 *
 * Aturan pentingnya: **URL gambar hanya diberikan bila pemanggil memang berhak
 * melihatnya**. Avatar yang disembunyikan karena laporan tidak pernah membocorkan
 * alamat gambarnya ke murid lain — pemiliknya tetap mendapat URL-nya. URL-nya
 * sendiri bertanda tangan dan berumur pendek, jadi tidak ada gambar yang bisa
 * ditebak alamatnya.
 *
 * @mixin Avatar
 */
class AvatarResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $pengguna = $request->user();
        $profil = $pengguna?->murid;
        $pemilik = $profil !== null && (int) $profil->getKey() === (int) $this->student_id;
        $guru = $pengguna !== null && $pengguna->isGuru();
        $terlihat = $guru || $pemilik || $this->terlihatSemua();

        return [
            'id' => $this->id,
            'student_id' => $this->student_id,
            'nama_murid' => $this->whenLoaded('murid', fn () => $this->murid->relationLoaded('user')
                ? $this->murid->user?->name
                : null),
            'kelas_nama' => $this->whenLoaded('murid', fn () => $this->murid->relationLoaded('kelas')
                ? $this->murid->kelas?->nama
                : null),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'terlihat' => $this->terlihatSemua(),
            'milik_saya' => $pemilik,
            'url' => $terlihat
                ? app(PenyimpananAvatar::class)->urlBertandaTangan($this->resource)
                : null,
            // Selalu JPEG hasil encode ulang server; bukan tipe berkas kiriman.
            'mime' => $this->mime,
            'lebar' => $this->lebar,
            'tinggi' => $this->tinggi,
            'ukuran' => $this->ukuran,
            'ukuran_manusia' => app(PenyimpananAvatar::class)->ukuranManusia((int) $this->ukuran),
            'jumlah_laporan' => $this->jumlah_laporan,
            'disembunyikan_at' => $this->disembunyikan_at?->toIso8601String(),
            'dibuat_at' => $this->created_at?->toIso8601String(),
            'boleh_lapor' => $profil !== null && ! $pemilik && $this->terlihatSemua(),
            'laporan' => LaporanAvatarResource::collection($this->whenLoaded('laporan')),
        ];
    }
}
