<?php

declare(strict_types=1);

namespace App\Sections\School\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ImporMuridRequest extends FormRequest
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
            'file' => ['required', 'file', 'extensions:csv,txt', 'max:5120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.extensions' => 'Berkas harus berformat CSV.',
            'file.max' => 'Ukuran berkas maksimal 5 MB.',
        ];
    }
}
