<?php

declare(strict_types=1);

namespace App\Sections\Material\Http\Requests;

use App\Sections\Material\Enums\TipeBlok;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SinkronBlokRequest extends FormRequest
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
            'blok' => ['present', 'array', 'max:200'],
            'blok.*.tipe' => ['required', Rule::enum(TipeBlok::class)],
            'blok.*.wajib' => ['nullable', 'boolean'],
            'blok.*.isi' => ['nullable', 'array'],
            'blok.*.quiz_id' => ['nullable', 'integer'],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function daftarBlok(): array
    {
        /** @var array<int, array<string, mixed>> $blok */
        $blok = (array) $this->validated('blok');

        return array_values($blok);
    }
}
