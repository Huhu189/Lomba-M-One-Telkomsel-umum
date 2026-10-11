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
 * ## Identitas: satu kode per perangkat, bukan satu nama
 *
 * Setiap pengunjung membawa **kode perangkat** yang dibuat sekali lalu disimpan
 * di perangkatnya (klien yang membuat dan menyimpannya; server hanya menurunkan
 * akun dari kode itu). Akun tamu = kode perangkat, sedangkan **nama yang dia
 * ketik hanya nama tampilan** — jadi:
 *
 * 1. nama yang sama di dua perangkat berbeda tetap dua anak berbeda (tidak ada
 *    pembajakan akun dan tidak ada "nama sudah dipakai");
 * 2. nama non-Latin atau beremoji tetap punya akun sendiri (dulu slug kosong
 *    membuat semua anak seperti itu berbagi satu akun `tamu+tamu@`);
 * 3. anak yang sama masuk lagi dari perangkat yang sama melanjutkan akun yang
 *    sama — batas percobaan/retry, riwayat jawaban, dan hasilnya tetap satu
 *    orang, bukan akun baru tiap kali masuk;
 * 4. pembatas laju bisa dikunci per kode perangkat, bukan per alamat IP, jadi
 *    satu kelas SD di balik satu NAT sekolah tidak saling mengunci.
 *
 * Tamu tetap punya baris `users` + `students` (di kelas penampung tamu),
 * sehingga policy IDOR, penilaian, koreksi guru, dan laporan bekerja tanpa
 * cabang baru. Yang berbeda hanya satu: pemeriksaan "kuis ini harus kelasmu"
 * diganti dengan "kuis ini memang dibuka untuk tamu".
 */
class TamuService
{
    /** Kelas penampung akun tamu — dibuat sekali per sekolah saat tamu pertama masuk. */
    public const NAMA_KELAS = 'Tamu (tanpa akun)';

    /** Panjang kode perangkat yang dibuat server bila klien belum punya. */
    private const PANJANG_KODE = 40;

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
     * Masuk sebagai siswa tamu: pakai akun tamu milik kode perangkat itu, atau
     * buat baru, lalu langsung buka sesinya.
     *
     * Kode perangkat yang tidak dikirim (klien lama, penyimpanan diblokir) TIDAK
     * ditolak: server membuatkan kode acak baru dan mengembalikannya untuk
     * disimpan klien. Akibatnya jujur: pengunjung tanpa kode mendapat akun baru,
     * bukan menumpang akun orang lain yang kebetulan namanya sama.
     *
     * @return array{user: User, kode: string}
     *
     * @throws ValidationException
     */
    public function masuk(string $nama, int $sekolahId, ?string $kodePerangkat = null): array
    {
        if (! $this->tersedia($sekolahId)) {
            throw ValidationException::withMessages([
                'nama' => 'Sekolah ini belum membuka masuk sebagai siswa tamu.',
            ]);
        }

        $nama = $this->rapikanNama($nama);
        $kode = $this->kodeSah($kodePerangkat) ?? Str::random(self::PANJANG_KODE);
        $email = $this->emailUntukKode($kode);

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
                    // kata sandi — identitasnya kode perangkat, nama yang dia
                    // ketik hanya tampilan.
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
                // Perangkat yang sama boleh datang dengan ejaan nama yang sudah
                // diperbaiki; akunnya tetap yang itu.
                $user->forceFill(['name' => $nama])->save();
            }

            $this->pastikanProfil($user, $sekolahId);

            return $user;
        });

        $this->login->masukOtomatis($user);

        return ['user' => $user, 'kode' => $kode];
    }

    /**
     * Kode perangkat yang diterima apa adanya: panjang 8–128 dan hanya huruf,
     * angka, serta `.-_:`. Bentuk yang tidak sah diperlakukan sebagai "tidak
     * dikirim" supaya kode aneh dari klien tidak pernah dipakai sebagai kunci
     * penyimpanan (dan tidak bisa dipakai menebak akun tamu orang lain).
     */
    public function kodeSah(?string $kode): ?string
    {
        $kode = trim((string) $kode);

        if (preg_match('/^[A-Za-z0-9._:-]{8,128}$/', $kode) !== 1) {
            return null;
        }

        return $kode;
    }

    /**
     * Alamat email akun tamu dari kode perangkatnya.
     *
     * Di-hash, bukan dibaca apa adanya: kode perangkat adalah kunci masuk akun
     * tamu, jadi tidak boleh tersimpan mentah di kolom yang tampil di panel
     * admin/laporan. Nama tidak ikut ke sini — dengan begitu dua anak bernama
     * sama tetap dua akun, dan satu anak yang memperbaiki ejaan namanya tetap
     * satu akun.
     */
    public function emailUntukKode(string $kode): string
    {
        return 'tamu+'.substr(hash('sha256', $kode), 0, 32).'@'.self::DOMAIN_EMAIL;
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
