// @vitest-environment jsdom
/**
 * Deteksi tamper halaman (2B–2C).
 *
 * Yang dijaga di sini:
 * - keempat pemeriksaan benar-benar menemukan sasarannya (extension, fungsi
 *   proteksi yang diganti, overlay asing, kanari yang hilang);
 * - overlay asing **dinetralkan** (dihapus), bukan cuma dicatat;
 * - pemindai **fail-open**: tanpa DOM/MutationObserver yang lengkap ia tidak
 *   melempar, dan `hentikan()` tak meninggalkan timer;
 * - saklar `detect_tamper` **default mati** dan **tidak ikut preset ujian**
 *   (lihat juga `pengaturanProteksi.test.js`) — deteksi jenis ini rawan salah
 *   tuduh, jadi tidak boleh menyala sendiri.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buatPemindaiTamper,
  cariOverlayMenutupi,
  cariSumberExtension,
  sidikFungsiProteksi,
  skemaExtension,
} from '../../security/deteksiTamper.js'

/** @returns {{ catat: import('vitest').Mock, kaburkan: import('vitest').Mock }} */
function pengintip() {
  return { catat: vi.fn(), kaburkan: vi.fn() }
}

/**
 * Overlay asing ber-z-index tinggi yang menutupi area ulangan.
 *
 * @param {{ zIndex?: number, lebar?: number, tinggi?: number, posisi?: string }} [opsi]
 */
function buatOverlay({ zIndex = 5000, lebar = 800, tinggi = 600, posisi = 'fixed' } = {}) {
  const node = document.createElement('div')

  node.style.position = posisi
  node.style.zIndex = String(zIndex)
  node.textContent = 'overlay asing'
  // jsdom tidak menghitung tata letak, jadi ukurannya dijawab manual.
  node.getBoundingClientRect = () => /** @type {DOMRect} */ ({ width: lebar, height: tinggi })
  document.body.appendChild(node)

  return node
}

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.innerHTML = '<head></head><body></body>'
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('skemaExtension', () => {
  it('mengenali ketiga skema extension dan mengabaikan yang lain', () => {
    expect(skemaExtension('chrome-extension://abc/x.js')).toBe('chrome-extension:')
    expect(skemaExtension('  MOZ-EXTENSION://abc/x.js')).toBe('moz-extension:')
    expect(skemaExtension('safari-web-extension://abc')).toBe('safari-web-extension:')
    expect(skemaExtension('https://sekolah.test/app.js')).toBeNull()
    expect(skemaExtension(undefined)).toBeNull()
  })
})

describe('cariSumberExtension', () => {
  it('menemukan script dari skema extension dan tidak menghitung https', () => {
    const script = document.createElement('script')
    script.src = 'chrome-extension://abcdef/inject.js'
    document.body.appendChild(script)

    const aman = document.createElement('script')
    aman.src = 'https://sekolah.test/app.js'
    document.body.appendChild(aman)

    expect(cariSumberExtension(document)).toEqual(['chrome-extension:'])
  })
})

describe('cariOverlayMenutupi', () => {
  it('menemukan overlay ber-z-index tinggi yang menutupi area', () => {
    const overlay = buatOverlay()

    expect(cariOverlayMenutupi(document, window)).toContain(overlay)
  })

  it('mengabaikan elemen kecil, statis, atau ber-z-index rendah', () => {
    buatOverlay({ lebar: 40, tinggi: 40 })
    buatOverlay({ zIndex: 10 })
    buatOverlay({ posisi: 'static' })

    expect(cariOverlayMenutupi(document, window)).toEqual([])
  })
})

describe('buatPemindaiTamper', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('melaporkan sumber extension sebagai extension_detected', () => {
    const script = document.createElement('script')
    script.src = 'moz-extension://abcdef/inject.js'
    document.body.appendChild(script)

    const { catat, kaburkan } = pengintip()
    const pemindai = buatPemindaiTamper({ catat, kaburkan, jedaAwalMs: 0, jedaPindaiMs: 0 })

    pemindai.mulai()
    const ketemu = pemindai.periksa()
    pemindai.hentikan()

    expect(ketemu).toBe(true)
    expect(catat).toHaveBeenCalledWith('extension_detected', expect.objectContaining({ skema: 'moz-extension:' }))
    expect(kaburkan).toHaveBeenCalled()
  })

  it('menghapus overlay asing sekaligus mencatat dom_injection', () => {
    const overlay = buatOverlay()

    const { catat, kaburkan } = pengintip()
    const pemindai = buatPemindaiTamper({ catat, kaburkan, jedaAwalMs: 0, jedaPindaiMs: 0 })

    pemindai.mulai()
    pemindai.periksa()
    pemindai.hentikan()

    expect(document.body.contains(overlay)).toBe(false)
    expect(catat).toHaveBeenCalledWith('dom_injection', expect.objectContaining({ sumber: 'overlay' }))
    expect(kaburkan).toHaveBeenCalled()
  })

  it('menemukan fungsi proteksi yang diganti sesudah mulai', () => {
    const jendelaUji = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (window))
    const asli = /** @type {(...a: unknown[]) => unknown} */ (jendelaUji.addEventListener)

    const { catat } = pengintip()
    const pemindai = buatPemindaiTamper({ catat, kaburkan: vi.fn(), jedaAwalMs: 0, jedaPindaiMs: 0 })

    pemindai.mulai()

    // Seseorang membungkus addEventListener (pola penyadap/penonaktif proteksi).
    /** @type {(...args: unknown[]) => unknown} */
    const diganti = (...args) => asli.apply(window, args)
    jendelaUji.addEventListener = diganti

    const ketemu = pemindai.periksa()
    pemindai.hentikan()
    jendelaUji.addEventListener = asli

    expect(ketemu).toBe(true)
    expect(catat).toHaveBeenCalledWith('dom_injection', expect.objectContaining({ fungsi: expect.stringContaining('addEventListener') }))
  })

  it('melaporkan dom_injection bila kanari dihapus', () => {
    const { catat } = pengintip()
    const pemindai = buatPemindaiTamper({ catat, kaburkan: vi.fn(), jedaAwalMs: 0, jedaPindaiMs: 0 })

    pemindai.mulai()

    const kanari = document.querySelector('[data-kanari-proteksi]')
    expect(kanari).not.toBeNull()
    kanari?.remove()

    const ketemu = pemindai.periksa()
    pemindai.hentikan()

    expect(ketemu).toBe(true)
    expect(catat).toHaveBeenCalledWith('dom_injection', expect.objectContaining({ sumber: 'kanari' }))
  })

  it('tidak melempar dan tidak mengaburkan saat halaman bersih', () => {
    const { catat, kaburkan } = pengintip()
    const pemindai = buatPemindaiTamper({ catat, kaburkan, jedaAwalMs: 0, jedaPindaiMs: 0 })

    pemindai.mulai()
    expect(() => pemindai.periksa()).not.toThrow()
    pemindai.hentikan()

    expect(catat).not.toHaveBeenCalled()
    expect(kaburkan).not.toHaveBeenCalled()
  })

  it('menjadwalkan pemindaian pertama dan berkala, lalu membersihkannya di hentikan()', () => {
    const { catat } = pengintip()
    const pemindai = buatPemindaiTamper({ catat, kaburkan: vi.fn(), jedaAwalMs: 4000, jedaPindaiMs: 15000 })

    pemindai.mulai()

    // Sisipkan extension SESUDAH pemindaian awal: pemindaian berkala tetap menemukannya.
    const script = document.createElement('script')
    script.src = 'chrome-extension://abcdef/late.js'
    document.body.appendChild(script)

    vi.advanceTimersByTime(4000)
    vi.advanceTimersByTime(15000)

    expect(catat).toHaveBeenCalledWith('extension_detected', expect.anything())

    pemindai.hentikan()
    catat.mockClear()

    // Sesudah dihentikan tidak ada pemindaian yang tertinggal.
    vi.advanceTimersByTime(30000)
    expect(catat).not.toHaveBeenCalled()
  })

  it('fail-open: Pemindai yang tidak lengkap tidak melempar', () => {
    const { catat, kaburkan } = pengintip()
    const pemindai = buatPemindaiTamper({
      catat,
      kaburkan,
      // MutationObserver yang melempar saat `observe` tidak boleh menjatuhkan.
      Pengamat: /** @type {typeof MutationObserver} */ (
        /** @type {unknown} */ (
          class {
            observe() {
              throw new Error('observe gagal')
            }
            disconnect() {}
          }
        )
      ),
      jedaAwalMs: 0,
      jedaPindaiMs: 0,
    })

    expect(() => pemindai.mulai()).not.toThrow()
    expect(() => pemindai.hentikan()).not.toThrow()
  })

  it('sidikFungsiProteksi merekam sumber fungsi proteksi yang ada', () => {
    const sidik = sidikFungsiProteksi(window)

    expect(Object.keys(sidik)).toContain('window.addEventListener')
    expect(typeof sidik['window.addEventListener']).toBe('string')
  })
})
