<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Http\Requests;

use App\Sections\Attempt\Services\TimService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Susun/ubah satu tim kuis (slice 09-C). Pemilik kuis diperiksa policy;
 * di sini hanya bentuk datanya.
 */
class SimpanTimRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'tim_id' => ['nullable', 'integer', 'exists:teams,id'],
            'nama' => ['required', 'string', 'min:2', 'max:60'],
            'murid' => ['required', 'array', 'min:'.TimService::MIN_ANGGOTA],
            'murid.*' => ['integer', 'distinct', 'exists:students,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'nama.required' => 'Nama tim wajib diisi.',
            'murid.min' => 'Satu tim minimal berisi '.TimService::MIN_ANGGOTA.' murid.',
            'murid.*.distinct' => 'Seorang murid tidak bisa masuk dua kali di tim yang sama.',
        ];
    }
}
