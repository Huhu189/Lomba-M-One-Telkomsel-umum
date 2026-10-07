<?php

declare(strict_types=1);

namespace App\Sections\Material\Services;

use App\Models\User;
use App\Sections\Attempt\Enums\JenisAttempt;
use App\Sections\Attempt\Enums\StatusAttempt;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Services\AttemptService;
use App\Sections\Material\Enums\StatusMateri;
use App\Sections\Material\Enums\StatusProgres;
use App\Sections\Material\Enums\TipeBlok;
use App\Sections\Material\Models\BlokMateri;
use App\Sections\Material\Models\Materi;
use App\Sections\Material\Models\ProgresMateri;
use App\Sections\Material\Models\UnggahanMateri;
use App\Sections\School\Models\Murid;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Perjalanan murid menembus materi berblok.
 *
 * Dua hal yang ditegakkan server:
 *
 * 1. **Urutan blok wajib.** Murid tidak bisa melompati blok wajib; klien tidak
 *    dipercaya menentukan boleh-tidaknya. Kalau tidak, seluruh desain "materi
 *    berurutan" hanya jadi hiasan di layar.
 * 2. **Kuis sisipan lewat mesin kuis yang sama.** Saat murid mencapai blok
 *    kuis, server yang membuat attempt bertipe `latihan` (bukan klien menyusun
 *    soal sendiri), sehingga penilaian, retry, dan batas percobaan mengikuti
 *    pengaturan tiga lapis yang sudah ada. Latihan tidak pernah menyentuh skor
 *    asli ulangan maupun ranking.
 */
class ProgresMateriService
{
    public function __construct(
        private readonly AttemptService $attempt,
        private readonly PenyimpananMateri $penyimpanan,
    ) {}

    /**
     * Materi terbit untuk kelas murid.
     *
     * @return Collection<int, Materi>
     */
    public function daftarMurid(User $murid): Collection
    {
        $profil = $murid->murid;

        if ($profil === null) {
            return new Collection;
        }

        return Materi::query()
            ->where('class_id', $profil->class_id)
            ->where('status', StatusMateri::Publikasi->value)
            ->with(['mapel', 'tag'])
            ->withCount('blok')
            ->orderBy('urutan')
            ->orderBy('id')
            ->get();
    }

    /**
     * Ringkasan progres murid pada satu materi (untuk halaman murid).
     *
     * @return array<string, mixed>
     */
    public function ringkasan(Materi $materi, User $murid): array
    {
        $profil = $this->profil($materi, $murid);
        $materi->loadMissing(['mapel', 'tag', 'blok']);
        $selesai = $this->petaProgres($materi, $profil);

        $blok = [];

        foreach ($materi->blok as $satu) {
            $progres = $selesai[$satu->getKey()] ?? null;

            $blok[] = [
                'block_id' => $satu->getKey(),
                'urutan' => $satu->urutan,
                'tipe' => $satu->tipe->value,
                'tipe_label' => $satu->tipe->label(),
                'wajib' => $satu->wajib,
                'status' => $progres?->status->value ?? 'belum',
                'status_label' => $progres?->status->label() ?? 'Belum dibuka',
                'skor' => (float) ($progres->skor ?? 0),
            ];
        }

        $jumlahWajib = $materi->blok->where('wajib', true)->count();
        $selesaiWajib = collect($blok)->where('status', StatusProgres::Selesai->value)->where('wajib', true)->count();

        return [
            'materi' => [
                'id' => $materi->getKey(),
                'judul' => $materi->judul,
                'deskripsi' => $materi->deskripsi,
                'mapel_nama' => $materi->mapel?->nama,
                'tema_nama' => $materi->tag?->nama,
            ],
            'blok' => $blok,
            'jumlah_blok' => count($blok),
            'selesai_wajib' => $selesaiWajib,
            'jumlah_wajib' => $jumlahWajib,
            'persen' => $jumlahWajib > 0 ? (int) round($selesaiWajib / $jumlahWajib * 100) : 0,
        ];
    }

    /**
     * Buka satu blok: tegakkan urutan, tandai dibuka, dan bila blok kuis
     * langsung buat attempt latihan lewat mesin kuis.
     *
     * @return array{blok: array<string, mixed>, attempt: Attempt|null}
     *
     * @throws ValidationException
     */
    public function buka(Materi $materi, BlokMateri $blok, User $murid): array
    {
        $profil = $this->profil($materi, $murid);
        $this->pastikanBlok($materi, $blok);
        $this->pastikanUrutan($materi, $blok, $profil);

        // Relasi dimuat lebih dulu: repo ini mematikan lazy loading di luar
        // produksi, dan blok kuis selalu butuh kuisnya.
        $blok->loadMissing('kuis');

        $progres = ProgresMateri::query()->firstOrCreate(
            ['block_id' => $blok->getKey(), 'student_id' => $profil->getKey()],
            [
                'school_id' => $materi->school_id,
                'material_id' => $materi->getKey(),
                'status' => StatusProgres::Dibuka,
            ],
        );

        $attempt = null;

        if ($blok->tipe->berkuis() && $blok->kuis !== null) {
            $attempt = $this->attempt->mulai($blok->kuis, $murid, JenisAttempt::Latihan);

            if ((int) $progres->attempt_id !== (int) $attempt->getKey()) {
                $progres->forceFill(['attempt_id' => $attempt->getKey()])->save();
            }
        }

        return [
            'blok' => $this->payloadBlok($blok, $progres),
            'attempt' => $attempt,
        ];
    }

    /**
     * Tandai blok selesai. Blok kuis hanya boleh ditutup setelah latihannya
     * dikumpulkan — skor latihan itulah yang masuk laporan tema.
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function selesai(Materi $materi, BlokMateri $blok, User $murid): array
    {
        $profil = $this->profil($materi, $murid);
        $this->pastikanBlok($materi, $blok);
        $this->pastikanUrutan($materi, $blok, $profil);
        $blok->loadMissing('kuis');

        $progres = ProgresMateri::query()->firstOrCreate(
            ['block_id' => $blok->getKey(), 'student_id' => $profil->getKey()],
            [
                'school_id' => $materi->school_id,
                'material_id' => $materi->getKey(),
                'status' => StatusProgres::Dibuka,
            ],
        );

        $skor = 0.0;

        if ($blok->tipe->berkuis()) {
            $attempt = $progres->attempt_id === null
                ? null
                : Attempt::query()->find($progres->attempt_id);

            if ($attempt === null) {
                throw ValidationException::withMessages(['blok' => 'Latihan belum dimulai; buka blok ini dulu.']);
            }

            if ($attempt->status !== StatusAttempt::Selesai) {
                throw ValidationException::withMessages([
                    'blok' => 'Kumpulkan latihan dulu sebelum menandai blok selesai.',
                ]);
            }

            $skor = (float) $attempt->skor;
        }

        $progres->forceFill([
            'status' => StatusProgres::Selesai,
            'skor' => $skor,
            'selesai_at' => now(),
        ])->save();

        return $this->payloadBlok($blok, $progres);
    }

    /**
     * @return array<string, mixed>
     */
    private function payloadBlok(BlokMateri $blok, ProgresMateri $progres): array
    {
        $payload = [
            'block_id' => $blok->getKey(),
            'urutan' => $blok->urutan,
            'tipe' => $blok->tipe->value,
            'tipe_label' => $blok->tipe->label(),
            'wajib' => $blok->wajib,
            'status' => $progres->status->value,
            'status_label' => $progres->status->label(),
            'skor' => (float) $progres->skor,
        ];

        if ($blok->tipe === TipeBlok::Teks) {
            $payload['teks'] = (string) ($blok->isi['teks'] ?? '');
        }

        if ($blok->tipe === TipeBlok::Media) {
            $payload['media'] = $this->payloadMedia((string) ($blok->isi['unggahan_kode'] ?? ''), (string) ($blok->isi['keterangan'] ?? ''));
        }

        if ($blok->tipe->berkuis() && $blok->kuis !== null) {
            $payload['kuis'] = [
                'id' => $blok->kuis->getKey(),
                'judul' => $blok->kuis->judul,
                'jumlah_soal' => $blok->kuis->soal()->count(),
            ];
        }

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    private function payloadMedia(string $kode, string $keterangan): array
    {
        $unggahan = UnggahanMateri::query()->where('kode', $kode)->first();

        if ($unggahan === null) {
            return ['kode' => $kode, 'keterangan' => $keterangan, 'tersedia' => false];
        }

        return [
            'kode' => $unggahan->kode,
            'keterangan' => $keterangan,
            'nama' => $unggahan->nama_asli,
            'kategori' => $unggahan->kategori->value,
            'kategori_label' => $unggahan->kategori->label(),
            // Hanya kategori umum yang boleh ditampilkan langsung; sisanya unduhan.
            'tampil_langsung' => $unggahan->kategori->bolehTampilLangsung(),
            'mime' => $unggahan->mime,
            'ukuran' => $unggahan->ukuran_total,
            'ukuran_manusia' => $this->penyimpanan->ukuranManusia((int) $unggahan->ukuran_total),
            'url' => $this->penyimpanan->urlBertandaTangan($unggahan),
            'tersedia' => true,
        ];
    }

    /**
     * @return array<int, ProgresMateri>
     */
    private function petaProgres(Materi $materi, Murid $profil): array
    {
        $peta = [];

        $baris = ProgresMateri::query()
            ->where('material_id', $materi->getKey())
            ->where('student_id', $profil->getKey())
            ->get();

        foreach ($baris as $satu) {
            $peta[(int) $satu->block_id] = $satu;
        }

        return $peta;
    }

    /**
     * @throws ValidationException
     */
    private function profil(Materi $materi, User $murid): Murid
    {
        $profil = $murid->murid;

        if ($profil === null) {
            throw ValidationException::withMessages(['materi' => 'Hanya akun murid yang bisa menempuh materi.']);
        }

        if (! $materi->terbit()) {
            throw ValidationException::withMessages(['materi' => 'Materi ini belum diterbitkan guru.']);
        }

        if ((int) $profil->class_id !== (int) $materi->class_id) {
            throw ValidationException::withMessages(['materi' => 'Materi ini bukan untuk kelasmu.']);
        }

        return $profil;
    }

    /**
     * @throws ValidationException
     */
    private function pastikanBlok(Materi $materi, BlokMateri $blok): void
    {
        if ((int) $blok->material_id !== (int) $materi->getKey()) {
            throw ValidationException::withMessages(['blok' => 'Blok itu bukan bagian dari materi ini.']);
        }
    }

    /**
     * Semua blok wajib sebelum blok ini harus sudah selesai.
     *
     * @throws ValidationException
     */
    private function pastikanUrutan(Materi $materi, BlokMateri $blok, Murid $profil): void
    {
        $wajibSebelum = BlokMateri::query()
            ->where('material_id', $materi->getKey())
            ->where('urutan', '<', $blok->urutan)
            ->where('wajib', true)
            ->pluck('id');

        if ($wajibSebelum->isEmpty()) {
            return;
        }

        $sudah = ProgresMateri::query()
            ->where('student_id', $profil->getKey())
            ->whereIn('block_id', $wajibSebelum->all())
            ->where('status', StatusProgres::Selesai->value)
            ->pluck('block_id');

        $sisa = $wajibSebelum->diff($sudah);

        if ($sisa->isNotEmpty()) {
            throw ValidationException::withMessages([
                'blok' => 'Selesaikan blok wajib sebelumnya dulu sebelum membuka blok ini.',
            ]);
        }
    }
}
