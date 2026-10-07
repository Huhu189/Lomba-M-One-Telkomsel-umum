<?php

declare(strict_types=1);

namespace App\Sections\Avatar\Http\Requests;

use App\Sections\Avatar\Enums\AlasanLaporan;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LaporAvatarRequest extends FormRequest
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
            // Alasan divalidasi terhadap enum: klien tidak bisa mengirim kategori
            // bebas yang tidak dikenal guru.
            'alasan' => ['required', 'string', Rule::enum(AlasanLaporan::class)],
            'keterangan' => ['nullable', 'string', 'max:300'],
        ];
    }
}
