// @vitest-environment jsdom
/**
 * Editor kuis **satu halaman** (14 Oktober 2026).
 *
 * Permintaan pemilik produk: *"dalam editor form/ujian nya buat ringkas, gak
 * perlu 3 step 3 step."* Sebelum ini editor adalah alur tiga langkah: isi info
 * lalu tekan "Lanjut: susun soal", susun soal lalu tekan "Lanjut: tinjau", baru
 * bisa menerbitkan — setiap langkah menyembunyikan isi langkah lain.
 *
 * Yang dijaga tes ini: ketiga bagian tampil **sekaligus** di satu halaman,
 * tombol "Lanjut: …" tidak ada lagi, dan bar aksi lengket menyediakan Simpan
 * draf + Terbitkan dari posisi mana pun (tanpa harus menggulir ke bagian 3).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import HalamanKuis from '../../../sections/quiz/HalamanKuis.jsx'
import { useAuthStore } from '../../../sections/auth/authStore.js'

vi.mock('../../../sections/quiz/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return {
    ...asli,
    ambilKuis: vi.fn(),
    ambilKuisDetail: vi.fn(),
    buatKuis: vi.fn(),
    ubahKuis: vi.fn(),
    arsipkanKuis: vi.fn(),
    hapusKuis: vi.fn(),
    publikasiKuis: vi.fn(),
    pulihkanKuis: vi.fn(),
    sinkronSoalKuis: vi.fn(),
  }
})

vi.mock('../../../sections/school/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return { ...asli, ambilMapel: vi.fn(), ambilKelas: vi.fn() }
})

vi.mock('../../../sections/question/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return { ...asli, ambilSoal: vi.fn(), ambilTag: vi.fn(), buatSoal: vi.fn() }
})

vi.mock('../../../sections/settings/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return { ...asli, ambilPengaturan: vi.fn(), simpanPengaturan: vi.fn() }
})

// Editor soal itu berat dan tidak diuji di sini (punya berkas tesnya sendiri).
vi.mock('../../../sections/question/EditorSoal.jsx', () => ({ default: () => null }))

const apiKuis = await import('../../../sections/quiz/api.js')
const apiSekolah = await import('../../../sections/school/api.js')
const apiSoal = await import('../../../sections/question/api.js')

const ambilKuis = /** @type {import('vitest').Mock} */ (apiKuis.ambilKuis)
const ambilMapel = /** @type {import('vitest').Mock} */ (apiSekolah.ambilMapel)
const ambilKelas = /** @type {import('vitest').Mock} */ (apiSekolah.ambilKelas)
const ambilSoal = /** @type {import('vitest').Mock} */ (apiSoal.ambilSoal)
const ambilTag = /** @type {import('vitest').Mock} */ (apiSoal.ambilTag)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @param {number} ms */
const sleep = (ms) => new Promise((selesai) => setTimeout(selesai, ms))

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

function pasang() {
  act(() => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <HalamanKuis />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })
}

/** @param {string} teks @returns {HTMLButtonElement|null} */
function tombol(teks) {
  const semua = /** @type {HTMLButtonElement[]} */ ([...wadah.querySelectorAll('button')])
  return semua.find((satu) => satu.textContent?.includes(teks)) ?? null
}

/**
 * Menunggu sampai layar memuat teks tertentu.
 * @param {string} teks
 * @param {number} [batas]
 */
async function tungguTeks(teks, batas = 3000) {
  const mulai = Date.now()
  while (Date.now() - mulai < batas) {
    if ((wadah.textContent ?? '').includes(teks)) return true
    await act(async () => {
      await sleep(25)
    })
  }
  return (wadah.textContent ?? '').includes(teks)
}

/** Buka editor kuis baru (draf belum tersimpan di server). */
async function bukaEditorBaru() {
  pasang()
  await tungguTeks('Buat kuis')

  await act(async () => {
    tombol('Buat kuis')?.click()
    await sleep(20)
  })
}

beforeEach(() => {
  ambilKuis.mockReset().mockResolvedValue([])
  ambilMapel.mockReset().mockResolvedValue([{ id: 1, nama: 'Matematika' }])
  ambilKelas.mockReset().mockResolvedValue([{ id: 2, nama: '5A', jumlah_murid: 24 }])
  ambilSoal.mockReset().mockResolvedValue({
    data: [],
    meta: { current_page: 1, last_page: 1, total: 0 },
  })
  ambilTag.mockReset().mockResolvedValue([])

  useAuthStore.setState({
    user: {
      id: 7,
      name: 'Bu Rina',
      email: 'rina@sekolah.test',
      role: 'guru',
      status: 'aktif',
      statusLabel: 'Aktif',
      emailTerverifikasi: true,
    },
    detikTunggu: 0,
  })

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('Editor kuis satu halaman', () => {
  it('ketiga bagian tampil sekaligus, tanpa gerbang "Lanjut:"', async () => {
    await bukaEditorBaru()

    for (const judul of ['1. Info dan jadwal', '2. Susun soal', '3. Tinjau dan publikasikan']) {
      expect(await tungguTeks(judul)).toBe(true)
    }

    // Tidak ada lagi tombol yang mengunci langkah berikutnya.
    expect(tombol('Lanjut: susun soal')).toBeNull()
    expect(tombol('Lanjut: tinjau')).toBeNull()
  })

  it('isian bagian 1 dan daftar kelengkapan bagian 3 terlihat bersamaan', async () => {
    await bukaEditorBaru()
    await tungguTeks('3. Tinjau dan publikasikan')

    // Isian langkah pertama masih di halaman yang sama dengan ringkasan terbit.
    expect(wadah.querySelector('input#kuis-judul')).not.toBeNull()
    expect(wadah.textContent).toContain('dari 8 lengkap')
    expect(wadah.textContent).toContain('Judul terisi (minimal 3 huruf)')
  })

  it('bar aksi lengket menyediakan Simpan draf dan Terbitkan dari posisi mana pun', async () => {
    await bukaEditorBaru()
    await tungguTeks('3. Tinjau dan publikasikan')

    const simpan = tombol('Simpan draf')
    const terbit = tombol('Terbitkan kuis')

    // Keduanya di bar lengket di ATAS halaman, bukan di dasar bagian 3.
    expect(simpan).not.toBeNull()
    expect(terbit).not.toBeNull()

    const bar = wadah.querySelector('.bar-susun')
    expect(bar).not.toBeNull()
    expect(bar?.textContent).toContain('Simpan draf')
    expect(bar?.textContent).toContain('Terbitkan kuis')

    // Draf baru belum lengkap → menerbitkan masih dikunci (server tetap penentu,
    // ini hanya supaya guru tidak menekan tombol yang pasti ditolak).
    expect(terbit?.disabled).toBe(true)

    // "Simpan draf" mengirim formulir bagian 1 lewat atribut form, jadi tetap
    // bekerja walau tombolnya berada di luar <form>.
    expect(simpan?.getAttribute('form')).toBe('form-kuis')
    expect(wadah.querySelector('form#form-kuis')).not.toBeNull()
  })

  it('bagian 2 punya "Simpan susunan" sebagai jalan keluar tanpa menerbitkan', async () => {
    await bukaEditorBaru()
    await tungguTeks('2. Susun soal')

    expect(tombol('Simpan susunan')).not.toBeNull()
    expect(wadah.textContent).toContain('Bank soal')
    expect(wadah.textContent).toContain('Susunan kuis')
  })
})
