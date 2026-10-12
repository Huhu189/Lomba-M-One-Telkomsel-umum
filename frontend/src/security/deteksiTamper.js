/**
 * Deteksi tamper halaman (bagian 2B–2C chunk anticheat).
 *
 * Empat hal yang diperiksa, semuanya **hanya bukti untuk guru**, bukan vonis:
 *
 * 1. **Sumber dari skema extension** — node (script/link/iframe/…) yang memuat
 *    `chrome-extension:`, `moz-extension:`, atau `safari-web-extension:`
 *    dilaporkan sebagai `extension_detected`.
 * 2. **Fungsi bawaan yang diganti** — `addEventListener`, `preventDefault`,
 *    `stopPropagation` dibandingkan dengan sidik jari yang diambil saat mulai;
 *    yang berubah dilaporkan sebagai `dom_injection`.
 * 3. **Overlay asing** — elemen posisi fixed/absolute/sticky ber-z-index tinggi
 *    yang menutupi area ulangan dihapus (dinetralkan) lalu dicatat.
 * 4. **Elemen kanari yang hilang** — kanari tersembunyi yang kita sisipkan;
 *    kalau dihapus/disembunyikan pihak lain, itu juga `dom_injection`.
 *
 * Aturan yang dijaga:
 * - **rawan salah tuduh**, jadi saklar `detect_tamper` **default MATI** dan
 *   sengaja TIDAK ikut preset `exam_mode` (lihat `KunciPengaturan` di backend);
 * - **fail-open**: setiap pemeriksaan dibungkus try/catch — pemindai yang rusak
 *   tidak boleh menghentikan ulangan;
 * - tindakan hanya: hapus node asing, netralkan overlay, dan kaburkan layar
 *   sebentar. Tidak ada yang memblokir murid selamanya.
 *
 * Modul ini murni DOM (tanpa React) sehingga bisa diuji di jsdom dengan
 * menyuntikkan `document`, `window`, dan `catat`/`kaburkan`.
 */

/** Skema URL yang menandakan sumber dimuat dari extension peramban. */
const SKEMA_EXTENSION = ['chrome-extension:', 'moz-extension:', 'safari-web-extension:']

/** z-index minimum yang dianggap menutupi halaman ulangan. */
const Z_INDEX_MENUTUPI = 1000

/** Sisi minimum (px) overlay supaya dianggap menutupi area, bukan hiasan kecil. */
const SISI_OVERLAY_MIN_PX = 200

/** Atribut yang bisa memuat sumber eksternal pada sebuah node. */
const ATRIBUT_SUMBER = ['src', 'href', 'srcset', 'data', 'poster']

/** Jadwal pemindaian berkala sesudah pemindaian awal (ms). */
const JEDA_PINDAI_MS = 15000

/** Pemindaian pertama sesudah mount (ms). */
const JEDA_AWAL_MS = 4000

/** Jeda penggabungan perubahan DOM dari MutationObserver (ms). */
const JEDA_MUTASI_MS = 250

/** Lama mengaburkan layar saat tamper ditemukan (detik). */
const BLUR_TAMPER_DETIK = 4

/** Penanda kanari supaya tidak tertukar dengan node lain. */
const PENANDA_KANARI = 'data-kanari-proteksi'

/**
 * Skema extension dari sebuah nilai atribut, bila ada.
 *
 * @param {unknown} nilai
 * @returns {string|null}
 */
export function skemaExtension(nilai) {
  if (typeof nilai !== 'string') return null

  const teks = nilai.trim().toLowerCase()

  for (const skema of SKEMA_EXTENSION) {
    if (teks.startsWith(skema)) return skema
  }

  return null
}

/**
 * Skema extension yang muncul pada sumber node mana pun di dalam `akar`.
 *
 * @param {ParentNode} akar
 * @returns {string[]}
 */
export function cariSumberExtension(akar) {
  /** @type {Set<string>} */
  const ketemu = new Set()

  /** @type {Element[]} */
  let semua = []

  try {
    semua = [...akar.querySelectorAll('*')].filter((node) => node instanceof Element)
  } catch {
    return []
  }

  for (const node of semua) {
    for (const atribut of ATRIBUT_SUMBER) {
      const skema = skemaExtension(node.getAttribute(atribut))

      if (skema !== null) {
        ketemu.add(skema)
        break
      }
    }
  }

  return [...ketemu]
}

/**
 * Sidik jari fungsi proteksi yang menjadi acuan deteksi.
 *
 * Yang dipakai adalah **sumber fungsi** (`Function.prototype.toString.call`),
 * bukan referensinya: mengganti `window.addEventListener` dengan pembungkus
 * mengubah sumbernya, dan itulah yang dicurigai. Baselinnya diambil saat mulai,
 * bukan dibandingkan dengan anggapan "[native code]" — di jsdom maupun di
 * peramban yang sah, fungsi bawaan bisa saja bukan native, jadi membandingkan
 * dengan teks tetap adalah cara yang bebas salah tuduh.
 *
 * @param {Window & typeof globalThis} jendela
 * @returns {Record<string, string>}
 */
export function sidikFungsiProteksi(jendela) {
  const sumber = Function.prototype.toString

  /** @type {Array<[string, unknown]>} */
  const diperiksa = [
    ['window.addEventListener', jendela.addEventListener],
    ['window.removeEventListener', jendela.removeEventListener],
    ['EventTarget.prototype.addEventListener', jendela.EventTarget?.prototype?.addEventListener],
    ['Event.prototype.preventDefault', jendela.Event?.prototype?.preventDefault],
    ['Event.prototype.stopPropagation', jendela.Event?.prototype?.stopPropagation],
  ]

  /** @type {Record<string, string>} */
  const hasil = {}

  for (const [nama, fungsi] of diperiksa) {
    if (typeof fungsi !== 'function') continue

    try {
      hasil[nama] = sumber.call(fungsi)
    } catch {
      // fungsi yang tidak bisa dibaca sumbernya dilewati (fail-open)
    }
  }

  return hasil
}

/**
 * Overlay asing yang menutupi area ulangan.
 *
 * @param {Document} dokumen
 * @param {Window & typeof globalThis} jendela
 * @returns {Element[]}
 */
export function cariOverlayMenutupi(dokumen, jendela) {
  /** @type {Element[]} */
  const hasil = []

  /** @type {Element[]} */
  let semua = []

  try {
    semua = [...dokumen.querySelectorAll('body *')].filter((node) => node instanceof Element)
  } catch {
    return []
  }

  for (const node of semua) {
    let gaya
    let kotak

    try {
      gaya = jendela.getComputedStyle(node)
      kotak = node.getBoundingClientRect()
    } catch {
      continue
    }

    const posisi = gaya.position

    if (posisi !== 'fixed' && posisi !== 'absolute' && posisi !== 'sticky') continue

    const z = Number.parseInt(gaya.zIndex, 10)

    if (!Number.isFinite(z) || z < Z_INDEX_MENUTUPI) continue
    if (kotak.width < SISI_OVERLAY_MIN_PX || kotak.height < SISI_OVERLAY_MIN_PX) continue

    hasil.push(node)
  }

  return hasil
}

/**
 * Buat pemindai tamper untuk satu halaman ulangan.
 *
 * @param {object} opsi
 * @param {(kategori: string, rincian?: Record<string, unknown>) => void} opsi.catat
 * @param {(detik: number) => void} opsi.kaburkan
 * @param {Document} [opsi.dokumen]
 * @param {Window & typeof globalThis} [opsi.jendela]
 * @param {typeof MutationObserver} [opsi.Pengamat]
 * @param {number} [opsi.jedaAwalMs]
 * @param {number} [opsi.jedaPindaiMs]
 * @param {number} [opsi.jedaMutasiMs]
 * @param {number} [opsi.blurDetik]
 *
 * @returns {{
 *   mulai: () => void,
 *   hentikan: () => void,
 *   periksa: () => boolean,
 * }}
 */
export function buatPemindaiTamper(opsi) {
  const {
    catat,
    kaburkan,
    dokumen = document,
    jendela = window,
    Pengamat = jendela.MutationObserver,
    jedaAwalMs = JEDA_AWAL_MS,
    jedaPindaiMs = JEDA_PINDAI_MS,
    jedaMutasiMs = JEDA_MUTASI_MS,
    blurDetik = BLUR_TAMPER_DETIK,
  } = opsi

  /** @type {Record<string, string>} */
  let sidikAwal = {}
  /** @type {HTMLElement|null} */
  let kanari = null
  /** @type {MutationObserver|null} */
  let pengamat = null
  /** @type {number} */
  let timerAwal = 0
  /** @type {number} */
  let timerPindai = 0
  /** @type {number} */
  let timerMutasi = 0
  let berjalan = false

  /** Apakah kanari masih ada dan masih tersembunyi seperti seharusnya. */
  function kanariHilang() {
    if (kanari === null) return false

    try {
      if (!kanari.isConnected) return true

      const gaya = jendela.getComputedStyle(kanari)

      return gaya.display === 'none' && kanari.style.display !== 'none'
    } catch {
      return false
    }
  }

  /** Fungsi proteksi yang sumbernya berbeda dari sidik saat mulai. */
  function fungsiDiganti() {
    const sekarang = sidikFungsiProteksi(jendela)
    /** @type {string[]} */
    const berubah = []

    for (const [nama, awal] of Object.entries(sidikAwal)) {
      if (sekarang[nama] !== undefined && sekarang[nama] !== awal) berubah.push(nama)
    }

    return berubah
  }

  /**
   * Jalankan satu putaran pemeriksaan. Mengembalikan true bila ada temuan.
   *
   * @returns {boolean}
   */
  function periksa() {
    let ketemu = false

    // 1. Sumber dari skema extension.
    const skema = cariSumberExtension(dokumen)

    if (skema.length > 0) {
      catat('extension_detected', { skema: skema.join(',') })
      ketemu = true
    }

    // 2. Fungsi proteksi bawaan yang diganti.
    const diganti = fungsiDiganti()

    if (diganti.length > 0) {
      catat('dom_injection', { fungsi: diganti.join(',') })
      ketemu = true
    }

    // 3. Overlay asing: dihapus (dinetralkan) sekaligus dicatat.
    const overlay = cariOverlayMenutupi(dokumen, jendela)

    if (overlay.length > 0) {
      for (const node of overlay) {
        try {
          node.remove()
        } catch {
          // node yang tidak bisa dihapus tidak menggagalkan pemeriksaan lain
        }
      }

      catat('dom_injection', { sumber: 'overlay', jumlah: String(overlay.length) })
      ketemu = true
    }

    // 4. Kanari yang hilang atau disembunyikan.
    if (kanariHilang()) {
      catat('dom_injection', { sumber: 'kanari' })
      ketemu = true
    }

    if (ketemu) {
      try {
        kaburkan(blurDetik)
      } catch {
        // fail-open
      }
    }

    return ketemu
  }

  /** Sisipkan elemen kanari tak terlihat (tanpa memengaruhi tata letak). */
  function pasangKanari() {
    try {
      const node = dokumen.createElement('div')

      node.setAttribute(PENANDA_KANARI, '1')
      node.setAttribute('aria-hidden', 'true')
      node.style.position = 'absolute'
      node.style.width = '1px'
      node.style.height = '1px'
      node.style.opacity = '0'
      node.style.pointerEvents = 'none'

      dokumen.documentElement.appendChild(node)
      kanari = node
    } catch {
      kanari = null
    }
  }

  /** Jadwalkan pemeriksaan gabungan sesudah perubahan DOM (debounce). */
  function jadwalkanPeriksa() {
    if (timerMutasi !== 0) jendela.clearTimeout(timerMutasi)

    timerMutasi = jendela.setTimeout(() => {
      timerMutasi = 0
      periksa()
    }, jedaMutasiMs)
  }

  return {
    mulai() {
      if (berjalan) return

      berjalan = true
      sidikAwal = sidikFungsiProteksi(jendela)
      pasangKanari()

      // Pemindaian pertama sesudah halaman tenang (skrip pihak lain biasanya
      // menyisipkan diri setelah muat), lalu berkala.
      timerAwal = jendela.setTimeout(() => {
        timerAwal = 0
        periksa()
      }, jedaAwalMs)

      timerPindai = jendela.setInterval(periksa, jedaPindaiMs)

      if (typeof Pengamat === 'function') {
        try {
          const pengamatBaru = new Pengamat(jadwalkanPeriksa)

          pengamatBaru.observe(dokumen.documentElement, { childList: true, subtree: true, attributes: true })
          pengamat = pengamatBaru
        } catch {
          pengamat = null
        }
      }
    },

    hentikan() {
      berjalan = false

      if (timerAwal !== 0) jendela.clearTimeout(timerAwal)
      if (timerPindai !== 0) jendela.clearInterval(timerPindai)
      if (timerMutasi !== 0) jendela.clearTimeout(timerMutasi)

      timerAwal = 0
      timerPindai = 0
      timerMutasi = 0

      try {
        pengamat?.disconnect()
      } catch {
        // abaikan
      }

      pengamat = null

      try {
        kanari?.remove()
      } catch {
        // abaikan
      }

      kanari = null
    },

    periksa,
  }
}
