/**
 * Halaman Masuk (login) — RHF + Zod, toast, hitung mundur throttle.
 * Pesan galat kredensial dari backend sudah anti-enumerasi.
 */
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { skemaMasuk } from './validasi.js'
import { pesanGalatApi, teksGalat } from './api.js'
import { useAuthStore } from './authStore.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { RUTE } from '../../routes.js'

/**
 * @param {{ berhasil?: (user: import('./authStore.js').DataUser) => void }} props
 */
export default function HalamanMasuk({ berhasil }) {
  const masuk = useAuthStore((s) => s.masuk)
  const detikTunggu = useAuthStore((s) => s.detikTunggu)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(skemaMasuk),
    defaultValues: { email: '', password: '' },
  })

  const kirim = handleSubmit(async (data) => {
    try {
      const user = await masuk(data)
      tampilkanToast('sukses', `Selamat datang, ${user.name}!`)
      berhasil?.(user)
    } catch (galat) {
      setError('root', { message: pesanGalatApi(galat) })
      tampilkanToast('salah', pesanGalatApi(galat))
    }
  })

  return (
    <div className="row justify-content-center">
      <div className="col-md-8 col-lg-6 col-xl-5">
        <div className="kartu-soft p-4 p-md-5">
          <h1 className="h4 fw-bold mb-1">Masuk</h1>
          <p className="text-body-secondary mb-4">
            Belum punya akun?{' '}
            <Link to={RUTE.daftar}>Daftar sebagai murid</Link>
          </p>

          <form onSubmit={kirim} noValidate>
            {errors.root?.message && (
              <div className="status-salah fw-semibold mb-3" role="alert">
                {teksGalat(errors.root)}
              </div>
            )}

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

            <div className="mb-4">
              <label className="form-label fw-semibold" htmlFor="password">
                Kata sandi
              </label>
              <input
                id="password"
                type="password"
                className="form-control"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="status-salah small mb-0 mt-1">{teksGalat(errors.password)}</p>
              )}
            </div>

            <div className="d-flex flex-wrap align-items-center gap-3">
              <button
                type="submit"
                className="btn btn-aksen px-4"
                disabled={isSubmitting || detikTunggu > 0}
              >
                {detikTunggu > 0 ? `Tunggu ${detikTunggu} detik…` : 'Masuk'}
              </button>
              <Link to={RUTE.lupaSandi}>Lupa kata sandi?</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
