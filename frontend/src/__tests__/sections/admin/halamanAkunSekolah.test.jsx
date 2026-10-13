// @vitest-environment jsdom
/**
 * Halaman kelola akun sekolah (/admin/akun).
 *
 * Yang dijaga di sini adalah alur dua langkah yang menjadi inti halaman: admin
 * tidak boleh bisa menyimpan apa pun sebelum ia meminta token konfirmasi dan
 * menuliskan alasannya. Tanpa pagar itu, satu klik bisa mengubah email atau
 * menangguhkan akun murid tanpa jejak — dan tombolnya akan tampak normal saja.
 *
 * Uji ini memakai jalur yang benar-benar dipakai admin: ketik di formulir →
 * tombol Simpan hidup setelah token diterbitkan → muatan yang dikirim berisi
 * alasan, token, dan email yang sudah dipotong spasinya.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HalamanAkunSekolah from '../../../sections/admin/HalamanAkunSekolah.jsx'

vi.mock('../../../sections/admin/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return {
    ...asli,
    ambilAkunSekolah: vi.fn(),
    mintaTokenAkun: vi.fn(),
    ubahEmailAkun: vi.fn(),
    setelSandiAkun: vi.fn(),
    ubahStatusAkun: vi.fn(),
  }
})

const api = await import('../../../sections/admin/api.js')
const ambilAkunSekolah = /** @type {import('vitest').Mock} */ (api.ambilAkunSekolah)
const mintaTokenAkun = /** @type {import('vitest').Mock} */ (api.mintaTokenAkun)
const ubahEmailAkun = /** @type {import('vitest').Mock} */ (api.ubahEmailAkun)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @param {Record<string, unknown>} isi */
const akun = (isi) => ({
  id: 1,
  nama: 'Ana',
  email: 'ana@sekolah.test',
  peran: 'murid',
  peran_label: 'Murid',
  status: 'aktif',
  status_label: 'Aktif',
  terverifikasi: true,
  is_tamu: false,
  kelas_nama: 'Kelas 5A',
  nis: '1001',
  terakhir_aktif: null,
  ...isi,
})

// Akun yang sering dicari admin: barisnya ada, statusnya "aktif", tetapi emailnya
// belum diverifikasi sehingga ia ditolak di semua jalur masuk.
const ana = akun({ terverifikasi: false })
const rina = akun({
  id: 2,
  nama: 'Bu Rina',
  email: 'rina@sekolah.test',
  peran: 'guru',
  peran_label: 'Guru',
  status: 'suspended',
  status_label: 'Ditangguhkan',
  kelas_nama: null,
  nis: null,
})

/** @param {Array<Record<string, unknown>>} data */
const halaman = (data) => ({
  data,
  meta: { total: data.length, current_page: 1, last_page: 1, per_page: 20 },
})

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
          <HalamanAkunSekolah />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })
}

/** @param {string} pemilih @returns {HTMLElement|null} */
function cari(pemilih) {
  return /** @type {HTMLElement|null} */ (wadah.querySelector(pemilih))
}

/** @param {string} teks @returns {HTMLButtonElement|null} */
function tombol(teks) {
  const semua = /** @type {HTMLButtonElement[]} */ ([...wadah.querySelectorAll('button')])
  return semua.find((satu) => satu.textContent?.includes(teks)) ?? null
}

/** @param {string} label @returns {HTMLButtonElement|null} */
function tombolLabel(label) {
  return /** @type {HTMLButtonElement|null} */ (wadah.querySelector(`button[aria-label="${label}"]`))
}

/**
 * Satu pilihan di dalam menu "…" baris tabel (bukan tab di panelnya).
 * @param {string} teks @returns {HTMLButtonElement|null}
 */
function itemMenu(teks) {
  const semua = /** @type {HTMLButtonElement[]} */ ([
    ...wadah.querySelectorAll('.menu-aksi-daftar button'),
  ])
  return semua.find((satu) => satu.textContent?.includes(teks)) ?? null
}

/** Jumlah menu baris yang sedang terbuka. */
const jumlahMenuTerbuka = () => wadah.querySelectorAll('.menu-aksi-daftar').length

/** Buka menu baris milik satu akun. @param {string} nama */
function bukaMenu(nama) {
  act(() => {
    tombolLabel(`Menu aksi untuk ${nama}`)?.click()
  })
}

/**
 * Isi input/textarea seperti pengguna mengetik.
 * @param {string} pemilih
 * @param {string} nilai
 */
function isi(pemilih, nilai) {
  const el = /** @type {HTMLInputElement|HTMLTextAreaElement|null} */ (cari(pemilih))
  if (!el) throw new Error(`isian ${pemilih} tidak ada`)

  const prototipe = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype

  act(() => {
    const setter = Object.getOwnPropertyDescriptor(prototipe, 'value')?.set
    setter?.call(el, nilai)
    el.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

/**
 * Menunggu sampai layar memuat teks tertentu.
 * @param {string} teks
 * @param {number} [batas]
 */
async function tungguTeks(teks, batas = 2000) {
  const mulai = Date.now()
  while (Date.now() - mulai < batas) {
    if ((wadah.textContent ?? '').includes(teks)) return true
    await act(async () => {
      await sleep(25)
    })
  }
  return (wadah.textContent ?? '').includes(teks)
}

beforeEach(() => {
  ambilAkunSekolah.mockReset()
  mintaTokenAkun.mockReset()
  ubahEmailAkun.mockReset()

  ambilAkunSekolah.mockResolvedValue(halaman([ana, rina]))

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('HalamanAkunSekolah', () => {
  it('menampilkan akun guru & murid dengan status yang jujur', async () => {
    pasang()

    expect(await tungguTeks('Bu Rina')).toBe(true)
    expect(wadah.textContent).toContain('ana@sekolah.test')
    // Akun "aktif" tetapi emailnya belum diverifikasi tidak boleh tampak sehat.
    expect(wadah.textContent).toContain('Belum terverifikasi')
    expect(wadah.textContent).toContain('Ditangguhkan')
  })

  it('menyaring daftar dengan kata kunci yang sudah dipotong spasinya', async () => {
    pasang()
    await tungguTeks('Bu Rina')

    isi('#cari-akun', '  rina  ')
    await act(async () => {
      await sleep(450)
    })

    const terakhir = ambilAkunSekolah.mock.calls.at(-1)?.[0]

    expect(terakhir?.halaman).toBe(1)
    expect(terakhir?.cari).toBe('rina')
  })

  it('tiga aksi per baris jadi satu menu berteks yang bisa ditutup', async () => {
    pasang()
    await tungguTeks('Bu Rina')

    // Tiga tombol ikon berjajar sudah tidak ada; tinggal satu tombol menu.
    expect(tombolLabel('Ubah email Ana')).toBeNull()
    expect(tombolLabel('Setel ulang sandi Ana')).toBeNull()
    expect(tombolLabel('Menu aksi untuk Ana')).not.toBeNull()
    expect(jumlahMenuTerbuka()).toBe(0)

    bukaMenu('Ana')

    // Pilihannya berupa TEKS, bukan ikon tanpa keterangan.
    expect(itemMenu('Ubah email')).not.toBeNull()
    expect(itemMenu('Setel ulang kata sandi')).not.toBeNull()
    expect(itemMenu('Tangguhkan akun')).not.toBeNull()

    // Hanya satu menu boleh terbuka: membuka baris lain menutup yang lama.
    bukaMenu('Bu Rina')
    expect(jumlahMenuTerbuka()).toBe(1)
    expect(itemMenu('Aktifkan kembali')).not.toBeNull()

    // Esc menutup menu.
    act(() => {
      document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(jumlahMenuTerbuka()).toBe(0)

    // Klik di luar menu juga menutupnya.
    bukaMenu('Ana')
    expect(jumlahMenuTerbuka()).toBe(1)

    act(() => {
      document.body.dispatchEvent(new window.Event('pointerdown', { bubbles: true }))
    })
    expect(jumlahMenuTerbuka()).toBe(0)
  })

  it('tidak bisa menyimpan tanpa token, lalu menyimpan setelah token terbit', async () => {
    mintaTokenAkun.mockResolvedValue({
      token: 'tok-abc',
      expires_at: '2026-10-14T02:05:00Z',
      ttl_detik: 300,
    })
    ubahEmailAkun.mockResolvedValue({
      message: 'Email akun diperbarui.',
      akun: akun({ email: 'ana.baru@sekolah.test' }),
    })

    pasang()
    await tungguTeks('Ana')

    bukaMenu('Ana')

    act(() => {
      itemMenu('Ubah email')?.click()
    })

    // Memilih satu aksi menutup menunya, jadi tidak ada daftar yang tertinggal.
    expect(jumlahMenuTerbuka()).toBe(0)

    const simpan = /** @type {HTMLButtonElement} */ (tombol('Simpan perubahan'))
    const minta = /** @type {HTMLButtonElement} */ (tombol('Minta token konfirmasi'))

    // Formulir masih kosong: kedua tombol memang mati.
    expect(simpan.disabled).toBe(true)
    expect(minta.disabled).toBe(true)

    isi('#email-akun', 'ana.baru@sekolah.test')
    isi('#alasan-akun', 'Email murid salah ketik saat impor data')

    // Isian sudah sah, jadi "minta token" hidup — tetapi Simpan tetap mati
    // karena belum ada token.
    expect(tombol('Minta token konfirmasi')?.disabled).toBe(false)
    expect(tombol('Simpan perubahan')?.disabled).toBe(true)

    await act(async () => {
      tombol('Minta token konfirmasi')?.click()
      await sleep(50)
    })

    expect(mintaTokenAkun.mock.calls[0]?.[0]).toBe(ana.id)
    expect(mintaTokenAkun.mock.calls[0]?.[1]).toBe('Email murid salah ketik saat impor data')
    expect(ubahEmailAkun).not.toHaveBeenCalled()

    expect(tombol('Simpan perubahan')?.disabled).toBe(false)

    await act(async () => {
      tombol('Simpan perubahan')?.click()
      await sleep(50)
    })

    expect(ubahEmailAkun.mock.calls[0]?.[0]).toBe(ana.id)
    expect(ubahEmailAkun.mock.calls[0]?.[1]).toEqual({
      email: 'ana.baru@sekolah.test',
      alasan: 'Email murid salah ketik saat impor data',
      token: 'tok-abc',
    })
  })

  it('tiga pil tindakan di panel jadi satu menu "…" berteks', async () => {
    pasang()
    await tungguTeks('Bu Rina')

    bukaMenu('Ana')
    act(() => {
      itemMenu('Ubah email')?.click()
    })

    // Deretan tiga pil tindakan sudah tidak ada di panel; tinggal satu tombol "…".
    expect(cari('[role="group"][aria-label="Pilih tindakan"]')).toBeNull()
    expect(tombolLabel('Pilih tindakan untuk Ana')).not.toBeNull()

    act(() => {
      tombolLabel('Pilih tindakan untuk Ana')?.click()
    })

    // Pilihannya berupa TEKS, dan yang sedang aktif ditandai.
    expect(itemMenu('Ubah email')?.getAttribute('aria-current')).toBe('true')
    expect(itemMenu('Setel ulang kata sandi')?.getAttribute('aria-current')).toBeNull()
    expect(itemMenu('Status akun')).not.toBeNull()

    // Memilih satu tindakan menutup menunya lalu mengganti isi panelnya.
    act(() => {
      itemMenu('Setel ulang kata sandi')?.click()
    })
    expect(jumlahMenuTerbuka()).toBe(0)
    expect(wadah.textContent).toContain('Setel ulang kata sandi: Ana')
    expect(cari('#sandi-akun')).not.toBeNull()

    // Esc menutup menunya, dan klik di luar juga.
    act(() => {
      tombolLabel('Pilih tindakan untuk Ana')?.click()
    })
    expect(jumlahMenuTerbuka()).toBe(1)

    act(() => {
      document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(jumlahMenuTerbuka()).toBe(0)

    act(() => {
      tombolLabel('Pilih tindakan untuk Ana')?.click()
    })
    expect(jumlahMenuTerbuka()).toBe(1)

    act(() => {
      document.body.dispatchEvent(new window.Event('pointerdown', { bubbles: true }))
    })
    expect(jumlahMenuTerbuka()).toBe(0)
  })

  it('akun yang ditangguhkan menawarkan tindakan mengaktifkan kembali', async () => {
    pasang()
    await tungguTeks('Bu Rina')

    bukaMenu('Bu Rina')
    expect(itemMenu('Aktifkan kembali')).not.toBeNull()
    expect(itemMenu('Tangguhkan akun')).toBeNull()

    // Aksi merusak dikenali warnanya, bukan hanya dari teksnya.
    expect(itemMenu('Aktifkan kembali')?.classList.contains('menu-aksi-bahaya')).toBe(false)

    bukaMenu('Ana')
    expect(itemMenu('Tangguhkan akun')?.classList.contains('menu-aksi-bahaya')).toBe(true)
  })
})
