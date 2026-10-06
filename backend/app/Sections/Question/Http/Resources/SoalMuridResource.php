<?php

declare(strict_types=1);

namespace App\Sections\Question\Http\Resources;

use App\Sections\Question\Models\Soal;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Soal untuk murid — TANPA kunci jawaban dan tanpa pembahasan.
 * Daftar kolom sengaja ditulis eksplisit supaya kunci tidak pernah bocor.
 *
 * @mixin Soal
 */
class SoalMuridResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tipe' => $this->tipe->value,
            'tipe_label' => $this->tipe->label(),
            'konten' => $this->konten,
            'skor' => $this->skor,
        ];
    }
}
