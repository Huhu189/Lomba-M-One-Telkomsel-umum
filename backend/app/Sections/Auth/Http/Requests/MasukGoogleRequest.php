<?php

declare(strict_types=1);

namespace App\Sections\Auth\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Masuk lewat Google: klien mengirim **ID token** (JWT) dari Google Identity
 * Services di kolom `credential`.
 *
 * Yang diperiksa di sini hanya bentuknya (ada, berupa teks, tidak bukan-bukan).
 * Isi token — tanda tangan, penerbit, audiens, dan email — diperiksa di
 * `GoogleIdTokenVerifier`; validasi request tidak boleh disalahartikan sebagai
 * bukti keaslian.
 */
class MasukGoogleRequest extends FormRequest
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
            // ID token Google sekitar 1 KB; batas 4 KB cukup longgar untuk
            // perubahan format, tetapi tetap menutup kiriman besar yang sia-sia.
            'credential' => ['required', 'string', 'max:4096'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'credential.required' => 'Google tidak mengirim data masuk. Tekan tombolnya sekali lagi ya.',
            'credential.string' => 'Masuk dengan Google tidak bisa dipakai kali ini. Coba lagi ya.',
        ];
    }
}
