<?php

declare(strict_types=1);

namespace App\Sections\Question\Http\Resources;

use App\Sections\Question\Models\Soal;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Soal untuk guru — memuat kunci jawaban.
 * Jalur murid memakai SoalMuridResource (tanpa kunci).
 *
 * @mixin Soal
 */
class SoalResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'subject_id' => $this->subject_id,
            'tag_id' => $this->tag_id,
            'tipe' => $this->tipe->value,
            'tipe_label' => $this->tipe->label(),
            'objektif' => $this->tipe->objektif(),
            'konten' => $this->konten,
            'kunci' => $this->kunci,
            'pembahasan' => $this->pembahasan,
            'skor' => $this->skor,
            'aktif' => $this->aktif,
            'mapel_nama' => $this->whenLoaded('mapel', fn () => $this->mapel->nama),
            'tag_nama' => $this->whenLoaded('tag', fn () => $this->tag?->nama),
        ];
    }
}
