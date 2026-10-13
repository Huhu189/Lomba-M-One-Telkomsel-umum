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

    /**
     * Pesan galat dalam bahasa Indonesia.
     *
     * Tanpa ini guru hanya melihat "The email has already been taken." saat
     * menambah murid yang email (atau NIS-)nya sudah dipakai — penyebab paling
     * sering di halaman ini. Pesannya kini menyebut penyebabnya dan apa yang
     * harus dilakukan, sama seperti halaman Kelas & Mapel.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'nama.required' => 'Nama murid wajib diisi.',
            'nama.min' => 'Nama minimal 2 karakter.',
            'nama.max' => 'Nama maksimal 120 karakter.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.max' => 'Email maksimal 120 karakter.',
            'email.unique' => 'Email ini sudah dipakai akun lain. Pakai email lain, misalnya email orang tua atau wali.',
            'class_id.required' => 'Pilih dulu kelas muridnya.',
            'class_id.integer' => 'Kelas harus berupa angka.',
            'class_id.exists' => 'Kelas itu tidak ada di sekolah ini.',
            'nis.unique' => 'NIS ini sudah dipakai murid lain di sekolah ini.',
            'nis.max' => 'NIS maksimal 30 karakter.',
            'nisn.max' => 'NISN maksimal 20 karakter.',
            'kata_sandi.min' => 'Kata sandi minimal 10 karakter.',
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
