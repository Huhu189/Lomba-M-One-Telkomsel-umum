<?php

declare(strict_types=1);

namespace App\Sections\Auth\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Ubah nama akun sendiri.
 *
 * Hanya `name` — email tidak boleh diubah dari sini (lihat `AkunService`), dan
 * pesan validasinya dibuat jelas supaya klien tidak menebak-nebak.
 */
class PerbaruiAkunRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>|string>
     */
    public function rules(): array
    {
        return [
            // Sama dengan aturan pendaftaran murid supaya nama yang diterima saat
            // daftar selalu bisa diperbaiki di sini.
            'name' => ['required', 'string', 'min:2', 'max:60'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama tidak boleh kosong.',
            'name.min' => 'Nama minimal 2 huruf.',
            'name.max' => 'Nama terlalu panjang (maksimal 60 huruf).',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['name' => trim((string) $this->input('name'))]);
    }
}
