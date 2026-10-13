<?php

declare(strict_types=1);

namespace App\Sections\Auth\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Ganti kata sandi sendiri.
 *
 * `sandi_sekarang` wajib ada: tanpa membuktikan sandi lama, sesi yang ditinggal
 * terbuka di komputer lab bisa dipakai orang berikutnya untuk mengunci pemilik
 * akun keluar. Panjang minimal menyamai aturan pendaftaran (10 karakter).
 */
class GantiSandiRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>|string>
     */
    public function rules(): array
    {
        return [
            'sandi_sekarang' => ['required', 'string'],
            'password' => ['required', 'string', 'min:10', 'confirmed'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'sandi_sekarang.required' => 'Isi kata sandi yang sekarang.',
            'password.min' => 'Kata sandi baru minimal 10 karakter.',
            'password.confirmed' => 'Ulangi kata sandi baru dengan isian yang sama.',
        ];
    }

    /**
     * Spasi tepi ikut dibersihkan (satu siklus dengan MasukRequest) supaya sandi
     * yang tersimpan selalu bisa dipakai masuk; sandi lama dibiarkan apa adanya
     * karena yang dicocokkan adalah hash dari isian pengguna.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'password' => trim((string) $this->input('password')),
            'password_confirmation' => trim((string) $this->input('password_confirmation')),
        ]);
    }
}
