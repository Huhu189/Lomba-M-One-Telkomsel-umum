<?php

declare(strict_types=1);

namespace App\Sections\Presence\Http\Requests;

use App\Sections\Presence\Enums\ModeLayar;
use App\Sections\Presence\Services\LayarService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Ubah keadaan layar guru (slice 10). Pemilik kuis diperiksa policy; di sini
 * hanya bentuk datanya. Aturan "mode apa butuh apa" ditegakkan LayarService
 * supaya pesannya bisa menjelaskan alasannya, bukan sekadar "tidak valid".
 */
class SimpanLayarRequest extends FormRequest
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
            'mode' => ['required', 'string', Rule::in(array_map(
                static fn (ModeLayar $mode): string => $mode->value,
                ModeLayar::cases(),
            ))],
            'judul' => ['nullable', 'string', 'max:'.LayarService::MAKS_JUDUL],
            'isi' => ['nullable', 'string', 'max:'.LayarService::MAKS_ISI],
            'question_id' => ['nullable', 'integer', 'exists:questions,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'mode.in' => 'Mode layar tidak dikenal.',
            'isi.max' => 'Tulisan layar terlalu panjang; ringkas saja supaya terbaca dari jauh.',
            'question_id.exists' => 'Soal itu tidak ditemukan.',
        ];
    }
}
