<?php

declare(strict_types=1);

namespace App\Sections\Admin\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * Satu baris daftar akun guru/murid di panel admin.
 *
 * Tanpa kolom sensitif (sandi, token, remember_token), dan sengaja tanpa
 * `email_verified_at` mentah — klien hanya perlu tahu terverifikasi atau belum.
 *
 * @mixin User
 */
class AkunSekolahResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nama' => $this->name,
            'email' => $this->email,
            'peran' => $this->role,
            'peran_label' => $this->labelPeran(),
            'status' => $this->status?->value,
            'status_label' => $this->status?->label(),
            'terverifikasi' => $this->hasVerifiedEmail(),
            // Siswa tamu: akun tanpa sandi yang tidak pernah dipakai untuk masuk,
            // jadi panel menyembunyikan tombol setel sandi untuk mereka.
            'is_tamu' => (bool) $this->is_tamu,
            'kelas_nama' => $this->whenLoaded('murid', fn () => $this->murid?->kelas?->nama),
            'nis' => $this->whenLoaded('murid', fn () => $this->murid?->nis),
            'terakhir_aktif' => $this->waktuTerakhirAktif(),
        ];
    }

    private function labelPeran(): string
    {
        return match ($this->role) {
            'admin' => 'Admin sekolah',
            'guru' => 'Guru',
            'murid' => 'Murid',
            default => 'Tanpa peran',
        };
    }

    /**
     * Waktu sesi terakhir akun ini, dari sub-kueri `terakhir_aktif`.
     *
     * Dibaca lewat `getAttributes()` supaya tetap aman ketika sub-kueri itu tidak
     * ikut dipilih (driver sesi bukan `database`) — `Model::shouldBeStrict`
     * melempar MissingAttributeException kalau diakses sebagai properti biasa.
     */
    private function waktuTerakhirAktif(): ?string
    {
        $nilai = $this->getAttributes()['terakhir_aktif'] ?? null;

        return $nilai === null ? null : Carbon::createFromTimestamp((int) $nilai)->toIso8601String();
    }
}
