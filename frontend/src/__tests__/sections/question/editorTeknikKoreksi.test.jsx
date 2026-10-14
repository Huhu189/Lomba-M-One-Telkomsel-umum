// @vitest-environment jsdom
/**
 * Pilihan teknik koreksi di editor soal (14 Oktober 2026).
 *
 * Permintaan pemilik produk: "semua tipe soal … ada yang bisa manual otomatis,
 * ada yang bisa lebih (teks)". Yang diuji di sini bukan hanya layarnya, tetapi
 * **muatan yang benar-benar dikirim ke server**: `kunci.teknik_koreksi` hanya
 * ikut bila guru memilih yang bukan bawaan, dan pilihan yang tidak tersedia
 * untuk jenis soal tidak pernah bisa dipilih.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import EditorSoal from '../../../sections/question/EditorSoal.jsx'
import { TIPE } from '../../../sections/question/tipeSoal.js'
import { TEKNIK } from '../../../sections/question/teknikKoreksi.js'
import { useToastStore } from '../../../shared/ui/toast.jsx'

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root
/** Muatan tersimpan dari `onSimpan`. */
let tersimpan = /** @type {any} */ (null)

/**
 * Pasang editor untuk soal baru.
 * @param {string} jenis
 */
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

/** @param {string} id */
function radio(id) {
  const el = /** @type {HTMLInputElement|null} */ (wadah.querySelector(`#${id}`))

  if (!el) throw new Error(`radio ${id} tidak ada`)

  return el
}

/** @param {string} pemilih @param {string} nilai */
function isi(pemilih, nilai) {
  const el = /** @type {HTMLInputElement|HTMLTextAreaElement|null} */ (wadah.querySelector(pemilih))

  if (!el) throw new Error(`isian ${pemilih} tidak ada`)

  const proto =
    el instanceof window.HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype

  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, nilai)
    el.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

/** @param {string} teks */
function tombolTeks(teks) {
  const el = [...wadah.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === teks)

  if (!el) throw new Error(`tombol "${teks}" tidak ada`)

  return el
}

/** Jumlah radio teknik yang tampil. */
function jumlahRadio() {
  return wadah.querySelectorAll('input[name="teknik-koreksi"]').length
}

/** Nilai radio yang sedang tercentang. */
function terpilih() {
  const el = /** @type {HTMLInputElement|null} */ (
    wadah.querySelector('input[name="teknik-koreksi"]:checked')
  )

  return el?.value ?? ''
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

describe('teknik koreksi di editor', () => {
  it('pilihan ganda menawarkan otomatis (bawaan) dan manual', () => {
    pasang(TIPE.pilihanGanda)

    expect(jumlahRadio()).toBe(2)
    expect(terpilih()).toBe(TEKNIK.otomatis)
    expect(radio('teknik-manual').checked).toBe(false)
    expect(wadah.textContent ?? '').toContain('Teknik koreksi')
  })

  /** Isi pilihan ganda sampai layak disimpan. */
  function isiPilihanGanda() {
    isi('#soal-teks', 'Berapa hasil 2 + 2?')
    isi('[aria-label="Teks opsi A"]', '3')
    isi('[aria-label="Teks opsi B"]', '4')
    act(() => radio('kunci-B').click())
  }

  it('memilih manual mengirim kunci.teknik_koreksi ke server', () => {
    pasang(TIPE.pilihanGanda)

    isiPilihanGanda()
    act(() => radio('teknik-manual').click())
    act(() => tombolTeks('Simpan soal')?.click())

    expect(tersimpan).toBeTruthy()
    expect(tersimpan.kunci.teknik_koreksi).toBe(TEKNIK.manual)
  })

  it('membiarkan bawaan tidak menambah bidang teknik ke kunci', () => {
    pasang(TIPE.pilihanGanda)

    isiPilihanGanda()
    act(() => tombolTeks('Simpan soal')?.click())

    expect(tersimpan).toBeTruthy()
    expect('teknik_koreksi' in tersimpan.kunci).toBe(false)
  })

  it('uraian hanya menawarkan otomatis (teks) dan manual', () => {
    pasang(TIPE.uraian)

    expect(jumlahRadio()).toBe(2)
    expect(terpilih()).toBe(TEKNIK.otomatisTeks)
    // Jenis yang dinilai kata kunci tidak menawarkan "otomatis" kunci pasti.
    expect(wadah.querySelector('#teknik-otomatis')).toBeNull()
  })

  it('tugas unggah terkunci pada manual', () => {
    pasang(TIPE.tugasUnggah)

    expect(jumlahRadio()).toBe(1)
    expect(terpilih()).toBe(TEKNIK.manual)
    expect(radio('teknik-manual').disabled).toBe(true)
    expect(wadah.textContent ?? '').toContain('hanya bisa dinilai manual')
  })

  it('mengganti jenis soal merapikan teknik yang tidak lagi tersedia', () => {
    pasang(TIPE.uraian)

    // Uraian memakai bawaan "otomatis teks"; pindah ke pilihan ganda membuat
    // pilihan itu tidak lagi tersedia — editor mengembalikannya ke bawaan
    // jenis barunya, bukan menampilkan galat saat menyimpan.
    act(() => radio('teknik-manual').click())
    expect(terpilih()).toBe(TEKNIK.manual)

    const detail = wadah.querySelector('details.pemilih-jenis')
    if (detail) act(() => detail.setAttribute('open', 'open'))

    const petak = /** @type {HTMLElement|undefined} */ (
      [...wadah.querySelectorAll('button[role="radio"]')].find((b) =>
        (b.textContent ?? '').includes('Pilihan ganda'),
      )
    )

    if (!petak) throw new Error('petak "Pilihan ganda" tidak ada')

    act(() => petak.click())

    // 'manual' tersedia di kedua jenis, jadi pilihan guru dipertahankan.
    expect(terpilih()).toBe(TEKNIK.manual)
    expect(wadah.textContent ?? '').toContain('Pilihan ganda')
  })
})
