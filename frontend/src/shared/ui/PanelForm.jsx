/**
 * Panel formulir samping (papan Kelas "sesudah").
 *
 * Dipakai halaman data induk supaya daftar memakai lebar penuh dan formulir
 * tambah/ubah muncul saat dibutuhkan. Berbasis elemen <dialog> modal, jadi
 * fokus terkunci, Esc menutup, dan latar digelapkan oleh ::backdrop tanpa
 * pustaka tambahan.
 */
import { useEffect, useRef } from 'react'
import { IkonSilang } from '../../icons.jsx'
import { TombolIkon } from './Tombol.jsx'

/**
 * @param {{
 *   buka: boolean,
 *   judul: string,
 *   labelTutup: string,
 *   onTutup: () => void,
 *   children: import('react').ReactNode,
 * }} props
 */
export default function PanelForm({ buka, judul, labelTutup, onTutup, children }) {
  const ref = useRef(/** @type {HTMLDialogElement|null} */ (null))

  useEffect(() => {
    const d = ref.current
    if (!d) return
    const bisaModal = typeof d.showModal === 'function'
    if (buka && !d.open) {
      if (bisaModal) d.showModal()
      else d.setAttribute('open', '')
    } else if (!buka && d.open) {
      if (bisaModal) d.close()
      else d.removeAttribute('open')
    }
  }, [buka])

  return (
    <dialog
      ref={ref}
      className="dialog dialog-samping"
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-panel-form"
      onCancel={(e) => {
        e.preventDefault()
        onTutup()
      }}
    >
      <div className="d-flex align-items-center gap-2 mb-4">
        <h2 id="judul-panel-form" className="judul-bagian mb-0 flex-grow-1">
          {judul}
        </h2>
        <TombolIkon label={labelTutup} ikon={IkonSilang} onClick={onTutup} />
      </div>
      {children}
    </dialog>
  )
}
