/**
 * Halaman Verifikasi email — tautan bertanda tangan dari email mengarah ke
 * sini dengan query ?status=berhasil|gagal (redirect dari backend).
 * Memakai data URL saja (pagar mutu: data luar lewat Zod; query string
 * divalidasi manual dengan skema Zod).
 */
import { z } from 'zod'
import { Link, useSearchParams } from 'react-router-dom'
import { skemaKirimUlang } from './validasi.js'
import { kirimUlangVerifikasi, pesanGalatApi } from './api.js'
import { useAuthStore } from './authStore.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { RUTE } from '../../routes.js'

/** Skema query status dari redirect backend. */
const skemaQueryStatus = z.object({
  status: z.enum(['berhasil', 'gagal']),
})

export default function HalamanVerifikasiEmail() {
  const [parameter] = useSearchParams()

  const email = useAuthStore((s) => s.user?.email ?? '')

  const terurai = skemaQueryStatus.safeParse({
    status: parameter.get('status') ?? '',
  })
  const berhasil = terurai.success && terurai.data.status === 'berhasil'

  /**
   * Kirim ulang tautan untuk email yang diketik pengguna (tanpa sesi).
   * @param {import('react').FormEvent<HTMLFormElement>} acara
   */
  async function kirimUlang(acara) {
    acara.preventDefault()
    const dataForm = new FormData(acara.currentTarget)
    const hasil = skemaKirimUlang.safeParse({ email: String(dataForm.get('email') ?? '') })

    if (!hasil.success) {
      tampilkanToast('salah', hasil.error.issues[0]?.message ?? 'Email tidak valid.')
      return
    }

    try {
      const pesan = await kirimUlangVerifikasi(hasil.data.email)
      tampilkanToast('info', pesan)
    } catch (galat) {
      tampilkanToast('salah', pesanGalatApi(galat))
    }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-md-8 col-lg-6 col-xl-5">
        <div className="kartu-soft p-4 p-md-5 text-center">
          {berhasil ? (
            <>
              <h1 className="h4 fw-bold status-benar">Email berhasil diverifikasi!</h1>
              <p className="text-body-secondary">
                Akun Anda sudah aktif. Silakan masuk untuk mulai belajar.
              </p>
              <Link className="btn btn-aksen px-4" to={RUTE.masuk}>
                Masuk sekarang
              </Link>
            </>
          ) : (
            <>
              <h1 className="h4 fw-bold status-salah">Verifikasi email gagal.</h1>
              <p className="text-body-secondary">
                Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru di bawah.
              </p>

              <form onSubmit={kirimUlang} noValidate className="mt-3">
                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="email-verifikasi">
                    Email akun
                  </label>
                  <input
                    id="email-verifikasi"
                    name="email"
                    type="email"
                    className="form-control"
                    defaultValue={email}
                    autoComplete="email"
                  />
                </div>
                <button type="submit" className="btn btn-aksen px-4">
                  Kirim ulang tautan verifikasi
                </button>
              </form>

              <p className="mt-3 mb-0">
                <Link to={RUTE.masuk}>Kembali ke halaman masuk</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
