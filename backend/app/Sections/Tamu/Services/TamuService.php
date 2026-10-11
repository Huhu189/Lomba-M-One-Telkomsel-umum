<?php

declare(strict_types=1);

namespace App\Sections\Tamu\Services;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use App\Sections\Auth\Services\LoginService;
use App\Sections\Quiz\Enums\StatusKuis;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Murid;
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Services\PengaturanService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Siswa tamu — murid tanpa akun sekolah.
 *
 * Guru membukanya lewat pengaturan tiga lapis `izinkan_tamu` (paling lazim di
 * **lapis kuis** miliknya; admin bisa menyalakannya untuk sekolah/kelas). Tamu
 * cukup mengetik nama, lalu mengerjakan kuis itu seperti murid biasa.
 *
 * Dua hal yang sengaja TIDAK dilonggarkan:
 *
 * 1. Nama adalah identitasnya. Nama yang sama masuk lagi memakai akun yang sama
 *    (alamat emailnya diturunkan dari nama), jadi batas percobaan/retry, riwayat
 *    jawaban, dan hasilnya tetap satu orang — bukan akun baru tiap kali masuk.
 *    Konsekuensinya jujur: dua anak dengan nama persis sama akan berbagi satu
 *    identitas, makanya formulir tamu meminta nama yang unik.
 * 2. Tamu tetap punya baris `users` + `students` (di kelas penampung tamu),
 *    sehingga policy IDOR, penilaian, koreksi guru, dan laporan bekerja tanpa
 *    cabang baru. Yang berbeda hanya satu: pemeriksaan "kuis ini harus kelasmu"
 *    diganti dengan "kuis ini memang dibuka untuk tamu".
 */
class TamuService
{
    /** Kelas penampung akun tamu — dibuat sekali per sekolah saat tamu pertama masuk. */
    public const NAMA_KELAS = 'Tamu (tanpa akun)';

    /**
     * Domain email khusus akun tamu.
     *
     * `.invalid` dijamin tidak pernah dipakai domain sungguhan (RFC 2606), jadi
     * email tamu tidak mungkin bertabrakan dengan surat sungguhan maupun
     * pendaftaran murid biasa — sekaligus menandai jelas asal akunnya.
     */
    private const DOMAIN_EMAIL = 'tamu.invalid';

    public function __construct(
        private readonly PengaturanService $pengaturan,
        private readonly LoginService $login,
    ) {}

    /**
     * Apakah sekolah ini menerima siswa tamu sama sekali?
     *
     * Dipakai halaman masuk untuk memutuskan apakah formulir tamu ditampilkan:
     * menyala karena lapis sekolah, ATAU karena setidaknya satu kuis terbit
     * membuka pintunya (guru yang hanya ingin satu kuis saja).
     */
    public function tersedia(int $sekolahId): bool
    {
        return $this->aktifSekolah($sekolahId) || $this->kuisTerbuka($sekolahId)->isNotEmpty();
    }

    /** Nilai `izinkan_tamu` pada lapis sekolah saja (tanpa konteks kuis). */
    public function aktifSekolah(int $sekolahId): bool
    {
        $peta = $this->pengaturan->semua($sekolahId)['pengaturan'];

        return (bool) ($peta[KunciPengaturan::IzinkanTamu->value]['nilai'] ?? KunciPengaturan::IzinkanTamu->bawaan());
    }

    /**
     * Apakah SATU kuis ini dibuka untuk tamu (resolusi kuis → kelas → sekolah).
     */
    public function izinkanKuis(Kuis $kuis): bool
    {
        $kelasId = $kuis->class_id === null ? null : (int) $kuis->class_id;

        $peta = $this->pengaturan->semua(
            (int) $kuis->school_id,
            $kelasId,
            (int) $kuis->getKey(),
        )['pengaturan'];

        return (bool) ($peta[KunciPengaturan::IzinkanTamu->value]['nilai'] ?? KunciPengaturan::IzinkanTamu->bawaan());
    }

    /**
     * Kuis yang boleh dikerjakan siswa tamu: sudah terbit DAN izin tamunya
     * menyala. Kuis draf tidak pernah muncul — tamu sama sekali tidak boleh
     * melihat kuis yang belum diterbitkan guru.
     *
     * @return Collection<int, Kuis>
     */
    public function kuisTerbuka(int $sekolahId): Collection
    {
        return Kuis::query()
            ->where('school_id', $sekolahId)
            ->where('status', StatusKuis::Publikasi->value)
            ->with(['mapel', 'kelas'])
            ->withCount('soal')
            ->orderBy('mulai_at')
            ->get()
            // Penyaringan izinnya di memori: pengaturan sudah di-cache berlapis,
            // jadi ini tidak menambah satu query per kuis.
            ->filter(fn (Kuis $kuis): bool => $this->izinkanKuis($kuis))
            ->values();
    }

    /**
     * Masuk sebagai siswa tamu: pakai akun tamu yang sudah ada (nama sama) atau
     * buat baru, lalu langsung buka sesinya.
     *
     * @throws ValidationException
     */
    public function masuk(string $nama, int $sekolahId): User
    {
        if (! $this->tersedia($sekolahId)) {
            throw ValidationException::withMessages([
                'nama' => 'Sekolah ini belum membuka masuk sebagai siswa tamu.',
            ]);
        }

        $nama = $this->rapikanNama($nama);
        $email = $this->emailUntuk($nama);

        $user = DB::transaction(function () use ($nama, $email, $sekolahId): User {
            $user = User::query()->where('email', $email)->first();

            // Alamat email tamu memakai domain khusus, jadi ini hanya mungkin
            // bila pendaftaran murid biasa sudah memakai alamat yang sama.
            if ($user !== null && ! $user->is_tamu) {
                throw ValidationException::withMessages([
                    'nama' => 'Nama itu sudah dipakai akun lain. Pakai nama lain.',
                ]);
            }

            if ($user === null) {
                $user = User::query()->create([
                    'name' => $nama,
                    'email' => $email,
                    // Kata sandi acak: akun tamu tidak pernah dimasuki lewat
                    // kata sandi, identitasnya nama yang ia ketik.
                    'password' => Str::password(32),
                    'status' => UserStatus::Aktif->value,
                    'is_tamu' => true,
                ]);

                // Akun tamu tidak punya kotak surat, jadi verifikasi email
                // dilewati — tanpa ini middleware `akun-aktif` menutup semua
                // endpoint untuknya (sama seperti akun yang dibuat guru).
                $user->forceFill(['email_verified_at' => now()])->save();
                $user->tetapkanPeran('murid');
            } else {
                // Nama yang sama boleh datang dengan huruf besar/kecil berbeda.
                $user->forceFill(['name' => $nama])->save();
            }

            $this->pastikanProfil($user, $sekolahId);

            return $user;
        });

        $this->login->masukOtomatis($user);

        return $user;
    }

    /**
     * Alamat email akun tamu dari namanya (stabil: nama sama = akun sama).
     */
    public function emailUntuk(string $nama): string
    {
        $slug = Str::slug($nama);

        if ($slug === '') {
            $slug = 'tamu';
        }

        return 'tamu+'.mb_substr($slug, 0, 60).'@'.self::DOMAIN_EMAIL;
    }

    /**
     * Rapikan nama tamu: spasi berlebih dirapatkan dan karakter kendali dibuang.
     *
     * Dipakai di dua tempat (validasi & penyimpanan) supaya " Rara   Sari "
     * dan "Rara Sari" tidak menjadi dua identitas berbeda.
     */
    public function rapikanNama(string $nama): string
    {
        $tanpaKendali = preg_replace('/[\p{Cc}\p{Cf}]+/u', ' ', $nama) ?? '';

        return trim((string) preg_replace('/\s+/u', ' ', $tanpaKendali));
    }

    /**
     * Profil murid untuk akun tamu, ditempatkan di kelas penampung tamu.
     */
    private function pastikanProfil(User $user, int $sekolahId): Murid
    {
        $ada = Murid::query()->where('user_id', $user->getKey())->first();

        if ($ada !== null) {
            return $ada;
        }

        $kelas = Kelas::query()->firstOrCreate(
            ['school_id' => $sekolahId, 'nama' => self::NAMA_KELAS],
            ['tingkat' => 1, 'tahun_ajaran' => null],
        );

        // `user_id` unik: dua permintaan masuk yang bersamaan (dobel kirim)
        // bisa sama-sama lolos pemeriksaan di atas, dan `createOrFirst`
        // menyelamatkan yang kalah dari pelanggaran unik.
        return Murid::query()->createOrFirst(
            ['user_id' => $user->getKey()],
            ['school_id' => $sekolahId, 'class_id' => $kelas->getKey()],
        );
    }
}
