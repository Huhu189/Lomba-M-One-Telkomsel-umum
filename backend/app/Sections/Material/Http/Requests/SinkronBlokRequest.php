<?php

declare(strict_types=1);

namespace App\Sections\Material\Http\Requests;

use App\Sections\Material\Enums\TipeBlok;
use App\Sections\Material\Registry\TautanMedia;
use App\Sections\Material\Registry\TemaPerjalanan;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SinkronBlokRequest extends FormRequest
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
            'blok' => ['present', 'array', 'max:200'],
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
            // Saklar layar sesudah kuis sisipan (bawaan mati): ringkasan soal,
            // kartu ingat, dan papan peringkat latihan.
            'blok.*.tampilan.ringkasan' => ['nullable', 'boolean'],
            'blok.*.tampilan.kartu' => ['nullable', 'boolean'],
            'blok.*.tampilan.papan' => ['nullable', 'boolean'],
        ];
    }

    /**
     * Tautan media (14 Okt 2026) diperiksa **di sini**, bukan sebagai aturan
     * bersarang `blok.*.isi.tautan`.
     *
     * Alasannya bukan selera: begitu satu kunci di dalam `isi` punya aturan
     * bersarang, `validated('blok')` hanya mengembalikan kunci bersarang itu —
     * `unggahan_kode`, `keterangan`, `teks`, dan `penjelasan` ikut terbuang, dan
     * seluruh unggahan materi mendadak ditolak sebagai "belum selesai diunggah"
     * (terbukti: 8 tes Slice08/Slice12 merah). Aturan di `after` menjaga bentuk
     * `isi` apa adanya, dan cek tautannya tetap satu sumber di
     * `Registry\TautanMedia`.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var array<int, mixed> $blok */
            $blok = (array) $this->input('blok', []);

            foreach ($blok as $indeks => $satu) {
                $isi = is_array($satu) ? ($satu['isi'] ?? null) : null;
                $tautan = is_array($isi) ? ($isi['tautan'] ?? null) : null;

                if (! is_string($tautan) || trim($tautan) === '') {
                    continue;
                }

                $pesan = mb_strlen(trim($tautan)) > TautanMedia::MAKS
                    ? 'Tautan media terlalu panjang (maksimum '.TautanMedia::MAKS.' karakter).'
                    : 'Tautan media harus alamat https yang bisa dibuka murid (bukan http, alamat lokal, atau alamat bersandi).';

                if (mb_strlen(trim($tautan)) > TautanMedia::MAKS || ! TautanMedia::aman($tautan)) {
                    $validator->errors()->add('blok.'.$indeks.'.isi.tautan', $pesan);
                }
            }
        });
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
