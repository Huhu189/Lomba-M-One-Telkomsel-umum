<?php

declare(strict_types=1);

namespace App\Sections\Auth\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Representasi user yang aman untuk klien (tanpa kolom sensitif).
 *
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'status' => $this->status?->value,
            'statusLabel' => $this->status?->label(),
            'emailTerverifikasi' => $this->hasVerifiedEmail(),
        ];
    }
}
