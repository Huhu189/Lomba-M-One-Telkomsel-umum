/**
 * Pagar galat khusus ulangan. Prinsip chunk anticheat: fail-open — satu galat
 * render tidak boleh membuat ulangan berhenti; jawaban sudah ada di cadangan
 * lokal, jadi murid cukup menampilkan lagi layarnya.
 */
import { ErrorBoundary } from 'react-error-boundary'
import Banner from '../../shared/ui/Banner.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export default function BatasGalatUlangan({ children }) {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div className="kartu-soft p-4">
          <Banner jenis="salah" judul="Layar ulangan tersendat">
            <p className="mb-2">
              Jawaban yang sudah kamu isi tetap tersimpan di perangkat ini. Tampilkan lagi layar ulangan
              untuk melanjutkan; bila tetap gagal, beri tahu gurumu.
            </p>
            <p className="teks-lembut small mb-3">
              Catatan teknis: {error instanceof Error ? error.message : 'galat tidak dikenal'}
            </p>
            <Tombol onClick={resetErrorBoundary}>Tampilkan lagi</Tombol>
          </Banner>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
