/**
 * Halaman Atur ulang kata sandi — token & email dari query string
 * (tautan email mengarah ke frontend: /atur-ulang-sandi?token=…&email=…).
 */
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { skemaAturUlang } from './validasi.js'
import { aturUlangSandi, pesanGalatApi, teksGalat } from './api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { RUTE } from '../../routes.js'

export default function HalamanAturUlangSandi() {
  const [parameter] = useSearchParams()
  const token = parameter.get('token') ?? ''
  const emailDariTautan = parameter.get('email') ?? ''
  const [berhasil, setBerhasil] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(skemaAturUlang),
    defaultValues: { token, email: emailDariTautan, password: '', konfirmasi: '' },
  })

  const kirim = handleSubmit(async (data) => {
    try {
      const pesan = await aturUlangSandi({
        token: data.token,
        email: data.email,
        password: data.password,
      })
      setBerhasil(true)
      tampilkanToast('sukses', pesan)
    } catch (galat) {
      setError('root', { message: pesanGalatApi(galat) })
      tampilkanToast('salah', pesanGalatApi(galat))
    }
  })

  return (
    <div className="row justify-content-center">
      <div className="col-md-8 col-lg-6 col-xl-5">
        <div className="kartu-soft p-4 p-md-5">
          <h1 className="h4 fw-bold mb-1">Atur ulang kata sandi</h1>

          {berhasil ? (
            <div className="status-benar" role="status">
              <p className="fw-semibold">Kata sandi berhasil diganti.</p>
              <Link to={RUTE.masuk}>Masuk dengan kata sandi baru</Link>
            </div>
          ) : (
            <>
              <p className="text-body-secondary mb-4">
                Buat kata sandi baru (minimal 10 karakter) untuk{' '}
                <strong>{emailDariTautan || 'email Anda'}</strong>.
              </p>

              <form onSubmit={kirim} noValidate>
                {errors.root?.message && (
                  <div className="status-salah fw-semibold mb-3" role="alert">
                    {teksGalat(errors.root)}
                  </div>
                )}

                <input type="hidden" {...register('token')} />

                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="form-control"
                    autoComplete="email"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="status-salah small mb-0 mt-1">{teksGalat(errors.email)}</p>
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="password">
                    Kata sandi baru (minimal 10 karakter)
                  </label>
                  <input
                    id="password"
                    type="password"
                    className="form-control"
                    autoComplete="new-password"
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="status-salah small mb-0 mt-1">{teksGalat(errors.password)}</p>
                  )}
                </div>

                <div className="mb-4">
                  <label className="form-label fw-semibold" htmlFor="konfirmasi">
                    Ulangi kata sandi baru
                  </label>
                  <input
                    id="konfirmasi"
                    type="password"
                    className="form-control"
                    autoComplete="new-password"
                    {...register('konfirmasi')}
                  />
                  {errors.konfirmasi && (
                    <p className="status-salah small mb-0 mt-1">{teksGalat(errors.konfirmasi)}</p>
                  )}
                </div>

                <button type="submit" className="btn btn-aksen px-4" disabled={isSubmitting}>
                  {isSubmitting ? 'Menyimpan…' : 'Simpan kata sandi baru'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
