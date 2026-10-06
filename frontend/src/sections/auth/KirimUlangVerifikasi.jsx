/**
 * Blok "kirim ulang tautan verifikasi" yang dipakai dua halaman.
 * - Email sudah diketahui (baru daftar): cukup satu tombol.
 * - Email belum diketahui: form dengan satu isian.
 * Respons server identik untuk email apa pun (anti-enumerasi), jadi
 * pesan sukses selalu bernada "jika terdaftar…". Jeda 60 detik hanya
 * kenyamanan tampilan; server tetap membatasi (throttle).
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { skemaKirimUlang } from './validasi.js'
import { kirimUlangVerifikasi, kirimUlangVerifikasiSesi, pesanGalatApi, teksGalat } from './api.js'
import { sudahDitampilkanSebagaiTunggu, useAuthStore } from './authStore.js'
import Isian from '../../shared/ui/Isian.jsx'
import Banner from '../../shared/ui/Banner.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { useHitungMundur } from '../../shared/ui/useHitungMundur.js'
import { IkonSurat } from '../../icons.jsx'
import PeringatanTunggu from './PeringatanTunggu.jsx'

const JEDA = 60

/**
 * @param {{ emailAwal?: string, jedaAwal?: number }} props
 */
export default function KirimUlangVerifikasi({ emailAwal = '', jedaAwal = 0 }) {
  const detikTunggu = useAuthStore((s) => s.detikTunggu)
  const emailSesi = useAuthStore((s) => s.user?.email ?? '')
  const jeda = useHitungMundur()
  const [terkirimKe, setTerkirimKe] = useState('')
  const [galatServer, setGalatServer] = useState('')
  const [emailGagalTerkirim, setEmailGagalTerkirim] = useState(false)

  const { mulai } = jeda
  useEffect(() => {
    if (jedaAwal > 0) mulai(jedaAwal)
  }, [jedaAwal, mulai])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(skemaKirimUlang),
    defaultValues: { email: emailAwal },
  })

  /** @param {{ email: string }} data */
  async function proses(data) {
    setGalatServer('')
    setEmailGagalTerkirim(false)
    const emailKirim = data.email.toLowerCase()

    try {
      // Bila yang mengirim adalah pemilik akun yang sedang masuk, pakai jalur sesi:
      // server melaporkan jujur apakah email benar-benar terkirim.
      if (emailSesi !== '' && emailKirim === emailSesi.toLowerCase()) {
        const hasil = await kirimUlangVerifikasiSesi()
        mulai(JEDA)
        if (!hasil.email_terkirim) {
          setEmailGagalTerkirim(true)
          return
        }
      } else {
        await kirimUlangVerifikasi(data.email)
        mulai(JEDA)
      }

      setTerkirimKe(emailKirim)
    } catch (galat) {
      if (!sudahDitampilkanSebagaiTunggu(galat)) setGalatServer(pesanGalatApi(galat))
    }
  }

  const kirim = handleSubmit(proses)
  const menunggu = jeda.sisa > 0 || detikTunggu > 0
  const teksTombol = jeda.sisa > 0 ? `Kirim ulang dalam ${jeda.sisa} detik` : 'Kirim ulang tautan'

  return (
    <div>
      <PeringatanTunggu />

      {terkirimKe && (
        <Banner jenis="sukses" judul="Tautan dikirim">
          Jika <strong className="text-break">{terkirimKe}</strong> belum terverifikasi, tautan baru
          sudah dikirim. Cek juga folder spam.
        </Banner>
      )}
      {emailGagalTerkirim && (
        <Banner jenis="peringatan" judul="Email belum terkirim">
          Akunmu sudah aktif di perangkat ini, tetapi layanan email sekolah sedang sibuk. Coba lagi
          beberapa saat, atau minta guru memverifikasi akunmu.
        </Banner>
      )}
      {galatServer && (
        <Banner jenis="salah" judul="Belum terkirim">
          {galatServer}
        </Banner>
      )}

      <form onSubmit={kirim} noValidate>
        {emailAwal === '' && (
          <Isian
            label="Email akun"
            type="email"
            ikon={IkonSurat}
            autoComplete="email"
            inputMode="email"
            placeholder="nama@email.com"
            galat={teksGalat(errors.email)}
            {...register('email')}
          />
        )}
        <Tombol
          type="submit"
          varian={emailAwal === '' ? 'utama' : 'tepi'}
          lebar
          besar={emailAwal === ''}
          ikon={IkonSurat}
          memuat={isSubmitting}
          teksMemuat="Mengirim…"
          disabled={menunggu}
        >
          {teksTombol}
        </Tombol>
      </form>
    </div>
  )
}
