<?php

declare(strict_types=1);

namespace App\Providers;

use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Policies\AttemptPolicy;
use App\Sections\Avatar\Models\Avatar;
use App\Sections\Avatar\Policies\AvatarPolicy;
use App\Sections\Cache\Services\CacheBerlapis;
use App\Sections\Cache\Services\LapisanL1;
use App\Sections\Cache\Services\LapisanL2;
use App\Sections\Cache\Services\PintuTraffic;
use App\Sections\Cheat\Models\KejadianKecurangan;
use App\Sections\Cheat\Policies\KejadianKecuranganPolicy;
use App\Sections\Material\Models\Materi;
use App\Sections\Material\Policies\MateriPolicy;
use App\Sections\Question\Models\Soal;
use App\Sections\Question\Models\Tag;
use App\Sections\Question\Policies\SoalPolicy;
use App\Sections\Question\Policies\TagPolicy;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Quiz\Policies\KuisPolicy;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use App\Sections\School\Policies\KelasPolicy;
use App\Sections\School\Policies\MapelPolicy;
use App\Sections\School\Policies\MuridPolicy;
use App\Sections\School\Policies\SekolahPolicy;
use App\Sections\Settings\Models\Pengaturan;
use App\Sections\Settings\Policies\PengaturanPolicy;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Contracts\Auth\CanResetPassword;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Proxy tepercaya (K-06).
     *
     * Tanpa daftar ini, di belakang nginx/Cloudflare/Octane-proxy seluruh sekolah
     * terlihat berasal dari SATU alamat: limiter `auth` (120/menit per IP) dan
     * `verifikasi` (3/menit per IP) menolak murid yang sah, dan sinyal anti-cheat
     * "sesi ganda dari IP sama" menuduh semua murid.
     *
     * Bawaannya KOSONG — tidak ada proxy yang dipercaya — karena percaya semua
     * proxy (`at: '*'`) justru membuat klien bisa memalsukan IP-nya sendiri lewat
     * header X-Forwarded-For. Pengelola deploy mengisi TRUSTED_PROXIES dengan
     * alamat proxy miliknya sendiri (lihat config/app.php dan .env.example).
     *
     * Dipasang di sini, bukan di bootstrap/app.php: callback `withMiddleware`
     * berjalan sebelum container punya `config`, jadi `config()` di sana meledak.
     */
    private function pasangProxyTepercaya(): void
    {
        $mentah = trim((string) config('app.trusted_proxies'));

        if ($mentah === '') {
            return;
        }

        $proxies = array_values(array_filter(array_map('trim', preg_split('/[,\s]+/', $mentah) ?: [])));

        if ($proxies !== []) {
            TrustProxies::at($proxies);
        }
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Pagar mutu: model ketat di semua lingkungan non-produksi.
        Model::shouldBeStrict(! $this->app->isProduction());
        Model::preventLazyLoading(! $this->app->isProduction());

        $this->pasangProxyTepercaya();

        // Respons resource tanpa pembungkus "data" (skema flat untuk klien).
        JsonResource::withoutWrapping();

        // Policy model berada di luar App\Models, jadi didaftarkan eksplisit.
        Gate::policy(Sekolah::class, SekolahPolicy::class);
        Gate::policy(Kelas::class, KelasPolicy::class);
        Gate::policy(Mapel::class, MapelPolicy::class);
        Gate::policy(Murid::class, MuridPolicy::class);
        Gate::policy(Pengaturan::class, PengaturanPolicy::class);
        Gate::policy(Tag::class, TagPolicy::class);
        Gate::policy(Soal::class, SoalPolicy::class);
        Gate::policy(Kuis::class, KuisPolicy::class);
        Gate::policy(Attempt::class, AttemptPolicy::class);
        Gate::policy(KejadianKecurangan::class, KejadianKecuranganPolicy::class);
        Gate::policy(Materi::class, MateriPolicy::class);
        Gate::policy(Avatar::class, AvatarPolicy::class);

        // Cache berlapis L1 (SQLite tmpfs) → L2 (Redis) → L3 (database) untuk
        // state yang dibaca berulang saat ulangan berjalan (slice 10).
        $this->app->singleton(CacheBerlapis::class, function (): CacheBerlapis {
            $konfig = config('cache_l1');

            return new CacheBerlapis(
                new PintuTraffic(
                    (int) $konfig['jendela_detik'],
                    (float) $konfig['ambang_aktif_per_detik'],
                    (float) $konfig['ambang_mati_per_detik'],
                ),
                [
                    new LapisanL2,
                    new LapisanL1(
                        LapisanL1::jalurBawaan($konfig['jalur']),
                        (int) $konfig['ttl_detik'],
                        (bool) $konfig['aktif'],
                    ),
                ],
            );
        });

        // Tautan reset sandi harus menuju halaman frontend (SPA), bukan ke API.
        // Tanpa callback ini notifikasi bawaan Laravel memanggil route('password.reset')
        // yang tidak ada di aplikasi ini, sehingga email reset gagal dikirim.
        ResetPassword::createUrlUsing(function (object $notifiable, string $token): string {
            /** @var CanResetPassword $notifiable */
            $email = (string) $notifiable->getEmailForPasswordReset();
            $dasar = rtrim((string) config('app.frontend_url'), '/');

            return $dasar.'/atur-ulang-sandi?token='.$token.'&email='.urlencode($email);
        });

        // Tautan verifikasi email: tanda tangan RELATIF (hanya path + expires), bukan URL penuh.
        // Tanda tangan absolut ikut menghitung host:port, sehingga tautan jadi "Invalid
        // signature" begitu host berbeda antara saat email dibuat dan saat diklik (queue
        // worker/APP_URL, proxy Vite :5173 -> :8000, www vs non-www). Tanda tangan relatif
        // tetap aman: path, id, hash, dan masa berlaku tetap tidak bisa diubah.
        VerifyEmail::createUrlUsing(function (object $notifiable): string {
            $relatif = URL::temporarySignedRoute(
                'verification.verify',
                now()->addMinutes((int) config('auth.verification.expire', 60)),
                [
                    'id' => $notifiable->getKey(),
                    'hash' => sha1(mb_strtolower((string) $notifiable->getEmailForVerification())),
                ],
                false,
            );

            return rtrim((string) config('app.url'), '/').$relatif;
        });

        // Throttle jalur auth (chunk security: anti brute-force & anti spam email).
        // Dua batas: per akun+IP (menebak sandi satu akun) dan per IP (mengganti-ganti
        // email dari satu alamat tetap terbatas).
        //
        // Batas per IP WAJIB longgar: satu kelas SD di balik NAT sekolah berbagi
        // satu alamat publik, sehingga batas kecil (dulu 20/menit) menolak murid
        // ke-21 yang menekan "Masuk" saat jam pelajaran mulai (temuan S-01).
        // Yang menjaga brute-force tetap batas per akun+IP di baris pertama.
        RateLimiter::for('auth', function (Request $request) {
            $perAlamat = (string) $request->ip();
            $perAkun = $perAlamat.'|'.mb_strtolower((string) $request->input('email'));

            return [
                Limit::perMinute(5)->by($perAkun),
                Limit::perMinute(120)->by($perAlamat),
            ];
        });

        // Klik tautan dari email: sudah dijaga tanda tangan + masa berlaku, jadi batasnya
        // longgar. Satu kelas yang mendaftar serentak lewat NAT sekolah (satu IP) tidak
        // boleh kena 429 hanya karena menekan tautan di waktu yang sama.
        RateLimiter::for('verifikasi-klik', function (Request $request) {
            return Limit::perMinute(120)->by((string) $request->ip());
        });

        RateLimiter::for('verifikasi', function (Request $request) {
            return Limit::perMinute(3)->by((string) $request->ip());
        });

        // Penyajian berkas materi (slice 08): URL sudah bertanda tangan dan
        // berumur pendek, jadi batasnya longgar — satu kelas yang membuka materi
        // bersamaan dari satu IP sekolah tidak boleh kena 429.
        RateLimiter::for('berkas', function (Request $request) {
            return Limit::perMinute(300)->by((string) $request->ip());
        });

        // Avatar (slice 08): unggah/ganti gambar, kembalikan ke bawaan, dan lapor.
        // Dibatasi per AKUN (bukan per IP) karena seluruh kelas bisa memakai satu
        // koneksi sekolah yang sama; batas laporan per jam tetap ditegakkan di
        // ModerasiAvatarService.
        RateLimiter::for('avatar', function (Request $request) {
            return Limit::perMinute(20)->by((string) ($request->user()?->getAuthIdentifier() ?? $request->ip()));
        });

        // Tiket SSE (K-10). Tanpa batas, satu akun bisa memutar panggilan tiket
        // tanpa henti: tiap panggilan menulis satu baris `sse_tickets` + satu kunci
        // Redis, jadi tabel dan Redis tumbuh mengikuti kecepatan klien. Batasnya
        // per AKUN (bukan per IP — satu kelas berbagi satu alamat) dan sengaja
        // longgar: tiket tetap harus bisa diterbitkan ulang setiap kali SSE putus
        // dan klien menyambung lagi.
        RateLimiter::for('tiket', function (Request $request) {
            return Limit::perMinute(30)->by((string) ($request->user()?->getAuthIdentifier() ?? $request->ip()));
        });

        // Masuk sebagai siswa tamu (T1). Jalur ini SENGAJA tidak memakai limiter
        // `auth`: limiter itu berkunci per IP+email, sedangkan tamu tidak punya
        // email — akibatnya seluruh kelas yang berbagi satu NAT sekolah dihitung
        // sebagai satu orang dan murid ke-6 ditolak 429 di jam pelajaran mulai.
        //
        // Kuncinya sekarang kode perangkat unik milik tiap pengunjung (klien yang
        // membuat & menyimpannya), jadi batas 5/menit berlaku per ANAK, bukan per
        // sekolah. Batas per IP tetap dipasang sebagai pagar penyalahgunaan,
        // dan sengaja longgar karena satu sekolah = satu alamat.
        RateLimiter::for('tamu', function (Request $request) {
            $kode = trim((string) $request->input('kode_perangkat'));
            $perPengunjung = $kode === '' ? 'tamu|ip:'.$request->ip() : 'tamu|'.$kode;

            return [
                Limit::perMinute(5)->by($perPengunjung),
                Limit::perMinute(120)->by((string) $request->ip()),
            ];
        });

        // Kejadian kecurangan (K-09). Klien mengirim antreannya 1,5 detik setelah
        // kejadian terakhir (maksimal 50 entri per kiriman), jadi ~40 permintaan
        // per menit sudah lebih dari cukup — termasuk saat antrean 200 entri yang
        // menumpuk offline dikuras sekaligus (4 kiriman). Batas ini per AKUN,
        // bukan per IP: satu kelas berbagi satu alamat NAT sekolah.
        // Tanpa batas ini, satu murid bisa menembak endpoint berulang dan menulis
        // puluhan ribu baris `cheat_events` dalam satu menit.
        RateLimiter::for('kejadian', function (Request $request) {
            return Limit::perMinute(60)->by((string) ($request->user()?->getAuthIdentifier() ?? $request->ip()));
        });

        // Denyut proteksi (2D). Klien mengirim satu denyut tiap 30 detik
        // (2/menit); batas 12/menit memberi ruang untuk muat ulang halaman dan
        // percobaan ulang jaringan, tetapi tetap menutup kiriman borongan.
        RateLimiter::for('denyut', function (Request $request) {
            return Limit::perMinute(12)->by((string) ($request->user()?->getAuthIdentifier() ?? $request->ip()));
        });
    }
}
