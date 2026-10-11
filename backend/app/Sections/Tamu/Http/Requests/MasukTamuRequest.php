<?php

declare(strict_types=1);

namespace App\Sections\Tamu\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Formulir masuk siswa tamu — cukup nama, tanpa email/kata sandi.
 *
 * Nama divalidasi setelah dirapikan (spasi berlebih dirapatkan, karakter
 * kendali dibuang), jadi " A " ditolak sebagai nama satu huruf dan bukan lolos
 * sebagai tiga karakter.
 *
 * `kode_perangkat` opsional: klien yang punya menyimpan kode unik perangkatnya
 * dan mengirimnya supaya masuk lagi memakai akun yang sama. Bentuknya dibatasi
 * ketat karena kode itu menjadi kunci akun tamu dan kunci pembatas laju.
 */
class MasukTamuRequest extends FormRequest
{
    /** Jalur publik: calon tamu memang belum punya sesi. */
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
            'nama' => ['required', 'string', 'min:2', 'max:60'],
            'kode_perangkat' => ['nullable', 'string', 'min:8', 'max:128', 'regex:/^[A-Za-z0-9._:-]+$/'],
        ];
    }

    /**
     * Rapikan dulu, baru nilai. Karakter kendali (baris baru, tab, penanda arah
     * tulisan) dibuang supaya nama rapi di laporan dan tidak bisa dipakai
     * memalsukan baris tabel.
     */
    protected function prepareForValidation(): void
    {
        $nama = (string) $this->input('nama');
        $tanpaKendali = preg_replace('/[\p{Cc}\p{Cf}]+/u', ' ', $nama) ?? '';

        $this->merge([
            'nama' => trim((string) preg_replace('/\s+/u', ' ', $tanpaKendali)),
        ]);
    }

    /**
     * Pesan ramah anak untuk kasus yang paling sering terjadi.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'nama.required' => 'Tulis namamu dulu ya.',
            'nama.min' => 'Nama minimal 2 huruf.',
            'nama.max' => 'Nama maksimal 60 huruf.',
            // Kode perangkat dibuat klien, jadi galat ini hanya muncul kalau ada
            // yang mengutak-atik: pengguna cukup diminta masuk ulang.
            'kode_perangkat.regex' => 'Kode perangkat tidak dikenal. Muat ulang halaman lalu coba lagi.',
        ];
    }
}
