/**
 * Halaman Masuk (login) — RHF + Zod, hitung mundur throttle.
 * Pesan galat kredensial dari backend sudah anti-enumerasi; tautan
 * "kirim ulang verifikasi" selalu ditawarkan setelah gagal agar murid yang
 * belum verifikasi tidak buntu (tanpa membocorkan status akun).
 *
 * Sejak 14 Oktober 2026 halaman ini **membalik urutannya** bila pengunjung
 * datang dari tautan ulangan yang dibagikan guru (state `lanjut` menuju
 * `/kuis/…`): pintu siswa tamu tampil lebih dulu, sedangkan formulir akun
 * sekolah dilipat di bawahnya. Anak yang tidak punya akun tidak lagi mendarat di
 * kolom email/kata sandi lalu merasa "dipaksa masuk" — ia menulis namanya dan
 * langsung kembali ke ulangannya. Server tetap yang memutuskan pintu tamu
 * terbuka atau tidak (`GET /v1/tamu`).
 *
 * Selama jawaban `GET /v1/tamu` **belum tiba**, halaman menahan isinya dulu
 * (bukan menampilkan kolom email lalu menukarnya beberapa milidetik kemudian):
 * tanpa itu, anak dari tautan tetap sempat melihat formulir akun sekolah lebih
 * dulu — persis keluhan yang diperbaiki putaran ini.
 */
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { skemaMasuk } from '../validasi.js'
import { ambilInfoTamu, pesanGalatApi, teksGalat } from '../api.js'
import { sudahDitampilkanSebagaiTunggu, useAuthStore } from '../authStore.js'
import { tampilkanToast } from '../../../shared/ui/toast.jsx'
import Isian from '../../../shared/ui/Isian.jsx'
import Banner from '../../../shared/ui/Banner.jsx'
import { Tombol, TombolTaut } from '../../../shared/ui/Tombol.jsx'
import { IkonKunci, IkonPengguna, IkonSurat } from '../../../icons.jsx'
import { RUTE } from '../../../routes.js'
import KartuAuth from '../komponen/KartuAuth.jsx'
import GoogleMasuk from '../komponen/GoogleMasuk.jsx'
import MasukTamu from '../komponen/MasukTamu.jsx'
import PeringatanTunggu from '../komponen/PeringatanTunggu.jsx'
import MemuatHalaman from '../../../shared/ui/MemuatHalaman.jsx'

/**
 * @param {{ berhasil?: (user: import('../authStore.js').DataUser) => void }} props
 */
export default function HalamanMasuk({ berhasil }) {
  const masuk = useAuthStore((s) => s.masuk)
  const detikTunggu = useAuthStore((s) => s.detikTunggu)
  const lokasi = useLocation()

  // Server yang menentukan apakah pintu tamu terbuka; halaman ini hanya
  // menampilkan formulirnya bila memang ada kuis/izin tamu dari guru.
  const infoTamu = useQuery({ queryKey: ['tamu-info'], queryFn: ambilInfoTamu, staleTime: 60_000 })

  // Datang dari tautan ulangan yang dibagikan guru? (`KeMasuk` membawa tujuan
  // asalnya lewat `state.lanjut`.) Murid yang mengerjakan ulangan lewat tautan
  // biasanya tidak punya akun sekolah, jadi pintu tamunya yang diutamakan.
  const tujuan = typeof lokasi.state?.lanjut === 'string' ? lokasi.state.lanjut : ''
  const dariTautanUlangan = /^\/(kuis|kerjakan|peringkat)\//.test(tujuan)
  const tamuDulu = dariTautanUlangan && infoTamu.data?.diizinkan === true

  // Pintu tamu dari tautan ulangan belum bisa dipastikan tampil atau tidak.
  // Menahan isi (dengan penanda yang tidak berkedip) lebih baik daripada
  // menyodorkan kolom email lebih dulu lalu menukarnya.
  const sedangMemastikanPintu = dariTautanUlangan && infoTamu.isLoading

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm({
    resolver: zodResolver(skemaMasuk),
    defaultValues: { email: '', password: '' },
  })

  const kirim = handleSubmit(async (data) => {
    clearErrors('root')
    try {
      const user = await masuk(data)
      tampilkanToast('sukses', `Selamat datang, ${user.name}!`)
      berhasil?.(user)
    } catch (galat) {
      if (!sudahDitampilkanSebagaiTunggu(galat)) {
        setError('root', { message: pesanGalatApi(galat) })
      }
    }
  })

  const formulirAkun = (
    <form onSubmit={kirim} noValidate>
      <PeringatanTunggu />

      {errors.root?.message && (
        <Banner jenis="salah" judul="Belum bisa masuk">
          {teksGalat(errors.root)}{' '}
          <Link
            to={RUTE.perluVerifikasi}
            state={{ email: getValues('email') }}
            className="taut-sentuh mt-1"
          >
            Belum verifikasi email? Kirim ulang tautan
          </Link>
        </Banner>
      )}

      <Isian
        label="Email"
        type="email"
        ikon={IkonSurat}
        autoComplete="email"
        inputMode="email"
        placeholder="nama@email.com"
        galat={teksGalat(errors.email)}
        {...register('email')}
      />

      <Isian
        label="Kata sandi"
        type="password"
        ikon={IkonKunci}
        autoComplete="current-password"
        galat={teksGalat(errors.password)}
        {...register('password')}
      />

      <div className="text-end mb-4">
        <Link className="taut-sentuh" to={RUTE.lupaSandi}>
          Lupa kata sandi?
        </Link>
      </div>

      <Tombol
        type="submit"
        besar
        lebar
        memuat={isSubmitting}
        teksMemuat="Memeriksa…"
        disabled={detikTunggu > 0}
      >
        {detikTunggu > 0 ? `Tunggu ${detikTunggu} detik` : 'Masuk'}
      </Tombol>
    </form>
  )

  return (
    <KartuAuth
      judul={tamuDulu ? 'Ikut ulangan ini' : 'Selamat datang kembali!'}
      sub={
        tamuDulu
          ? 'Kamu membuka tautan ulangan dari gurumu. Cukup tulis namamu.'
          : 'Masuk dulu, lalu lanjut belajar.'
      }
      ikon={IkonPengguna}
    >
      {tamuDulu ? (
        <>
          <MasukTamu berhasil={berhasil} utama />

          {/**
           * Akun sekolah tetap dijangkau, tetapi TIDAK lagi menjadi pintu depan
           * bagi anak yang datang dari tautan ulangan: formulirnya dilipat, dan
           * tetap ada di DOM untuk pembaca layar/pencarian dalam halaman.
           */}
          <details className="auth-lipat-akun">
            <summary className="auth-pemisah">Punya akun sekolah?</summary>
            <div className="pt-1">{formulirAkun}</div>
            <p className="teks-lembut small mt-3 mb-0">
              Belum punya akun? <Link className="taut-sentuh" to={RUTE.daftar}>Daftar sebagai murid</Link>{' '}
              — atau lanjut sebagai siswa tamu di atas.
            </p>
          </details>
        </>
      ) : sedangMemastikanPintu ? (
        <MemuatHalaman />
      ) : (
        <>
          {/**
           * Datang dari tautan ulangan, tetapi pintu tamunya tertutup: sebabnya
           * dikatakan apa adanya (14 Oktober 2026).
           *
           * Sebelum catatan ini, anak yang membuka tautan guru hanya melihat
           * kolom email + kata sandi dan merasa "dipaksa masuk" — padahal bukan
           * aplikasinya yang menolak, melainkan kuis itu memang belum dibuka
           * untuk tamu (`TamuService::tersedia`: kuisnya harus terbit dan
           * `izinkan_tamu`-nya menyala). Guru yang mencoba tautannya sendiri pun
           * membaca sebab yang sama, jadi tidak perlu bertanya ke mana-mana.
           */}
          {dariTautanUlangan && infoTamu.isSuccess && infoTamu.data?.diizinkan === false && (
            <Banner jenis="info" judul="Ulangan ini belum dibuka untuk siswa tanpa akun">
              Minta gurumu menyalakan “Izinkan siswa tamu” untuk kuis ini, lalu menerbitkan kuisnya —
              pintu tamu baru terbuka sesudah itu. Sementara itu, kamu bisa masuk dengan akun sekolah
              di bawah.
            </Banner>
          )}

          {/**
           * Tombol Google ditempatkan di ATAS formulir kata sandi (14 Oktober
           * 2026): bagi murid yang akunnya dibuat lewat Google, pintu itu memang
           * yang pertama ia cari. Tampil hanya bila sekolah menyalakannya.
           */}
          <GoogleMasuk berhasil={berhasil} />

          {formulirAkun}

          <p className="auth-pemisah">Belum punya akun?</p>
          <TombolTaut to={RUTE.daftar} varian="tepi" lebar>
            Daftar sebagai murid
          </TombolTaut>

          {/* Pintu tamu = tautan ke halamannya sendiri, bukan formulir yang
              ditempel di sini. Tujuan asal (`state.lanjut`) ikut dibawa, dan
              tombolnya memakai komponen tombol yang sama dengan pintu lain
              (`TombolTaut`) supaya bentuk, ikon, dan jaraknya seragam —
              sebelumnya tautan ini ditulis dengan kelas manual dan terlihat
              berbeda dari tombol di atasnya. */}
          {infoTamu.data?.diizinkan && (
            <div className="auth-pintu-tamu">
              <TombolTaut
                to={RUTE.masukTamu}
                state={lokasi.state}
                varian="tepi"
                lebar
                ikon={IkonPengguna}
              >
                Masuk sebagai siswa tamu
              </TombolTaut>
              <p className="teks-lembut small mt-2 mb-0">
                Untuk anak yang mengerjakan ulangan dari tautan gurunya tanpa akun sekolah.
              </p>
            </div>
          )}
        </>
      )}
    </KartuAuth>
  )
}
