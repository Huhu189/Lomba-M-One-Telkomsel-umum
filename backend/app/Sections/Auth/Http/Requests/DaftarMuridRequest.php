<?php

declare(strict_types=1);

namespace App\Sections\Auth\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DaftarMuridRequest extends FormRequest
{
    /** Murid publik boleh mendaftar tanpa sesi. */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Password minimal 10 karakter (chunk security butir 10).
     *
     * @return array<string, list<string>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'email' => ['required', 'string', 'email:rfc', 'max:120', 'unique:users,email'],
            'password' => ['required', 'string', 'min:10', 'confirmed'],
        ];
    }

    /**
     * Email disimpan huruf kecil.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => mb_strtolower(trim((string) $this->input('email'))),
        ]);
    }
}
