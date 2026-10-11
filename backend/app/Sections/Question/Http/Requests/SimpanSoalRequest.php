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
     * Rapikan kiriman klien sebelum divalidasi registry.
     */
    protected function prepareForValidation(): void
    {
        $konten = $this->input('konten');

        if (! is_array($konten)) {
            return;
        }

        // `ConvertEmptyStringsToNull` (middleware bawaan Laravel) mengubah kotak
        // teka silang mini yang kosong dari `''` menjadi `null`, sehingga registry
        // menolaknya dengan "Kotak teka silang hanya boleh '' atau '#'" — guru
        // jadi tidak bisa menyimpan soal teka silang sama sekali. Kotak kosong
        // dikembalikan ke `''` supaya bentuk yang tersimpan tetap seperti yang
        // didokumentasikan registry (`''` = diisi murid, `'#'` = kotak hitam).
        if (isset($konten['grid']) && is_array($konten['grid'])) {
            $konten['grid'] = array_map(
                static fn (mixed $baris): mixed => is_array($baris)
                    ? array_map(static fn (mixed $kotak): mixed => $kotak ?? '', $baris)
                    : $baris,
                $konten['grid'],
            );
        }

        // Bersihkan teks soal dari spasi berlebih di ujung.
        if (isset($konten['teks']) && is_string($konten['teks'])) {
            $konten['teks'] = trim($konten['teks']);
        }

        $this->merge(['konten' => $konten]);
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
