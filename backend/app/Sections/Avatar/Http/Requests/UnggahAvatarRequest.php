<?php

declare(strict_types=1);

namespace App\Sections\Avatar\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Unggah satu gambar avatar. Isinya boleh dikirim dua cara: sebagai `berkas`
 * (unggahan multipart, jalur klien sungguhan) atau `isi_base64` (jalur yang
 * ramah pengujian dan klien non-browser).
 *
 * Aturan `mimes` di sini hanya saringan awal berbasis nama/tipe kiriman.
 * Keputusan sesungguhnya ada di `PenyimpananAvatar`, yang membaca magic bytes
 * isi berkas: SVG tetap ditolak walau namanya `.png`.
 */
class UnggahAvatarRequest extends FormRequest
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
        $batasKb = max(1, (int) ceil(((int) config('avatar.ukuran_maks')) / 1024));

        return [
            'berkas' => ['nullable', 'file', 'max:'.$batasKb],
            'isi_base64' => ['nullable', 'string'],
        ];
    }

    /** Isi berkas mentah dari salah satu jalur kiriman. */
    public function isi(): string
    {
        $berkas = $this->file('berkas');

        if ($berkas !== null) {
            return (string) file_get_contents($berkas->getRealPath());
        }

        $base64 = (string) $this->input('isi_base64', '');

        if ($base64 === '') {
            return '';
        }

        // Terima base64 standar maupun varian URL-safe, dengan atau tanpa padding.
        $base64 = strtr($base64, '-_', '+/');
        $sisa = strlen($base64) % 4;

        if ($sisa !== 0) {
            $base64 .= str_repeat('=', 4 - $sisa);
        }

        $isi = base64_decode($base64, true);

        return $isi === false ? '' : $isi;
    }

    protected function prepareForValidation(): void
    {
        // Kiriman yang tidak menyertakan keduanya ditolak dengan pesan yang jelas.
        if ($this->file('berkas') === null && trim((string) $this->input('isi_base64', '')) === '') {
            $this->merge(['isi_base64' => null]);
        }
    }
}
