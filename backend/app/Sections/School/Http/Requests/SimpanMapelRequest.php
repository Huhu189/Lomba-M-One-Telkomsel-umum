<?php

declare(strict_types=1);

namespace App\Sections\School\Http\Requests;

use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Sekolah;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SimpanMapelRequest extends FormRequest
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
        $mapel = $this->route('mapel');
        $mapelId = $mapel instanceof Mapel ? $mapel->getKey() : null;

        return [
            'nama' => [
                'required', 'string', 'min:2', 'max:80',
                Rule::unique('subjects', 'nama')
                    ->where(fn ($query) => $query->where('school_id', $sekolahId))
                    ->ignore($mapelId),
            ],
            'kode' => ['nullable', 'string', 'max:20', 'regex:/^[A-Za-z0-9-]+$/'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nama' => is_string($this->input('nama')) ? trim((string) $this->input('nama')) : $this->input('nama'),
            'kode' => is_string($this->input('kode')) ? mb_strtoupper(trim((string) $this->input('kode'))) : $this->input('kode'),
        ]);
    }
}
