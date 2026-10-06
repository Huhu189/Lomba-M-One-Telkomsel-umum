<?php

declare(strict_types=1);

namespace App\Sections\Quiz\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SinkronSoalKuisRequest extends FormRequest
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
            'soal' => ['present', 'array'],
            'soal.*' => ['integer', Rule::exists('questions', 'id')],
        ];
    }
}
