// @vitest-environment jsdom
/**
 * Kepala sekolah hanya MELIHAT (14 Oktober 2026).
 *
 * Peran `admin` mengawasi sekolah dan mengelola akun guru/murid, tetapi tidak
 * menyusun atau mengubah data akademik — servernya menolaknya
 * (`User::bolehMengubahAkademik()` + policy tiap bagian). Uji ini menjaga sisi
 * klien: tombol yang pasti ditolak tidak boleh ditampilkan sama sekali, karena
 * guru/kepala sekolah yang menekannya lalu mendapat 403 hanya akan menyangka
 * aplikasinya rusak.
 *
 * Yang diuji lewat render sungguhan: halaman **Kelas** dan **Bank soal** —
 * keduanya muncul di menu kepala sekolah.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HalamanKelas from '../../../sections/school/halaman/HalamanKelas.jsx'
import HalamanBankSoal from '../../../sections/question/halaman/HalamanBankSoal.jsx'
import { hanyaMelihat } from '../../../shared/akses.js'
import { useAuthStore } from '../../../sections/auth/authStore.js'

vi.mock('../../../sections/school/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return {
    ...asli,
    ambilKelas: vi.fn(),
    buatKelas: vi.fn(),
    ubahKelas: vi.fn(),
    hapusKelas: vi.fn(),
    ambilMapel: vi.fn(),
  }
})

vi.mock('../../../sections/question/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return {
    ...asli,
    ambilSoal: vi.fn(),
    ambilTag: vi.fn(),
    buatSoal: vi.fn(),
    ubahSoal: vi.fn(),
    hapusSoal: vi.fn(),
  }
})

const apiSekolah = await import('../../../sections/school/api.js')
const apiSoal = await import('../../../sections/question/api.js')

const ambilKelas = /** @type {import('vitest').Mock} */ (apiSekolah.ambilKelas)
const ambilMapel = /** @type {import('vitest').Mock} */ (apiSekolah.ambilMapel)
const ambilSoal = /** @type {import('vitest').Mock} */ (apiSoal.ambilSoal)
const ambilTag = /** @type {import('vitest').Mock} */ (apiSoal.ambilTag)

const kotak = /** @type {Record<string, unknown>} */ (globalThis)
kotak.IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

/** @param {import('react').ReactElement} halaman */
function pasang(halaman) {
  act(() => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>{halaman}</MemoryRouter>
      </QueryClientProvider>,
    )
  })
}

/** @param {number} ms */
const sleep = (ms) => new Promise((selesai) => setTimeout(selesai, ms))

/**
 * Menunggu sampai layar memuat teks tertentu (paling lama `batas` ms).
 * @param {string} teks
 * @param {number} [batas]
 */
async function tungguTeks(teks, batas = 3000) {
  const mulai = Date.now()
  while (Date.now() - mulai < batas) {
    if ((wadah.textContent ?? '').includes(teks)) return true
    await act(async () => {
      await sleep(50)
    })
  }
  return (wadah.textContent ?? '').includes(teks)
}

/** @param {string} teks @returns {boolean} */
function adaTeks(teks) {
  return (wadah.textContent ?? '').includes(teks)
}

/** @param {string} label @returns {boolean} */
function adaTombolBerlabel(label) {
  return wadah.querySelector(`[aria-label="${label}"]`) !== null
}

/**
 * Apakah ada TOMBOL yang bertuliskan ini?
 *
 * Bukan sekadar mencari teksnya: panel formulir berbasis `<dialog>` tetap
 * mencetak judulnya ("Tambah kelas") walau panelnya tertutup, jadi mencari teks
 * saja akan menganggap tombolnya masih ada padahal sudah disembunyikan.
 * @param {string} teks
 * @returns {boolean}
 */
function adaTombolBerteks(teks) {
  const semua = /** @type {HTMLButtonElement[]} */ ([...wadah.querySelectorAll('button')])
  return semua.some((satu) => (satu.textContent ?? '').includes(teks))
}

/** Masuk sebagai seorang pengguna. @param {string} peran */
function masukSebagai(peran) {
  useAuthStore.getState().aturUser({
    id: 1,
    name: peran === 'admin' ? 'Bu Kepala Sekolah' : 'Pak Guru',
    email: `${peran}@sekolah.test`,
    role: peran,
    status: 'aktif',
    statusLabel: 'Aktif',
    emailTerverifikasi: true,
  })
}

beforeEach(() => {
  ambilKelas.mockReset()
  ambilMapel.mockReset()
  ambilSoal.mockReset()
  ambilTag.mockReset()

  ambilKelas.mockResolvedValue([
    { id: 7, nama: '4A', tingkat: 4, tahun_ajaran: '2026/2027', jumlah_murid: 12 },
  ])
  ambilMapel.mockResolvedValue([{ id: 3, nama: 'Matematika' }])
  ambilTag.mockResolvedValue([])
  ambilSoal.mockResolvedValue({
    data: [
      {
        id: 11,
        subject_id: 3,
        tag_id: null,
        tipe: 'pilihan_ganda',
        tipe_label: 'Pilihan ganda',
        objektif: true,
        konten: { teks: 'Berapa 2 + 2?' },
        kunci: { jawaban: 'A' },
        pembahasan: null,
        skor: 1,
        aktif: true,
        mapel_nama: 'Matematika',
        tag_nama: null,
      },
    ],
    meta: { total: 1, current_page: 1, last_page: 1, per_page: 20 },
  })

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
  useAuthStore.getState().aturUser(null)
})

/**
 * Panggil `hanyaMelihat` dengan peran seadanya — fungsi itu memang hanya membaca
 * `role`, jadi tidak perlu DataUser lengkap.
 * @param {string|null|undefined} peran
 */
function cekPeran(peran) {
  const user = peran === null || peran === undefined ? peran : { role: peran }
  return hanyaMelihat(/** @type {import('../../../sections/auth/authStore.js').DataUser} */ (user))
}

describe('hanyaMelihat', () => {
  it('hanya peran admin (kepala sekolah) yang dianggap hanya melihat', () => {
    expect(cekPeran('admin')).toBe(true)
    expect(cekPeran('guru')).toBe(false)
    expect(cekPeran('murid')).toBe(false)
    expect(cekPeran(null)).toBe(false)
    expect(cekPeran(undefined)).toBe(false)
  })
})

describe('halaman Kelas', () => {
  it('kepala sekolah tidak melihat tombol tambah maupun aksi baris', async () => {
    masukSebagai('admin')
    pasang(<HalamanKelas />)
    await tungguTeks('4A')

    expect(adaTombolBerlabel('Ubah kelas 4A')).toBe(false)
    expect(adaTombolBerlabel('Hapus kelas 4A')).toBe(false)
    expect(adaTombolBerteks('Tambah kelas')).toBe(false)
    // Alasan halaman ini tidak punya tombol apa pun harus terbaca, bukan ditebak.
    expect(adaTeks('Hanya melihat.')).toBe(true)
  })

  it('guru tetap mendapat tombol tambah dan aksi barisnya', async () => {
    masukSebagai('guru')
    pasang(<HalamanKelas />)
    await tungguTeks('4A')

    expect(adaTombolBerteks('Tambah kelas')).toBe(true)
    expect(adaTombolBerlabel('Ubah kelas 4A')).toBe(true)
    expect(adaTombolBerlabel('Hapus kelas 4A')).toBe(true)
    expect(adaTeks('Hanya melihat.')).toBe(false)
  })
})

describe('halaman Bank soal', () => {
  it('kepala sekolah bisa membaca soal tetapi tidak menambah atau menghapusnya', async () => {
    masukSebagai('admin')
    pasang(<HalamanBankSoal />)
    await tungguTeks('Berapa 2 + 2?')

    expect(adaTeks('Berapa 2 + 2?')).toBe(true)
    expect(adaTombolBerteks('Tambah soal')).toBe(false)
    expect(adaTombolBerlabel('Ubah soal: Berapa 2 + 2?')).toBe(false)
    expect(adaTombolBerlabel('Hapus soal: Berapa 2 + 2?')).toBe(false)
    expect(adaTeks('Hanya melihat.')).toBe(true)
  })

  it('guru tetap bisa mengubah dan menghapus soal', async () => {
    masukSebagai('guru')
    pasang(<HalamanBankSoal />)
    await tungguTeks('Berapa 2 + 2?')

    expect(adaTombolBerteks('Tambah soal')).toBe(true)
    expect(adaTombolBerlabel('Ubah soal: Berapa 2 + 2?')).toBe(true)
    expect(adaTombolBerlabel('Hapus soal: Berapa 2 + 2?')).toBe(true)
  })
})
