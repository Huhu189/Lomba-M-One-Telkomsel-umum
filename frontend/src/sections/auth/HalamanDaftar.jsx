/**
 * Halaman Daftar murid — RHF + Zod. Role selalu dari server (murid);
 * guru/admin dibuat lewat seeder/impor (tidak ada self-register).
 */
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { skemaDaftar } from './validasi.js'
import { daftar, pesanGalatApi, teksGalat } from './api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import Isian from '../../shared/ui/Isian.jsx'
import Banner from '../../shared/ui/Banner.jsx'
import MeterSandi from '../../shared/ui/MeterSandi.jsx'
import { Tombol, TombolTaut } from '../../shared/ui/Tombol.jsx'
import { IkonDaftar, IkonKunci, IkonPengguna, IkonSurat } from '../../icons.jsx'
import { RUTE } from '../../routes.js'
import { sudahDitampilkanSebagaiTunggu, useAuthStore } from './authStore.js'
import KartuAuth from './KartuAuth.jsx'
import PeringatanTunggu from './PeringatanTunggu.jsx'

/**
 * @param {{ berhasil?: (email: string) => void }} props
 */
export default function HalamanDaftar({ berhasil }) {
  const detikTunggu = useAuthStore((s) => s.detikTunggu)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm({
    resolver: zodResolver(skemaDaftar),
    defaultValues: { name: '', email: '', password: '', konfirmasi: '' },
  })

  const sandi = watch('password')

  const kirim = handleSubmit(async (data) => {
    clearErrors('root')
    try {
      const pesan = await daftar({
        name: data.name,
        email: data.email,
        password: data.password,
      })
      tampilkanToast('sukses', pesan)
      berhasil?.(data.email.toLowerCase())
    } catch (galat) {
      if (!sudahDitampilkanSebagaiTunggu(galat)) {
        setError('root', { message: pesanGalatApi(galat) })
      }
    }
  })

  return (
    <KartuAuth
      judul="Buat akun murid"
      sub="Isi data di bawah, lalu cek email untuk mengaktifkan akun."
      ikon={IkonDaftar}
    >
      <form onSubmit={kirim} noValidate>
        <PeringatanTunggu />

        {errors.root?.message && (
          <Banner jenis="salah" judul="Pendaftaran belum berhasil">
            {teksGalat(errors.root)}
          </Banner>
        )}

        <Isian
          label="Nama lengkap"
          ikon={IkonPengguna}
          autoComplete="name"
          placeholder="Contoh: Rina Aulia"
          galat={teksGalat(errors.name)}
          {...register('name')}
        />

        <Isian
          label="Email"
          type="email"
          ikon={IkonSurat}
          autoComplete="email"
          inputMode="email"
          placeholder="nama@email.com"
          bantuan="Boleh memakai email orang tua atau wali."
          galat={teksGalat(errors.email)}
          {...register('email')}
        />

        <Isian
          label="Kata sandi"
          type="password"
          ikon={IkonKunci}
          autoComplete="new-password"
          bantuan="Minimal 10 karakter. Kalimat pendek yang mudah diingat juga boleh."
          galat={teksGalat(errors.password)}
          {...register('password')}
        />
        <MeterSandi sandi={sandi} />

        <Isian
          label="Ulangi kata sandi"
          type="password"
          ikon={IkonKunci}
          autoComplete="new-password"
          galat={teksGalat(errors.konfirmasi)}
          {...register('konfirmasi')}
        />

        <Tombol
          type="submit"
          besar
          lebar
          className="mt-2"
          memuat={isSubmitting}
          teksMemuat="Mendaftarkan…"
          disabled={detikTunggu > 0}
        >
          {detikTunggu > 0 ? `Tunggu ${detikTunggu} detik` : 'Buat akun'}
        </Tombol>
      </form>

      <p className="small teks-lembut mt-3 mb-0 text-center">
        Akun guru dibuat oleh sekolah — pendaftaran ini hanya untuk murid.
      </p>

      <p className="auth-pemisah">Sudah punya akun?</p>
      <TombolTaut to={RUTE.masuk} varian="tepi" lebar>
        Masuk
      </TombolTaut>
    </KartuAuth>
  )
}
