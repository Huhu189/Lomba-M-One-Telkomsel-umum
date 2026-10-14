/**
 * Toast buatan sendiri (chunk theme) — tanpa library eksternal.
 * Status selalu disertai ikon + teks, warna dari variabel CSS tema.
 */
import { useEffect, useState } from 'react'
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
 * Berapa lama toast menutup sendiri. Toast "salah"/"peringatan" **tidak** ikut
 * menutup sendiri: pesan seperti "gagal mengumpulkan" atau "gagal menyimpan"
 * bisa hilang sebelum sempat dibaca, padahal itu pesan yang paling penting
 * (temuan M5). Yang menutup sendiri hanya kabar baik/sekilas (sukses & info).
 */
const JEDA_TUTUP_MS = 5000

/** @param {'sukses'|'salah'|'peringatan'|'info'} jenis */
function menutupSendiri(jenis) {
  return jenis === 'sukses' || jenis === 'info'
}

/**
 * Satu item toast. Sukses/info menutup sendiri, galat/peringatan menetap
 * sampai ditutup — dan yang menutup sendiri berhenti menghitung saat disentuh,
 * disorot, atau difokus keyboard supaya sempat dibaca.
 * @param {{ toast: Toast }} props
 */
function ToastItem({ toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const Ikon = ikonJenis[toast.jenis] ?? IkonInfo
  const [ditahan, setDitahan] = useState(false)
  const menetap = !menutupSendiri(toast.jenis)

  useEffect(() => {
    if (menetap || ditahan) return undefined

    const timer = setTimeout(() => dismiss(toast.id), JEDA_TUTUP_MS)
    return () => clearTimeout(timer)
  }, [toast.id, dismiss, menetap, ditahan])

  return (
    <div
      className={`toast-item ${toast.jenis}${menetap ? ' menetap' : ''}`}
      role={toast.jenis === 'salah' ? 'alert' : 'status'}
      data-menetap={menetap ? '1' : undefined}
      onMouseEnter={() => setDitahan(true)}
      onMouseLeave={() => setDitahan(false)}
      onFocus={() => setDitahan(true)}
      onBlur={() => setDitahan(false)}
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
