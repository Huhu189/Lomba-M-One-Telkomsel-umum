/**
 * Halaman Atur ulang kata sandi — token & email dari query string
 * (tautan email mengarah ke frontend: /atur-ulang-sandi?token=…&email=…).
 * Tanpa token, form tidak ditampilkan (tidak ada gunanya) dan murid diarahkan
 * meminta tautan baru.
 */
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { skemaAturUlang } from './validasi.js'
import { aturUlangSandi, pesanGalatApi, teksGalat } from './api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import Isian from '../../shared/ui/Isian.jsx'
import Banner from '../../shared/ui/Banner.jsx'
import MeterSandi from '../../shared/ui/MeterSandi.jsx'
import { Tombol, TombolTaut } from '../../shared/ui/Tombol.jsx'
import { IkonKunci, IkonSurat } from '../../icons.jsx'
import { RUTE } from '../../routes.js'
import { sudahDitampilkanSebagaiTunggu, useAuthStore } from './authStore.js'
import KartuAuth from './KartuAuth.jsx'
import PeringatanTunggu from './PeringatanTunggu.jsx'

export default function HalamanAturUlangSandi() {
  const [parameter] = useSearchParams()
  const token = parameter.get('token') ?? ''
  const emailDariTautan = parameter.get('email') ?? ''
  const detikTunggu = useAuthStore((s) => s.detikTunggu)
  const [berhasil, setBerhasil] = useState(false)
  const [tautanDipakai, setTautanDipakai] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm({
    resolver: zodResolver(skemaAturUlang),
    defaultValues: { token, email: emailDariTautan, password: '', konfirmasi: '' },
  })

  const sandi = watch('password')

  const kirim = handleSubmit(async (data) => {
    clearErrors('root')
    try {
      const hasil = await aturUlangSandi({
        token: data.token,
        email: data.email,
        password: data.password,
      })

      if (hasil.tautan_dipakai) {
        // Token sekali pakai sudah habis: form ini tidak akan pernah berhasil
        // lagi — tunjukkan halaman khusus, jangan biarkan anak menebak-nebak.
        setTautanDipakai(true)
        return
      }

      setBerhasil(true)
      tampilkanToast('sukses', hasil.message)
    } catch (galat) {
      if (!sudahDitampilkanSebagaiTunggu(galat)) {
        setError('root', { message: pesanGalatApi(galat) })
      }
    }
  })

  if (tautanDipakai) {
    return (
      <KartuAuth judul="Tautan sudah pernah dipakai" tengah>
        <span className="fitur-ikon hangat mx-auto" aria-hidden="true">
          <IkonSurat size={28} />
        </span>
        <p className="teks-lembut">
          Setiap tautan pengaturan ulang hanya berlaku sekali. Kata sandi kemungkinan sudah
          diganti oleh tautan ini. Kalau memang kamu yang memakainya, cukup masuk memakai kata
          sandi terbaru. Kalau bukan kamu, minta tautan yang baru.
        </p>
        <div className="d-grid gap-2">
          <TombolTaut to={RUTE.masuk} besar lebar>
            Masuk
          </TombolTaut>
          <TombolTaut to={RUTE.lupaSandi} varian="tepi" lebar>
            Minta tautan baru
          </TombolTaut>
        </div>
      </KartuAuth>
    )
  }

  if (berhasil) {
    return (
      <KartuAuth judul="Kata sandi sudah diganti!" tengah>
        <span className="fitur-ikon mx-auto" aria-hidden="true">
          <IkonKunci size={28} />
        </span>
        <p className="teks-lembut">Sekarang kamu bisa masuk memakai kata sandi yang baru.</p>
        <TombolTaut to={RUTE.masuk} besar lebar>
          Masuk sekarang
        </TombolTaut>
      </KartuAuth>
    )
  }

  if (token === '') {
    return (
      <KartuAuth judul="Tautan belum lengkap" tengah>
        <span className="fitur-ikon hangat mx-auto" aria-hidden="true">
          <IkonSurat size={28} />
        </span>
        <p className="teks-lembut">
          Buka tautan langsung dari email pengaturan ulang, atau minta tautan yang baru.
        </p>
        <TombolTaut to={RUTE.lupaSandi} besar lebar>
          Minta tautan baru
        </TombolTaut>
      </KartuAuth>
    )
  }

  return (
    <KartuAuth
      judul="Buat kata sandi baru"
      sub={
        emailDariTautan ? (
          <>
            Untuk akun <strong className="text-break">{emailDariTautan}</strong>.
          </>
        ) : (
          'Masukkan email akunmu dan kata sandi baru.'
        )
      }
      ikon={IkonKunci}
    >
      <form onSubmit={kirim} noValidate>
        <PeringatanTunggu />

        {errors.root?.message && (
          <Banner jenis="salah" judul="Belum berhasil">
            {teksGalat(errors.root)}{' '}
            <Link to={RUTE.lupaSandi} className="d-block mt-1">
              Minta tautan baru
            </Link>
          </Banner>
        )}

        <input type="hidden" {...register('token')} />
        {emailDariTautan ? (
          <input type="hidden" {...register('email')} />
        ) : (
          <Isian
            label="Email"
            type="email"
            ikon={IkonSurat}
            autoComplete="email"
            inputMode="email"
            galat={teksGalat(errors.email)}
            {...register('email')}
          />
        )}

        <Isian
          label="Kata sandi baru"
          type="password"
          ikon={IkonKunci}
          autoComplete="new-password"
          bantuan="Minimal 10 karakter."
          galat={teksGalat(errors.password)}
          {...register('password')}
        />
        <MeterSandi sandi={sandi} />

        <Isian
          label="Ulangi kata sandi baru"
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
          teksMemuat="Menyimpan…"
          disabled={detikTunggu > 0}
        >
          {detikTunggu > 0 ? `Tunggu ${detikTunggu} detik` : 'Simpan kata sandi baru'}
        </Tombol>
      </form>
    </KartuAuth>
  )
}
