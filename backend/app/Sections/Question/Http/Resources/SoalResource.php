<?php

declare(strict_types=1);

namespace App\Sections\Question\Http\Resources;

use App\Sections\Question\Models\Soal;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Soal untuk guru — memuat kunci jawaban.
 * Jalur murid memakai SoalMuridResource (tanpa kunci).
 *
 * @mixin Soal
 */
class SoalResource extends JsonResource
{
    /**
     * Sedang dipakai kuis yang berjalan?
     *
     * Dikirim ke editor supaya guru tahu aturannya **sebelum** menekan Simpan —
     * sejak 12 Oktober 2026 isi soal masih boleh diperbaiki saat ulangan jalan,
     * sementara kunci/skor/jenis soal tidak. Nilainya dibaca dari penanda yang
     * dihitung daftar bank soal (`withExists`) supaya satu halaman 50 soal tidak
     * menembak satu kueri per baris; kalau penandanya tidak ada (mis. satu soal
     * yang baru disimpan), barulah dijaga modelnya.
     */
    private function terkunci(): bool
    {
        $atribut = $this->resource->getAttributes();

        if (array_key_exists('dipakai_kuis_berjalan', $atribut)) {
            return (bool) $atribut['dipakai_kuis_berjalan'];
        }

        return $this->resource->terkunci();
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'subject_id' => $this->subject_id,
            'tag_id' => $this->tag_id,
            'tipe' => $this->tipe->value,
            'tipe_label' => $this->tipe->label(),
            'objektif' => $this->tipe->objektif(),
            'konten' => $this->konten,
            'kunci' => $this->kunci,
            'pembahasan' => $this->pembahasan,
            'skor' => $this->skor,
            'aktif' => $this->aktif,
            'terkunci' => $this->terkunci(),
            'mapel_nama' => $this->whenLoaded('mapel', fn () => $this->mapel->nama),
            'tag_nama' => $this->whenLoaded('tag', fn () => $this->tag?->nama),
        ];
    }
}
