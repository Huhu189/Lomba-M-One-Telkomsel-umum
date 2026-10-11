<?php

declare(strict_types=1);

namespace App\Sections\Quiz\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SimpanKuisRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Mapel dan kelas tidak wajib saat kuis masih draf: guru boleh menyusun soal
     * lebih dulu dan baru memilih keduanya sebelum menerbitkan. Kewajiban itu
     * ditegakkan `KuisService::galatKelengkapan()` pada saat publikasi.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'judul' => ['required', 'string', 'min:3', 'max:150'],
            'deskripsi' => ['nullable', 'string', 'max:1000'],
            'subject_id' => ['nullable', 'integer', Rule::exists('subjects', 'id')],
            'class_id' => ['nullable', 'integer', Rule::exists('classes', 'id')],
            // Durasi boleh tidak dikirim: kolomnya punya bawaan 30 menit, dan guru
            // yang menyusun draf cukup mengisi judulnya dulu.
            'durasi_menit' => ['nullable', 'integer', 'min:1', 'max:300'],
            'mulai_at' => ['nullable', 'date'],
            'selesai_at' => ['nullable', 'date', 'after:mulai_at'],
            'acak_soal' => ['nullable', 'boolean'],
            'acak_opsi' => ['nullable', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'judul' => is_string($this->input('judul')) ? trim((string) $this->input('judul')) : $this->input('judul'),
        ]);
    }
}
