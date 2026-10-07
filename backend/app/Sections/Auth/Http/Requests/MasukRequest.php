<?php

declare(strict_types=1);

namespace App\Sections\Auth\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MasukRequest extends FormRequest
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
            'email' => ['required', 'string', 'email:rfc'],
            'password' => ['required', 'string'],
            'ingat' => ['sometimes', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => mb_strtolower(trim((string) $this->input('email'))),
            // Toleransi UX: spasi di awal/akhir kata sandi hampir selalu salah ketik
            // (autofill ponsel, copy-paste), bukan bagian sandi. Di-trim agar sandi
            // yang benar tetap bisa masuk. Spasi di dalam sandi tidak tersentuh.
            'password' => trim((string) $this->input('password')),
        ]);
    }
}
