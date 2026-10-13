<?php

declare(strict_types=1);

namespace App\Sections\Admin\Http\Requests;

use App\Models\User;
use App\Sections\Admin\Services\AkunSekolahService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Ubah email akun guru/murid (admin sekolah).
 *
 * Memakai token konfirmasi + alasan seperti koreksi nilai: email adalah alamat
 * pemulihan akun, jadi mengubahnya memindahkan kendali atas akun itu.
 */
class UbahEmailAkunRequest extends FormRequest
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
        $akun = $this->route('akun');
        $sasaranId = $akun instanceof User ? $akun->getKey() : null;

        return [
            'email' => [
                'required', 'string', 'email:rfc', 'max:120',
                Rule::unique('users', 'email')->ignore($sasaranId),
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
            'email.required' => 'Email baru wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email ini sudah dipakai akun lain. Pakai email lain.',
            'alasan.required' => 'Tulis alasan perubahan email ini.',
            'alasan.min' => 'Alasan minimal '.AkunSekolahService::ALASAN_MIN.' karakter.',
            'token.required' => 'Token konfirmasi wajib ada. Minta token dulu.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => is_string($this->input('email')) ? mb_strtolower(trim((string) $this->input('email'))) : $this->input('email'),
            'alasan' => is_string($this->input('alasan')) ? trim((string) $this->input('alasan')) : $this->input('alasan'),
        ]);
    }
}
