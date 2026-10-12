<?php

declare(strict_types=1);

namespace App\Sections\Presence\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Satu denyut proteksi dari perangkat murid (2D).
 *
 * Isinya hanya nonce yang terakhir diterima klien; identitas attempt datang
 * dari URL dan sesi, bukan payload. Panjangnya dibatasi supaya payload aneh
 * tidak masuk ke perbandingan `hash_equals`.
 */
class DenyutRequest extends FormRequest
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
            'nonce' => ['required', 'string', 'max:64'],
        ];
    }
}
