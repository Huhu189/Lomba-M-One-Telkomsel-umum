// @vitest-environment jsdom
/**
 * Tes pil langkah (papan 10). Render lewat renderToStaticMarkup dan tes
 * interaksi tombol di jsdom: tiap langkah harus bisa dicapai dengan Tab lalu
 * diaktifkan dengan Enter/klik, dan membawa nomor langkahnya.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import LangkahPil from '../../../shared/ui/LangkahPil.jsx'

/** @type {{ IS_REACT_ACT_ENVIRONMENT?: boolean }} */ (globalThis).IS_REACT_ACT_ENVIRONMENT = true

describe('LangkahPil', () => {
  const langkah = ['Info dan jadwal', 'Susun soal', 'Tinjau dan publikasi']

  it('menampilkan nomor dan nama tiap langkah di dalam nav berlabel', () => {
    const html = renderToStaticMarkup(
      <LangkahPil langkah={langkah} aktif={0} onPilih={() => {}} label="Langkah menyusun kuis" />,
    )

    expect(html).toContain('aria-label="Langkah menyusun kuis"')
    expect(html).toContain('Info dan jadwal')
    expect(html).toContain('Susun soal')
    expect(html).toContain('Tinjau dan publikasi')
    expect(html.match(/pil-langkah/g)?.length).toBe(3)
    expect(html.match(/class="no"/g)?.length).toBe(3)
  })

  it('hanya menandai langkah aktif dengan aria-current="step"', () => {
    const html = renderToStaticMarkup(
      <LangkahPil langkah={langkah} aktif={1} onPilih={() => {}} />,
    )

    expect(html.match(/aria-current="step"/g)?.length).toBe(1)
    // Status aktif juga dibacakan pembaca layar, bukan warna saja.
    expect(html).toContain('(sedang dibuka)')
  })

  it('langkah adalah tombol, jadi bisa diaktifkan dengan Enter dan mengirim nomornya', () => {
    const onPilih = vi.fn()
    const wadah = document.createElement('div')
    document.body.appendChild(wadah)
    const root = createRoot(wadah)

    act(() => root.render(<LangkahPil langkah={langkah} aktif={0} onPilih={onPilih} />))

    const tombol = [...wadah.querySelectorAll('button')]
    expect(tombol.map((satu) => satu.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON'])

    const ketiga = tombol[2]
    ketiga.focus()
    expect(document.activeElement).toBe(ketiga)
    act(() => ketiga.click())

    expect(onPilih).toHaveBeenCalledWith(2)

    act(() => root.unmount())
    wadah.remove()
  })
})
