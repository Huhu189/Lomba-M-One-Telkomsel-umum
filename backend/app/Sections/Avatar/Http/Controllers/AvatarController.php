<?php

declare(strict_types=1);

namespace App\Sections\Avatar\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Avatar\Enums\AlasanLaporan;
use App\Sections\Avatar\Enums\StatusAvatar;
use App\Sections\Avatar\Http\Requests\LaporAvatarRequest;
use App\Sections\Avatar\Http\Requests\UnggahAvatarRequest;
use App\Sections\Avatar\Http\Resources\AvatarResource;
use App\Sections\Avatar\Http\Resources\LaporanAvatarResource;
use App\Sections\Avatar\Models\Avatar;
use App\Sections\Avatar\Services\ModerasiAvatarService;
use App\Sections\Avatar\Services\PenyimpananAvatar;
use App\Sections\School\Models\Murid;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Avatar murid (slice 08).
 *
 * Murid mengurus avatarnya sendiri (unggah / kembalikan ke bawaan) dan bisa
 * melaporkan avatar teman sekelas. Keputusan atas laporan **bukan** di sini:
 * laporan hanya menyembunyikan gambar sampai guru meninjaunya
 * (`ModerasiAvatarController`).
 */
class AvatarController extends Controller
{
    /** Relasi yang selalu dimuat supaya resource tidak memicu lazy load. */
    private const RELASI = ['murid.user', 'murid.kelas'];

    /** Avatar sendiri; `bawaan: true` berarti belum pernah mengunggah. */
    public function saya(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Avatar::class);

        $profil = $request->user()?->murid;

        if ($profil === null) {
            return response()->json(['avatar' => null, 'bawaan' => true]);
        }

        $avatar = Avatar::terkiniUntuk((int) $profil->getKey());

        if ($avatar === null) {
            return response()->json(['avatar' => null, 'bawaan' => true]);
        }

        $avatar->load([...self::RELASI, 'laporan.pelapor.user']);

        return response()->json([
            'avatar' => (new AvatarResource($avatar))->resolve(),
            'bawaan' => false,
        ]);
    }

    /**
     * Daftar avatar yang boleh dilihat pemanggil.
     *
     * Guru melihat seluruh sekolah (untuk moderasi); murid hanya kelasnya, dan
     * avatar yang disembunyikan **tidak ikut** — kecuali avatarnya sendiri.
     */
    public function daftar(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Avatar::class);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        if ($pengguna->isGuru()) {
            return response()->json(['avatar' => AvatarResource::collection($this->terbaruPerMurid(null))->resolve()]);
        }

        $profil = $pengguna->murid;

        if ($profil === null) {
            abort(403, 'Hanya murid dan guru yang punya daftar avatar.');
        }

        $kandidat = Avatar::query()
            ->whereIn('student_id', Murid::query()->where('class_id', $profil->class_id)->select('id'))
            ->where('status', '!=', StatusAvatar::Dihapus->value)
            ->with(self::RELASI)
            ->orderBy('id')
            ->get();

        $terpilih = [];

        foreach ($kandidat as $satu) {
            $milikSendiri = (int) $satu->student_id === (int) $profil->getKey();

            if (! $milikSendiri && ! $satu->terlihatSemua()) {
                continue;
            }

            // Urutan id menaik: baris terakhir yang menang = avatar terbaru.
            $terpilih[(int) $satu->student_id] = $satu;
        }

        return response()->json([
            'avatar' => AvatarResource::collection(array_values($terpilih))->resolve(),
            'murid_id' => (int) $profil->getKey(),
        ]);
    }

    /** Unggah (atau ganti) avatar sendiri. Berkas selalu diencode ulang server. */
    public function unggah(UnggahAvatarRequest $request, PenyimpananAvatar $penyimpanan): JsonResponse
    {
        $this->authorize('unggah', Avatar::class);

        $pengguna = $request->user();
        $profil = $pengguna?->murid;

        if ($pengguna === null || $profil === null) {
            abort(403, 'Hanya murid yang bisa memasang avatar.');
        }

        $isi = $request->isi();

        if ($isi === '') {
            throw ValidationException::withMessages(['berkas' => 'Pilih gambar terlebih dahulu.']);
        }

        $avatar = $penyimpanan->simpan($profil, $isi);

        return (new AvatarResource($avatar->load(self::RELASI)))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Kembalikan ke avatar bawaan.
     *
     * Avatar yang sedang disembunyikan karena laporan **tidak** bisa dihapus
     * sendiri: gambar itu masih menunggu tinjauan guru, dan menghapusnya akan
     * menghapus barang bukti. Murid tetap boleh mengunggah gambar baru.
     */
    public function hapus(Request $request, PenyimpananAvatar $penyimpanan): JsonResponse
    {
        $this->authorize('hapusSendiri', Avatar::class);

        $profil = $request->user()?->murid;

        if ($profil === null) {
            abort(403, 'Hanya murid yang bisa menghapus avatarnya.');
        }

        $avatar = Avatar::terkiniUntuk((int) $profil->getKey());

        if ($avatar === null) {
            return response()->json([
                'message' => 'Kamu memang belum memasang avatar.',
                'bawaan' => true,
            ]);
        }

        if ($avatar->status === StatusAvatar::Disembunyikan) {
            throw ValidationException::withMessages([
                'avatar' => 'Avatar ini sedang menunggu tinjauan guru. Unggah gambar baru bila ingin menggantinya.',
            ]);
        }

        $penyimpanan->hapusBerkas($avatar);
        $avatar->forceFill(['status' => StatusAvatar::Dihapus])->save();

        return response()->json([
            'message' => 'Avatar dikembalikan ke bawaan.',
            'bawaan' => true,
        ]);
    }

    /** Laporkan avatar teman sekelas. */
    public function lapor(
        LaporAvatarRequest $request,
        Avatar $avatar,
        ModerasiAvatarService $moderasi,
    ): JsonResponse {
        $this->authorize('lapor', $avatar);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $alasan = AlasanLaporan::from((string) $request->validated('alasan'));
        $keterangan = $request->validated('keterangan');

        $hasil = $moderasi->lapor(
            $avatar,
            $pengguna,
            $alasan,
            is_string($keterangan) ? $keterangan : null,
        );

        return response()->json([
            'message' => $hasil['disembunyikan']
                ? 'Laporan diterima. Gambar disembunyikan sampai guru meninjau.'
                : 'Laporan diterima. Guru akan meninjau.',
            'laporan' => (new LaporanAvatarResource($hasil['laporan']))->resolve(),
            'jumlah_laporan' => $hasil['jumlah'],
            'disembunyikan' => $hasil['disembunyikan'],
        ], 201);
    }

    /**
     * Avatar terbaru per murid (yang belum dihapus). Dipakai guru supaya daftar
     * tidak dipenuhi riwayat unggahan.
     *
     * @return array<int, Avatar>
     */
    private function terbaruPerMurid(?int $studentId): array
    {
        $kandidat = Avatar::query()
            ->when($studentId !== null, fn ($query) => $query->where('student_id', $studentId))
            ->where('status', '!=', StatusAvatar::Dihapus->value)
            ->with(self::RELASI)
            ->orderBy('id')
            ->get();

        $terpilih = [];

        foreach ($kandidat as $satu) {
            $terpilih[(int) $satu->student_id] = $satu;
        }

        return array_values($terpilih);
    }
}
