<?php

declare(strict_types=1);

namespace App\Sections\Avatar\Http\Resources;

use App\Sections\Avatar\Models\LaporanAvatar;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Satu laporan avatar. Nama pelapor hanya ikut untuk guru (antrean moderasi),
 * supaya murid tidak bisa memakai endpoint ini untuk mencari tahu siapa yang
 * melaporkannya.
 *
 * @mixin LaporanAvatar
 */
class LaporanAvatarResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $guru = $request->user()?->isGuru() ?? false;

        return [
            'id' => $this->id,
            'alasan' => $this->alasan->value,
            'alasan_label' => $this->alasan->label(),
            'keterangan' => $this->keterangan,
            'status' => $this->review_status->value,
            'status_label' => $this->review_status->label(),
            'pelapor_nama' => $this->when(
                $guru,
                fn () => $this->whenLoaded('pelapor', fn () => $this->pelapor->relationLoaded('user')
                    ? $this->pelapor->user?->name
                    : null),
            ),
            'dibuat_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
