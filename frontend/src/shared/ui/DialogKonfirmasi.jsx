/**
 * Dialog konfirmasi berbasis elemen <dialog> bawaan browser (papan Standar,
 * temuan 02). Menggantikan window.confirm: bisa diberi gaya, isinya menyebut
 * dampak tindakan, dan tetap bekerja di webview HP.
 *
 * `<dialog>` memberi fokus terkunci, Esc menutup, dan `::backdrop` gratis.
 * Saat `buka` benar, dialog dibuka sebagai modal; menutup lewat Esc tetap
 * memanggil `onBatal` supaya status React dan DOM tidak pernah berbeda.
 */
import { useEffect, useRef } from 'react'
import { IkonPeringatan } from '../../icons.jsx'
import { Tombol } from './Tombol.jsx'

/**
 * @param {{
 *   buka: boolean,
 *   judul: string,
 *   labelYa: string,
 *   bahaya?: boolean,
 *   memuat?: boolean,
 *   onYa: () => void,
 *   onBatal: () => void,
 *   children?: import('react').ReactNode,
 * }} props
 */
export default function DialogKonfirmasi({
  buka,
  judul,
  labelYa,
  bahaya = false,
  memuat = false,
  onYa,
  onBatal,
  children,
}) {
  const ref = useRef(/** @type {HTMLDialogElement|null} */ (null))

  useEffect(() => {
    const d = ref.current
    if (!d) return
    // Browser lama / webview tanpa showModal(): pakai atribut open apa adanya.
    const bisaModal = typeof d.showModal === 'function'
    if (buka) {
      if (d.open) return
      if (bisaModal) d.showModal()
      else d.setAttribute('open', '')
    } else if (d.open) {
      if (bisaModal) d.close()
      else d.removeAttribute('open')
    }
  }, [buka])

  return (
    <dialog
      ref={ref}
      className={bahaya ? 'dialog dialog-bahaya' : 'dialog'}
      role="alertdialog"
      aria-labelledby="dialog-konfirmasi-judul"
      aria-describedby="dialog-konfirmasi-isi"
      onCancel={(e) => {
        e.preventDefault()
        if (!memuat) onBatal()
      }}
      onClose={() => {
        // Esc/klik backdrop: selaraskan status React dengan DOM.
        if (!memuat && buka) onBatal()
      }}
    >
      {bahaya && (
        <span className="dialog-ikon" aria-hidden="true">
          <IkonPeringatan size={26} />
        </span>
      )}
      <h2 id="dialog-konfirmasi-judul" className="h4 fw-bold">
        {judul}
      </h2>
      <div id="dialog-konfirmasi-isi" className="teks-lembut">
        {children}
      </div>
      <div className="d-flex flex-wrap justify-content-end gap-2 mt-4">
        <Tombol varian="tepi" onClick={onBatal} disabled={memuat} autoFocus>
          Batal
        </Tombol>
        <Tombol varian={bahaya ? 'bahaya' : 'utama'} memuat={memuat} onClick={onYa}>
          {labelYa}
        </Tombol>
      </div>
    </dialog>
  )
}
