<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class KumpulkanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            // Kunci idempotensi dari klien: dijaga panjangnya, bukan nilainya
            // (server tetap yang menentukan: attempt selesai tidak dinilai ulang).
            'idempotency_key' => ['required', 'string', 'min:8', 'max:64'],
        ];
    }
}
