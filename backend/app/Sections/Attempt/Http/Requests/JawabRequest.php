<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Http\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class JawabRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Bentuk jawaban berbeda per tipe soal (id opsi, boolean, daftar id, peta
     * pasangan), jadi yang divalidasi adalah batas ukurannya — penilaian
     * struktural tetap di registry tipe soal.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'question_id' => ['required', 'integer', Rule::exists('questions', 'id')],
            'jawaban' => [
                'present',
                function (string $atribut, mixed $nilai, Closure $gagal): void {
                    if (is_string($nilai) && mb_strlen($nilai) > 2000) {
                        $gagal('Jawaban terlalu panjang.');
                    }

                    if (is_array($nilai) && count($nilai) > 50) {
                        $gagal('Jawaban terlalu banyak.');
                    }
                },
            ],
        ];
    }
}
