<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Http\Requests;

use App\Sections\Attempt\Services\TimService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Bagi seluruh murid kelas jadi beberapa tim sekaligus (slice 09-C).
 */
class BagiTimRequest extends FormRequest
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
            'jumlah_tim' => ['required', 'integer', 'between:2,'.TimService::MAKS_TIM],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'jumlah_tim.between' => 'Jumlah tim harus antara 2 dan '.TimService::MAKS_TIM.'.',
        ];
    }
}
