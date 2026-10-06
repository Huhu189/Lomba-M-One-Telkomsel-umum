<?php

declare(strict_types=1);

namespace App\Sections\Settings\Http\Requests;

use App\Sections\School\Models\Kelas;
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Enums\LingkupPengaturan;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SimpanPengaturanRequest extends FormRequest
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
            'lingkup' => ['required', Rule::enum(LingkupPengaturan::class)],
            'lingkup_id' => ['nullable', 'integer', 'min:1'],
            'kunci' => ['required', Rule::enum(KunciPengaturan::class)],
            'nilai' => ['required'],
            'terkunci' => ['sometimes', 'boolean'],
            'kelas_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'kuis_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }

    /**
     * Validasi tipe nilai dan kelengkapan lingkup_id.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $lingkup = LingkupPengaturan::tryFrom((string) $this->input('lingkup'));
                $kunci = KunciPengaturan::tryFrom((string) $this->input('kunci'));

                if ($lingkup === null || $kunci === null) {
                    return;
                }

                $nilai = $this->input('nilai');

                if ($kunci->tipe() === 'boolean' && ! is_bool($nilai)) {
                    $validator->errors()->add('nilai', 'Nilai harus berupa benar/salah.');
                }

                if ($kunci->tipe() === 'integer') {
                    $angka = is_int($nilai) || (is_string($nilai) && ctype_digit($nilai)) ? (int) $nilai : null;

                    if ($angka === null) {
                        $validator->errors()->add('nilai', 'Nilai harus berupa bilangan bulat.');
                    } elseif ($angka < 0) {
                        $validator->errors()->add('nilai', 'Nilai tidak boleh negatif.');
                    } elseif ($angka > 100 && in_array($kunci, [KunciPengaturan::AmbangPaham, KunciPengaturan::AmbangMulaiPaham], true)) {
                        // Ambang laporan adalah persentase.
                        $validator->errors()->add('nilai', 'Ambang pemahaman harus 0–100.');
                    }
                }

                if ($lingkup !== LingkupPengaturan::Sekolah && ! $this->filled('lingkup_id')) {
                    $validator->errors()->add('lingkup_id', 'Lingkup ID wajib untuk pengaturan kelas/kuis.');
                }

                if ($lingkup === LingkupPengaturan::Kelas
                    && $this->filled('lingkup_id')
                    && ! Kelas::query()->whereKey($this->integer('lingkup_id'))->exists()) {
                    $validator->errors()->add('lingkup_id', 'Kelas tidak ditemukan.');
                }
            },
        ];
    }
}
