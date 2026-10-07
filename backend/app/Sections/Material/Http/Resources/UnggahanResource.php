<?php

declare(strict_types=1);

namespace App\Sections\Material\Http\Resources;

use App\Sections\Material\Models\UnggahanMateri;
use App\Sections\Material\Services\PenyimpananMateri;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Berkas materi untuk guru: ditambah URL bertanda tangan berumur pendek, jadi
 * guru tidak perlu tahu lokasi fisik berkas di storage.
 *
 * @mixin UnggahanMateri
 */
class UnggahanResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $penyimpanan = app(PenyimpananMateri::class);

        return [
            'kode' => $this->kode,
            'nama_asli' => $this->nama_asli,
            'ekstensi' => $this->ekstensi,
            'mime' => $this->mime,
            'kategori' => $this->kategori->value,
            'kategori_label' => $this->kategori->label(),
            'tampil_langsung' => $this->kategori->bolehTampilLangsung(),
            'ukuran' => $this->ukuran_total,
            'ukuran_manusia' => $penyimpanan->ukuranManusia((int) $this->ukuran_total),
            // Klien perlu tahu berapa potongan yang harus dikirim dan seberapa besar
            // tiap potongan; keduanya ditentukan server agar tidak ada tebak-tebakan.
            'jumlah_potongan' => $this->jumlah_potongan,
            'ukuran_potongan' => (int) config('material.chunk_byte'),
            'hash' => $this->hash,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            // Penyajian selalu lewat URL bertanda tangan, bukan path storage.
            'url' => $this->selesai() ? $penyimpanan->urlBertandaTangan($this->resource) : null,
        ];
    }
}
