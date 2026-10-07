<?php

declare(strict_types=1);

namespace App\Sections\Avatar\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Keputusan guru atas avatar yang dilaporkan (pulihkan / hapus). Alasan
 * singkat bersifat opsional, tetapi ikut tercatat di audit bila diisi.
 */
class ModerasiAvatarRequest extends FormRequest
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
            'catatan' => ['nullable', 'string', 'max:300'],
        ];
    }
}
