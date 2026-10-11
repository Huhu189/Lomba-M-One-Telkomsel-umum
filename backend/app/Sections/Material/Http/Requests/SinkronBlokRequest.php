<?php

declare(strict_types=1);

namespace App\Sections\Material\Http\Requests;

use App\Sections\Material\Enums\TipeBlok;
use App\Sections\Material\Registry\TemaPerjalanan;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SinkronBlokRequest extends FormRequest
{
    /** Rasio bingkai pratinjau yang diizinkan. */
    public const RASIO = ['16:9', '9:16', '1:1', '4:3'];

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
            'blok' => ['present', 'array', 'max:200'],
            'rasio' => ['nullable', Rule::in(self::RASIO)],
            // Tema perjalanan materi (template tema video: mis. “Mendaki Gunung”).
            'tema' => ['nullable', 'array'],
            'tema.kode' => ['nullable', 'string', Rule::in(TemaPerjalanan::kodeSemua())],
            // Nama boleh kosong: server jatuh ke nama bawaan tema.
            'tema.nama' => ['nullable', 'string', 'max:'.TemaPerjalanan::MAKS_NAMA],
            'tema.video_kode' => ['nullable', 'string', 'max:64'],
            'blok.*.tipe' => ['required', Rule::enum(TipeBlok::class)],
            'blok.*.wajib' => ['nullable', 'boolean'],
            'blok.*.fase' => ['nullable', 'string', 'max:'.TemaPerjalanan::MAKS_LANGKAH],
            'blok.*.isi' => ['nullable', 'array'],
            'blok.*.quiz_id' => ['nullable', 'integer'],
            // Penempatan klip di timeline editor (gaya video editor). Disimpan di
            // dalam kolom JSON `isi`, jadi tidak perlu kolom/migrasi baru.
            'blok.*.track' => ['nullable', 'integer', 'min:0', 'max:20'],
            'blok.*.mulai_detik' => ['nullable', 'numeric', 'min:0', 'max:86400'],
            'blok.*.durasi_detik' => ['nullable', 'numeric', 'min:0', 'max:86400'],
            // Pengaturan tampilan per klip (disimpan di dalam `isi`).
            'blok.*.tampilan' => ['nullable', 'array'],
            'blok.*.tampilan.fit' => ['nullable', Rule::in(['contain', 'cover'])],
            'blok.*.tampilan.fokus_x' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'blok.*.tampilan.fokus_y' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'blok.*.tampilan.zoom' => ['nullable', 'numeric', 'min:1', 'max:3'],
            'blok.*.tampilan.mode' => ['nullable', Rule::in(['jeda', 'berjalan'])],
            'blok.*.tampilan.tata' => ['nullable', Rule::in(['vertikal', 'horizontal'])],
        ];
    }

    public function rasio(): ?string
    {
        $rasio = $this->validated('rasio');

        return is_string($rasio) ? $rasio : null;
    }

    /**
     * Pilihan tema perjalanan, atau `null` bila guru tidak mengirimnya (tema
     * yang sudah tersimpan dibiarkan apa adanya).
     *
     * @return array<string, mixed>|null
     */
    public function tema(): ?array
    {
        $tema = $this->validated('tema');

        return is_array($tema) ? $tema : null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function daftarBlok(): array
    {
        /** @var array<int, array<string, mixed>> $blok */
        $blok = (array) $this->validated('blok');

        return array_values($blok);
    }
}
