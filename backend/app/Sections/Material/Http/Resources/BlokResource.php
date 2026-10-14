<?php

declare(strict_types=1);

namespace App\Sections\Material\Http\Resources;

use App\Sections\Material\Enums\TipeBlok;
use App\Sections\Material\Models\BlokMateri;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Blok materi untuk guru. Blok media menunjuk **salah satu** dari dua sumber:
 * kode berkas unggahan (detail + URL bertanda tangannya ada di daftar
 * `unggahan` materi, jadi satu berkas yang dipakai beberapa blok tetap satu
 * tautan) atau **tautan media** (`tautan`, lihat Registry\TautanMedia) yang
 * tidak diunggah sama sekali.
 *
 * @mixin BlokMateri
 */
class BlokResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $isi = is_array($this->isi) ? $this->isi : [];

        return [
            'block_id' => $this->id,
            'urutan' => $this->urutan,
            'tipe' => $this->tipe->value,
            'tipe_label' => $this->tipe->label(),
            'wajib' => $this->wajib,
            'teks' => $this->tipe === TipeBlok::Teks ? (string) ($isi['teks'] ?? '') : null,
            'unggahan_kode' => $this->tipe === TipeBlok::Media ? ($isi['unggahan_kode'] ?? null) : null,
            // Sumber kedua klip media: alamat https yang diselipkan guru. Yang
            // dikirim balik alamat **aslinya** (bukan alamat sematan) supaya
            // editor menampilkan apa yang guru tempelkan.
            'tautan' => $this->tipe === TipeBlok::Media && is_string($isi['tautan'] ?? null)
                ? $isi['tautan']
                : null,
            'keterangan' => $this->tipe === TipeBlok::Media ? ($isi['keterangan'] ?? null) : null,
            'quiz_id' => $this->quiz_id,
            // Penempatan klip di timeline editor (gaya video editor).
            'track' => (int) ($isi['track'] ?? 0),
            'mulai_detik' => (float) ($isi['mulai_detik'] ?? 0),
            'durasi_detik' => (float) ($isi['durasi_detik'] ?? 0),
            // Pengaturan tampilan: media (fit/fokus/zoom) dan kuis (mode/tata).
            'tampilan' => is_array($isi['tampilan'] ?? null) ? $isi['tampilan'] : null,
            // Nama pos perjalanan yang diberikan guru (kosong = pakai bawaan tema).
            'fase' => is_string($isi['fase'] ?? null) ? $isi['fase'] : null,
            // Penjelasan opsional setelah kuis (blok kuis): teks + kode media.
            // Media memakai pustaka unggahan materi yang sama seperti blok media.
            'penjelasan' => $this->tipe->berkuis() && is_array($isi['penjelasan'] ?? null)
                ? [
                    'teks' => (string) ($isi['penjelasan']['teks'] ?? ''),
                    'unggahan_kode' => is_string($isi['penjelasan']['unggahan_kode'] ?? null)
                        ? $isi['penjelasan']['unggahan_kode']
                        : null,
                ]
                : null,
            'kuis_judul' => $this->whenLoaded('kuis', fn () => $this->kuis->judul),
            'jumlah_soal' => $this->whenLoaded('kuis', fn () => $this->kuis->soal()->count()),
        ];
    }
}
