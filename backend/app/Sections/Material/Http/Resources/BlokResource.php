<?php

declare(strict_types=1);

namespace App\Sections\Material\Http\Resources;

use App\Sections\Material\Enums\TipeBlok;
use App\Sections\Material\Models\BlokMateri;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Blok materi untuk guru. Blok media hanya menunjuk kode berkas; detail dan URL
 * bertanda tangannya ada di daftar `unggahan` materi, jadi satu berkas yang
 * dipakai beberapa blok tetap satu tautan.
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
            'keterangan' => $this->tipe === TipeBlok::Media ? ($isi['keterangan'] ?? null) : null,
            'quiz_id' => $this->quiz_id,
            // Penempatan klip di timeline editor (gaya video editor).
            'track' => (int) ($isi['track'] ?? 0),
            'mulai_detik' => (float) ($isi['mulai_detik'] ?? 0),
            'durasi_detik' => (float) ($isi['durasi_detik'] ?? 0),
            'kuis_judul' => $this->whenLoaded('kuis', fn () => $this->kuis->judul),
            'jumlah_soal' => $this->whenLoaded('kuis', fn () => $this->kuis->soal()->count()),
        ];
    }
}
