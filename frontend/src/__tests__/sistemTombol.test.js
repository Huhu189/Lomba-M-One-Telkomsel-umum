/**
 * Pagar mutu "satu sistem tombol" (papan Standar, DoD halaman):
 * hanya `Tombol`/`TombolTaut`/`TombolIkon` yang boleh dipakai di JSX. Kelas
 * tombol bawaan Bootstrap (`btn-outline-*`, `btn-primary`, `btn-secondary`,
 * `btn-sm`) sudah tidak dipetakan lagi di theme.css, jadi memakainya akan
 * memunculkan warna biru bawaan Bootstrap yang gagal kontras AA di latar terang.
 *
 * Tata letak/grid Bootstrap tetap dipakai; yang dijaga di sini hanya tombolnya.
 */
import { describe, expect, it } from 'vitest'

/** Semua berkas JSX/JS sumber apa adanya (raw), kecuali tes. */
const berkasSumber = import.meta.glob('../**/*.{js,jsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const TERLARANG = /class(?:Name)?="[^"]*\bbtn-(?:outline-[a-z]+|primary|secondary|sm)\b/g

describe('sistem tombol', () => {
  it('tidak ada kelas tombol Bootstrap di JSX (pakai Tombol/TombolIkon)', () => {
    /** @type {string[]} */
    const pelanggar = []

    for (const [jalur, mentah] of Object.entries(berkasSumber)) {
      if (/\.test\.jsx?$/.test(jalur)) continue

      const temuan = String(mentah).match(TERLARANG)
      if (temuan) pelanggar.push(`${jalur.replace('../', 'src/')}: ${temuan.join(', ')}`)
    }

    expect(pelanggar).toEqual([])
  })

  it('theme.css tidak lagi memetakan tombol Bootstrap (template-nya sudah bersih)', () => {
    const css = String(
      /** @type {Record<string, unknown>} */ (
        import.meta.glob('../theme/theme.css', { query: '?raw', import: 'default', eager: true })
      )['../theme/theme.css'],
    )

    expect(css).not.toMatch(/\.btn-outline-[a-z]+\s*\{/)
    expect(css).not.toMatch(/\.btn-sm\s*\{/)
  })
})
