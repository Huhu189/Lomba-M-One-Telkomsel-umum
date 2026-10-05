/**
 * Halaman Perlu verifikasi — ditampilkan setelah daftar / saat mencoba masuk
 * dengan akun yang belum verifikasi email. Form kirim ulang memakai endpoint
 * publik (tanpa sesi) dengan respons identik (anti-enumerasi).
 */
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { skemaKirimUlang } from './validasi.js'
import { kirimUlangVerifikasi, pesanGalatApi, teksGalat } from './api.js'
import { useAuthStore } from './authStore.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { RUTE } from '../../routes.js'

export default function HalamanPerluVerifikasi() {
  const emailTersimpan = useAuthStore((s) => s.user?.email ?? '')
  const [terkirim, setTerkirim] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(skemaKirimUlang),
    defaultValues: { email: emailTersimpan },
  })

  const kirim = handleSubmit(async (data) => {
    try {
      const pesan = await kirimUlangVerifikasi(data.email)
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
          <h1 className="h4 fw-bold mb-1">Verifikasi email dulu, ya</h1>
          <p className="text-body-secondary">
            Kami mengirim tautan verifikasi ke email Anda. Buka tautan itu agar akun
            bisa aktif. Belum menerima email? Kirim ulang di bawah.
          </p>

          {terkirim ? (
            <div className="status-info" role="status">
              <p className="fw-semibold mb-0">
                Tautan verifikasi dikirim (jika email belum terverifikasi). Cek folder spam
                juga, ya.
              </p>
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
                  Email akun
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
                  {isSubmitting ? 'Mengirim…' : 'Kirim ulang tautan'}
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
