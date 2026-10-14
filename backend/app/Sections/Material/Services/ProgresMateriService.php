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
use App\Sections\Material\Registry\TautanMedia;
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
        private readonly TemaMateriService $tema,
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

        $selesaiId = collect($selesai)
            ->filter(fn (ProgresMateri $p): bool => $p->status === StatusProgres::Selesai)
            ->keys()
            ->map(fn ($id): int => (int) $id)
            ->all();

        $peta = $this->petaHost($materi->blok);
        $blok = [];

        // Urutan tayang mengikuti timeline (mulai, lalu urutan simpan), bukan
        // urutan klip dibuat guru.
        foreach ($this->urutWaktu($materi->blok) as $satu) {
            $progres = $selesai[$satu->getKey()] ?? null;
            $isi = is_array($satu->isi) ? $satu->isi : [];

            $baris = [
                'block_id' => $satu->getKey(),
                'urutan' => $satu->urutan,
                'tipe' => $satu->tipe->value,
                'tipe_label' => $satu->tipe->label(),
                'wajib' => $satu->wajib,
                'status' => $progres?->status->value ?? 'belum',
                'status_label' => $progres?->status->label() ?? 'Belum dibuka',
                'skor' => (float) ($progres->skor ?? 0),
                'mulai_detik' => $this->mulai($satu),
                'durasi_detik' => $this->durasi($satu),
                // Kuis yang tayang DI DALAM video: id blok video tuannya.
                'host_id' => $peta[$satu->getKey()] ?? null,
                'tampilan' => is_array($isi['tampilan'] ?? null) ? $isi['tampilan'] : null,
                // Kesopanan tampilan saja; server tetap penentu di buka/selesai.
                'boleh_dibuka' => $this->wajibSebelum($materi->blok, $satu, $peta)
                    ->diff($selesaiId)
                    ->isEmpty(),
            ];

            // Penjelasan setelah kuis (opsional) — bentuknya sama dengan yang
            // dikirim saat satu blok dibuka, supaya pemutar murid membaca satu
            // bentuk saja.
            $penjelasan = $satu->tipe->berkuis() ? $this->penjelasanBlok($isi) : null;

            if ($penjelasan !== null) {
                $baris['penjelasan'] = $penjelasan;
            }

            $blok[] = $baris;
        }

        $jumlahWajib = $materi->blok->where('wajib', true)->count();
        $selesaiWajib = collect($blok)->where('status', StatusProgres::Selesai->value)->where('wajib', true)->count();

        /** @var array<int, string> $statusPerBlok */
        $statusPerBlok = collect($blok)->mapWithKeys(
            static fn (array $satu): array => [(int) $satu['block_id'] => (string) $satu['status']],
        )->all();

        return [
            'materi' => [
                'id' => $materi->getKey(),
                'judul' => $materi->judul,
                'deskripsi' => $materi->deskripsi,
                'mapel_nama' => $materi->mapel?->nama,
                'tema_nama' => $materi->tag?->nama,
            ],
            'blok' => $blok,
            // Peta perjalanan (tema + pos yang sudah dilewati) untuk layar murid.
            'perjalanan' => $this->tema->perjalanan($materi, $statusPerBlok),
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

        $this->pastikanSisipanSelesai($materi, $blok, $profil);

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

        $isi = is_array($blok->isi) ? $blok->isi : [];
        $payload['mulai_detik'] = $this->mulai($blok);
        $payload['durasi_detik'] = $this->durasi($blok);
        $payload['tampilan'] = is_array($isi['tampilan'] ?? null) ? $isi['tampilan'] : null;

        if ($blok->tipe === TipeBlok::Teks) {
            $payload['teks'] = (string) ($blok->isi['teks'] ?? '');
        }

        if ($blok->tipe === TipeBlok::Media) {
            $payload['media'] = $this->payloadMedia(
                (string) ($blok->isi['unggahan_kode'] ?? ''),
                (string) ($blok->isi['keterangan'] ?? ''),
                (string) ($blok->isi['tautan'] ?? ''),
            );
            $payload['media']['tampilan'] = $payload['tampilan'];
        }

        if ($blok->tipe->berkuis() && $blok->kuis !== null) {
            $payload['kuis'] = [
                'id' => $blok->kuis->getKey(),
                'judul' => $blok->kuis->judul,
                'jumlah_soal' => $blok->kuis->soal()->count(),
            ];

            // Penjelasan opsional yang ditulis guru: murid melihatnya SESUDAH
            // kuis selesai. Bukan kunci jawaban.
            $penjelasan = $this->penjelasanBlok($isi);

            if ($penjelasan !== null) {
                $payload['penjelasan'] = $penjelasan;
            }
        }

        return $payload;
    }

    /**
     * Penjelasan setelah kuis (opsional) siap kirim: teks + media bertanda
     * tangan. Dipakai daftar progres maupun pemuatan satu blok supaya bentuknya
     * satu sumber; `null` berarti guru tidak menulis apa pun.
     *
     * @param  array<string, mixed>  $isi
     * @return array{teks: string, media: array<string, mixed>|null}|null
     */
    private function penjelasanBlok(array $isi): ?array
    {
        $penjelasan = $isi['penjelasan'] ?? null;

        if (! is_array($penjelasan)) {
            return null;
        }

        $teks = (string) ($penjelasan['teks'] ?? '');
        $kodeMedia = trim((string) ($penjelasan['unggahan_kode'] ?? ''));

        if ($teks === '' && $kodeMedia === '') {
            return null;
        }

        return [
            'teks' => $teks,
            'media' => $kodeMedia === '' ? null : $this->payloadMedia($kodeMedia, ''),
        ];
    }

    /**
     * Media satu klip: **berkas unggahan** (`unggahan_kode`) atau **tautan**
     * yang diselipkan guru (14 Okt 2026). Keduanya menghasilkan bentuk payload
     * yang sama supaya pemutar murid tidak perlu tahu dari mana asalnya.
     *
     * @return array<string, mixed>
     */
    private function payloadMedia(string $kode, string $keterangan, string $tautan = ''): array
    {
        if (trim($kode) === '' && trim($tautan) !== '') {
            return $this->payloadTautan(trim($tautan), $keterangan);
        }

        $unggahan = UnggahanMateri::query()->where('kode', $kode)->first();

        if ($unggahan === null) {
            return ['kode' => $kode, 'keterangan' => $keterangan, 'tersedia' => false];
        }

        return [
            'kode' => $unggahan->kode,
            'keterangan' => $keterangan,
            'sumber' => 'unggahan',
            'jenis' => 'unggahan',
            // Berkas unggahan tidak pernah disematkan: alamatnya bertanda tangan
            // dan milik server ini sendiri.
            'sematan' => null,
            'nama' => $unggahan->nama_asli,
            'kategori' => $unggahan->kategori->value,
            'kategori_label' => $unggahan->kategori->label(),
            // Umum & dokumen kantor disajikan dengan ekstensi aslinya; arsip dan
            // berkas tak dikenal tetap unduhan `.upload`.
            'tampil_langsung' => $unggahan->kategori->bolehTampilLangsung(),
            // `semat` (gambar/video/audio/PDF tampil di halaman), `dokumen`
            // (Word/Excel/PowerPoint: isinya dibaca & ditampilkan di halaman sejak
            // 14 Oktober 2026 — lihat frontend `PratinjauDokumen.jsx`), `unduh`.
            'sajian' => $unggahan->kategori->sajian(),
            'mime' => $unggahan->mime,
            'ukuran' => $unggahan->ukuran_total,
            'ukuran_manusia' => $this->penyimpanan->ukuranManusia((int) $unggahan->ukuran_total),
            'url' => $this->penyimpanan->urlBertandaTangan($unggahan),
            'tersedia' => true,
        ];
    }

    /**
     * Media dari tautan guru. `url` selalu alamat **asli** yang ditempelkan guru;
     * `sematan` alamat bingkai resminya (YouTube/Drive) yang dihitung server -
     * lihat Registry\TautanMedia.
     *
     * @return array<string, mixed>
     */
    private function payloadTautan(string $tautan, string $keterangan): array
    {
        $jenis = TautanMedia::jenis($tautan);
        $sematan = TautanMedia::sematan($tautan);
        $mime = TautanMedia::mime($tautan);
        // Tautan halaman biasa (bukan berkas media, bukan YouTube/Drive) hanya
        // bisa dibuka lewat tautan — bukan disematkan sebagai bingkai.
        $tampil = $sematan !== null || $mime !== null;

        return [
            'kode' => null,
            'keterangan' => $keterangan,
            'sumber' => 'tautan',
            'jenis' => $jenis,
            'sematan' => $sematan,
            'nama' => TautanMedia::nama($tautan),
            'kategori' => 'tautan',
            'kategori_label' => TautanMedia::label($jenis),
            'tampil_langsung' => $tampil,
            // Tautan tidak pernah diunduh sebagai berkas: yang bisa disemat masuk
            // bingkai (`semat`), sisanya cukup dibuka (`tautan`).
            'sajian' => $sematan !== null ? 'semat' : 'tautan',
            'mime' => $mime,
            'ukuran' => null,
            'ukuran_manusia' => null,
            'url' => $tautan,
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
     * Semua blok wajib sebelum blok ini (menurut timeline) harus sudah selesai.
     * Kuis yang tayang di dalam sebuah video tidak mensyaratkan video itu
     * selesai — justru video yang menunggu kuisnya (lihat pastikanSisipanSelesai).
     *
     * @throws ValidationException
     */
    private function pastikanUrutan(Materi $materi, BlokMateri $blok, Murid $profil): void
    {
        $semua = BlokMateri::query()->where('material_id', $materi->getKey())->get();
        $wajibSebelum = $this->wajibSebelum($semua, $blok, $this->petaHost($semua));

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

    /**
     * Video baru boleh ditutup setelah kuis wajib di dalamnya selesai.
     *
     * @throws ValidationException
     */
    private function pastikanSisipanSelesai(Materi $materi, BlokMateri $blok, Murid $profil): void
    {
        if ($blok->tipe !== TipeBlok::Media) {
            return;
        }

        $semua = BlokMateri::query()->where('material_id', $materi->getKey())->get();

        $sisipan = collect($this->petaHost($semua))
            ->filter(fn ($hostId): bool => (int) $hostId === (int) $blok->getKey())
            ->keys()
            ->map(fn ($id): int => (int) $id)
            ->filter(fn (int $id): bool => (bool) $semua->firstWhere('id', $id)?->wajib);

        if ($sisipan->isEmpty()) {
            return;
        }

        $sudah = ProgresMateri::query()
            ->where('student_id', $profil->getKey())
            ->whereIn('block_id', $sisipan->all())
            ->where('status', StatusProgres::Selesai->value)
            ->pluck('block_id')
            ->map(fn ($id): int => (int) $id);

        if ($sisipan->diff($sudah)->isNotEmpty()) {
            throw ValidationException::withMessages([
                'blok' => 'Jawab dulu kuis di dalam video sebelum menandai bagian ini selesai.',
            ]);
        }
    }

    /**
     * Id blok wajib yang harus selesai sebelum `$blok` boleh dibuka.
     *
     * @param  iterable<int, BlokMateri>  $semua
     * @param  array<int, int>  $peta  kuis id => video tuan id
     * @return \Illuminate\Support\Collection<int, int>
     */
    private function wajibSebelum(iterable $semua, BlokMateri $blok, array $peta): \Illuminate\Support\Collection
    {
        return collect($semua)
            ->filter(fn (BlokMateri $lain): bool => $lain->wajib
                && $lain->getKey() !== $blok->getKey()
                && $this->sebelum($lain, $blok)
                && ($peta[$blok->getKey()] ?? null) !== $lain->getKey())
            ->map(fn (BlokMateri $lain): int => (int) $lain->getKey())
            ->values();
    }

    /** `$a` tayang lebih dulu dari `$b`: mulai lebih awal; seri → urutan simpan. */
    private function sebelum(BlokMateri $a, BlokMateri $b): bool
    {
        $selisih = $this->mulai($a) <=> $this->mulai($b);

        return $selisih !== 0 ? $selisih < 0 : $a->urutan < $b->urutan;
    }

    /**
     * @param  iterable<int, BlokMateri>  $blok
     * @return array<int, BlokMateri>
     */
    private function urutWaktu(iterable $blok): array
    {
        $daftar = collect($blok)->all();
        usort($daftar, fn (BlokMateri $a, BlokMateri $b): int => $this->sebelum($a, $b) ? -1 : ($this->sebelum($b, $a) ? 1 : 0));

        return $daftar;
    }

    /**
     * Peta kuis → video/audio tuan: kuis yang titik mulainya jatuh di dalam
     * jendela klip media berputar. Tanpa durasi (data lama) tidak ada jendela.
     *
     * @param  iterable<int, BlokMateri>  $semua
     * @return array<int, int>
     */
    private function petaHost(iterable $semua): array
    {
        $blok = collect($semua);
        $media = $blok->filter(fn (BlokMateri $b): bool => $b->tipe === TipeBlok::Media && $this->durasi($b) > 0);

        if ($media->isEmpty()) {
            return [];
        }

        $mime = UnggahanMateri::query()
            ->whereIn('kode', $media->map(fn (BlokMateri $b): string => (string) ($b->isi['unggahan_kode'] ?? ''))->all())
            ->pluck('mime', 'kode');

        $tuan = $media->filter(function (BlokMateri $b) use ($mime): bool {
            $tipeMime = (string) ($mime[(string) ($b->isi['unggahan_kode'] ?? '')] ?? '');

            return str_starts_with($tipeMime, 'video/') || str_starts_with($tipeMime, 'audio/');
        });

        $peta = [];

        foreach ($blok->filter(fn (BlokMateri $b): bool => $b->tipe === TipeBlok::Kuis) as $kuis) {
            foreach ($tuan as $host) {
                $mulai = $this->mulai($kuis);

                if ($mulai >= $this->mulai($host) && $mulai < $this->mulai($host) + $this->durasi($host)) {
                    $peta[(int) $kuis->getKey()] = (int) $host->getKey();
                    break;
                }
            }
        }

        return $peta;
    }

    private function mulai(BlokMateri $blok): float
    {
        return (float) (is_array($blok->isi) ? ($blok->isi['mulai_detik'] ?? 0) : 0);
    }

    private function durasi(BlokMateri $blok): float
    {
        return (float) (is_array($blok->isi) ? ($blok->isi['durasi_detik'] ?? 0) : 0);
    }
}
