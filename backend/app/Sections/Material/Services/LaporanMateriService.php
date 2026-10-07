<?php

declare(strict_types=1);

namespace App\Sections\Material\Services;

use App\Sections\Attempt\Enums\StatusAttempt;
use App\Sections\Material\Models\Materi;
use App\Sections\Material\Models\ProgresMateri;
use App\Sections\Report\Services\LaporanTagService;
use App\Sections\School\Models\Murid;

/**
 * Laporan materi untuk guru: siapa sudah menempuh sampai mana, dan bagaimana
 * pemahaman tema anak-anak dari **kuis sisipan latihan**.
 *
 * Skor latihan sengaja hanya hidup di laporan tema materi — tidak masuk
 * ranking dan tidak pernah menyentuh skor asli ulangan (aturan F2), sebab
 * latihan boleh diulang sebebasnya dan itu justru tujuannya.
 */
class LaporanMateriService
{
    public function __construct(private readonly LaporanTagService $tag) {}

    /**
     * @return array<string, mixed>
     */
    public function untukMateri(Materi $materi): array
    {
        $materi->loadMissing(['kelas', 'mapel', 'tag', 'blok.kuis.soal.tag']);

        $ambang = $this->tag->ambang((int) $materi->school_id, (int) $materi->class_id, null);
        $blok = $materi->blok;

        $murid = Murid::query()
            ->where('class_id', $materi->class_id)
            ->with('user')
            ->orderBy('id')
            ->get();

        $progres = ProgresMateri::query()
            ->where('material_id', $materi->getKey())
            ->with(['attempt.jawaban'])
            ->get()
            ->groupBy('student_id');

        $daftar = [];

        foreach ($murid as $satuMurid) {
            $barisMurid = $progres->get($satuMurid->getKey()) ?? collect();

            $perBlok = [];
            $temaMentah = [];
            $jumlahWajib = 0;
            $selesaiWajib = 0;
            $skorLatihan = 0.0;
            $skorMaksimal = 0.0;

            foreach ($blok as $satuBlok) {
                $baris = $barisMurid->firstWhere('block_id', $satuBlok->getKey());
                $status = $baris?->status->value ?? 'belum';

                if ($satuBlok->wajib) {
                    $jumlahWajib++;

                    if ($status === 'selesai') {
                        $selesaiWajib++;
                    }
                }

                $attempt = $baris?->attempt;

                if ($satuBlok->tipe->berkuis() && $attempt !== null && $attempt->status === StatusAttempt::Selesai) {
                    $skorLatihan += (float) $attempt->skor;
                    $skorMaksimal += (float) $attempt->skor_maksimal;

                    $jawaban = $attempt->jawaban->keyBy('question_id');

                    foreach ($satuBlok->kuis?->soal ?? [] as $soal) {
                        $tag = $soal->tag;

                        if ($tag === null) {
                            continue;
                        }

                        $kunci = (int) $tag->getKey();

                        $temaMentah[$kunci] ??= [
                            'tag_id' => $kunci,
                            'tag_nama' => $tag->nama,
                            'jumlah_soal' => 0,
                            'jumlah_benar' => 0,
                        ];

                        $temaMentah[$kunci]['jumlah_soal']++;

                        if ($jawaban->get($soal->getKey())?->benar === true) {
                            $temaMentah[$kunci]['jumlah_benar']++;
                        }
                    }
                }

                $perBlok[] = [
                    'block_id' => $satuBlok->getKey(),
                    'urutan' => $satuBlok->urutan,
                    'tipe' => $satuBlok->tipe->value,
                    'tipe_label' => $satuBlok->tipe->label(),
                    'wajib' => $satuBlok->wajib,
                    'status' => $status,
                    'status_label' => $baris?->status->label() ?? 'Belum dibuka',
                    'skor' => (float) ($baris->skor ?? 0),
                    'attempt_id' => $baris?->attempt_id,
                    'dikumpulkan_at' => $attempt?->dikumpulkan_at?->toIso8601String(),
                ];
            }

            $tema = [];

            foreach ($temaMentah as $satuTema) {
                $persen = (int) $satuTema['jumlah_soal'] > 0
                    ? round((int) $satuTema['jumlah_benar'] / (int) $satuTema['jumlah_soal'] * 100, 1)
                    : 0.0;

                $tingkat = $this->tag->tingkat((int) $satuTema['jumlah_soal'], $persen, $ambang);

                $tema[] = [
                    'tag_id' => $satuTema['tag_id'],
                    'tag_nama' => $satuTema['tag_nama'],
                    'jumlah_soal' => $satuTema['jumlah_soal'],
                    'jumlah_benar' => $satuTema['jumlah_benar'],
                    'persen' => $persen,
                    'tingkat' => $tingkat,
                    'tingkat_label' => LaporanTagService::labelTingkat($tingkat),
                ];
            }

            // Terlemah dulu supaya guru langsung menunjuk tema kritis.
            usort($tema, static fn (array $a, array $b): int => $a['persen'] <=> $b['persen']);

            $daftar[] = [
                'murid_id' => (int) $satuMurid->getKey(),
                'nama' => $satuMurid->user?->name,
                'blok_selesai' => (int) collect($perBlok)->where('status', 'selesai')->count(),
                'jumlah_blok' => count($perBlok),
                'selesai_wajib' => $selesaiWajib,
                'jumlah_wajib' => $jumlahWajib,
                'skor_latihan' => round($skorLatihan, 2),
                'skor_latihan_maksimal' => round($skorMaksimal, 2),
                'tema' => $tema,
                'blok' => $perBlok,
            ];
        }

        $blokRingkas = [];

        foreach ($blok as $satuBlok) {
            $blokRingkas[] = [
                'block_id' => $satuBlok->getKey(),
                'urutan' => $satuBlok->urutan,
                'tipe' => $satuBlok->tipe->value,
                'tipe_label' => $satuBlok->tipe->label(),
                'wajib' => $satuBlok->wajib,
                'kuis_id' => $satuBlok->quiz_id,
                'kuis_judul' => $satuBlok->kuis?->judul,
            ];
        }

        return [
            'materi' => [
                'id' => $materi->getKey(),
                'judul' => $materi->judul,
                'status' => $materi->status->value,
                'mapel_nama' => $materi->mapel?->nama,
                'kelas_nama' => $materi->kelas?->nama,
                'tema_nama' => $materi->tag?->nama,
            ],
            'ambang' => $ambang,
            'blok' => $blokRingkas,
            'murid' => $daftar,
        ];
    }
}
