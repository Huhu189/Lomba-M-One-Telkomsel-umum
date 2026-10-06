<?php

declare(strict_types=1);

namespace App\Sections\Cheat\Http\Resources;

use App\Sections\Cheat\Models\KejadianKecurangan;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Satu catatan kecurangan untuk guru: apa yang terdeteksi, seberapa besar
 * skor risikonya, dan bagaimana tinjuannya. `created_at` selalu waktu server.
 *
 * @mixin KejadianKecurangan
 */
class KejadianKecuranganResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'attempt_id' => $this->attempt_id,
            'student_id' => $this->student_id,
            'nama_murid' => $this->whenLoaded('murid', fn () => $this->murid->user?->name),
            'kategori' => $this->kategori->value,
            'kategori_label' => $this->kategori->label(),
            'skor_risiko' => $this->skor_risiko,
            'dari_klien' => $this->dari_klien,
            'client_at' => $this->client_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'rincian' => $this->rincian,
            'review_status' => $this->review_status->value,
            'review_status_label' => $this->review_status->label(),
            'reviewed_by' => $this->reviewed_by,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
        ];
    }
}
