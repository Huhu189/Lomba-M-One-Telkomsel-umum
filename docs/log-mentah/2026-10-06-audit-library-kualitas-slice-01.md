# Laporan Audit Library & Kualitas Kode — Slice 01 (Auth & Identitas)

- **Tanggal audit:** 6 Oktober 2026
- **Proyek:** Platform ulangan/form online sekolah — M-ONE Telkomsel Coding Competition (kategori Umum, subtema Web Education for Kids SD)
- **Bahan yang diperiksa:** `src_2.zip` (frontend `src/`), `backend_3.zip` (backend Laravel lengkap dengan `vendor`), `Arsip_4.zip` (AGENT.md + chunk JSON sebagai pembanding aturan)
- **Rujukan jurnal/log:** Entri 1 di `docs/jurnal-prompt.md`; log mentah di `docs/log-mentah/2026-10-06-1703-audit-library-kualitas-slice-01.md`

## 0. Batas pemeriksaan (baca dulu)

| Hal | Status |
|---|---|
| Kode dibaca dan dianalisis statis | **Sudah dilakukan** |
| Satu klaim dicek langsung ke source framework di `vendor` (bug B1) | **Sudah dilakukan** |
| `php artisan test`, `pint --test`, `vitest`, `npm run check`, `eslint` | **Belum dijalankan** (frontend tidak punya `package.json`/`node_modules`; Packagist diblokir di sandbox) |
| Versi paket frontend | **Tidak bisa diverifikasi** (hanya folder `src/` yang ada) |
| Perbaikan kode | **Belum ditulis** — dokumen ini hanya temuan dan usulan perbaikan |

Tingkat keyakinan tiap temuan ditulis di kolom "Keyakinan": **Terbukti** (dibaca dari kode/source), **Analisis** (kesimpulan dari membaca kode, belum dijalankan).

---

## 1. Ringkasan

| # | Temuan | Berkas | Tingkat | Keyakinan |
|---|---|---|---|---|
| B1 | Lupa sandi: tautan reset tidak pernah dibuat ke frontend; kemungkinan 500 di produksi | `PasswordResetService.php` | Tinggi | Terbukti |
| B2 | Pendaftaran membocorkan email yang sudah terdaftar (422) | `DaftarMuridRequest.php` | Tinggi | Terbukti |
| B3 | Verifikasi email mengaktifkan akun yang sedang *suspended* | `VerifyEmailService.php` | Tinggi | Terbukti |
| B4 | Login hilang saat halaman di-refresh (`muatUser` tidak pernah dipanggil) | `authStore.js`, `App.jsx` | Sedang | Terbukti |
| B5 | Listener sesi terpasang ganda (StrictMode / hot reload) | `App.jsx`, `authStore.js` | Sedang | Analisis |
| B6 | Header XSRF Axios tidak terkirim bila beda origin → 419 | `client.js` | Sedang | Analisis |
| K1 | Arch test controller memakai namespace salah → tidak memeriksa apa-apa | `ArchitectureTest.php` | Sedang | Terbukti |
| K2 | Perbedaan waktu respons login (timing) membuka tebakan email | `LoginService.php` | Rendah–sedang | Analisis |
| K3 | Throttle `auth` hanya per `ip|email` | `AppServiceProvider.php` | Rendah–sedang | Analisis |
| K4 | Query `User::` langsung di controller | `AuthController.php` | Rendah | Terbukti |
| K5 | Variabel `$alasan` tidak dipakai | `LoginService.php` | Rendah | Terbukti |
| K6 | Ternary dengan dua cabang identik | `PasswordResetService.php` | Rendah | Terbukti |
| K7 | Route closure `/v1/sesi` menghalangi `route:cache` | `routes/api.php` | Rendah | Terbukti |
| K8 | Role disimpan ganda (kolom `role` + role Spatie) | `RegisterService.php`, `User.php` | Rendah | Terbukti |
| K9 | `ambilCsrfCookie()` dipanggil sebelum setiap request; `toLowerCase()` berulang | `api.js` | Rendah | Terbukti |
| K10 | Cast `(bool)` berlebih; `terapkan(array $data)` bertipe longgar; sesi lain tidak dicabut setelah reset sandi | `AuthController.php`, `PasswordResetService.php` | Rendah | Terbukti |
| P1 | Paket di luar daftar stack (Pail, Pao, Tailwind, dll.) | `composer.json`, `package.json` | Rendah | Terbukti |
| P2 | Belum terpasang: Octane, Debugbar; terpasang tapi belum dipakai: activitylog, query-builder, league/csv | `composer.json` | Info | Terbukti |
| P3 | `.env` (dengan `APP_KEY`) ikut di zip; `vite-env.d.ts` sisa template TS | — | Rendah | Terbukti |

---

## 2. Audit library

### 2.1 DOMPurify
- Tidak ada `import`, `dangerouslySetInnerHTML`, atau `innerHTML` di seluruh `src/`. Semua teks (termasuk `user.name`) dirender lewat JSX sehingga otomatis di-escape.
- **Belum dipakai, dan itu wajar** untuk slice 01. Baru dibutuhkan saat ada HTML dari server (isi soal, materi, MathML — slice 03 dan 08).
- **Syarat pemakaian benar nanti:** satu fungsi pembantu `bersihkanHtml()`; whitelist tag MathML; tidak ada `dangerouslySetInnerHTML` selain lewat fungsi itu; test XSS (`<script>`, `onerror=`, `javascript:`). File konfigurasi ESLint dengan `react/no-danger` belum ada di arsip.

### 2.2 Library frontend lain

| Library | Dipakai? | Penilaian |
|---|---|---|
| Zod | Ya (`validasi.js`, `api.js`, `health.js`) | Benar. `z.email()` lewat `.pipe` adalah sintaks Zod v4. Catatan: komentar "disimpan huruf kecil" di `skemaEmail` tidak diikuti `.toLowerCase()` |
| React Hook Form + `@hookform/resolvers/zod` | Ya (5 halaman) | Benar. Galat server lewat `setError('root')` |
| Zustand | Ya (`authStore`, `toast`) | Benar. Tidak ada token di `localStorage` (dibuktikan test `localStorage.length === 0`) |
| TanStack Query | Ya (health di `App.jsx`) | Benar |
| react-error-boundary | Ya (`main.jsx`) | Benar. Satu boundary tingkat aplikasi |
| Axios | Ya (`client.js`) | Ada risiko XSRF beda origin → lihat **B6** |
| Bootstrap | Ya (`main.jsx`) | Benar, hanya CSS |
| dayjs, JSZip, `@tanstack/react-virtual` | Belum | Normal, fiturnya belum ada |

### 2.3 Library backend

| Library | Dipakai? | Penilaian |
|---|---|---|
| `laravel/sanctum` (mode SPA) | Ya | Benar (`statefulApi()`, `auth:sanctum`) |
| `spatie/laravel-permission` | Ya (`HasRoles`, seeder) | Benar, tapi lihat **K8** |
| `spatie/laravel-activitylog` | Terpasang, belum dipakai | Sesuai rencana slice berikutnya |
| `spatie/laravel-query-builder` | Terpasang, belum dipakai | Sesuai rencana |
| `league/csv` | Terpasang, belum dipakai | Sesuai rencana slice 02 |
| `laravel/octane` | **Tidak ada** di `composer.json` | Ada di daftar stack |
| Debugbar (dev) | **Tidak ada** | Ada di daftar stack |
| Paket terlarang (Larastan, Laravel Excel, RoadRunner, dst.) | Tidak ada | Aman |

---

## 3. Bug (fungsi/variabel yang rusak, penyebab, perbaikan)

### B1 — Lupa sandi: tautan reset tidak mengarah ke frontend (kemungkinan 500)
- **Berkas:** `app/Sections/Auth/Services/PasswordResetService.php`, baris 30–46 (`terapkan`) dan 17–25 (`kirimTautan`)
- **Bagian yang rusak:** closure ketiga pada `Password::reset($data, fn…, function (User $user, string $token): string { … })`.
- **Penjelasan:**
  1. `PasswordBroker::reset(array $credentials, Closure $callback)` hanya menerima **2 argumen** (dicek di `vendor/laravel/framework/src/Illuminate/Auth/Passwords/PasswordBroker.php` baris 122). Closure ketiga **diabaikan** — kode pembuat URL ke `FRONTEND_URL` tidak pernah dijalankan.
  2. URL di email reset dibuat oleh `Illuminate\Auth\Notifications\ResetPassword`. Jika `ResetPassword::$createUrlCallback` kosong, ia memanggil `route('password.reset', …)` (baris 96). Di seluruh `app/`, `routes/`, dan `config/` **tidak ada** `createUrlUsing` maupun route bernama `password.reset`.
  3. Akibatnya, saat `Password::sendResetLink()` benar-benar mengirim email (bukan `Notification::fake()`), Laravel melempar `RouteNotFoundException` → respons 500 pada `/api/v1/auth/lupa-sandi`.
  4. Test lolos karena `Notification::fake()` menghentikan pembuatan URL.
- **Perbaikan (usulan):**
  ```php
  // AppServiceProvider::boot()
  \Illuminate\Auth\Notifications\ResetPassword::createUrlUsing(
      fn (object $notifiable, string $token): string =>
          rtrim((string) config('app.frontend_url'), '/')
          .'/atur-ulang-sandi?token='.$token.'&email='.urlencode($notifiable->getEmailForPasswordReset())
  );
  ```
  Lalu hapus closure ketiga di `Password::reset(...)`.
- **Test yang perlu ditambah:** kirim lupa sandi **tanpa** `Notification::fake()` (pakai `Notification::fake()` hanya untuk menangkap lalu render `toMail()` dan periksa bahwa URL diawali `FRONTEND_URL`).

### B2 — Pendaftaran membocorkan email yang sudah terdaftar
- **Berkas:** `app/Sections/Auth/Http/Requests/DaftarMuridRequest.php`, baris 26
- **Bagian yang rusak:** aturan `'unique:users,email'`.
- **Penjelasan:** email yang sudah ada menghasilkan respons **422** berisi pesan galat validasi, sedangkan email baru menghasilkan 201. Penyerang bisa menebak email yang terdaftar. Ini bertentangan dengan `RegisterService::pesanResponsDaftar()` (baris 39) yang mengklaim anti-enumerasi, dan dengan aturan keamanan #9 di AGENT.md.
- **Perbaikan (usulan):** hapus `unique` dari Form Request. Di `RegisterService::daftarMurid`, cari email lebih dulu; bila sudah ada, jangan buat akun baru (opsional: kirim email "Anda sudah punya akun" ke pemilik email) dan **tetap** balas 201 dengan pesan yang sama. Pertahankan unique index di database sebagai pengaman terakhir.
- **Test yang perlu ditambah:** daftar dengan email yang sudah ada → status dan badan respons identik dengan email baru.

### B3 — Verifikasi email mengaktifkan akun *suspended*
- **Berkas:** `app/Sections/Auth/Services/VerifyEmailService.php`, baris 16–27
- **Bagian yang rusak:** blok `if (! $user->hasVerifiedEmail())` yang selalu mengisi `'status' => UserStatus::Aktif->value`.
- **Penjelasan:** akun berstatus `Suspended` (atau `Dihapus`) yang email-nya belum terverifikasi akan berubah menjadi `Aktif` hanya dengan membuka tautan verifikasi bertanda tangan. Itu melewati penangguhan oleh sekolah.
- **Perbaikan (usulan):** isi `status` menjadi `Aktif` hanya jika status saat ini `UserStatus::Pending`; untuk status lain, boleh isi `email_verified_at` tapi biarkan status.
- **Test yang perlu ditambah:** user `Suspended` + email belum terverifikasi → setelah verifikasi, status tetap `Suspended`.

### B4 — Login hilang saat halaman di-refresh
- **Berkas:** `src/sections/auth/authStore.js` baris 88 (`muatUser`), `src/App.jsx`
- **Bagian yang rusak:** `muatUser()` dan `ambilSaya()` ada, tetapi tidak dipanggil di mana pun.
- **Penjelasan:** `user` di store dimulai `null` dan tidak ikut persist (sengaja, tanpa token di localStorage). Setelah reload, cookie sesi masih hidup tetapi UI menampilkan seolah belum masuk. Belum ada pula route guard (halaman yang butuh login tidak dialihkan).
- **Perbaikan (usulan):** saat aplikasi dimuat, panggil `muatUser()` (atau `useQuery(['saya'], ambilSaya)`), tangani 401 sebagai "belum masuk"; tambahkan komponen `RequireAuth` untuk rute yang memerlukan login dan tampilkan indikator memuat sampai pemeriksaan selesai.

### B5 — Listener sesi terpasang ganda
- **Berkas:** `src/App.jsx` baris 114–115; `src/sections/auth/authStore.js` fungsi `pasangListenerSesi`
- **Bagian yang rusak:** `pasangListenerSesi()` dipanggil dalam `useEffect` tanpa fungsi pembersih dan tanpa penanda idempoten.
- **Penjelasan:** di `StrictMode` (dipakai di `main.jsx`) efek dijalankan dua kali pada mode pengembangan, dan hot reload menumpuk listener. `auth:throttle` akan memanggil `mulaiTungguThrottle` berkali-kali.
- **Perbaikan (usulan):** buat `pasangListenerSesi()` mengembalikan fungsi pembersih (`removeEventListener`), atau pasang sekali di luar komponen dengan penanda `let terpasang = false`.

### B6 — Header XSRF Axios untuk beda origin
- **Berkas:** `src/shared/api/client.js` baris 7–10 dan 14–17
- **Bagian yang rusak:** `axios.create({ withCredentials: true, … })` tanpa `withXSRFToken`.
- **Penjelasan:** bila `VITE_API_URL` menunjuk origin berbeda (mis. Vite :5173 dan Laravel :8000), Axios 1.x tidak menambahkan `X-XSRF-TOKEN` otomatis → Laravel membalas 419 pada POST. Di produksi satu origin lewat proxy ini aman. (Berdasarkan perilaku Axios 1.x; versi di frontend tidak bisa diverifikasi.)
- **Perbaikan (usulan):** tambahkan `withXSRFToken: true` pada `client` dan `axiosRoot`.

---

## 4. Masalah kualitas kode

### K1 — Arch test controller tidak memeriksa apa-apa
- **Berkas:** `tests/Arch/ArchitectureTest.php`, baris 24–25
- `->expect('App\Sections\Http\Controllers')` — namespace sebenarnya `App\Sections\Auth\Http\Controllers` (dan `App\Sections\Health\Http\Controllers`). Namespace yang tidak cocok menghasilkan test yang lolos tanpa memeriksa apa pun.
- Daftar `toOnlyUse(['App\Sections', …])` juga terlalu longgar karena `App\Sections` mencakup semuanya.
- Aturan di `chunks/quality-gates.json` ("controller tidak memanggil `DB::` langsung") belum ditest.
- **Perbaikan (usulan):** perbaiki namespace menjadi yang nyata, mis. `arch()->expect('App\Sections\Auth\Http\Controllers')->not->toUse('Illuminate\Support\Facades\DB')`, ulangi untuk `App\Sections\Health\Http\Controllers`, dan kembalikan `toOnlyUse` dengan daftar yang menyebut namespace Service spesifik, bukan seluruh `App\Sections`.

### K2 — Perbedaan waktu respons login
- **Berkas:** `LoginService.php`, baris 30
- Jika `$user === null`, `Hash::check` dilewati (cepat); jika ada, hash diperiksa (lambat). Selisih waktu bisa dipakai menebak email terdaftar.
- **Perbaikan:** panggil `Hash::check($password, $hashDummy)` saat user tidak ada.

### K3 — Throttle `auth` hanya per `ip|email`
- **Berkas:** `AppServiceProvider.php`, baris 37–39
- Penyerang yang mengganti-ganti email dari satu IP tidak terbatasi. **Perbaikan:** kembalikan dua limit: `Limit::perMinute(5)->by(ip|email)` dan `Limit::perMinute(20)->by(ip)`.

### K4 — Query di controller
- **Berkas:** `AuthController.php`, baris 89 (`User::query()->where('email', $email)->first()` di `kirimUlangVerifikasiPublik`)
- Logika pindahkan ke `VerifyEmailService` (mis. `kirimUlangPublik(string $email): void`). Controller cukup memanggil service.

### K5 — Variabel tidak dipakai
- **Berkas:** `LoginService.php`, baris 34 — `if (($alasan = $user->alasanAkunDitolak()) !== null)`; `$alasan` tidak dipakai. Ganti dengan `if ($user->alasanAkunDitolak() !== null)`.

### K6 — Ternary dengan dua cabang identik
- **Berkas:** `PasswordResetService.php`, baris 22–24 — kedua cabang mengembalikan string yang sama. Sederhanakan menjadi satu `return` dan abaikan `$status` (atau pakai untuk pencatatan log internal).

### K7 — Route closure
- **Berkas:** `routes/api.php`, baris 45 — `Route::get('/v1/sesi', function …)` membuat `php artisan route:cache` gagal. Pindahkan ke controller invokable.

### K8 — Role disimpan di dua tempat
- **Berkas:** `RegisterService.php` baris 26 (`'role' => 'murid'`) + `assignRole('murid')`; `User.php` baris 16 (`'role'` ada di `#[Fillable]`)
- Kolom `role` dan role Spatie bisa tidak sinkron. Pilih satu sumber kebenaran (disarankan Spatie) dan turunkan `role` di `UserResource` dari `getRoleNames()->first()`; keluarkan `role` dari `Fillable`.

### K9 — Frontend: pemanggilan berulang
- **Berkas:** `src/sections/auth/api.js` — `ambilCsrfCookie()` pada baris 59, 75, 89, 117, 130, 141 (sebelum **setiap** request, termasuk logout); `email.toLowerCase()` pada baris 62, 77, 119, dan seterusnya.
- **Perbaikan:** ambil cookie CSRF sekali saat aplikasi dimuat (dan ulang hanya saat 419); lakukan normalisasi huruf kecil di skema Zod (`.toLowerCase()`).

### K10 — Detail kecil
- `AuthController.php` baris 39: `(bool) $request->boolean('ingat')` — cast berlebih (`boolean()` sudah mengembalikan bool).
- `PasswordResetService::terapkan(array $data)`: tipe array longgar; ganti dengan parameter bernama (`token`, `email`, `password`).
- Setelah reset sandi, sesi dan token ingat-saya di perangkat lain belum dicabut. Tambahkan `$user->setRememberToken(Str::random(60))` dan invalidasi sesi database untuk user itu.

---

## 5. Kepatuhan terhadap daftar stack (AGENT.md)

- **P1 — di luar daftar:** `laravel/pail`, `laravel/pao` (require-dev); `@tailwindcss/vite`, `tailwindcss`, `laravel-vite-plugin`, `concurrently`, `@laravel/multiplex` (package.json backend, sisa scaffold) beserta `vite.config.js` dan `resources/` backend. Aturan: dependency di luar daftar wajib punya justifikasi satu kalimat; bila tidak, hapus.
- **P2 — status stack:** `laravel/octane` dan Debugbar belum ada; `activitylog`, `query-builder`, `league/csv` terpasang belum dipakai. Kriteria `chunks/stack.json` "terpasang dan terpakai pada slice yang relevan" belum terpenuhi untuk slice 01 pada paket-paket ini (wajar sesuai urutan slice).
- **P3 — berkas:** `.env` ikut di zip dengan `APP_KEY` asli dan `APP_DEBUG=true` (`.gitignore` sudah mengecualikan `.env`; jangan sampai ter-commit, dan buat ulang key bila zip pernah dibagikan: `php artisan key:generate`). `src/vite-env.d.ts` adalah sisa template TypeScript di proyek JS-only. `verify.sh` dan `jsconfig.json` (disyaratkan `quality-gates`) tidak ada dalam arsip yang diunggah.

---

## 6. Hal yang sudah baik

- Struktur `Sections/Auth` per fitur (Controller, Service, Request, Resource, Enum) bersih dan konsisten.
- `declare(strict_types=1)` di semua berkas PHP, enum untuk status, Form Request, `Model::shouldBeStrict`, `preventLazyLoading`.
- Login: `session()->regenerate()`, pesan galat generik, akun suspended/pending ditolak dengan pesan yang sama; `EnsureAccountUsable` menolak akun tidak layak pada sesi berjalan.
- Role dari server; ada test bahwa `role=admin` dari klien diabaikan.
- Frontend: JSDoc, data luar divalidasi Zod, tanpa token di localStorage, interceptor 401/419/429, toast dan ikon buatan sendiri.
- Test: 16 test backend (15 di `AuthTest`), 23 test frontend (belum dijalankan).

## 7. Urutan perbaikan yang disarankan

1. B1 (lupa sandi) → 2. B2 (enumerasi daftar) → 3. B3 (suspended jadi aktif) → 4. B4 (refresh sesi) → 5. B5 dan B6 → 6. K1 (arch test) → 7. K2–K10 → 8. P1–P3.

Setiap perbaikan dilakukan sebagai commit kecil dengan test yang gagal dulu (merah → hijau), lalu `./verify.sh` wajib hijau. Hasil yang belum dijalankan harus dicatat jujur di `docs/laporan-pengujian.md`.
