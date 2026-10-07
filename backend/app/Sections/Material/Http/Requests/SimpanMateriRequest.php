<?php

declare(strict_types=1);

namespace App\Sections\Material\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SimpanMateriRequest extends FormRequest
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
            'judul' => ['required', 'string', 'min:3', 'max:150'],
            'deskripsi' => ['nullable', 'string', 'max:2000'],
            'subject_id' => ['required', 'integer', Rule::exists('subjects', 'id')],
            'class_id' => ['required', 'integer', Rule::exists('classes', 'id')],
            'tag_id' => ['nullable', 'integer', Rule::exists('tags', 'id')],
            'urutan' => ['nullable', 'integer', 'min:0', 'max:9999'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'judul' => is_string($this->input('judul')) ? trim((string) $this->input('judul')) : $this->input('judul'),
        ]);
    }
}
