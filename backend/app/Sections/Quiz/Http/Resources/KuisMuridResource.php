<?php

declare(strict_types=1);

namespace App\Sections\Quiz\Http\Resources;

use App\Sections\Quiz\Models\Kuis;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Kuis untuk murid — hanya kuis terbit kelasnya, TANPA kunci jawaban dan
 * TANPA daftar soal (K-02).
 *
 * Sebelumnya resource ini ikut mengirim seluruh soal beserta `konten` mentahnya,
 * sehingga murid kelas bisa membaca isi ulangan jauh sebelum `mulai_at` — cukup
 * dengan `GET /kuis/{id}`. Pengacakan di server pun jadi tidak ada artinya.
 * Soal sekarang hanya keluar lewat attempt yang sudah dimulai (`payloadSoal`),
 * yang memakai snapshot + urutan hasil pengacakan.
 *
 * @mixin Kuis
 */
class KuisMuridResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'judul' => $this->judul,
            'deskripsi' => $this->deskripsi,
            'status' => $this->status->value,
            'mapel_nama' => $this->whenLoaded('mapel', fn () => $this->mapel->nama),
            'kelas_nama' => $this->whenLoaded('kelas', fn () => $this->kelas->nama),
            'mulai_at' => $this->mulai_at?->toIso8601String(),
            'selesai_at' => $this->selesai_at?->toIso8601String(),
            'durasi_menit' => $this->durasi_menit,
            'jumlah_soal' => $this->whenCounted('soal'),
            'sedang_berjalan' => $this->sedangBerjalan(),
        ];
    }
}
