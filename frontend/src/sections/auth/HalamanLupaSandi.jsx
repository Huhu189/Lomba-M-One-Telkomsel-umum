/**
 * Halaman Lupa kata sandi — respons backend anti-enumerasi (pesan sama
 * untuk email terdaftar maupun tidak), jadi tampilkan pesan itu sebagai info.
 */
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { skemaLupaSandi } from './validasi.js'
import { lupaSandi, pesanGalatApi, teksGalat } from './api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { RUTE } from '../../routes.js'

export default function HalamanLupaSandi() {
  const [terkirim, setTerkirim] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(skemaLupaSandi),
    defaultValues: { email: '' },
  })

  const kirim = handleSubmit(async (data) => {
    try {
      const pesan = await lupaSandi(data.email)
      setTerkirim(true)
      tampilkanToast('info', pesan)
    } catch (galat) {
      setError('root', { message: pesanGalatApi(galat) })
      tampilkanToast('salah', pesanGalatApi(galat))
    }
  })

  return (
    <div className="row justify-content-center">
      <div className="col-md-8 col-lg-6 col-xl-5">
        <div className="kartu-soft p-4 p-md-5">
          <h1 className="h4 fw-bold mb-1">Lupa kata sandi</h1>
          <p className="text-body-secondary mb-4">
            Masukkan email — tautan pengaturan ulang akan dikirim jika email terdaftar.
          </p>

          {terkirim ? (
            <div className="status-info" role="status">
              <p className="fw-semibold">
                Silakan cek email Anda (termasuk folder spam) untuk tautan pengaturan ulang.
              </p>
              <Link to={RUTE.masuk}>Kembali ke halaman masuk</Link>
            </div>
          ) : (
            <form onSubmit={kirim} noValidate>
              {errors.root?.message && (
                <div className="status-salah fw-semibold mb-3" role="alert">
                  {teksGalat(errors.root)}
                </div>
              )}

              <div className="mb-4">
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

              <div className="d-flex flex-wrap align-items-center gap-3">
                <button type="submit" className="btn btn-aksen px-4" disabled={isSubmitting}>
                  {isSubmitting ? 'Mengirim…' : 'Kirim tautan'}
                </button>
                <Link to={RUTE.masuk}>Kembali ke masuk</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
