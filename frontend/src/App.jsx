/**
 * Kerangka aplikasi + router.
 * - KerangkaAuth: halaman masuk/daftar/dll (panel + formulir).
 * - KerangkaUmum: beranda, data induk, dan halaman lain (header + footer).
 * Sesi dipulihkan saat dimuat agar refresh tidak "mengeluarkan" pengguna.
 *
 * Halaman dimuat malas per rute (`MalasHalaman`, lihat `halaman.js`) supaya
 * aplikasi tidak mengunduh seluruh kode sekaligus. Yang statis hanya kerangka,
 * beranda, halaman masuk, dan 404 — halaman lain baru diunduh saat dibuka, dan
 * penanda "sedang diunduh" hanya menempati area konten (lihat `KerangkaUmum`/
 * `KerangkaAuth`) supaya menu dan kaki halaman tetap tampil selama menunggu.
 */
import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ToastHost, tampilkanToast } from './shared/ui/toast.jsx'
import KerangkaAuth from './shared/layout/KerangkaAuth.jsx'
import KerangkaUmum from './shared/layout/KerangkaUmum.jsx'
import { RUTE } from './routes.js'
// Statis (selalu ada di bundel awal): kerangka ulangan, halaman pertama yang
// dilihat semua orang, pintu masuk, dan 404.
import Beranda from './sections/home/halaman/Beranda.jsx'
import HalamanTidakDitemukan from './sections/home/halaman/HalamanTidakDitemukan.jsx'
import HalamanMasuk from './sections/auth/halaman/HalamanMasuk.jsx'
import BatasGalatUlangan from './sections/attempt/komponen/BatasGalatUlangan.jsx'
// Malas: tiap halaman jadi berkas terpisah, diunduh saat rutenya dibuka.
import {
  EditorMateri,
  HalamanAkun,
  HalamanAkunSekolah,
  HalamanAturUlangSandi,
  HalamanBadge,
  HalamanBankSoal,
  HalamanBuatSandi,
  HalamanDaftar,
  HalamanHasil,
  HalamanImporMurid,
  HalamanKelas,
  HalamanKerjakan,
  HalamanKoreksi,
  HalamanKuisDetail,
  HalamanLaporan,
  HalamanLayar,
  HalamanLupaSandi,
  HalamanMapel,
  HalamanMasukTamu,
  HalamanMonitor,
  HalamanMurid,
  HalamanPeringkat,
  HalamanPerluVerifikasi,
  HalamanProgresTema,
  HalamanTag,
  HalamanTim,
  HalamanVerifikasiEmail,
  PilihHalamanAvatar,
  PilihHalamanKuis,
  PilihHalamanMateri,
} from './halaman.js'
import { pasangListenerSesi, useAuthStore } from './sections/auth/authStore.js'
import { tujuanLanjut } from './sections/quiz/setelan/setelanSesi.js'
import MetaHalaman from './shared/seo/MetaHalaman.jsx'

/** Layar tunggu singkat selama sesi diperiksa (mencegah kilatan tampilan tamu). */
function LayarMemuat() {
  return (
    <div className="d-flex min-vh-100 align-items-center justify-content-center text-center" role="status">
      <div>
        <span className="spinner-border text-primary" aria-hidden="true" />
        <p className="teks-lembut mt-3">Menyiapkan…</p>
      </div>
    </div>
  )
}

/** Halaman tamu saja (masuk/daftar/…): yang sudah masuk dialihkan ke beranda. */
function HanyaTamu() {
  const user = useAuthStore((s) => s.user)
  return user ? <Navigate to={RUTE.beranda} replace /> : <Outlet />
}

/**
 * Kerangka umum dengan gerbang verifikasi & kata sandi: akun yang sudah masuk
 * tetapi belum memverifikasi email diarahkan ke halaman verifikasi, dan akun
 * yang lahir dari Google (belum punya kata sandi sendiri) diarahkan ke langkah
 * pembuatan kata sandi. Keduanya memang ditolak server (403), jadi jangan
 * biarkan murid menabrak dinding itu atau melihat halaman yang pasti gagal.
 */
function GerbangUmum() {
  const user = useAuthStore((s) => s.user)

  if (user?.perluBuatSandi) {
    return <Navigate to={RUTE.buatSandi} replace />
  }

  if (user && !user.emailTerverifikasi) {
    return <Navigate to={RUTE.perluVerifikasi} replace />
  }

  return <KerangkaUmum />
}

/**
 * Halaman buat kata sandi: hanya untuk yang sedang masuk DAN memang belum
 * bersandi. Yang sudah bersandi dialihkan ke beranda; yang belum masuk ke
 * halaman masuk — halaman ini tidak boleh jadi jalan pintas mengganti sandi
 * tanpa sandi lama.
 */
function HanyaBuatSandi() {
  const user = useAuthStore((s) => s.user)

  if (!user) return <KeMasuk />

  return user.perluBuatSandi ? <Outlet /> : <Navigate to={RUTE.beranda} replace />
}

/**
 * Halaman buat kata sandi + penyambungnya ke store: nama murid dibaca reaktif
 * (bukan sekali saat render) supaya sapaan di halaman itu ikut hidup bila user
 * baru selesai dipulihkan, dan pengarahan sesudah berhasil tetap satu tempat.
 */
function HalamanBuatSandiTersambung() {
  const nama = useAuthStore((s) => s.user?.name ?? '')
  const navigate = useNavigate()

  return (
    <HalamanBuatSandi
      nama={nama}
      berhasil={() => navigate(RUTE.beranda, { replace: true })}
    />
  )
}

/**
 * Alihkan ke halaman masuk sambil membawa tujuan asal (`state.lanjut`).
 *
 * Inilah yang membuat tautan yang dibagikan guru hidup: murid yang membuka
 * `…/kuis/12` tanpa sesi diantar ke halaman masuk, lalu dikembalikan ke kuis
 * itu setelah masuk — baik lewat akun sekolah maupun lewat pintu siswa tamu
 * (bila guru membuka `izinkan_tamu` untuk kuis itu). Tujuan itu divalidasi
 * `tujuanLanjut` sebelum dipakai, jadi hanya jalur internal yang diterima.
 */
function KeMasuk() {
  const lokasi = useLocation()

  return <Navigate to={RUTE.masuk} replace state={{ lanjut: `${lokasi.pathname}${lokasi.search}` }} />
}

/** Halaman yang butuh sesi (beranda boleh dibuka tamu). */
function HanyaMasuk() {
  const user = useAuthStore((s) => s.user)

  return user ? <Outlet /> : <KeMasuk />
}

/**
 * Halaman khusus murid (lencana & progres tema): guru/admin dialihkan ke
 * beranda karena datanya tidak ada untuk mereka — tanpa pagar ini guru yang
 * salah buka akan menabrak 403 dari API.
 */
function HanyaMurid() {
  const user = useAuthStore((s) => s.user)

  if (!user) return <KeMasuk />

  return user.role === 'murid' ? <Outlet /> : <Navigate to={RUTE.beranda} replace />
}

/**
 * Halaman panel admin sekolah: hanya peran `admin` (guru dialihkan ke beranda).
 *
 * Guru tetap tidak diberi jalan ke sini walau ia punya hak di hampir semua
 * halaman lain: mengubah email atau menyetel sandi akun orang lain adalah
 * tindakan administratif yang bisa dipakai mengambil alih akun (lihat
 * AkunSekolahPolicy) — jadi menunya pun tidak muncul untuk guru.
 */
function HanyaAdmin() {
  const user = useAuthStore((s) => s.user)

  if (!user) return <KeMasuk />

  return user.role === 'admin' ? <Outlet /> : <Navigate to={RUTE.beranda} replace />
}

/** Halaman data induk: hanya guru/admin (murid dialihkan ke beranda). */
function HanyaGuru() {
  const user = useAuthStore((s) => s.user)

  if (!user) return <KeMasuk />

  const isGuru = user.role === 'guru' || user.role === 'admin'
  return isGuru ? <Outlet /> : <Navigate to={RUTE.beranda} replace />
}

/**
 * Halaman yang menuntut kemampuan **mengubah** data akademik: impor murid,
 * koreksi nilai, kelola tim, layar kelas, dan penyunting materi.
 *
 * Kepala sekolah (peran `admin`) dialihkan ke beranda. Halamannya memang akan
 * gagal di API-nya (403), tetapi membiarkannya terbuka hanya membuatnya menunggu
 * halaman yang tidak bisa dipakai — jadi pagarnya dipasang di depan.
 */
function HanyaGuruMengajar() {
  const user = useAuthStore((s) => s.user)

  if (!user) return <KeMasuk />

  return user.role === 'guru' ? <Outlet /> : <Navigate to={RUTE.beranda} replace />
}

/**
 * Halaman yang terbuka untuk murid dan guru, tetapi bukan kepala sekolah:
 * halaman avatar (murid memasang, guru meninjau laporan). Kepala sekolah tidak
 * memutuskan tampilan avatar murid (lihat AvatarPolicy).
 */
function BukanKepalaSekolah() {
  const user = useAuthStore((s) => s.user)

  if (!user) return <KeMasuk />

  return user.role === 'admin' ? <Navigate to={RUTE.beranda} replace /> : <Outlet />
}

/** Kerangka aplikasi: sesi, toast, dan router. */
export default function App() {
  const navigate = useNavigate()
  const lokasi = useLocation()
  const sesiSiap = useAuthStore((s) => s.sesiSiap)
  const pulihkanSesi = useAuthStore((s) => s.pulihkanSesi)

  // Listener sesi/throttle global (idempoten) + pulihkan sesi dari cookie.
  useEffect(() => {
    pasangListenerSesi()
    void pulihkanSesi()

    const saatSesiHabis = () => tampilkanToast('info', 'Sesi berakhir. Silakan masuk lagi.')
    window.addEventListener('auth:sesi-habis', saatSesiHabis)
    return () => window.removeEventListener('auth:sesi-habis', saatSesiHabis)
  }, [pulihkanSesi])

  if (!sesiSiap) return <LayarMemuat />

  /**
   * Tujuan sesudah masuk (akun, Google, atau siswa tamu): tautan asal dari guru bila
   * ada, kalau tidak beranda (tamu diantar ke daftar ulangan).
   * @param {import('./sections/auth/authStore.js').DataUser} user
   */
  const setelahMasuk = (user) =>
    navigate(
      // Akun dari Google dengan kata sandi belum dibuat tidak
      // diantar ke tujuan asalnya dulu: lapisan wajib-buat-sandi
      // didahulukan, karena seluruh rute lain memang ditolak
      // server sampai kata sandinya ada.
      user.perluBuatSandi
        ? RUTE.buatSandi
        : (tujuanLanjut(
            /** @type {{ lanjut?: unknown }|null} */ (lokasi.state)?.lanjut,
          ) ?? (user.isTamu ? RUTE.kuis : RUTE.beranda)),
      { replace: true },
    )

  return (
    <>
      <ToastHost />
      {/* Judul tab + meta description/robots mengikuti jalur (satu sumber,
          lihat `shared/seo/meta.js`) — bukan lagi di tiap halaman. */}
      <MetaHalaman jalur={lokasi.pathname} />
      <Routes>
        <Route element={<GerbangUmum />}>
          <Route path={RUTE.beranda} element={<Beranda />} />

          {/* Data induk (slice 02) — guru/admin boleh membaca; yang menambah dan
              mengubah hanya guru (kepala sekolah hanya melihat). */}
          <Route element={<HanyaGuru />}>
            <Route path={RUTE.kelas} element={<HalamanKelas />} />
            <Route path={RUTE.mapel} element={<HalamanMapel />} />
            <Route path={RUTE.murid} element={<HalamanMurid />} />
            <Route path={RUTE.bankSoal} element={<HalamanBankSoal />} />
            <Route path={RUTE.tag} element={<HalamanTag />} />

            {/* Laporan per tema memuat data seluruh kelas — guru & kepala sekolah
                (kepala sekolah memang bertugas membacanya). */}
            <Route path={RUTE.laporanKuis} element={<HalamanLaporan />} />
            {/* Monitor Ulangan: memantau, bukan menilai — tetap terbaca. */}
            <Route path={RUTE.monitorKuis} element={<HalamanMonitor />} />
          </Route>

          {/* Jalur yang benar-benar mengubah data akademik — guru pengajar saja. */}
          <Route element={<HanyaGuruMengajar />}>
            <Route path={RUTE.imporMurid} element={<HalamanImporMurid />} />
            <Route path={RUTE.koreksiKuis} element={<HalamanKoreksi />} />
            <Route path={RUTE.timKuis} element={<HalamanTim />} />
            <Route path={RUTE.layarKuis} element={<HalamanLayar />} />
            {/* Editor materi bergaya video editor. */}
            <Route path={RUTE.materiEditor} element={<EditorMateri />} />
          </Route>

          {/* Panel admin sekolah (14 Okt 2026) — admin saja, bukan guru. */}
          <Route element={<HanyaAdmin />}>
            <Route path={RUTE.adminAkun} element={<HalamanAkunSekolah />} />
          </Route>

          {/* Kuis (slice 03) — guru mengelola, murid melihat daftar ulangannya. */}
          <Route element={<HanyaMasuk />}>
            {/* Setelan akun sendiri: milik SEMUA pengguna, jadi tidak lagi di
                gerbang guru. Setelan per ulangan ada di halaman detail kuis. */}
            <Route path={RUTE.pengaturan} element={<HalamanAkun />} />

            <Route path={RUTE.kuis} element={<PilihHalamanKuis />} />
            <Route path={RUTE.kuisDetail} element={<HalamanKuisDetail />} />

            {/* Pengerjaan ulangan dibungkus pagar galat khusus (fail-open). */}
            <Route
              path={RUTE.kerjakanKuis}
              element={
                <BatasGalatUlangan>
                  <HalamanKerjakan />
                </BatasGalatUlangan>
              }
            />
            <Route path={RUTE.hasilAttempt} element={<HalamanHasil />} />

            {/* Peringkat, lencana, dan progres tema (slice 05). */}
            <Route path={RUTE.peringkatKuis} element={<HalamanPeringkat />} />

            {/* Lencana & progres tema datanya per murid — halaman khusus murid. */}
            <Route element={<HanyaMurid />}>
              <Route path={RUTE.badge} element={<HalamanBadge />} />
              <Route path={RUTE.progresTema} element={<HalamanProgresTema />} />
            </Route>

            {/* Materi berblok (slice 08) — guru menyusun, murid menempuh. */}
            <Route path={RUTE.materi} element={<PilihHalamanMateri />} />
            {/* Tautan satu materi yang dibagikan guru: murid langsung menempuh
                materinya, guru dibawa ke editornya (lihat `PilihHalamanMateri`). */}
            <Route path={RUTE.materiTautan} element={<PilihHalamanMateri />} />

            {/* Avatar + moderasi (slice 08) — murid memasang, guru meninjau
                laporan; kepala sekolah tidak memutuskan tampilan avatar murid. */}
            <Route element={<BukanKepalaSekolah />}>
              <Route path={RUTE.avatar} element={<PilihHalamanAvatar />} />
            </Route>
          </Route>

          <Route path="*" element={<HalamanTidakDitemukan />} />
        </Route>

        <Route element={<KerangkaAuth />}>
          <Route element={<HanyaTamu />}>
            <Route
              path={RUTE.masuk}
              element={
                <HalamanMasuk
                  berhasil={setelahMasuk}
                />
              }
            />
            <Route
              path={RUTE.daftar}
              element={
                <HalamanDaftar
                  berhasil={(email) =>
                    navigate(RUTE.perluVerifikasi, { replace: true, state: { email } })
                  }
                  // Daftar lewat Google: emailnya sudah diverifikasi Google, jadi
                  // murid langsung masuk dan tinggal membuat kata sandinya
                  // (langkah yang sama dengan jalur masuk lewat Google).
                  berhasilGoogle={(user) =>
                    navigate(user.perluBuatSandi ? RUTE.buatSandi : RUTE.beranda, { replace: true })
                  }
                />
              }
            />
            <Route path={RUTE.masukTamu} element={<HalamanMasukTamu berhasil={setelahMasuk} />} />
            <Route path={RUTE.lupaSandi} element={<HalamanLupaSandi />} />
            <Route path={RUTE.aturUlangSandi} element={<HalamanAturUlangSandi />} />
          </Route>

          {/* Lapisan wajib-buat-sandi untuk akun dari Google. Boleh dibuka oleh
              yang sudah masuk (karena itu di luar `HanyaTamu`), tetapi hanya
              selama akunnya memang belum punya kata sandi sendiri. */}
          <Route element={<HanyaBuatSandi />}>
            <Route path={RUTE.buatSandi} element={<HalamanBuatSandiTersambung />} />
          </Route>
          {/* Tautan dari email boleh dibuka siapa pun, termasuk yang sudah masuk. */}
          <Route path={RUTE.verifikasiEmail} element={<HalamanVerifikasiEmail />} />
          <Route path={RUTE.perluVerifikasi} element={<HalamanPerluVerifikasi />} />
        </Route>
      </Routes>
    </>
  )
}
