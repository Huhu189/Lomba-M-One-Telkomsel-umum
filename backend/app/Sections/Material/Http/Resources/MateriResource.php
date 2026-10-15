<?php

declare(strict_types=1);

namespace App\Sections\Material\Http\Resources;

use App\Sections\Material\Models\Materi;
use App\Sections\Material\Registry\TemaPerjalanan;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Materi untuk guru — memuat urutan blok dan berkas yang sudah diunggah.
 *
 * @mixin Materi
 */
class MateriResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'judul' => $this->judul,
            'deskripsi' => $this->deskripsi,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'subject_id' => $this->subject_id,
            'class_id' => $this->class_id,
            'tag_id' => $this->tag_id,
            'urutan' => $this->urutan,
            'mapel_nama' => $this->whenLoaded('mapel', fn () => $this->mapel->nama),
            // Materi tanpa kelas = "Semua kelas". Dihitung lewat `relationLoaded`,
            // BUKAN `whenLoaded(...)`: untuk relasi yang kosong (kelasnya null),
            // `whenLoaded` mengembalikan null walau relasinya sudah dimuat — jadi
            // daftar materi menampilkan "-" untuk materi yang berlaku di semua
            // kelas, tepat di layar yang paling perlu mengatakannya (15 Okt 2026).
            'kelas_nama' => $this->relationLoaded('kelas') ? $this->namaKelas() : null,
            'tema_nama' => $this->whenLoaded('tag', fn () => $this->tag?->nama),
            'publikasi_at' => $this->publikasi_at?->toIso8601String(),
            'jumlah_blok' => $this->whenCounted('blok'),
            // Tema perjalanan: pilihan mentah guru + konfigurasi lengkap (nama
            // bawaan fase/tingkat) supaya editor bisa menggambar peta sebelum
            // perubahan disimpan.
            'tema' => $this->tema,
            'perjalanan' => TemaPerjalanan::konfigurasi($this->tema),
            'blok' => BlokResource::collection($this->whenLoaded('blok')),
            'unggahan' => UnggahanResource::collection($this->whenLoaded('unggahan')),
        ];
    }
}
