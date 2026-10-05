/**
 * Halaman Verifikasi email — tautan bertanda tangan dari email mengarah ke
 * backend, lalu diarahkan ke sini dengan query ?status=berhasil|gagal.
 * Query string divalidasi Zod (pagar mutu: data luar lewat Zod).
 */
import { z } from 'zod'
import { useSearchParams } from 'react-router-dom'
import { MaskotBuku } from '../../shared/ui/Maskot.jsx'
import { TombolTaut } from '../../shared/ui/Tombol.jsx'
import { IkonPanahKiri } from '../../icons.jsx'
import { RUTE } from '../../routes.js'
import { useAuthStore } from './authStore.js'
import KartuAuth from './KartuAuth.jsx'
import KirimUlangVerifikasi from './KirimUlangVerifikasi.jsx'

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

  if (berhasil) {
    return (
      <KartuAuth judul="Email terverifikasi!" tengah>
        <MaskotBuku ukuran={160} label="Maskot buku bersorak gembira" melayang className="mb-3" />
        <p className="teks-lembut">Akunmu sudah aktif. Yuk masuk dan mulai belajar.</p>
        <TombolTaut to={RUTE.masuk} besar lebar>
          Masuk sekarang
        </TombolTaut>
      </KartuAuth>
    )
  }

  return (
    <KartuAuth judul="Tautan tidak berlaku" tengah>
      <MaskotBuku ukuran={140} suasana="sedih" label="Maskot buku sedih" className="mb-3" />
      <p className="teks-lembut mb-4">
        Tautan ini sudah kedaluwarsa atau tidak benar. Tenang, kamu bisa minta tautan yang baru.
      </p>

      <div className="text-start">
        <KirimUlangVerifikasi emailAwal={email} />
      </div>

      <div className="d-grid mt-3">
        <TombolTaut to={RUTE.masuk} varian="teks" ikon={IkonPanahKiri}>
          Kembali ke halaman masuk
        </TombolTaut>
      </div>
    </KartuAuth>
  )
}
