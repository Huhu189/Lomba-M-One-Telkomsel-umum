<?php

declare(strict_types=1);

namespace App\Sections\Material\Services;

use App\Models\User;
use App\Sections\Material\Enums\StatusMateri;
use App\Sections\Material\Enums\StatusUnggahan;
use App\Sections\Material\Enums\TipeBlok;
use App\Sections\Material\Models\BlokMateri;
use App\Sections\Material\Models\Materi;
use App\Sections\Material\Models\UnggahanMateri;
use App\Sections\Question\Enums\TipeSoal;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Sekolah;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Materi pelajaran: simpan/perbarui/hapus, dan penegakan aturan blok.
 *
 * Aturan blok ditegakkan **di sini (server)**, bukan di form guru: blok kuis
 * hanya boleh menunjuk kuis yang sudah ada di bank soal sekolah yang sama,
 * sudah punya soal, dan tidak memuat soal uraian — sebab kuis sisipan adalah
 * latihan mandiri anak, bukan ulangan yang menunggu koreksi guru.
 */
class MateriService
{
    public function __construct(private readonly PenyimpananMateri $penyimpanan) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function simpan(Sekolah $sekolah, User $pembuat, array $data): Materi
    {
        return Materi::query()->create([
            'school_id' => $sekolah->getKey(),
            'subject_id' => (int) $data['subject_id'],
            'class_id' => (int) $data['class_id'],
            'tag_id' => isset($data['tag_id']) ? (int) $data['tag_id'] : null,
            'judul' => (string) $data['judul'],
            'deskripsi' => $data['deskripsi'] ?? null,
            'status' => StatusMateri::Draf,
            'urutan' => (int) ($data['urutan'] ?? 0),
            'dibuat_oleh' => $pembuat->getKey(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function perbarui(Materi $materi, array $data): Materi
    {
        $materi->fill([
            'subject_id' => (int) ($data['subject_id'] ?? $materi->subject_id),
            'class_id' => (int) ($data['class_id'] ?? $materi->class_id),
            'tag_id' => array_key_exists('tag_id', $data)
                ? ($data['tag_id'] === null ? null : (int) $data['tag_id'])
                : $materi->tag_id,
            'judul' => (string) ($data['judul'] ?? $materi->judul),
            'deskripsi' => $data['deskripsi'] ?? $materi->deskripsi,
            'urutan' => (int) ($data['urutan'] ?? $materi->urutan),
        ])->save();

        return $materi->refresh();
    }

    /** Hapus materi beserta berkas fisiknya. */
    public function hapus(Materi $materi): void
    {
        foreach (UnggahanMateri::query()->where('material_id', $materi->getKey())->get() as $unggahan) {
            $this->penyimpanan->hapus($unggahan);
        }

        $materi->delete();
    }

    /**
     * Ganti seluruh urutan blok materi.
     *
     * Blok dicocokkan berdasarkan nomor urut (bukan dihapus lalu dibuat ulang),
     * supaya progres murid pada blok yang tidak berubah tidak ikut terhapus.
     *
     * @param  array<int, array<string, mixed>>  $blok
     *
     * @throws ValidationException
     */
    public function sinkronBlok(Materi $materi, array $blok): Materi
    {
        $bersih = array_values($blok);

        DB::transaction(function () use ($materi, $bersih): void {
            foreach ($bersih as $indeks => $satu) {
                $urutan = $indeks + 1;
                $tipe = TipeBlok::from((string) ($satu['tipe'] ?? ''));

                $isi = null;
                $kuisId = null;

                if ($tipe->berkuis()) {
                    $kuisId = $this->validasiKuis($materi, (int) ($satu['quiz_id'] ?? 0));
                } else {
                    $isi = $this->validasiIsi($materi, $tipe, (array) ($satu['isi'] ?? []));
                }

                BlokMateri::query()->updateOrCreate(
                    ['material_id' => $materi->getKey(), 'urutan' => $urutan],
                    [
                        'tipe' => $tipe,
                        'wajib' => (bool) ($satu['wajib'] ?? true),
                        'isi' => $isi,
                        'quiz_id' => $kuisId,
                    ],
                );
            }

            BlokMateri::query()
                ->where('material_id', $materi->getKey())
                ->where('urutan', '>', count($bersih))
                ->delete();
        });

        return $materi->refresh()->load(['blok.kuis']);
    }

    /**
     * Materi hanya bisa terbit bila sudah punya blok.
     *
     * @throws ValidationException
     */
    public function publikasi(Materi $materi): Materi
    {
        if (! $materi->blok()->exists()) {
            throw ValidationException::withMessages([
                'blok' => 'Materi belum punya blok apa pun; tambahkan minimal satu blok.',
            ]);
        }

        $materi->forceFill([
            'status' => StatusMateri::Publikasi,
            'publikasi_at' => now(),
        ])->save();

        return $materi->refresh();
    }

    public function arsipkan(Materi $materi): Materi
    {
        $materi->forceFill(['status' => StatusMateri::Arsip])->save();

        return $materi->refresh();
    }

    /**
     * @throws ValidationException
     */
    private function validasiKuis(Materi $materi, int $kuisId): int
    {
        $kuis = Kuis::query()->with('soal')->find($kuisId);

        if ($kuis === null || (int) $kuis->school_id !== (int) $materi->school_id) {
            throw ValidationException::withMessages(['blok' => 'Kuis sisipan harus kuis yang ada di bank soal sekolah ini.']);
        }

        if ((int) $kuis->class_id !== (int) $materi->class_id) {
            throw ValidationException::withMessages(['blok' => 'Kuis sisipan harus kuis untuk kelas materi ini.']);
        }

        if ($kuis->soal->isEmpty()) {
            throw ValidationException::withMessages(['blok' => 'Kuis sisipan belum punya soal.']);
        }

        foreach ($kuis->soal as $soal) {
            $tipe = $soal->tipeAman();

            if ($tipe === null || $tipe === TipeSoal::Uraian) {
                throw ValidationException::withMessages([
                    'blok' => 'Kuis sisipan hanya boleh berisi soal objektif dan isian singkat ('.$soal->tipe->value.').',
                ]);
            }
        }

        return (int) $kuis->getKey();
    }

    /**
     * @param  array<string, mixed>  $isi
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    private function validasiIsi(Materi $materi, TipeBlok $tipe, array $isi): array
    {
        if ($tipe === TipeBlok::Teks) {
            $teks = trim((string) ($isi['teks'] ?? ''));

            if ($teks === '') {
                throw ValidationException::withMessages(['blok' => 'Blok teks tidak boleh kosong.']);
            }

            return ['teks' => mb_substr($teks, 0, 20000)];
        }

        $kode = trim((string) ($isi['unggahan_kode'] ?? ''));

        $unggahan = UnggahanMateri::query()
            ->where('kode', $kode)
            ->where('school_id', $materi->school_id)
            ->where('status', StatusUnggahan::Selesai->value)
            ->first();

        if ($unggahan === null) {
            throw ValidationException::withMessages(['blok' => 'Berkas media belum selesai diunggah.']);
        }

        return [
            'unggahan_kode' => (string) $unggahan->kode,
            'keterangan' => mb_substr(trim((string) ($isi['keterangan'] ?? '')), 0, 255),
        ];
    }
}
