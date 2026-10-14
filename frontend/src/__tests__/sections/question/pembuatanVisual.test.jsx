// @vitest-environment jsdom
/**
 * Pembuatan soal secara visual (14 Oktober 2026).
 *
 * Permintaan pemilik produk: *"menjodohkan layout-nya sangat jelek dan gak
 * berurutan dan sudah dipakai, perbaiki. Buat pengurutan urutan dll langsung
 * visual gak perlu ketik lagi, ini pattern utama: utamakan visual, jangan
 * banyak biarkan user mengetik manual … agar lebih mudah dan tidak banyak
 * human error."*
 *
 * Dua bentuknya diuji di sini:
 *
 * 1. **Mengurutkan & urut gambar** — urutan benar disusun dengan memindahkan
 *    barisnya (▲/▼), bukan dengan mengetik nomor urut. Nomor tiap baris
 *    dihitung dari posisinya, jadi tidak mungkin kembar atau bolong, dan yang
 *    dikirim ke server (`kunci.urutan`) mengikuti urutan yang dilihat guru.
 * 2. **Menjodohkan & hubung kata** — penyambungan pindah ke papan tersendiri,
 *    dan item kanan yang **sudah dipakai** tidak bisa dipilih lagi; sebabnya
 *    tertulis di opsinya beserta siapa pemakainya.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import EditorSoal from '../../../sections/question/EditorSoal.jsx'
import {
  geserBarisPosisi,
  lepasPasangan,
  pasangkanKanan,
  pemakaiKanan,
} from '../../../sections/question/tipeSoal.js'
import { useToastStore } from '../../../shared/ui/toast.jsx'

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

describe('geserBarisPosisi', () => {
  const daftar = [
    { id: 'I1', teks: 'satu', posisi: '1' },
    { id: 'I2', teks: 'dua', posisi: '2' },
    { id: 'I3', teks: 'tiga', posisi: '3' },
  ]

  it('memindahkan baris lalu menulis ulang nomornya dari atas', () => {
    const naik = geserBarisPosisi(daftar, 2, -1)

    expect(naik.map((satu) => satu.id)).toEqual(['I1', 'I3', 'I2'])
    expect(naik.map((satu) => satu.posisi)).toEqual(['1', '2', '3'])
  })

  it('nomor tetap berurutan walau posisi awalnya bolong atau kembar', () => {
    // Inilah yang dulu bisa diketik guru: dua baris bernomor sama, dan nomor
    // yang tidak dipakai. Sesudah dipindahkan, semuanya rapi 1..n.
    const kacau = [
      { id: 'I1', teks: 'satu', posisi: '1' },
      { id: 'I2', teks: 'dua', posisi: '1' },
      { id: 'I3', teks: 'tiga', posisi: '9' },
    ]

    expect(geserBarisPosisi(kacau, 0, 1).map((satu) => satu.posisi)).toEqual(['1', '2', '3'])
  })

  it('di ujung daftar, daftarnya tidak berubah', () => {
    expect(geserBarisPosisi(daftar, 0, -1)).toBe(daftar)
    expect(geserBarisPosisi(daftar, 2, 1)).toBe(daftar)
  })
})

describe('papan jodoh: aturan pasangan', () => {
  it('mencatat siapa pemakai tiap item kanan', () => {
    expect(pemakaiKanan({ K1: 'N2', K2: 'N1' })).toEqual({ N2: 'K1', N1: 'K2' })
    expect(pemakaiKanan({ K1: '', K2: 'N1' })).toEqual({ N1: 'K2' })
  })

  it('satu item kanan hanya boleh dipakai satu kiri', () => {
    const peta = { K1: 'N1', K2: 'N2' }

    // K2 mencoba mengambil N1 yang sudah dipakai K1: peta tidak berubah.
    expect(pasangkanKanan(peta, 'K2', 'N1')).toEqual(peta)
    // Memasangkan ulang kiri yang sama dengan kanan lain tetap boleh.
    expect(pasangkanKanan(peta, 'K2', 'N3')).toEqual({ K1: 'N1', K2: 'N3' })
  })

  it('memasangkan kiri yang sama mengganti pasangannya, bukan menambah', () => {
    expect(pasangkanKanan({ K1: 'N1' }, 'K1', 'N2')).toEqual({ K1: 'N2' })
  })

  it('melepas pasangan membuang entrinya', () => {
    expect(lepasPasangan({ K1: 'N1', K2: 'N2' }, 'K1')).toEqual({ K2: 'N2' })
    expect(lepasPasangan({ K2: 'N2' }, 'K1')).toEqual({ K2: 'N2' })
  })
})

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root
/** Muatan tersimpan dari `onSimpan`. */
let tersimpan = /** @type {any} */ (null)

/** @param {string} jenis */
function pasang(jenis) {
  act(() => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EditorSoal
          soal={null}
          daftarMapel={[{ id: 1, nama: 'Matematika' }]}
          daftarTag={[]}
          sedangMenyimpan={false}
          mapelAwal="1"
          jenisAwal={jenis}
          onSimpan={(muatan) => {
            tersimpan = muatan
          }}
          onBatal={() => {}}
        />
      </QueryClientProvider>,
    )
  })
}

/** @param {string} label */
function tombol(label) {
  const el = /** @type {HTMLButtonElement|null} */ (wadah.querySelector(`button[aria-label="${label}"]`))

  if (!el) throw new Error(`tombol "${label}" tidak ada`)

  return el
}

/** @param {string} label */
function klik(label) {
  act(() => tombol(label).click())
}

/** @param {string} label */
function adaTombol(label) {
  return wadah.querySelector(`button[aria-label="${label}"]`) !== null
}

/** @param {string} pemilih @param {string} nilai */
function isi(pemilih, nilai) {
  const el = /** @type {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|null} */ (
    wadah.querySelector(pemilih)
  )

  if (!el) throw new Error(`isian ${pemilih} tidak ada`)

  const proto =
    el instanceof window.HTMLSelectElement
      ? window.HTMLSelectElement.prototype
      : el instanceof window.HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype

  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, nilai)
    el.dispatchEvent(new window.Event('input', { bubbles: true }))
    if (el instanceof window.HTMLSelectElement) el.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
}

/** @param {string} kelas */
function jumlah(kelas) {
  return wadah.querySelectorAll(kelas).length
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
  tersimpan = null
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('mengurutkan disusun visual', () => {
  it('tidak ada lagi kotak nomor urut yang harus diketik', () => {
    pasang('mengurutkan')

    expect(wadah.querySelector('[aria-label^="Nomor urut item"]')).toBeNull()
    expect(adaTombol('Naikkan item I2 ke atas')).toBe(true)
    expect(adaTombol('Turunkan item I1 ke bawah')).toBe(true)
  })

  it('▲/▼ memindahkan baris dan nomor barisnya ikut berubah', () => {
    pasang('mengurutkan')

    isi('[aria-label="Teks item I1"]', 'Bangun tidur')
    isi('[aria-label="Teks item I2"]', 'Sikat gigi')

    klik('Naikkan item I2 ke atas')

    // Baris pertama sekarang I2 — nomor di badge mengikuti posisinya (1).
    const teksUrut = [...wadah.querySelectorAll('input[aria-label^="Teks item"]')].map((el) =>
      /** @type {HTMLInputElement} */ (el).getAttribute('aria-label'),
    )

    expect(teksUrut).toEqual(['Teks item I2', 'Teks item I1'])
    expect(wadah.textContent ?? '').toContain('Bangun tidur')
  })

  it('menyimpan urutan yang dilihat guru sebagai kunci', () => {
    pasang('mengurutkan')

    isi('#soal-teks', 'Urutkan kegiatan pagi.')
    isi('[aria-label="Teks item I1"]', 'Bangun tidur')
    isi('[aria-label="Teks item I2"]', 'Sikat gigi')
    klik('Turunkan item I1 ke bawah')

    act(() => {
      const simpan = [...wadah.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Simpan soal')
      simpan?.click()
    })

    expect(tersimpan).toBeTruthy()
    const itemTersimpan = /** @type {{ id: string }[]} */ (tersimpan.konten.item)

    expect(itemTersimpan.map((satu) => satu.id)).toEqual(['I2', 'I1'])
    expect(tersimpan.kunci.urutan).toEqual(['I2', 'I1'])
  })
})

describe('menjodohkan disambungkan di papan sendiri', () => {
  it('pemilih pasangan ada di papan, bukan berjejal di baris item', () => {
    pasang('menjodohkan')

    expect(jumlah('.papan-jodoh')).toBe(1)
    expect(jumlah('.baris-jodoh')).toBe(2)
    expect(wadah.querySelector('[aria-label="Pasangan kiri K1"]')).toBeTruthy()
    expect(wadah.textContent ?? '').toContain('2 dari 2 tersambung')
  })

  it('item kanan yang sudah dipakai tidak bisa dipilih lagi, sebabnya ditulis', () => {
    pasang('menjodohkan')

    // Bawaan: K1→N1 dan K2→N2. Baris K2 mencoba memakai N1.
    const opsi = [...wadah.querySelectorAll('[aria-label="Pasangan kiri K2"] option')].map(
      (satu) => /** @type {HTMLOptionElement} */ (satu),
    )
    const n1 = /** @type {HTMLOptionElement} */ (opsi.find((o) => o.value === 'N1'))

    expect(n1.disabled).toBe(true)
    expect(n1.textContent).toContain('sudah dipakai K1')
  })

  it('melepas pasangan lewat opsi kosong dan menghitung ulang', () => {
    pasang('menjodohkan')

    isi('[aria-label="Pasangan kiri K1"]', '')

    expect(wadah.textContent ?? '').toContain('1 dari 2 tersambung')
    expect(wadah.textContent ?? '').toContain('belum dipasangkan')
    expect(wadah.textContent ?? '').toContain('Masih ada 1 item kiri yang belum dipasangkan.')
  })

  it('menyimpan pasangan yang tersambung di papan', () => {
    pasang('menjodohkan')

    isi('#soal-teks', 'Jodohkan alat pernapasan.')
    isi('[aria-label="Teks kiri K1"]', 'Paru-paru')
    isi('[aria-label="Teks kanan N1"]', 'Alat pernapasan')
    isi('[aria-label="Teks kiri K2"]', 'Jantung')
    isi('[aria-label="Teks kanan N2"]', 'Alat pemompa darah')

    // Dua item kanan milik dua kiri: tanpa "sudah dipakai" yang benar, N1 dan
    // N2 bisa saja sama-sama menunjuk satu item dan baru ditolak server.
    // Sesudah dilepas, N1 kembali tersedia untuk K1.
    isi('[aria-label="Pasangan kiri K2"]', '')
    isi('[aria-label="Pasangan kiri K1"]', 'N1')
    isi('[aria-label="Pasangan kiri K2"]', 'N2')

    act(() => {
      const simpan = [...wadah.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Simpan soal')
      simpan?.click()
    })

    expect(tersimpan).toBeTruthy()
    expect(tersimpan.kunci.pasangan).toEqual({ K1: 'N1', K2: 'N2' })
    expect(tersimpan.konten.kiri[0]).toEqual({ id: 'K1', teks: 'Paru-paru' })
  })
})
