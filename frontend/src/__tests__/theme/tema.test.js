/**
 * Pagar mutu chunk theme: "semua warna di komponen merujuk variabel CSS,
 * bukan nilai hex langsung". Hex hanya boleh ada di blok :root dan
 * [data-bs-theme='dark'] pada theme.css.
 *
 * Berkas dibaca lewat import.meta.glob (dukungan Vite/Vitest) agar tidak
 * memerlukan API Node dan tetap lolos checkJs strict.
 */
import { describe, expect, it } from 'vitest'

/** Semua berkas sumber apa adanya (raw) di dalam src/. */
const berkasSumber = import.meta.glob('../../**/*.{js,jsx,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const HEX = /#[0-9a-fA-F]{3,8}\b/g

describe('warna hanya lewat variabel CSS', () => {
  it('tidak ada hex di berkas js/jsx/css selain blok variabel theme.css', () => {
    /** @type {string[]} */
    const pelanggar = []

    for (const [jalur, mentah] of Object.entries(berkasSumber)) {
      if (/\.test\.jsx?$/.test(jalur)) continue

      let isi = String(mentah)

      if (jalur.endsWith('theme.css')) {
        // buang komentar dan dua blok definisi variabel (:root, [data-bs-theme='dark'])
        isi = isi.replace(/\/\*[\s\S]*?\*\//g, '')
        isi = isi.replace(/:root\s*\{[^}]*\}/, '')
        isi = isi.replace(/\[data-bs-theme='dark'\]\s*\{[^}]*\}/, '')
      }

      // komentar JSDoc boleh menyebut hex untuk dokumentasi
      const tanpaKomentar = isi.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      const temuan = tanpaKomentar.match(HEX)
      if (temuan) {
        pelanggar.push(`${jalur.replace(/^\.\.\//, 'src/')}: ${temuan.join(', ')}`)
      }
    }

    expect(pelanggar).toEqual([])
  })
})
