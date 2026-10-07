<?php

declare(strict_types=1);

namespace App\Sections\Material\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Satu potongan berkas. Isi boleh dikirim dua cara: sebagai `potongan` (unggahan
 * multipart, jalur yang dipakai klien sungguhan) atau `isi_base64` (jalur yang
 * ramah pengujian dan klien non-browser).
 */
class SimpanPotonganRequest extends FormRequest
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
            'potongan' => ['nullable', 'file', 'max:10240'],
            'isi_base64' => ['nullable', 'string'],
            'hash' => ['nullable', 'string', 'size:64'],
        ];
    }

    public function isi(): string
    {
        $berkas = $this->file('potongan');

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
}
