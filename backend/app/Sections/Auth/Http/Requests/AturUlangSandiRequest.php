<?php

declare(strict_types=1);

namespace App\Sections\Auth\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AturUlangSandiRequest extends FormRequest
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
            'token' => ['required', 'string'],
            'email' => ['required', 'string', 'email:rfc'],
            'password' => ['required', 'string', 'min:10', 'confirmed'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => mb_strtolower(trim((string) $this->input('email'))),
            // Sama dengan MasukRequest/DaftarMuridRequest: toleransi spasi tepi pada sandi.
            'password' => trim((string) $this->input('password')),
            'password_confirmation' => trim((string) $this->input('password_confirmation')),
        ]);
    }
}
