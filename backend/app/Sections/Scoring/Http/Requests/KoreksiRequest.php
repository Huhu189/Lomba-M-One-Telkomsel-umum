<?php

declare(strict_types=1);

namespace App\Sections\Scoring\Http\Requests;

use App\Sections\Scoring\Services\KoreksiService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class KoreksiRequest extends FormRequest
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
            'skor' => ['required', 'numeric', 'min:0', 'max:100'],
            'alasan' => ['required', 'string', 'min:'.KoreksiService::ALASAN_MIN, 'max:500'],
            'token' => ['required', 'string', 'min:20', 'max:64'],
        ];
    }
}
