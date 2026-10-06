<?php

declare(strict_types=1);

namespace App\Sections\Quiz\Http\Resources;

use App\Sections\Question\Http\Resources\SoalMuridResource;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Kuis untuk murid — hanya kuis terbit kelasnya dan TANPA kunci jawaban.
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
            'soal' => SoalMuridResource::collection($this->whenLoaded('soal')),
        ];
    }
}
