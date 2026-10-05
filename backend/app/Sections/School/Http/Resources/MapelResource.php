<?php

declare(strict_types=1);

namespace App\Sections\School\Http\Resources;

use App\Sections\School\Models\Mapel;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Mapel
 */
class MapelResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'school_id' => $this->school_id,
            'nama' => $this->nama,
            'kode' => $this->kode,
        ];
    }
}
