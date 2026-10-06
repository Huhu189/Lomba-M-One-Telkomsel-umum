/**
 * Halaman Masuk (login) — RHF + Zod, hitung mundur throttle.
 * Pesan galat kredensial dari backend sudah anti-enumerasi; tautan
 * "kirim ulang verifikasi" selalu ditawarkan setelah gagal agar murid yang
 * belum verifikasi tidak buntu (tanpa membocorkan status akun).
 */
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { skemaMasuk } from './validasi.js'
import { pesanGalatApi, teksGalat } from './api.js'
import { sudahDitampilkanSebagaiTunggu, useAuthStore } from './authStore.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import Isian from '../../shared/ui/Isian.jsx'
import Banner from '../../shared/ui/Banner.jsx'
import { Tombol, TombolTaut } from '../../shared/ui/Tombol.jsx'
import { IkonKunci, IkonPengguna, IkonSurat } from '../../icons.jsx'
import { RUTE } from '../../routes.js'
import KartuAuth from './KartuAuth.jsx'
import PeringatanTunggu from './PeringatanTunggu.jsx'

/**
 * @param {{ berhasil?: (user: import('./authStore.js').DataUser) => void }} props
 */
export default function HalamanMasuk({ berhasil }) {
  const masuk = useAuthStore((s) => s.masuk)
  const detikTunggu = useAuthStore((s) => s.detikTunggu)

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

  return (
    <KartuAuth
      judul="Selamat datang kembali!"
      sub="Masuk dulu, lalu lanjut belajar."
      ikon={IkonPengguna}
    >
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

      <p className="auth-pemisah">Belum punya akun?</p>
      <TombolTaut to={RUTE.daftar} varian="tepi" lebar>
        Daftar sebagai murid
      </TombolTaut>
    </KartuAuth>
  )
}
