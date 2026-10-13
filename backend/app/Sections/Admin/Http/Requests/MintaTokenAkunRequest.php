<?php

declare(strict_types=1);

namespace App\Sections\Admin\Http\Requests;

use App\Sections\Admin\Services\AkunSekolahService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Permintaan token konfirmasi sebelum mengubah akun guru/murid.
 *
 * Alasan wajib di sini (bukan hanya di service) supaya galatnya muncul sebagai
 * kesalahan kolom di formulir, bukan 422 mendadak saat token dipakai.
 */
class MintaTokenAkunRequest extends FormRequest
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
            'alasan' => ['required', 'string', 'min:'.AkunSekolahService::ALASAN_MIN, 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'alasan.required' => 'Tulis alasan perubahan akun ini dulu.',
            'alasan.min' => 'Alasan minimal '.AkunSekolahService::ALASAN_MIN.' karakter.',
            'alasan.max' => 'Alasan maksimal 500 karakter.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'alasan' => is_string($this->input('alasan')) ? trim((string) $this->input('alasan')) : $this->input('alasan'),
        ]);
    }
}
