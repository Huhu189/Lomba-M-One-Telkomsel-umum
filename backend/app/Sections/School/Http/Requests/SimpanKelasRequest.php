<?php

declare(strict_types=1);

namespace App\Sections\School\Http\Requests;

use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Sekolah;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SimpanKelasRequest extends FormRequest
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
        $kelas = $this->route('kelas');
        $kelasId = $kelas instanceof Kelas ? $kelas->getKey() : null;

        $aturanNama = [
            'required', 'string', 'min:1', 'max:60',
            Rule::unique('classes', 'nama')
                ->where(fn ($query) => $query->where('school_id', $sekolahId))
                ->ignore($kelasId),
        ];

        return [
            'nama' => $aturanNama,
            'tingkat' => ['required', 'integer', 'min:1', 'max:6'],
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
