// @vitest-environment jsdom
/**
 * Rekam diri pada panel lampiran jawaban (slice 09).
 *
 * Dua hal yang dijaga di sini, keduanya pernah salah:
 *
 * 1. **Durasi yang dikirim = detik sungguhan.** `onstop` disusun sekali saat
 *    tombol ditekan, jadi membaca `detikRekam` (state) dari dalamnya selalu
 *    memberi nilai basi — dulu **0 detik** terkirim untuk semua rekaman yang
 *    lebih dari nol detik. Angkanya kini dibaca dari ref yang diperbarui timer.
 * 2. **Keluar dari soal saat merekam = rekaman dibuang.** Perekam dan
 *    kamera/mikrofon wajib dimatikan, dan potongan yang ditinggalkan TIDAK
 *    boleh diunggah (dulu tidak ada pembersihan sama sekali: perekam tetap
 *    hidup, lalu murid yang sudah pindah soal terkejut melihat unggahan yang
 *    tidak ia kirim).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import UnggahLampiran from '../../../sections/attempt/komponen/UnggahLampiran.jsx'

vi.mock('../../../sections/attempt/lampiran.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return {
    ...asli,
    daftarLampiran: vi.fn(),
    unggahLampiran: vi.fn(),
    hapusLampiran: vi.fn(),
  }
})

const api = await import('../../../sections/attempt/lampiran.js')
const daftarLampiran = /** @type {import('vitest').Mock} */ (api.daftarLampiran)
const unggahLampiran = /** @type {import('vitest').Mock} */ (api.unggahLampiran)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** Perekam palsu: menirukan MediaRecorder seperlunya. */
class PerekamPalsu {
  /** @param {unknown} aliran */
  constructor(aliran) {
    this.aliran = aliran
    this.state = 'inactive'
    this.mimeType = 'video/webm'
    /** @type {((peristiwa: { data: Blob }) => void)|null} */
    this.ondataavailable = null
    /** @type {(() => void)|null} */
    this.onstop = null
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    if (this.state === 'inactive') return

    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['rekaman'], { type: 'video/webm' }) })
    this.onstop?.()
  }
}

/** @type {{ stop: import('vitest').Mock }} */
let jalurVideo
/** @type {{ stop: import('vitest').Mock }} */
let jalurAudio

/** Kamera + mikrofon palsu; jejak `stop()` dipakai untuk memeriksa pembersihan. */
function aliranPalsu() {
  jalurVideo = { stop: vi.fn() }
  jalurAudio = { stop: vi.fn() }

  return { getTracks: () => [jalurVideo, jalurAudio] }
}

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

/** @param {string} teks */
function tombol(teks) {
  return Array.from(wadah.querySelectorAll('button')).find((satu) =>
    (satu.textContent ?? '').includes(teks),
  )
}

/** Pasang komponen dengan QueryClient bersih. */
function pasang() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <UnggahLampiran attemptId={7} soalId={3} sisaDetik={600} />
      </QueryClientProvider>,
    ),
  )
}

/**
 * Klik satu elemen di dalam `act` supaya pembaruan state-nya ikut terselesaikan.
 * @param {HTMLElement|undefined} elemen
 */
async function klik(elemen) {
  await act(async () => {
    elemen?.click()
  })
}

/** Centang izin lalu mulai merekam. */
async function mulaiRekam() {
  const izin = /** @type {HTMLInputElement} */ (wadah.querySelector('input[type="checkbox"]'))
  await klik(izin)

  const rekam = tombol('Rekam diri')

  expect(rekam).toBeTruthy()
  await klik(rekam)
}

beforeEach(() => {
  vi.useFakeTimers()
  daftarLampiran.mockReset()
  unggahLampiran.mockReset()
  daftarLampiran.mockResolvedValue([])
  unggahLampiran.mockResolvedValue({ kode: 'lmp-1' })

  glob.MediaRecorder = PerekamPalsu
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(() => Promise.resolve(aliranPalsu())) },
  })

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
  vi.useRealTimers()
})

describe('UnggahLampiran — rekam diri', () => {
  it('mengirim durasi sungguhan (bukan nilai basi dari state)', async () => {
    pasang()
    await act(async () => {})
    await mulaiRekam()

    // Tiga detik berjalan; penghitung di layar ikut naik.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(tombol('Stop rekam')?.textContent).toContain('3s')

    await klik(tombol('Stop rekam'))

    expect(unggahLampiran).toHaveBeenCalledTimes(1)

    const muatan = unggahLampiran.mock.calls[0][1]

    expect(muatan.jenis).toBe('rekam')
    expect(muatan.durasi_detik).toBe(3)
    expect(muatan.question_id).toBe(3)
  })

  it('keluar dari soal saat merekam: rekaman dibuang, kamera dimatikan', async () => {
    pasang()
    await act(async () => {})
    await mulaiRekam()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    act(() => root.unmount())

    expect(jalurVideo.stop).toHaveBeenCalled()
    expect(jalurAudio.stop).toHaveBeenCalled()
    expect(unggahLampiran).not.toHaveBeenCalled()
  })

  it('berhenti sendiri di batas 60 detik dan mengirim durasi 60', async () => {
    pasang()
    await act(async () => {})
    await mulaiRekam()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000)
    })

    // Timer menghentikan perekam sendiri (tombol kembali ke "Rekam diri").
    expect(tombol('Rekam diri')).toBeTruthy()
    expect(unggahLampiran).toHaveBeenCalledTimes(1)
    expect(unggahLampiran.mock.calls[0][1].durasi_detik).toBe(60)
  })
})
