<?php

declare(strict_types=1);

namespace App\Sections\School\Http\Requests;

use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SimpanMuridRequest extends FormRequest
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
        $murid = $this->route('murid');
        $muridId = $murid instanceof Murid ? $murid->getKey() : null;
        $userId = $murid instanceof Murid ? $murid->user_id : null;

        return [
            'nama' => ['required', 'string', 'min:2', 'max:120'],
            'email' => [
                'required', 'string', 'email:rfc', 'max:120',
                Rule::unique('users', 'email')->ignore($userId),
            ],
            'class_id' => [
                'required', 'integer',
                Rule::exists('classes', 'id')->where(fn ($query) => $query->where('school_id', $sekolahId)),
            ],
            'nis' => [
                'nullable', 'string', 'max:30',
                Rule::unique('students', 'nis')
                    ->where(fn ($query) => $query->where('school_id', $sekolahId))
                    ->ignore($muridId),
            ],
            'nisn' => ['nullable', 'string', 'max:20'],
            'kata_sandi' => ['nullable', 'string', 'min:10'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nama' => is_string($this->input('nama')) ? trim((string) $this->input('nama')) : $this->input('nama'),
            'email' => is_string($this->input('email')) ? mb_strtolower(trim((string) $this->input('email'))) : $this->input('email'),
        ]);
    }
}
