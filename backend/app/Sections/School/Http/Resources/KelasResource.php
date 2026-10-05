<?php

declare(strict_types=1);

namespace App\Sections\School\Http\Resources;

use App\Sections\School\Models\Kelas;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Kelas
 */
class KelasResource extends JsonResource
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
            'tingkat' => $this->tingkat,
            'tahun_ajaran' => $this->tahun_ajaran,
            'jumlah_murid' => $this->whenCounted('murid'),
        ];
    }
}
