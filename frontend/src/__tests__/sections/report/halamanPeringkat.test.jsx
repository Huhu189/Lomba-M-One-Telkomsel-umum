// @vitest-environment jsdom
/**
 * Papan peringkat (/kuis/:slug/peringkat) setelah aturan 14 Oktober 2026.
 *
 * Yang dijaga di sini adalah janji di depan murid, bukan sekadar tampilannya:
 *
 * 1. **murid di luar N% teratas** tidak melihat nomor peringkat siapa pun —
 *    ia diberi tahu bahwa nomornya belum dibuka, dan skornya sendiri tetap
 *    terbaca;
 * 2. **jejak bonus tidak pernah sampai ke layar murid**: kata "dibantu" dan
 *    nilai asli hanya muncul di layar kerja guru;
 * 3. **mode proyektor** membuang jejak itu juga — papan yang diproyeksikan
 *    harus sama persis dengan yang dilihat murid, karena layarnya menghadap
 *    kelas.
 *
 * Modul API di-mock supaya berkas ini menguji halaman, bukan jaringannya; dua
 * permintaan yang berbeda (guru 50 baris, murid 20 baris) tetap diperiksa.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HalamanPeringkat from '../../../sections/report/halaman/HalamanPeringkat.jsx'
import { useAuthStore } from '../../../sections/auth/authStore.js'

vi.mock('../../../sections/report/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return { ...asli, ambilPeringkat: vi.fn() }
})

const api = await import('../../../sections/report/api.js')
const ambilPeringkat = /** @type {import('vitest').Mock} */ (api.ambilPeringkat)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/**
 * Satu baris papan lengkap sesuai kontrak server.
 * @param {Record<string, unknown>} ubah
 */
function baris(ubah) {
  return {
    peringkat: 1,
    attempt_id: 1,
    murid_id: 1,
    tim_id: null,
    tim_nama: null,
    anggota: [],
    nama: 'Ani',
    skor: 10,
    skor_maksimal: 10,
    persen: 100,
    jumlah_benar: 10,
    jumlah_soal: 10,
    dikumpulkan_at: '2026-10-14T03:00:00.000Z',
    ...ubah,
  }
}

/**
 * Payload respons peringkat lengkap.
 * @param {Record<string, unknown>} ubah
 */
function respon(ubah) {
  return {
    kuis_id: 1,
    judul_kuis: 'Ulangan Operasi Hitung',
    mode_tim: false,
    tampil: true,
    guru: false,
    total: 5,
    top: 20,
    terbuka_persen: 30,
    terbuka_jumlah: 2,
    bonus_aktif: false,
    bonus_bawah_persen: 50,
    bonus_maks_persen: 15,
    peringkat: [],
    peringkat_saya: null,
    detail_saya: null,
    ...ubah,
  }
}

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
        <MemoryRouter initialEntries={['/kuis/abcd/peringkat']}>
          <Routes>
            <Route path="/kuis/:slug/peringkat" element={<HalamanPeringkat />} />
          </Routes>
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
  ambilPeringkat.mockReset()
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('HalamanPeringkat', () => {
  it('murid di luar N% teratas melihat skornya sendiri tanpa satu pun jejak bonus', async () => {
    useAuthStore.setState({ user: { id: 9, name: 'Dedi', role: 'murid' } })
    ambilPeringkat.mockResolvedValue(
      respon({
        // Baris yang terkirim ke murid sudah bebas jejak: angka `skor`/`persen`
        // adalah angka yang ditampilkan, dan tidak ada kunci bonus sama sekali.
        peringkat: [
          baris({ peringkat: 1, attempt_id: 1, murid_id: 1, nama: 'Ani' }),
          baris({ peringkat: 2, attempt_id: 2, murid_id: 2, nama: 'Budi', skor: 8, persen: 80, jumlah_benar: 8 }),
        ],
        detail_saya: {
          nama: 'Dedi',
          skor: 7,
          skor_maksimal: 10,
          persen: 70,
          peringkat: null,
          di_luar_terbuka: true,
        },
      }),
    )

    pasang()
    expect(await tungguTeks('Nomor peringkatmu belum dibuka')).toBe(true)

    // Aturan dijelaskan, dan nilainya sendiri tetap terbaca.
    expect(wadah.textContent).toContain('dibuka untuk 2 murid teratas')
    expect(wadah.textContent).toContain('Skormu:')
    expect(wadah.textContent).toContain('7 / 10 (70%)')

    // Janji diam-diam: tidak ada kata "dibantu", tidak ada kolom catatan guru,
    // dan tidak ada tombol mode proyektor di layar murid.
    expect(wadah.textContent).not.toContain('dibantu')
    expect(wadah.textContent).not.toContain('Catatan guru')
    expect(tombol('Mode proyektor')).toBeNull()

    // Murid meminta papan yang lebih pendek daripada guru.
    expect(ambilPeringkat.mock.calls[0]?.[1]).toBe(20)
  })

  it('guru melihat seluruh papan, jejak bonus, dan bisa memproyeksikannya tanpa jejak itu', async () => {
    useAuthStore.setState({ user: { id: 7, name: 'Bu Rina', role: 'guru' } })
    ambilPeringkat.mockResolvedValue(
      respon({
        guru: true,
        top: 50,
        terbuka_jumlah: 2,
        bonus_aktif: true,
        bonus_bawah_persen: 50,
        bonus_maks_persen: 60,
        peringkat: [
          baris({ peringkat: 1, attempt_id: 1, murid_id: 1, nama: 'Ani' }),
          baris({ peringkat: 2, attempt_id: 2, murid_id: 2, nama: 'Budi', skor: 8, persen: 80, jumlah_benar: 8 }),
          baris({
            peringkat: 3,
            attempt_id: 3,
            murid_id: 3,
            nama: 'Citra',
            skor: 6,
            persen: 60,
            jumlah_benar: 6,
          }),
          baris({
            peringkat: 4,
            attempt_id: 4,
            murid_id: 4,
            nama: 'Dedi',
            skor: 2,
            persen: 20,
            jumlah_benar: 2,
            peringkat_asli: 5,
            bonus: 5,
            skor_tampil: 7,
            persen_tampil: 70,
            berbantuan: true,
          }),
        ],
      }),
    )

    pasang()
    expect(await tungguTeks('Ulangan Operasi Hitung')).toBe(true)

    // Papan guru: 50 baris diminta, aturan keterbukaan murid diberitahukan, dan
    // baris yang dibantu ditandai lengkap dengan nilai serta peringkat aslinya.
    expect(ambilPeringkat.mock.calls[0]?.[1]).toBe(50)
    expect(wadah.textContent).toContain('Bonus penyemangat aktif')
    expect(wadah.textContent).toContain('Catatan guru')
    expect(wadah.textContent).toContain('dibantu +5')
    expect(wadah.textContent).toContain('nilai asli 2 / 10')
    expect(wadah.textContent).toContain('peringkat asli #5')
    expect(wadah.textContent).toContain('Murid hanya melihat 2 baris teratas')

    // Mode proyektor: papan yang menghadap kelas dibersihkan dari semua jejak.
    await act(async () => {
      tombol('Mode proyektor')?.click()
    })

    expect(wadah.textContent).toContain('Keluar mode proyektor')
    expect(wadah.textContent).not.toContain('Catatan guru')
    expect(wadah.textContent).not.toContain('dibantu')
    expect(wadah.textContent).not.toContain('peringkat asli')
    // Angka yang diproyeksikan tetap angka yang dilihat murid (Dedi 7 / 10).
    expect(wadah.textContent).toContain('7 / 10 (70%)')
  })

  it('mode tim menyapa tim, bukan anaknya: peringkat timmu, skor timmu', async () => {
    useAuthStore.setState({ user: { id: 9, name: 'Dedi', role: 'murid' } })
    ambilPeringkat.mockResolvedValue(
      respon({
        mode_tim: true,
        total: 2,
        terbuka_jumlah: 1,
        peringkat: [
          baris({
            peringkat: 1,
            attempt_id: 1,
            murid_id: null,
            tim_id: 7,
            tim_nama: 'Tim Merah',
            nama: 'Tim Merah',
            anggota: ['Ani', 'Budi'],
          }),
        ],
        detail_saya: {
          nama: 'Tim Biru',
          skor: 10,
          skor_maksimal: 20,
          persen: 50,
          peringkat: null,
          di_luar_terbuka: true,
        },
      }),
    )

    pasang()
    expect(await tungguTeks('Nomor peringkat timmu belum dibuka')).toBe(true)

    expect(wadah.textContent).toContain('Peringkat tim ·')
    expect(wadah.textContent).toContain('Skor timmu:')
    expect(wadah.textContent).toContain('1 tim teratas dari 2 peserta')
    // Baris tim tetap memakai nama tim, bukan nama anak.
    expect(wadah.textContent).toContain('Tim Merah')
    expect(wadah.textContent).toContain('Ani, Budi')
  })

  it('murid yang mengumpulkan melihat peringkatnya sendiri tanpa tabel saat aturan menutupnya', async () => {
    useAuthStore.setState({ user: { id: 2, name: 'Budi', role: 'murid' } })
    ambilPeringkat.mockResolvedValue(
      respon({
        peringkat: [
          baris({ peringkat: 1, attempt_id: 1, murid_id: 1, nama: 'Ani' }),
          baris({
            peringkat: 2,
            attempt_id: 2,
            murid_id: 2,
            nama: 'Budi',
            skor: 8,
            persen: 80,
            jumlah_benar: 8,
          }),
        ],
        peringkat_saya: baris({
          peringkat: 2,
          attempt_id: 2,
          murid_id: 2,
          nama: 'Budi',
          skor: 8,
          persen: 80,
          jumlah_benar: 8,
        }),
        detail_saya: {
          nama: 'Budi',
          skor: 8,
          skor_maksimal: 10,
          persen: 80,
          peringkat: 2,
          di_luar_terbuka: false,
        },
      }),
    )

    pasang()
    expect(await tungguTeks('Kamu di peringkat')).toBe(true)

    expect(wadah.textContent).toContain('Kamu di peringkat')
    expect(wadah.textContent).toContain('(kamu)')
    expect(wadah.textContent).not.toContain('Nomor peringkatmu belum dibuka')
  })
})
