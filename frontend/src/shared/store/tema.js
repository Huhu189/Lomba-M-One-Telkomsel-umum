/**
 * Preferensi tampilan yang disimpan di browser: tema terang/gelap dan ukuran
 * tulisan (Normal/Besar). Keduanya bukan data sensitif. Nilai dari localStorage
 * selalu divalidasi Zod dan semua akses dibungkus try/catch (mode privat /
 * penyimpanan diblokir) — kalau penyimpanan tidak ada, pilihannya tetap berlaku
 * untuk sesi ini.
 */
import { z } from 'zod'
import { create } from 'zustand'

const KUNCI = 'tema-ulangan'
const KUNCI_UKURAN = 'ukuran-ulangan'

/** Skema nilai tema yang sah. */
export const skemaTema = z.enum(['terang', 'gelap'])

/** Skala ukuran tulisan yang sah (papan putaran 3: hanya dua, tanpa "Rapat"). */
export const skemaUkuran = z.enum(['normal', 'besar'])

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
 * Baca ukuran tulisan awal: pilihan tersimpan, kalau tidak ada pakai Normal.
 * Tidak mengikuti perangkat — ukuran sengaja jadi pilihan sadar pengguna.
 * @returns {'normal'|'besar'}
 */
export function bacaUkuranAwal() {
  try {
    const hasil = skemaUkuran.safeParse(window.localStorage.getItem(KUNCI_UKURAN))
    if (hasil.success) return hasil.data
  } catch {
    // penyimpanan tidak tersedia — pakai Normal
  }
  return 'normal'
}

/**
 * Pasang ukuran tulisan ke <html> lewat data-ukuran. CSS-nya mengubah SATU
 * variabel (--s: 1 atau 1,12) di theme.css; sisanya ikut sendiri.
 * @param {'normal'|'besar'} ukuran
 */
export function terapkanUkuran(ukuran) {
  document.documentElement.setAttribute('data-ukuran', ukuran)
}

/**
 * @typedef {{
 *   tema: 'terang'|'gelap',
 *   ukuran: 'normal'|'besar',
 *   ubah: (tema: 'terang'|'gelap') => void,
 *   balik: () => void,
 *   ubahUkuran: (ukuran: 'normal'|'besar') => void,
 * }} TemaState
 */

/**
 * @param {(partial: Partial<TemaState>) => void} set
 * @param {() => TemaState} get
 * @returns {TemaState}
 */
function buatStoreTema(set, get) {
  return {
    tema: 'terang',
    ukuran: 'normal',
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
    ubahUkuran: (ukuran) => {
      terapkanUkuran(ukuran)
      try {
        window.localStorage.setItem(KUNCI_UKURAN, ukuran)
      } catch {
        // abaikan: ukuran tetap berlaku untuk sesi ini
      }
      set({ ukuran })
    },
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

/** Panggil sekali sebelum render pertama agar ukuran tidak berkedip. */
export function mulaiUkuran() {
  const ukuran = bacaUkuranAwal()
  terapkanUkuran(ukuran)
  useTemaStore.setState({ ukuran })
}
