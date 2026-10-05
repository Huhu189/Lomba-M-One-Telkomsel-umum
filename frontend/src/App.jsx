/**
 * Halaman demo slice 00 — kerangka aplikasi + tema + toast + ikon.
 * Belum ada fitur bisnis; fitur mulai slice 01 (lihat chunk_map.json).
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { daftarIkon } from './icons.jsx'
import { ToastHost, tampilkanToast } from './shared/ui/toast.jsx'
import { ambilHealth } from './shared/api/health.js'

const JENIS_TOAST = /** @type {const} */ (['sukses', 'salah', 'peringatan', 'info'])

/** Sediaan warna palet untuk kartu demo (dari chunk theme). */
const PALET = [
  { nama: 'Latar', varCss: '--latar', hex: '#F8FAFC' },
  { nama: 'Aksen', varCss: '--aksen', hex: '#0EA5E9' },
  { nama: 'Pendukung', varCss: '--pendukung', hex: '#95A7D5' },
  { nama: 'Sorot hangat', varCss: '--sorot-hangat', hex: '#EEF385' },
  { nama: 'Sidebar guru', varCss: '--guru-sidebar', hex: '#1A2F65' },
  { nama: 'Teks', varCss: '--teks', hex: '#0F172A' },
]

/** Halaman demo (dirombak total pada slice berikutnya). */
export default function App() {
  const [gelap, setGelap] = useState(false)

  const health = useQuery({
    queryKey: ['health'],
    queryFn: ambilHealth,
    refetchInterval: 30_000,
  })

  /**
   * Ganti mode terang/gelap lewat data-bs-theme (Bootstrap 5.3 CSS).
   * @param {boolean} jadiGelap
   */
  function ubahTema(jadiGelap) {
    setGelap(jadiGelap)
    document.documentElement.setAttribute(
      'data-bs-theme',
      jadiGelap ? 'dark' : 'light',
    )
  }

  return (
    <div className="container py-4">
      <ToastHost />

      <header className="d-flex flex-wrap align-items-center gap-3 mb-4">
        <h1 className="h3 fw-bold mb-0 me-auto">Ulangan Sekolah — Slice 00</h1>
        <button
          type="button"
          className="btn btn-aksen"
          onClick={() => ubahTema(!gelap)}
        >
          {gelap ? '☀ Mode terang' : '🌙 Mode gelap'}
        </button>
      </header>

      <div className="row g-4">
        <section className="col-lg-6">
          <div className="kartu-soft p-4 h-100">
            <h2 className="h5 fw-bold">Status backend (via Zod)</h2>
            {health.isPending && <p>Memuat status…</p>}
            {health.isError && (
              <p className="status-salah fw-bold" role="alert">
                Backend tidak terjangkau — jalankan `php artisan serve` di backend/.
              </p>
            )}
            {health.data && (
              <ul className="mb-2">
                <li>
                  Layanan: <strong>{health.data.service}</strong> —{' '}
                  <span className="status-benar">hidup</span>
                </li>
                <li>
                  Database:{' '}
                  {health.data.database ? (
                    <span className="status-benar">terhubung</span>
                  ) : (
                    <span className="status-salah">terputus</span>
                  )}
                </li>
                <li>Waktu server: {dayjs(health.data.time).format('DD MMM YYYY HH:mm:ss')}</li>
              </ul>
            )}
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => health.refetch()}
            >
              Muat ulang status
            </button>
          </div>
        </section>

        <section className="col-lg-6">
          <div className="kartu-soft p-4 h-100">
            <h2 className="h5 fw-bold">Demo toast (buatan sendiri)</h2>
            <div className="d-flex flex-wrap gap-2">
              {JENIS_TOAST.map((jenis) => (
                <button
                  key={jenis}
                  type="button"
                  className="btn btn-outline-primary text-capitalize"
                  onClick={() => tampilkanToast(jenis, `Contoh toast jenis ${jenis}.`)}
                >
                  {jenis}
                </button>
              ))}
            </div>
            <p className="mt-3 mb-0 text-body-secondary small">
              Toast memakai warna status dari variabel CSS, ikon + teks, aria-live.
            </p>
          </div>
        </section>

        <section className="col-lg-6">
          <div className="kartu-soft p-4 h-100">
            <h2 className="h5 fw-bold">Ikon SVG (src/icons.jsx)</h2>
            <div className="d-flex flex-wrap gap-3 fs-4">
              {Object.entries(daftarIkon).map(([nama, Ikon]) => (
                <span
                  key={nama}
                  title={nama}
                  style={{ color: 'var(--aksen)' }}
                >
                  <Ikon size={26} label={nama} />
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="col-lg-6">
          <div className="kartu-soft p-4 h-100">
            <h2 className="h5 fw-bold">Palet (variabel CSS)</h2>
            <div className="row g-2">
              {PALET.map((p) => (
                <div className="col-6 col-md-4" key={p.varCss}>
                  <div
                    className="swatch"
                    style={{ backgroundColor: `var(${p.varCss})` }}
                  >
                    {p.hex}
                  </div>
                  <p className="small text-center mb-0 mt-1">{p.nama}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className="text-center text-body-secondary small mt-4">
        Struktur: <code>src/sections/</code> · <code>src/shared/</code> ·{' '}
        <code>src/security/</code> — fitur bisnis mulai slice 01.
      </footer>
    </div>
  )
}
