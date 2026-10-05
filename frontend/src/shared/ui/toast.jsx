/**
 * Toast buatan sendiri (chunk theme) — tanpa library eksternal.
 * Status selalu disertai ikon + teks, warna dari variabel CSS tema.
 */
import { useEffect } from 'react'
import { create } from 'zustand'
import { IkonCentang, IkonSilang, IkonPeringatan, IkonInfo } from '../../icons.jsx'

let urutanId = 0

/**
 * @typedef {{ id: number, jenis: 'sukses'|'salah'|'peringatan'|'info', pesan: string }} Toast
 */

/**
 * @typedef {{
 *   toasts: Toast[],
 *   push: (toast: Omit<Toast, 'id'>) => number,
 *   dismiss: (id: number) => void,
 * }} ToastState
 */

/**
 * Creator store toast global (zustand) dengan tipe eksplisit untuk checkJs.
 * @param {(updater: (state: ToastState) => Partial<ToastState>) => void} set
 * @returns {ToastState}
 */
function buatStoreToast(set) {
  return {
    toasts: [],
    push: (toast) => {
      urutanId += 1
      const id = urutanId
      set((state) => ({ toasts: [...state.toasts, { id, ...toast }] }))
      return id
    },
    dismiss: (id) =>
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  }
}

export const useToastStore = create()(
  /** @type {import('zustand').StateCreator<ToastState, [], []>} */ (buatStoreToast),
)

/**
 * Cara singkat menampilkan toast dari mana saja.
 * @param {'sukses'|'salah'|'peringatan'|'info'} jenis
 * @param {string} pesan
 * @returns {number} id toast
 */
export function tampilkanToast(jenis, pesan) {
  return useToastStore.getState().push({ jenis, pesan })
}

/** Ikon per jenis toast (status selalu ada ikonnya). */
const ikonJenis = {
  sukses: IkonCentang,
  salah: IkonSilang,
  peringatan: IkonPeringatan,
  info: IkonInfo,
}

/** Label teks per jenis (aturan: status selalu dengan ikon atau teks). */
const labelJenis = {
  sukses: 'Berhasil',
  salah: 'Gagal',
  peringatan: 'Perhatian',
  info: 'Info',
}

/**
 * Satu item toast dengan auto-tutup.
 * @param {{ toast: Toast }} props
 */
function ToastItem({ toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const Ikon = ikonJenis[toast.jenis] ?? IkonInfo

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), 5000)
    return () => clearTimeout(timer)
  }, [toast.id, dismiss])

  return (
    <div
      className={`toast-item ${toast.jenis}`}
      role={toast.jenis === 'salah' ? 'alert' : 'status'}
    >
      <Ikon className="ikon" size={22} />
      <div>
        <strong className="d-block small text-uppercase">{labelJenis[toast.jenis]}</strong>
        <span>{toast.pesan}</span>
      </div>
      <button
        type="button"
        className="toast-tutup"
        aria-label="Tutup notifikasi"
        onClick={() => dismiss(toast.id)}
      >
        <IkonSilang size={18} />
      </button>
      <span className="toast-waktu" aria-hidden="true" />
    </div>
  )
}

/** Wadah toast: dirender sekali di root aplikasi. */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div className="toast-area" aria-live="polite" aria-atomic="false">
      {toasts.map((/** @type {Toast} */ t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
