<?php

declare(strict_types=1);

namespace App\Sections\Cheat\Http\Requests;

use App\Sections\Cheat\Enums\KategoriKecurangan;
use App\Sections\Cheat\Services\KecuranganService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Kiriman berkelompok kejadian dari perangkat murid.
 *
 * Identitas (school/quiz/attempt/student) TIDAK diambil dari payload — semuanya
 * dari sesi dan attempt di URL. Kategori wajib salah satu enum yang memang boleh
 * datang dari klien; kategori turunan server ditolak di service (dan di sini
 * sudah dibatasi agar tidak lolos validasi).
 */
class CatatKejadianRequest extends FormRequest
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
            'kejadian' => ['required', 'array', 'min:1', 'max:'.KecuranganService::BATAS_BERKELOMPOK],
            'kejadian.*.kategori' => [
                'required', 'string',
                Rule::in(array_map(
                    static fn (KategoriKecurangan $k): string => $k->value,
                    array_filter(KategoriKecurangan::cases(), static fn (KategoriKecurangan $k): bool => $k->dariKlien()),
                )),
            ],
            'kejadian.*.client_at' => ['nullable', 'date'],
            'kejadian.*.rincian' => ['nullable', 'array', 'max:10'],
        ];
    }
}
