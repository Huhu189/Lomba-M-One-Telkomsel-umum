<?php

declare(strict_types=1);

namespace App\Sections\Settings\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\School\Services\SekolahService;
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Enums\LingkupPengaturan;
use App\Sections\Settings\Http\Requests\SimpanPengaturanRequest;
use App\Sections\Settings\Models\Pengaturan;
use App\Sections\Settings\Services\PengaturanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PengaturanController extends Controller
{
    /**
     * Aturan yang berlaku di sekolah/kelas/kuis.
     *
     * Hanya guru/admin (K-05): murid tidak lagi bisa memetakan proteksi mana
     * yang aktif lewat `GET /pengaturan?kuis_id=`. Saklar anti-cheat yang
     * mengikatnya dikirim lewat payload attempt, satu per satu sesuai saklar
     * efektif kuisnya — tanpa daftar lengkap "apa yang dipasang guru".
     */
    public function index(
        Request $request,
        SekolahService $sekolah,
        PengaturanService $service,
    ): JsonResponse {
        $this->authorize('viewAny', Pengaturan::class);

        $sekolahId = $sekolah->tunggal()->id;
        $kelasId = $request->integer('kelas_id') ?: null;
        $kuisId = $request->integer('kuis_id') ?: null;

        return response()->json($this->resolusi($request, $service, $sekolahId, $kelasId, $kuisId));
    }

    public function perbarui(
        SimpanPengaturanRequest $request,
        SekolahService $sekolah,
        PengaturanService $service,
    ): JsonResponse {
        $data = $request->validated();
        $lingkup = LingkupPengaturan::from((string) $data['lingkup']);
        $kunci = KunciPengaturan::from((string) $data['kunci']);
        $sekolahId = $sekolah->tunggal()->id;

        $lingkupId = $lingkup === LingkupPengaturan::Sekolah
            ? $sekolahId
            : (int) $data['lingkup_id'];

        // Lingkup kuis diperiksa kepemilikannya (S-05): saklar anti-cheat satu
        // kuis bukan milik semua guru.
        //
        // Penolakannya dikirim sebagai 403 dengan pesan bahasa Indonesia yang
        // menyebut siapa yang berhak: sebelum ini jawabannya pesan bawaan
        // kerangka ("This action is unauthorized."), dan kepala sekolah yang
        // menekan saklar "Izinkan siswa tamu" tidak tahu bahwa setelannya memang
        // tidak pernah tersimpan — bukan aplikasinya yang menolak tamu.
        if (! $request->user()?->can('update', [Pengaturan::class, $lingkup, $lingkupId])) {
            abort(403, $this->pesanTolak($lingkup));
        }

        $nilai = $kunci->tipe() === 'integer' ? (int) $data['nilai'] : (bool) $data['nilai'];

        $service->simpan($lingkup, $lingkupId, $kunci, $nilai, (bool) ($data['terkunci'] ?? false));

        return response()->json($this->resolusi(
            $request,
            $service,
            $sekolahId,
            $request->integer('kelas_id') ?: null,
            $request->integer('kuis_id') ?: null,
        ));
    }

    /**
     * Resolusi pengaturan + `boleh_ubah`.
     *
     * `boleh_ubah` dibaca dari policy yang sama dengan jalur tulisnya, jadi
     * klien tidak perlu menebak dari peran pengguna: panel yang menampilkan
     * saklar wajib tahu apakah saklar itu benar-benar bisa disimpan. Tanpa ini
     * kepala sekolah (yang boleh MEMBACA resolusi) melihat panel yang tampak
     * bisa ditekan, menekannya, lalu tidak ada apa pun yang tersimpan.
     *
     * @return array<string, mixed>
     */
    private function resolusi(
        Request $request,
        PengaturanService $service,
        int $sekolahId,
        ?int $kelasId,
        ?int $kuisId,
    ): array {
        $lingkup = match (true) {
            $kuisId !== null => LingkupPengaturan::Kuis,
            $kelasId !== null => LingkupPengaturan::Kelas,
            default => LingkupPengaturan::Sekolah,
        };

        $lingkupId = $kuisId ?? $kelasId ?? $sekolahId;

        return [
            ...$service->semua($sekolahId, $kelasId, $kuisId),
            'boleh_ubah' => (bool) $request->user()?->can('update', [Pengaturan::class, $lingkup, $lingkupId]),
        ];
    }

    /** Sebab penolakan yang bisa dibaca guru, bukan pesan bawaan kerangka. */
    private function pesanTolak(LingkupPengaturan $lingkup): string
    {
        if ($lingkup === LingkupPengaturan::Kuis) {
            return 'Setelan ulangan ini hanya bisa diubah guru pemilik kuisnya. Kepala sekolah hanya melihat.';
        }

        return 'Setelan tingkat sekolah dan kelas tidak diubah dari aplikasi. Atur proteksi dan aturan ulangan di halaman kuisnya masing-masing.';
    }
}
