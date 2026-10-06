<?php

declare(strict_types=1);

namespace App\Sections\Question\Http\Requests;

use App\Sections\Question\Enums\TipeSoal;
use App\Sections\Question\Registry\RegistryTipeSoal;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SimpanSoalRequest extends FormRequest
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
            'subject_id' => ['required', 'integer', Rule::exists('subjects', 'id')],
            'tag_id' => ['nullable', 'integer', Rule::exists('tags', 'id')],
            'tipe' => ['required', 'string', Rule::in(RegistryTipeSoal::semuaNilai())],
            'konten' => ['required', 'array'],
            'kunci' => ['required', 'array'],
            'pembahasan' => ['nullable', 'string', 'max:500'],
            'skor' => ['nullable', 'integer', 'min:1', 'max:100'],
            'aktif' => ['nullable', 'boolean'],
        ];
    }

    /**
     * Validasi struktur isi soal + kunci oleh registry tipe soal.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $tipe = TipeSoal::tryFrom((string) $this->input('tipe'));

                if ($tipe === null) {
                    return;
                }

                if (! $tipe->objektif()) {
                    $validator->errors()->add('tipe', 'Tipe soal ini belum didukung; tahap sekarang hanya soal objektif.');

                    return;
                }

                $konten = $this->input('konten');
                $kunci = $this->input('kunci');

                if (! is_array($konten) || ! is_array($kunci)) {
                    return;
                }

                foreach (RegistryTipeSoal::validasi($tipe, $this->asStringKeyed($konten), $this->asStringKeyed($kunci)) as $pesan) {
                    $validator->errors()->add('konten', $pesan);
                }
            },
        ];
    }

    /**
     * Bersihkan teks soal/opsi dari spasi berlebih di ujung.
     */
    protected function prepareForValidation(): void
    {
        $konten = $this->input('konten');

        if (is_array($konten) && isset($konten['teks']) && is_string($konten['teks'])) {
            $konten['teks'] = trim($konten['teks']);
            $this->merge(['konten' => $konten]);
        }
    }

    /**
     * @param  array<mixed>  $data
     * @return array<string, mixed>
     */
    private function asStringKeyed(array $data): array
    {
        $hasil = [];

        foreach ($data as $kunci => $nilai) {
            $hasil[(string) $kunci] = $nilai;
        }

        return $hasil;
    }
}
