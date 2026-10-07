<?php

declare(strict_types=1);

namespace App\Sections\Material\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MulaiUnggahanRequest extends FormRequest
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
            'nama' => ['required', 'string', 'min:1', 'max:255'],
            'ukuran' => ['required', 'integer', 'min:1'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nama' => is_string($this->input('nama')) ? trim((string) $this->input('nama')) : $this->input('nama'),
        ]);
    }
}
