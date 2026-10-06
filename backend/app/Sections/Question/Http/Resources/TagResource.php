<?php

declare(strict_types=1);

namespace App\Sections\Question\Http\Resources;

use App\Sections\Question\Models\Tag;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Tag
 */
class TagResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nama' => $this->nama,
            'deskripsi' => $this->deskripsi,
            'jumlah_soal' => $this->whenCounted('soal'),
        ];
    }
}
