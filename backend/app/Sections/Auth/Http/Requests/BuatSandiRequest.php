<?php

declare(strict_types=1);

namespace App\Sections\Auth\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Buat kata sandi pertama (akun yang lahir dari tombol Google).
 *
 * Berbeda dengan `GantiSandiRequest`, tidak ada `sandi_sekarang` — memang belum
 * ada sandi milik murid. Penggantinya adalah penjaga di sisi server: sandi hanya
 * bisa dibuat lewat rute ini selama `perlu_buat_sandi` menyala
 * (`AkunService::setelSandiPertama`), sehingga rute ini tidak bisa dipakai
 * melewati pemeriksaan sandi lama.
 */
class BuatSandiRequest extends FormRequest
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
            'password' => ['required', 'string', 'min:10', 'confirmed'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'password.required' => 'Isi kata sandimu dulu ya.',
            'password.min' => 'Kata sandi minimal 10 karakter.',
            'password.confirmed' => 'Ulangi kata sandi dengan isian yang sama.',
        ];
    }

    /**
     * Spasi tepi dibersihkan (satu siklus dengan pendaftaran & ganti sandi)
     * supaya sandi yang tersimpan selalu bisa dipakai masuk.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'password' => trim((string) $this->input('password')),
            'password_confirmation' => trim((string) $this->input('password_confirmation')),
        ]);
    }
}
