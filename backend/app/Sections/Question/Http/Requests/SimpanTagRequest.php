<?php

declare(strict_types=1);

namespace App\Sections\Question\Http\Requests;

use App\Sections\Question\Models\Tag;
use App\Sections\School\Models\Sekolah;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SimpanTagRequest extends FormRequest
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
        $tag = $this->route('tag');
        $tagId = $tag instanceof Tag ? $tag->getKey() : null;

        return [
            'nama' => [
                'required', 'string', 'min:2', 'max:80',
                Rule::unique('tags', 'nama')
                    ->where(fn ($query) => $query->where('school_id', $sekolahId))
                    ->ignore($tagId),
            ],
            'deskripsi' => ['nullable', 'string', 'max:255'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nama' => is_string($this->input('nama')) ? trim((string) $this->input('nama')) : $this->input('nama'),
            'deskripsi' => is_string($this->input('deskripsi')) ? trim((string) $this->input('deskripsi')) : $this->input('deskripsi'),
        ]);
    }
}
