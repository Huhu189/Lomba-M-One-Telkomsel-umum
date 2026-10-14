// @vitest-environment jsdom
/**
 * Koreksi satu tombol (14 Oktober 2026, temuan G1).
 *
 * Dulu guru harus: mengetik skor → mengetik alasan → menekan "Minta token
 * konfirmasi" → menekan "Simpan koreksi". Untuk kelas 30 murid dengan 3 soal
 * uraian itu ±360 aksi. Kini satu tombol mengurus tokennya sendiri (server tetap
 * menerbitkan & memakai token seperti sebelumnya — audit tidak dilonggarkan),
 * skor bisa dipilih satu ketukan, dan baris berikutnya langsung dibuka.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HalamanKoreksi from '../../../sections/scoring/HalamanKoreksi.jsx'
import { useToastStore } from '../../../shared/ui/toast.jsx'

vi.mock('../../../sections/scoring/api.js', () => ({
  ambilAntreanKoreksi: vi.fn(),
  mintaSaranAi: vi.fn(),
  mintaTokenKoreksi: vi.fn(),
  simpanKoreksi: vi.fn(),
}))

const api = await import('../../../sections/scoring/api.js')
const ambilAntreanKoreksi = /** @type {import('vitest').Mock} */ (api.ambilAntreanKoreksi)
const mintaTokenKoreksi = /** @type {import('vitest').Mock} */ (api.mintaTokenKoreksi)
const simpanKoreksi = /** @type {import('vitest').Mock} */ (api.simpanKoreksi)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** Satu baris antrean koreksi. @param {number} soalId */
function item(soalId) {
  return {
    attempt_id: 5,
    question_id: soalId,
    murid_id: 2,
    murid_nama: 'Ayu',
    no_attempt: 1,
    status: 'perlu_tinjau',
    status_label: 'Perlu ditinjau',
    tipe: 'uraian',
    tipe_label: 'Uraian',
    teks_soal: 'Jelaskan fotosintesis.',
    jawaban: 'Tumbuhan membuat makanan.',
    kunci: { kata_kunci: [{ teks: 'fotosintesis' }] },
    skor_maksimal: 4,
    skor_sekarang: 0,
    dinilai_manual: false,
    saran_ai: null,
    alasan_ai: null,
    ai_status: null,
    ai_label: null,
    ai_dinilai_at: null,
  }
}

function antrean() {
  return {
    kuis_id: 1,
    judul_kuis: 'Ulangan IPA',
    mapel_nama: 'IPA',
    kelas_nama: '5A',
    alasan_min: 10,
    ai_aktif: false,
    jumlah: 2,
    item: [item(11), item(12)],
    catatan_attempt: [],
  }
}

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

function pasang() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/kuis/ulangan-ipa/koreksi']}>
          <Routes>
            <Route path="/kuis/:slug/koreksi" element={<HalamanKoreksi />} />
            <Route path="/kuis/:slug" element={<p>detail</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })
}

/** @param {string} teks */
function tombol(teks) {
  return [...wadah.querySelectorAll('button')].find((satu) =>
    (satu.textContent ?? '').includes(teks),
  )
}

/**
 * Tunggu sampai kueri antrean selesai.
 *
 * React Query menyiarkan hasilnya di batching `setTimeout`, jadi satu flush
 * microtask saja masih menyisakan skeleton "Menyusun antrean koreksi…".
 */
async function tenang() {
  await act(async () => {
    await new Promise((lanjut) => window.setTimeout(lanjut, 0))
  })
}

/**
 * Isi skor + alasan pada form yang sedang terbuka.
 * @param {number} skor
 */
function isiForm(skor) {
  const angka = /** @type {HTMLInputElement} */ (wadah.querySelector('input[type="number"]'))
  const alasan = /** @type {HTMLTextAreaElement} */ (wadah.querySelector('textarea'))

  act(() => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
      angka,
      String(skor),
    )
    angka.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  act(() => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set?.call(
      alasan,
      'Konsep benar walau ejaannya berbeda',
    )
    alasan.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
  ambilAntreanKoreksi.mockReset()
  mintaTokenKoreksi.mockReset()
  simpanKoreksi.mockReset()
  ambilAntreanKoreksi.mockResolvedValue(antrean())
  mintaTokenKoreksi.mockResolvedValue({ token: 'tok-123', expires_at: '2026-10-14T10:00:00Z', ttl_detik: 120 })
  simpanKoreksi.mockResolvedValue({ message: 'Koreksi tersimpan.', total_skor: 4 })

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('FormKoreksi — sekali klik', () => {
  it('satu tombol Simpan menerbitkan token lalu menyimpan', async () => {
    pasang()
    await tenang()

    isiForm(4)

    await act(async () => {
      tombol('Simpan & berikutnya')?.click()
    })

    expect(mintaTokenKoreksi).toHaveBeenCalledTimes(1)
    expect(simpanKoreksi).toHaveBeenCalledTimes(1)

    const muatan = simpanKoreksi.mock.calls[0][1]

    expect(muatan.question_id).toBe(11)
    expect(muatan.skor).toBe(4)
    expect(muatan.token).toBe('tok-123')
    expect(muatan.alasan.length).toBeGreaterThanOrEqual(10)
  })

  it('tombol "Minta token" manual tidak lagi wajib ditekan', async () => {
    pasang()
    await tenang()

    expect(tombol('Minta token konfirmasi')).toBeTruthy()
    // Tanpa menekannya pun, jalur simpan tetap sah (dibuktikan tes di atas).
    expect(tombol('Simpan & berikutnya')).toBeTruthy()
  })

  it('skor bisa dipilih satu ketukan dan alasan siap pakai mengurangi mengetik', async () => {
    pasang()
    await tenang()

    const cepat = /** @type {HTMLElement} */ (wadah.querySelector('[data-skor-cepat="2"]'))
    const alasan = /** @type {HTMLElement} */ (wadah.querySelector('[data-alasan-cepat]'))

    expect(cepat).not.toBeNull()
    expect(alasan).not.toBeNull()

    act(() => cepat.click())
    act(() => alasan.click())

    expect(/** @type {HTMLInputElement} */ (wadah.querySelector('input[type="number"]')).value).toBe(
      '2',
    )
    expect(/** @type {HTMLTextAreaElement} */ (wadah.querySelector('textarea')).value.length).toBeGreaterThanOrEqual(10)
  })

  it('alasan tetap wajib: Simpan mati sampai alasan cukup', async () => {
    pasang()
    await tenang()

    const simpan = /** @type {HTMLButtonElement} */ (tombol('Simpan & berikutnya'))

    expect(simpan.disabled).toBe(true)
  })
})
