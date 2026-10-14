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
            // Akun siswa tamu (tanpa login): klien perlu tahu untuk menampilkan
            // lencana "tamu" dan menyembunyikan menu yang butuh akun sekolah.
            'isTamu' => $this->isTamu(),
            // Akun dari tombol Google yang belum punya kata sandi sendiri:
            // klien mengarahkan ke langkah `/buat-sandi` (server juga menolak
            // rute lain lewat middleware `sandi-disetel`).
            'perluBuatSandi' => $this->perluBuatSandi(),
            // Penanda ringan untuk halaman akun: akun ini memang bisa masuk
            // lewat Google, jadi tombolnya layak ditawarkan di sana.
            'punyaGoogle' => $this->terhubungGoogle(),
        ];
    }
}
