<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Http\Resources;

use App\Sections\Attempt\Models\UnggahanJawaban;
use App\Sections\Attempt\Services\PenyimpananJawaban;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Lampiran jawaban seperti yang dilihat klien.
 *
 * `tampil_langsung` memberi tahu klien apakah berkasnya boleh ditampilkan inline
 * atau harus diunduh: kategori berisiko/tidak dikenal selalu unduhan `.upload`.
 *
 * @mixin UnggahanJawaban
 */
class UnggahanJawabanResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kode' => $this->kode,
            'question_id' => $this->question_id,
            'jenis' => $this->jenis->value,
            'jenis_label' => $this->jenis->label(),
            'nama_asli' => $this->nama_asli,
            'ekstensi' => $this->ekstensi,
            'mime' => $this->mime,
            'kategori' => $this->kategori->value,
            'kategori_label' => $this->kategori->label(),
            'tampil_langsung' => $this->tampilLangsung(),
            'ukuran' => $this->ukuran_total,
            'ukuran_manusia' => app(PenyimpananJawaban::class)->ukuranManusia((int) $this->ukuran_total),
            'durasi_detik' => $this->durasi_detik,
            'jumlah_potongan' => $this->jumlah_potongan,
            'ukuran_potongan' => (int) config('jawaban.chunk_byte'),
            'hash' => $this->hash,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'url' => $this->selesai() ? app(PenyimpananJawaban::class)->urlBertandaTangan($this->resource) : null,
        ];
    }
}
