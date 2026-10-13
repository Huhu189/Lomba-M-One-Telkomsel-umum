<?php

declare(strict_types=1);

namespace App\Sections\Admin\Http\Requests;

use App\Sections\Admin\Services\AkunSekolahService;
use App\Sections\Auth\Enums\UserStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Aktifkan / tangguhkan akun guru/murid.
 *
 * Hanya dua status yang diterima. `pending` (menunggu verifikasi) dan `dihapus`
 * bukan keadaan yang boleh dipaksakan dari satu tombol: yang pertama milik alur
 * verifikasi email, yang kedua menghapus profil murid beserta nilainya.
 */
class UbahStatusAkunRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'status' => [
                'required', 'string',
                Rule::in([UserStatus::Aktif->value, UserStatus::Suspended->value]),
            ],
            'alasan' => ['required', 'string', 'min:'.AkunSekolahService::ALASAN_MIN, 'max:500'],
            'token' => ['required', 'string', 'max:120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'status.required' => 'Pilih status baru akun ini.',
            'status.in' => 'Status yang bisa diset hanya aktif atau ditangguhkan.',
            'alasan.required' => 'Tulis alasan perubahan status ini.',
            'alasan.min' => 'Alasan minimal '.AkunSekolahService::ALASAN_MIN.' karakter.',
            'token.required' => 'Token konfirmasi wajib ada. Minta token dulu.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'alasan' => is_string($this->input('alasan')) ? trim((string) $this->input('alasan')) : $this->input('alasan'),
        ]);
    }
}
