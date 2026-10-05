<?php

declare(strict_types=1);

namespace App\Sections\School\Http\Requests;

use App\Sections\School\Models\Sekolah;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SimpanSekolahRequest extends FormRequest
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
        $sekolahId = Sekolah::query()->value('id');

        return [
            'nama' => ['required', 'string', 'min:2', 'max:150'],
            'npsn' => [
                'nullable', 'string', 'max:20', 'regex:/^[0-9]+$/',
                Rule::unique('schools', 'npsn')->ignore($sekolahId),
            ],
            'alamat' => ['nullable', 'string', 'max:255'],
            'kepala_sekolah' => ['nullable', 'string', 'max:120'],
            'tahun_ajaran' => ['nullable', 'string', 'max:20'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nama' => is_string($this->input('nama')) ? trim((string) $this->input('nama')) : $this->input('nama'),
        ]);
    }
}
