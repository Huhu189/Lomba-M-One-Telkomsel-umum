<?php

declare(strict_types=1);

namespace App\Sections\Cheat\Http\Requests;

use App\Sections\Cheat\Enums\StatusTinjauan;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Tinjauan guru: valid atau tidak valid (bukan "menunggu" — itu status awal).
 *
 * Kepala sekolah tidak ikut meninjau (ia hanya membaca catatannya); gerbang
 * pemiliknya sendiri ada di `KejadianKecuranganPolicy::tinjau`.
 */
class TinjauKejadianRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->bolehMengubahAkademik() === true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', 'string', Rule::in([
                StatusTinjauan::Valid->value,
                StatusTinjauan::TidakValid->value,
            ])],
            'catatan' => ['nullable', 'string', 'max:300'],
        ];
    }
}
