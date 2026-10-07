<?php

declare(strict_types=1);

namespace App\Sections\Avatar\Services;

use App\Models\User;
use App\Sections\Avatar\Enums\AlasanLaporan;
use App\Sections\Avatar\Enums\StatusAvatar;
use App\Sections\Avatar\Models\Avatar;
use App\Sections\Avatar\Models\LaporanAvatar;
use App\Sections\Cheat\Enums\StatusTinjauan;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Moderasi avatar berbasis laporan teman sekelas.
 *
 * Beberapa keputusan yang disengaja:
 *
 * - **Laporan berulang tidak menambah hitungan.** Unique (avatar_id,
 *   reporter_id) membuat tiga laporan berarti tiga anak berbeda, bukan satu
 *   anak yang menekan tombolnya tiga kali.
 * - **Ambang menyembunyikan, bukan menghapus.** Gambar yang dilaporkan hanya
 *   berhenti tampil untuk murid lain; pemiliknya tetap melihatnya, dan guru
 *   yang memutuskan. Murid tidak pernah bisa menghapus avatar temannya.
 * - **Pulihkan dan hapus selalu masuk audit** (`activity_log`), supaya
 *   keputusan guru bisa ditelusuri — sama seperti koreksi nilai dan tinjauan
 *   catatan kecurangan.
 */
class ModerasiAvatarService
{
    public function __construct(private readonly PenyimpananAvatar $penyimpanan) {}

    /**
     * Catat laporan seorang murid atas avatar temannya.
     *
     * @return array{laporan: LaporanAvatar, disembunyikan: bool, jumlah: int}
     *
     * @throws ValidationException
     */
    public function lapor(
        Avatar $avatar,
        User $pelapor,
        AlasanLaporan $alasan,
        ?string $keterangan = null,
    ): array {
        $murid = $pelapor->murid;

        if ($murid === null) {
            throw ValidationException::withMessages(['avatar' => 'Hanya murid yang bisa melaporkan avatar.']);
        }

        if ((int) $avatar->student_id === (int) $murid->getKey()) {
            throw ValidationException::withMessages(['avatar' => 'Kamu tidak bisa melaporkan avatarmu sendiri.']);
        }

        if (! $avatar->hidup()) {
            throw ValidationException::withMessages(['avatar' => 'Avatar ini sudah tidak ada lagi.']);
        }

        $batas = (int) config('avatar.maks_laporan_per_jam');
        $sejamTerakhir = LaporanAvatar::query()
            ->where('reporter_id', $murid->getKey())
            ->where('created_at', '>=', Carbon::now()->subHour())
            ->count();

        if ($sejamTerakhir >= $batas) {
            throw ValidationException::withMessages([
                'avatar' => 'Terlalu banyak laporan dalam satu jam. Coba lagi nanti.',
            ]);
        }

        // Idempoten: menekan lapor dua kali tidak menambah hitungan dan tidak
        // memunculkan galat — anak yang tidak sengaja menekan dua kali tidak
        // perlu diberi pesan merah.
        $sudahAda = LaporanAvatar::query()
            ->where('avatar_id', $avatar->getKey())
            ->where('reporter_id', $murid->getKey())
            ->first();

        if ($sudahAda !== null) {
            return [
                'laporan' => $sudahAda,
                'disembunyikan' => ! $avatar->terlihatSemua(),
                'jumlah' => (int) $avatar->jumlah_laporan,
            ];
        }

        $laporan = LaporanAvatar::query()->create([
            'avatar_id' => $avatar->getKey(),
            'reporter_id' => $murid->getKey(),
            'school_id' => $avatar->school_id,
            'alasan' => $alasan,
            'keterangan' => $keterangan === null ? null : mb_substr($keterangan, 0, 300),
            'review_status' => StatusTinjauan::Menunggu,
        ]);

        $jumlah = $this->hitungLaporanMenunggu($avatar);
        $disembunyikan = $this->terapkanAmbang($avatar, $jumlah);

        return ['laporan' => $laporan, 'disembunyikan' => $disembunyikan, 'jumlah' => $jumlah];
    }

    /**
     * Daftar avatar yang menunggu tinjauan guru (disembunyikan karena laporan).
     *
     * @return Collection<int, Avatar>
     */
    public function antrean(): Collection
    {
        return Avatar::query()
            ->where('status', StatusAvatar::Disembunyikan->value)
            ->with(['murid.user', 'laporan.pelapor.user'])
            ->orderByDesc('disembunyikan_at')
            ->orderByDesc('id')
            ->get();
    }

    /**
     * Guru memulihkan avatar: kembali tampil untuk semua orang, laporan yang
     * masih menunggu ditandai **tidak valid**.
     *
     * @throws ValidationException
     */
    public function pulihkan(Avatar $avatar, User $guru, ?string $catatan = null): Avatar
    {
        if ($avatar->status === StatusAvatar::Dihapus) {
            throw ValidationException::withMessages(['avatar' => 'Avatar ini sudah dihapus.']);
        }

        $this->tandaiLaporan($avatar, StatusTinjauan::TidakValid, $guru);

        $avatar->forceFill([
            'status' => StatusAvatar::Aktif,
            'disembunyikan_at' => null,
            'jumlah_laporan' => 0,
        ])->save();

        $this->catatAudit('pulihkan', $avatar, $guru, $catatan);

        return $avatar->refresh();
    }

    /**
     * Guru menghapus avatar: berkas fisik dibuang, laporan yang menunggu
     * ditandai **valid**. Barisnya tetap ada sebagai jejak audit.
     *
     * @throws ValidationException
     */
    public function hapus(Avatar $avatar, User $guru, ?string $catatan = null): Avatar
    {
        if ($avatar->status === StatusAvatar::Dihapus) {
            throw ValidationException::withMessages(['avatar' => 'Avatar ini sudah dihapus.']);
        }

        $this->tandaiLaporan($avatar, StatusTinjauan::Valid, $guru);
        $this->penyimpanan->hapusBerkas($avatar);

        $avatar->forceFill([
            'status' => StatusAvatar::Dihapus,
            'disembunyikan_at' => $avatar->disembunyikan_at ?? Carbon::now(),
        ])->save();

        $this->catatAudit('hapus', $avatar, $guru, $catatan);

        return $avatar->refresh();
    }

    /** Jumlah laporan yang masih menunggu tinjauan (yang dihitung untuk ambang). */
    public function hitungLaporanMenunggu(Avatar $avatar): int
    {
        return LaporanAvatar::query()
            ->where('avatar_id', $avatar->getKey())
            ->where('review_status', StatusTinjauan::Menunggu->value)
            ->count();
    }

    /**
     * Simpan hitungan terbaru, dan sembunyikan avatar bila laporan unik sudah
     * mencapai ambang. Mengembalikan true bila avatar BARU disembunyikan.
     */
    private function terapkanAmbang(Avatar $avatar, int $jumlah): bool
    {
        $ambang = max(1, (int) config('avatar.ambang_laporan'));

        $avatar->forceFill(['jumlah_laporan' => $jumlah]);

        $baruDisembunyikan = $jumlah >= $ambang && $avatar->status === StatusAvatar::Aktif;

        if ($baruDisembunyikan) {
            $avatar->forceFill([
                'status' => StatusAvatar::Disembunyikan,
                'disembunyikan_at' => Carbon::now(),
            ]);
        }

        $avatar->save();

        if ($baruDisembunyikan) {
            activity('avatar')
                ->performedOn($avatar)
                ->event('disembunyikan')
                ->withProperties([
                    'avatar_id' => $avatar->getKey(),
                    'student_id' => $avatar->student_id,
                    'jumlah_laporan' => $jumlah,
                    'ambang' => $ambang,
                ])
                ->log('Avatar disembunyikan setelah laporan teman sekelas');
        }

        return $baruDisembunyikan;
    }

    /** Tandai seluruh laporan yang masih menunggu dengan keputusan guru. */
    private function tandaiLaporan(Avatar $avatar, StatusTinjauan $status, User $guru): void
    {
        LaporanAvatar::query()
            ->where('avatar_id', $avatar->getKey())
            ->where('review_status', StatusTinjauan::Menunggu->value)
            ->update([
                'review_status' => $status->value,
                'reviewed_by' => $guru->getKey(),
                'reviewed_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ]);
    }

    private function catatAudit(string $aksi, Avatar $avatar, User $guru, ?string $catatan): void
    {
        activity('avatar')
            ->causedBy($guru)
            ->performedOn($avatar)
            ->event($aksi)
            ->withProperties([
                'avatar_id' => $avatar->getKey(),
                'student_id' => $avatar->student_id,
                'status' => $avatar->status->value,
                'jumlah_laporan' => $avatar->jumlah_laporan,
                'catatan' => $catatan,
            ])
            ->log($aksi === 'pulihkan' ? 'Avatar dipulihkan guru' : 'Avatar dihapus guru');
    }
}
