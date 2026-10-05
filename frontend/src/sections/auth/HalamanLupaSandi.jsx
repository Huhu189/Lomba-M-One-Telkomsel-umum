/**
 * Halaman Lupa kata sandi — respons backend anti-enumerasi (pesan sama
 * untuk email terdaftar maupun tidak), jadi hasilnya selalu "cek email".
 * Kirim ulang diberi jeda 60 detik di sisi tampilan (server tetap throttle).
 */
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { skemaLupaSandi } from './validasi.js'
import { lupaSandi, pesanGalatApi, teksGalat } from './api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import Isian from '../../shared/ui/Isian.jsx'
import Banner from '../../shared/ui/Banner.jsx'
import { IlustrasiSurat } from '../../shared/ui/Maskot.jsx'
import { Tombol, TombolTaut } from '../../shared/ui/Tombol.jsx'
import { useHitungMundur } from '../../shared/ui/useHitungMundur.js'
import { IkonKunci, IkonPanahKiri, IkonSurat } from '../../icons.jsx'
import { RUTE } from '../../routes.js'
import { sudahDitampilkanSebagaiTunggu, useAuthStore } from './authStore.js'
import KartuAuth from './KartuAuth.jsx'
import PeringatanTunggu from './PeringatanTunggu.jsx'

const JEDA_KIRIM_ULANG = 60

export default function HalamanLupaSandi() {
  const detikTunggu = useAuthStore((s) => s.detikTunggu)
  const [emailTerkirim, setEmailTerkirim] = useState('')
  const jeda = useHitungMundur()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm({
    resolver: zodResolver(skemaLupaSandi),
    defaultValues: { email: '' },
  })

  /** @param {string} email */
  async function kirimTautan(email) {
    const pesan = await lupaSandi(email)
    setEmailTerkirim(email.toLowerCase())
    jeda.mulai(JEDA_KIRIM_ULANG)
    return pesan
  }

  const kirim = handleSubmit(async (data) => {
    clearErrors('root')
    try {
      await kirimTautan(data.email)
    } catch (galat) {
      if (!sudahDitampilkanSebagaiTunggu(galat)) {
        setError('root', { message: pesanGalatApi(galat) })
      }
    }
  })

  async function kirimUlang() {
    try {
      await kirimTautan(emailTerkirim)
      tampilkanToast('info', 'Tautan dikirim ulang. Cek kotak masuk dan folder spam.')
    } catch (galat) {
      tampilkanToast('salah', pesanGalatApi(galat))
    }
  }

  if (emailTerkirim) {
    return (
      <KartuAuth judul="Cek email kamu" tengah>
        <IlustrasiSurat className="mb-3" />
        <p>
          Jika <strong className="text-break">{emailTerkirim}</strong> terdaftar, tautan untuk
          membuat kata sandi baru sudah kami kirim.
        </p>
        <p className="teks-lembut small">
          Belum masuk? Lihat juga folder spam. Tautan hanya berlaku sebentar.
        </p>

        <div className="d-grid gap-2 mt-4">
          <Tombol
            varian="tepi"
            onClick={kirimUlang}
            disabled={jeda.sisa > 0 || detikTunggu > 0}
          >
            {jeda.sisa > 0 ? `Kirim ulang dalam ${jeda.sisa} detik` : 'Kirim ulang tautan'}
          </Tombol>
          <TombolTaut to={RUTE.masuk} varian="teks" ikon={IkonPanahKiri}>
            Kembali ke halaman masuk
          </TombolTaut>
        </div>
      </KartuAuth>
    )
  }

  return (
    <KartuAuth
      judul="Lupa kata sandi?"
      sub="Tenang, masukkan emailmu. Kami kirim tautan untuk membuat kata sandi baru."
      ikon={IkonKunci}
    >
      <form onSubmit={kirim} noValidate>
        <PeringatanTunggu />

        {errors.root?.message && (
          <Banner jenis="salah" judul="Tautan belum terkirim">
            {teksGalat(errors.root)}
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

        <Tombol
          type="submit"
          besar
          lebar
          memuat={isSubmitting}
          teksMemuat="Mengirim…"
          disabled={detikTunggu > 0}
        >
          {detikTunggu > 0 ? `Tunggu ${detikTunggu} detik` : 'Kirim tautan'}
        </Tombol>
      </form>

      <div className="text-center mt-3">
        <TombolTaut to={RUTE.masuk} varian="teks" ikon={IkonPanahKiri}>
          Kembali ke halaman masuk
        </TombolTaut>
      </div>
    </KartuAuth>
  )
}
