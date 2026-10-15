// @vitest-environment jsdom
/**
 * Beranda admin sekolah (dasbor skala sekolah).
 *
 * Beranda admin adalah halaman pertama yang dibuka admin, dan seluruh isinya
 * berasal dari satu panggilan `/v1/admin/monitor`. Yang dijaga di sini: angka
 * yang tampil adalah angka yang dikirim server (bukan tebakan), urutan "perlu
 * perhatian" mengikuti keadaan yang benar-benar ada, sekolah yang tenang
 * mengatakannya apa adanya, dan tiap item perhatian menautkan ke halaman yang
 * memang bisa menindaklanjutinya.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BerandaAdmin from '../../../sections/admin/halaman/BerandaAdmin.jsx'
import { useAuthStore } from '../../../sections/auth/authStore.js'

vi.mock('../../../sections/admin/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return { ...asli, ambilMonitorSekolah: vi.fn() }
})

const api = await import('../../../sections/admin/api.js')
const ambilMonitorSekolah = /** @type {import('vitest').Mock} */ (api.ambilMonitorSekolah)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/**
 * Snapshot sekolah. Nilai bawaan = sekolah yang tenang; uji cukup menimpa bagian
 * yang diuji.
 * @param {Record<string, unknown>} [isi]
 */
const monitor = (isi = {}) => {
  const dasar = {
    sekolah: { nama: 'SD Negeri 1', npsn: '12345678', tahun_ajaran: '2026/2027' },
    server_now: '2026-10-14T02:00:00Z',
    menit_online: 10,
    murid: {
      total: 120,
      akun: 120,
      aktif: 118,
      online: 12,
      mengerjakan: 0,
      belum_verifikasi: 0,
      ditangguhkan: 0,
    },
    guru: { total: 8, aktif: 8, online: 3, ditangguhkan: 0, admin: 1 },
    kelas: {
      total: 4,
      daftar: [
        { id: 1, nama: 'Kelas 5A', tingkat: 5, jumlah_murid: 30, jumlah_kuis_terbit: 2 },
        { id: 2, nama: 'Kelas 5B', tingkat: 5, jumlah_murid: 28, jumlah_kuis_terbit: 1 },
      ],
    },
    kuis: {
      total: 10,
      terbit: 6,
      draf: 3,
      arsip: 1,
      aktif: 0,
      attempt_hari_ini: 0,
      dikumpulkan_hari_ini: 0,
      koreksi_menunggu: 0,
      kejadian_hari_ini: 0,
    },
    angka: [
      { kunci: 'murid_aktif', label: 'Murid aktif', nilai: 118, ket: 'dari 120 akun murid' },
      { kunci: 'sedang_mengerjakan', label: 'Sedang mengerjakan', nilai: 0, ket: 'ulangan berjalan' },
    ],
    kuis_berjalan: [],
    aktivitas: [],
  }

  return { ...dasar, ...isi }
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
        <MemoryRouter>
          <BerandaAdmin
            user={{
              id: 1,
              name: 'Pak Kepala',
              email: 'admin@sekolah.test',
              role: 'admin',
              status: 'aktif',
              statusLabel: 'Aktif',
              emailTerverifikasi: true,
            }}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })
}

/** @returns {string} */
const teks = () => wadah.textContent ?? ''

/**
 * Menunggu sampai layar memuat teks tertentu.
 * @param {string} dicari
 * @param {number} [batas]
 */
async function tungguTeks(dicari, batas = 2000) {
  const mulai = Date.now()
  while (Date.now() - mulai < batas) {
    if (teks().includes(dicari)) return true
    await act(async () => {
      await sleep(25)
    })
  }
  return teks().includes(dicari)
}

beforeEach(() => {
  ambilMonitorSekolah.mockReset()

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
  useAuthStore.setState({ user: null })
})

describe('BerandaAdmin', () => {
  it('menampilkan keadaan sekolah dari data server, bukan tebakan', async () => {
    ambilMonitorSekolah.mockResolvedValue(
      monitor({
        murid: {
          total: 120,
          akun: 120,
          aktif: 118,
          online: 12,
          mengerjakan: 3,
          belum_verifikasi: 5,
          ditangguhkan: 1,
        },
        kuis: {
          total: 10,
          terbit: 6,
          draf: 3,
          arsip: 1,
          aktif: 1,
          attempt_hari_ini: 26,
          dikumpulkan_hari_ini: 20,
          koreksi_menunggu: 4,
          kejadian_hari_ini: 2,
        },
        kuis_berjalan: [
          {
            id: 9,
            slug: 'ulangan-matematika-5a',
            judul: 'Ulangan Matematika',
            kelas_nama: 'Kelas 5A',
            peserta: 30,
            mengerjakan: 3,
            selesai: 27,
            persen_selesai: 90,
            mulai_at: '2026-10-14T01:00:00Z',
          },
        ],
        aktivitas: [
          {
            id: 77,
            jenis: 'kelola_akun',
            judul: 'Kelola akun: Setel ulang sandi',
            peristiwa: 'sandi',
            pelaku: 'Pak Kepala',
            alasan: 'Murid lupa sandi',
            waktu: '2026-10-14T01:30:00Z',
          },
        ],
      }),
    )

    pasang()

    expect(await tungguTeks('Ulangan Matematika')).toBe(true)

    // Angka yang tampil = angka yang dikirim server.
    expect(teks()).toContain('118')
    expect(teks()).toContain('akun aktif dari 120 murid terdaftar')
    expect(teks()).toContain('5 belum terverifikasi')
    expect(teks()).toContain('1 ditangguhkan')

    // Ulangan berjalan lengkap dengan kelas dan progresnya.
    expect(teks()).toContain('Kelas 5A · 30 peserta · 3 sedang mengerjakan · 27 selesai')
    expect(teks()).toContain('90% selesai')

    // Ringkasan kelas dihitung dari daftar yang dikirim server.
    expect(teks()).toContain('58 murid di 2 kelas · terbesar: Kelas 5A (30 murid)')

    // Jejak audit tampil apa adanya.
    expect(teks()).toContain('Kelola akun: Setel ulang sandi')
    expect(teks()).toContain('Murid lupa sandi')

    // "Online" tidak boleh dibaca sebagai bukti kehadiran.
    expect(teks()).toContain('bukan login terakhir')
  })

  it('mengurutkan "perlu perhatian" dari yang sedang bergerak ke sinyal kecurangan', async () => {
    ambilMonitorSekolah.mockResolvedValue(
      monitor({
        murid: {
          total: 120,
          akun: 120,
          aktif: 118,
          online: 12,
          mengerjakan: 3,
          belum_verifikasi: 5,
          ditangguhkan: 2,
        },
        guru: { total: 8, aktif: 8, online: 3, ditangguhkan: 1, admin: 1 },
        kuis: {
          total: 10,
          terbit: 6,
          draf: 3,
          arsip: 1,
          aktif: 1,
          attempt_hari_ini: 26,
          dikumpulkan_hari_ini: 20,
          koreksi_menunggu: 4,
          kejadian_hari_ini: 2,
        },
      }),
    )

    pasang()
    expect(await tungguTeks('3 murid sedang mengerjakan')).toBe(true)

    const urutan = ['3 murid sedang mengerjakan', '4 jawaban menunggu koreksi', '5 akun murid belum terverifikasi', '3 akun sedang ditangguhkan', '2 sinyal kecurangan hari ini']

    const posisi = urutan.map((satu) => teks().indexOf(satu))

    expect(posisi.every((p) => p >= 0), `posisi=${posisi.join(',')}`).toBe(true)
    expect([...posisi].sort((a, b) => a - b)).toEqual(posisi)

    // Akun murid dan guru yang ditangguhkan dijumlahkan dalam satu baris.
    expect(teks()).not.toContain('2 akun sedang ditangguhkan')
  })

  it('sekolah yang tenang mengatakannya apa adanya', async () => {
    ambilMonitorSekolah.mockResolvedValue(monitor({ kelas: { total: 0, daftar: [] } }))

    pasang()

    expect(await tungguTeks('Sekolah sedang tenang')).toBe(true)
    expect(teks()).toContain('Tidak ada ulangan berjalan')
    expect(teks()).toContain('Belum ada kelas')
    expect(teks()).toContain('Belum ada catatan aktivitas')
    // Tidak ada item perhatian palsu saat tidak ada apa-apa.
    expect(wadah.querySelectorAll('.perhatian-item').length).toBe(0)
  })

  it('gagal memuat tidak menebak angka', async () => {
    ambilMonitorSekolah.mockRejectedValue(new Error('jaringan putus'))

    pasang()

    expect(await tungguTeks('Gagal memuat dasbor sekolah')).toBe(true)
    expect(teks()).toContain('Angka yang tampil tidak boleh menebak')
    // Kartu angka tidak dirender dari data kosong.
    expect(wadah.querySelectorAll('.angka-nilai').length).toBe(0)
  })
})
