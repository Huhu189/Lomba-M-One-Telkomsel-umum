/**
 * Tautan materi: satu tombol yang **langsung menyalin** alamat materi, dengan
 * kotak cadangan bila peramban menolak akses klip papan (konteks non-HTTPS atau
 * izin dicabut).
 *
 * Beda dari `TautanSiswa` (kuis) yang tombolnya membuka kotak lebih dulu: di
 * editor materi, guru membagikan tautan berulang kali ke grup kelas, jadi satu
 * klik = tersalin lebih penting daripada satu langkah tambahan. Kotaknya tetap
 * terbuka supaya guru bisa **melihat** apa yang tersalin dan menyalin manual bila
 * perambannya menolak — bukan tombol yang ditekan lalu diam.
 */
import { useState } from 'react'
import { IkonTautan } from '../../../icons.jsx'
import { Tombol } from '../../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../../shared/ui/toast.jsx'
import { catatanMateri, tautanMateri } from './materiTautan.js'

/**
 * @param {{
 *   id: number,
 *   status?: string,
 *   kelas?: string,
 *   kelasBebas?: boolean,
 *   ukuran?: 'sedang'|'besar',
 * }} props
 */
export default function TautanMateri({
  id,
  status = 'draf',
  kelas = '',
  kelasBebas = false,
  ukuran = 'sedang',
}) {
  const [tampil, setTampil] = useState(false)

  const tautan = typeof window === 'undefined' ? '' : tautanMateri(id, window.location.origin)
  const catatan = catatanMateri({ status, kelas, kelasBebas })
  const belumAda = tautan === ''

  /** Salin tautannya; bila peramban menolak, katakan apa adanya dan buka kotaknya. */
  async function salin() {
    setTampil(true)

    try {
      if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('tanpa klip papan')
      await navigator.clipboard.writeText(tautan)
      tampilkanToast('sukses', 'Tautan materi disalin. Kirim ke grup kelas.')
    } catch {
      tampilkanToast(
        'info',
        'Peramban ini tidak mengizinkan salin otomatis. Salin tautannya dari kotak di bawah.',
      )
    }
  }

  return (
    <div className="tautan-materi">
      <Tombol
        varian="tepi"
        ukuran={ukuran}
        ikon={IkonTautan}
        disabled={belumAda}
        aria-expanded={tampil}
        title={belumAda ? 'Materinya belum punya alamat — simpan dulu.' : 'Salin tautan materi ini'}
        onClick={() => void salin()}
      >
        Salin tautan materi
      </Tombol>

      {belumAda ? (
        <p className="teks-lembut small mb-0">
          Materinya belum punya alamat, jadi belum ada tautan yang bisa dibagikan.
        </p>
      ) : (
        tampil && (
          <div className="tautan-materi-kotak">
            <input
              className="form-control form-control-sm"
              readOnly
              value={tautan}
              aria-label="Tautan materi"
              onFocus={(e) => e.target.select()}
            />

            {catatan.map((satu) => (
              <p key={satu} className="teks-lembut small mb-0 w-100">
                {satu}
              </p>
            ))}
          </div>
        )
      )}
    </div>
  )
}
