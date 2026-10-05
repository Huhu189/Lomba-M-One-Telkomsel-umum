/**
 * Preferensi tema terang/gelap (satu-satunya data yang disimpan di browser;
 * bukan data sensitif). Nilai dari localStorage selalu divalidasi Zod dan
 * semua akses dibungkus try/catch (mode privat / penyimpanan diblokir).
 */
import { z } from 'zod'
import { create } from 'zustand'

const KUNCI = 'tema-ulangan'

/** Skema nilai tema yang sah. */
export const skemaTema = z.enum(['terang', 'gelap'])

/**
 * Baca tema awal: pilihan tersimpan, kalau tidak ada ikuti pengaturan perangkat.
 * @returns {'terang'|'gelap'}
 */
export function bacaTemaAwal() {
  try {
    const hasil = skemaTema.safeParse(window.localStorage.getItem(KUNCI))
    if (hasil.success) return hasil.data
  } catch {
    // penyimpanan tidak tersedia — lanjut ke pengaturan perangkat
  }
  const gelap = window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
  return gelap ? 'gelap' : 'terang'
}

/**
 * Pasang tema ke <html> lewat data-bs-theme (Bootstrap 5.3 + variabel CSS).
 * @param {'terang'|'gelap'} tema
 */
export function terapkanTema(tema) {
  document.documentElement.setAttribute('data-bs-theme', tema === 'gelap' ? 'dark' : 'light')
}

/**
 * @typedef {{ tema: 'terang'|'gelap', ubah: (tema: 'terang'|'gelap') => void, balik: () => void }} TemaState
 */

/**
 * @param {(partial: Partial<TemaState>) => void} set
 * @param {() => TemaState} get
 * @returns {TemaState}
 */
function buatStoreTema(set, get) {
  return {
    tema: 'terang',
    ubah: (tema) => {
      terapkanTema(tema)
      try {
        window.localStorage.setItem(KUNCI, tema)
      } catch {
        // abaikan: tema tetap berlaku untuk sesi ini
      }
      set({ tema })
    },
    balik: () => get().ubah(get().tema === 'gelap' ? 'terang' : 'gelap'),
  }
}

export const useTemaStore = create()(
  /** @type {import('zustand').StateCreator<TemaState, [], []>} */ (buatStoreTema),
)

/** Panggil sekali sebelum render pertama agar tidak berkedip. */
export function mulaiTema() {
  const tema = bacaTemaAwal()
  terapkanTema(tema)
  useTemaStore.setState({ tema })
}
