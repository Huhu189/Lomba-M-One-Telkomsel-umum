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
import HalamanKuis from '../../../sections/quiz/halaman/HalamanKuis.jsx'
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
vi.mock('../../../sections/question/editor/EditorSoal.jsx', () => ({ default: () => null }))

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
    // 7 butir: kelas tidak lagi jadi syarat terbit (kuis tanpa kelas = semua
    // kelas), jadi butirnya tinggal judul, mapel, durasi, dua syarat jadwal, dan
    // dua syarat soal.
    expect(wadah.textContent).toContain('dari 7 lengkap')
    expect(wadah.textContent).toContain('Judul terisi (minimal 3 huruf)')
  })

  it('tidak ada pita aksi lengket di atas layar; aksinya ada di bagiannya masing-masing', async () => {
    await bukaEditorBaru()
    await tungguTeks('3. Tinjau dan publikasikan')

    // Pita yang menempel di bawah kepala halaman sudah dihapus (15 Oktober
    // 2026): ia menutupi bagian atas isi selama menggulir.
    expect(wadah.querySelector('.bar-susun')).toBeNull()

    // "Simpan draf" ada di kaki bagian 1 dan berada DI DALAM formulirnya, jadi
    // menekan Enter di kolom tetap menyimpan (dulu diakali tombol tersembunyi).
    const simpan = tombol('Simpan draf')
    expect(simpan).not.toBeNull()
    expect(simpan?.type).toBe('submit')
    expect(wadah.querySelector('form#form-kuis')?.contains(simpan ?? null)).toBe(true)
    expect(wadah.querySelectorAll('button[type="submit"]')).toHaveLength(1)

    // "Terbitkan kuis" di kaki bagian 3 — di tempat butir kelengkapan terbaca,
    // dan masih mati selama drafnya belum lengkap (server tetap penentu).
    const terbit = tombol('Publikasikan kuis')
    expect(terbit).not.toBeNull()
    expect(terbit?.disabled).toBe(true)
    expect(wadah.querySelector('#bagian-terbit')?.contains(terbit ?? null)).toBe(true)

    // Hanya satu tombol bernama "Simpan draf" di seluruh halaman.
    const semua = /** @type {HTMLButtonElement[]} */ ([...wadah.querySelectorAll('button')])
    expect(semua.filter((satu) => satu.textContent?.includes('Simpan draf'))).toHaveLength(1)
  })

  it('bagian 2 punya "Simpan susunan" sebagai jalan keluar tanpa menerbitkan', async () => {
    await bukaEditorBaru()
    await tungguTeks('2. Susun soal')

    expect(tombol('Simpan susunan')).not.toBeNull()
    expect(wadah.textContent).toContain('Bank soal')
    expect(wadah.textContent).toContain('Susunan kuis')
  })
})
