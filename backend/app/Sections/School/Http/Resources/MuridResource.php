<?php

declare(strict_types=1);

namespace App\Sections\School\Http\Resources;

use App\Sections\School\Models\Murid;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Murid
 */
class MuridResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'school_id' => $this->school_id,
            'class_id' => $this->class_id,
            'nis' => $this->nis,
            'nisn' => $this->nisn,
            'nama' => $this->user->name,
            'email' => $this->user->email,
            'kelas_nama' => $this->kelas->nama,
        ];
    }
}
