<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Http\Requests;

use App\Sections\Attempt\Enums\JenisUnggahanJawaban;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Buka sesi unggah lampiran jawaban untuk satu soal.
 *
 * `jenis` divalidasi terhadap enum supaya klien tidak bisa mengarang kategori
 * lampiran yang tidak dikenal server.
 */
class MulaiUnggahanJawabanRequest extends FormRequest
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
            'question_id' => ['required', 'integer', Rule::exists('questions', 'id')],
            'jenis' => ['required', 'string', Rule::enum(JenisUnggahanJawaban::class)],
            'nama' => ['nullable', 'string', 'max:255'],
            'ukuran' => ['required', 'integer', 'min:1'],
            'durasi_detik' => ['nullable', 'integer', 'min:1'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nama' => is_string($this->input('nama')) ? trim((string) $this->input('nama')) : $this->input('nama'),
        ]);
    }
}
