<?php

declare(strict_types=1);

namespace App\Sections\School\Http\Resources;

use App\Sections\School\Models\Sekolah;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Sekolah
 */
class SekolahResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nama' => $this->nama,
            'npsn' => $this->npsn,
            'alamat' => $this->alamat,
            'kepala_sekolah' => $this->kepala_sekolah,
            'tahun_ajaran' => $this->tahun_ajaran,
        ];
    }
}
