<?php

declare(strict_types=1);

namespace App\Sections\Quiz\Http\Resources;

use App\Sections\Question\Http\Resources\SoalResource;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Kuis untuk guru — boleh memuat susunan soal lengkap dengan kunci.
 *
 * @mixin Kuis
 */
class KuisResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            // Alamat kuis yang dipakai klien: slug acak, bukan id berurutan.
            'slug' => $this->slug,
            'judul' => $this->judul,
            'deskripsi' => $this->deskripsi,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'subject_id' => $this->subject_id,
            'class_id' => $this->class_id,
            // Mapel/kelas boleh belum dipilih selagi kuis masih draf → null.
            'mapel_nama' => $this->whenLoaded('mapel', fn () => $this->mapel?->nama),
            // Kuis tanpa kelas = "Semua kelas". Lewat `relationLoaded`, bukan
            // `whenLoaded`: untuk relasi yang kosong (class_id null), `whenLoaded`
            // mengembalikan null walau relasinya sudah dimuat — daftar kuis lalu
            // menulis "-" untuk kuis yang justru berlaku di semua kelas.
            'kelas_nama' => $this->relationLoaded('kelas') ? $this->namaKelas() : null,
            'mulai_at' => $this->mulai_at?->toIso8601String(),
            'selesai_at' => $this->selesai_at?->toIso8601String(),
            'durasi_menit' => $this->durasi_menit,
            'acak_soal' => $this->acak_soal,
            'acak_opsi' => $this->acak_opsi,
            'jumlah_soal' => $this->whenCounted('soal'),
            'sedang_berjalan' => $this->sedangBerjalan(),
            'soal' => SoalResource::collection($this->whenLoaded('soal')),
        ];
    }
}
