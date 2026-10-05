/**
 * Halaman Daftar murid — RHF + Zod. Role selalu dari server (murid);
 * guru/admin dibuat lewat seeder/impor (tidak ada self-register).
 */
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { skemaDaftar } from './validasi.js'
import { daftar, pesanGalatApi, teksGalat } from './api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { RUTE } from '../../routes.js'

/**
 * @param {{ berhasil?: () => void }} props
 */
export default function HalamanDaftar({ berhasil }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(skemaDaftar),
    defaultValues: { name: '', email: '', password: '', konfirmasi: '' },
  })

  const kirim = handleSubmit(async (data) => {
    try {
      const pesan = await daftar({
        name: data.name,
        email: data.email,
        password: data.password,
      })
      tampilkanToast('sukses', pesan)
      berhasil?.()
    } catch (galat) {
      setError('root', { message: pesanGalatApi(galat) })
      tampilkanToast('salah', pesanGalatApi(galat))
    }
  })

  return (
    <div className="row justify-content-center">
      <div className="col-md-9 col-lg-7 col-xl-6">
        <div className="kartu-soft p-4 p-md-5">
          <h1 className="h4 fw-bold mb-1">Daftar murid</h1>
          <p className="text-body-secondary mb-4">
            Sudah punya akun? <Link to={RUTE.masuk}>Masuk di sini</Link>
          </p>

          <form onSubmit={kirim} noValidate>
            {errors.root?.message && (
              <div className="status-salah fw-semibold mb-3" role="alert">
                {teksGalat(errors.root)}
              </div>
            )}

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="name">
                Nama lengkap
              </label>
              <input
                id="name"
                type="text"
                className="form-control"
                autoComplete="name"
                {...register('name')}
              />
              {errors.name && (
                <p className="status-salah small mb-0 mt-1">{teksGalat(errors.name)}</p>
              )}
            </div>

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
                Kata sandi (minimal 10 karakter)
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
                Ulangi kata sandi
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
              {isSubmitting ? 'Mendaftarkan…' : 'Daftar'}
            </button>
          </form>

          <p className="small text-body-secondary mt-3 mb-0">
            Akun guru dibuat oleh sekolah — pendaftaran hanya untuk murid.
          </p>
        </div>
      </div>
    </div>
  )
}
