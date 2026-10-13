<?php

declare(strict_types=1);

namespace App\Sections\Admin\Http\Requests;

use App\Sections\Admin\Services\AkunSekolahService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Setel ulang kata sandi akun guru/murid (admin sekolah).
 *
 * Panjang minimum 10 karakter mengikuti aturan sandi aplikasi (AGENT.md
 * prinsip keamanan #9), dan harus diketik dua kali supaya admin tidak mengunci
 * murid dengan sandi yang ia sendiri salah ketik.
 */
class SetelSandiAkunRequest extends FormRequest
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
            'password' => ['required', 'string', 'min:10', 'max:120', 'confirmed'],
            'alasan' => ['required', 'string', 'min:'.AkunSekolahService::ALASAN_MIN, 'max:500'],
            'token' => ['required', 'string', 'max:120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'password.required' => 'Kata sandi baru wajib diisi.',
            'password.min' => 'Kata sandi minimal 10 karakter.',
            'password.confirmed' => 'Ulangi kata sandi baru dengan isi yang sama.',
            'alasan.required' => 'Tulis alasan setel ulang sandi ini.',
            'alasan.min' => 'Alasan minimal '.AkunSekolahService::ALASAN_MIN.' karakter.',
            'token.required' => 'Token konfirmasi wajib ada. Minta token dulu.',
        ];
    }
}
