<?php

declare(strict_types=1);

namespace App\Sections\School\Http\Requests;

use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Sekolah;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SimpanKelasRequest extends FormRequest
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
        $sekolahId = Sekolah::query()->value('id');
        $kelas = $this->route('kelas');
        $kelasId = $kelas instanceof Kelas ? $kelas->getKey() : null;

        $aturanNama = [
            'required', 'string', 'min:1', 'max:60',
            Rule::unique('classes', 'nama')
                ->where(fn ($query) => $query->where('school_id', $sekolahId))
                ->ignore($kelasId),
        ];

        return [
            'nama' => $aturanNama,
            'tingkat' => ['required', 'integer', 'min:1', 'max:6'],
            'tahun_ajaran' => ['nullable', 'string', 'max:20'],
        ];
    }

    /**
     * Pesan galat dalam bahasa Indonesia.
     *
     * Sebelumnya guru hanya melihat "The nama has already been taken." — dan
     * nama yang paling wajar diketik (contoh di placeholder formulir) justru
     * sudah ada, jadi guru menyimpulkan halaman kelas rusak padahal kelasnya
     * cuma belum bisa bernama sama. Pesannya kini menyebut sebabnya dan apa yang
     * harus dilakukan.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'nama.required' => 'Nama kelas wajib diisi.',
            'nama.unique' => 'Nama kelas ini sudah dipakai di sekolah ini. Pakai nama lain, misalnya 6C.',
            'nama.max' => 'Nama kelas maksimal 60 karakter.',
            'tingkat.required' => 'Pilih dulu tingkat kelasnya.',
            'tingkat.integer' => 'Tingkat kelas harus berupa angka 1 sampai 6.',
            'tingkat.min' => 'Tingkat kelas paling rendah 1.',
            'tingkat.max' => 'Tingkat kelas paling tinggi 6.',
            'tahun_ajaran.max' => 'Tahun ajaran maksimal 20 karakter.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nama' => is_string($this->input('nama')) ? trim((string) $this->input('nama')) : $this->input('nama'),
        ]);
    }
}
