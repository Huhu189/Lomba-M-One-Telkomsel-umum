/**
 * Pagar mutu **semua latar tema perjalanan** (`frontend/public/tema/*.svg`) —
 * gunung, pulau, angkasa.
 *
 * Dua hal yang dijaga di sini:
 *
 * 1. **Bentuk berkas** (aturan sama untuk ketiganya): gambar rata, murni vektor
 *    (tanpa `<image>` raster, `<text>`, atau `<filter>`), rasio 16:9, ukuran
 *    dijaga, tidak ada bidang tanpa luas, dan tidak ada sisi path yang nyaris
 *    tegak panjang (bekas "tebing").
 * 2. **Pos mendarat di gambarnya** — inilah keluhan pemilik produk yang
 *    melahirkan berkas ini: *"saat disisipkan kuis hasilnya masih di udara"*.
 *    Rute pos (`RUTE_TEMA` di `sections/material/perjalanan/perjalanan.js`) diuji **langsung
 *    terhadap gambarnya**, jadi kalau rutenya digeser atau gambarnya diubah
 *    tanpa keduanya diselaraskan, tesnya merah:
 *
 *    - tema `gunung`: tiap pos harus berada **di bawah** garis punggungan
 *      gambarnya (pos di langit = gagal);
 *    - tema `pulau` & `angkasa`: tiap pos harus berada **di dalam benda** yang
 *      disebut rutenya (`dermaga`, `perahu`, `bumi`, `bulan`, …) — benda itu
 *      ditandai `id` di berkas SVG-nya.
 *
 * Yang **tidak** diuji di sini: warna jalur peta untuk latar gelap
 * (`.jelajah[data-adegan='angkasa']` di `theme.css`). Vitest men-stub berkas CSS
 * menjadi modul kosong, jadi pagar itu ada di harness peramban
 * (`docs/smoke-ui-perjalanan.mjs`), yang mengukur hasil render sungguhan.
 */
import { describe, expect, it } from 'vitest'
import { RUTE_TEMA } from '../../sections/material/perjalanan/perjalanan.js'
import mentahGunung from '../../../public/tema/gunung.svg?raw'
import mentahPulau from '../../../public/tema/pulau.svg?raw'
import mentahAngkasa from '../../../public/tema/angkasa.svg?raw'

const GERBANG = /<(path|circle|ellipse|rect|polygon)\b([^>]*?)\/?>/g
const GERBANG_GRUP = /<g id="([^"]+)">([\s\S]*?)<\/g>/g

/**
 * Nilai sebuah atribut. Pemisah spasi wajib: tanpa itu `d="…"` juga cocok
 * dengan `id="pantai"` (pernah kejadian saat mengukur berkas ini).
 *
 * @param {string} isi
 * @param {string} nama
 * @returns {string|null}
 */
function atur(isi, nama) {
  const cocok = new RegExp(`(?:^|\\s)${nama}="([^"]*)"`).exec(isi)
  return cocok ? cocok[1] : null
}

/**
 * @param {string} isi
 * @param {string} nama
 * @returns {number}
 */
function angka(isi, nama) {
  return Number(atur(isi, nama) ?? NaN)
}

/**
 * Titik sebuah `d` (hanya M/L/C/Z — berkas latar sengaja menghindari perintah
 * lain). Kurva ditelusuri **sungguhan** (bukan hanya titik kontrolnya): dengan
 * titik kontrol saja, cakrawala bisa meleset puluhan piksel dan pos yang
 * sebenarnya di langit ikut lolos.
 *
 * @param {string} d
 * @returns {Array<{ x: number, y: number }>}
 */
function titikPath(d) {
  const token = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)/g) ?? []
  /** @type {Array<{ x: number, y: number }>} */
  const titik = []
  let i = 0
  let x = 0
  let y = 0

  while (i < token.length) {
    const perintah = token[i++]

    if (perintah === 'M' || perintah === 'L') {
      x = Number(token[i++])
      y = Number(token[i++])
      titik.push({ x, y })
      continue
    }

    if (perintah === 'C') {
      const x1 = Number(token[i++])
      const y1 = Number(token[i++])
      const x2 = Number(token[i++])
      const y2 = Number(token[i++])
      const x3 = Number(token[i++])
      const y3 = Number(token[i++])
      for (let k = 1; k <= 16; k++) {
        const t = k / 16
        const u = 1 - t
        titik.push({
          x: u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          y: u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        })
      }
      x = x3
      y = y3
      continue
    }

    if (perintah !== 'Z' && perintah !== 'z') {
      throw new Error(`perintah path belum didukung pagar mutu ini: ${perintah}`)
    }
  }

  return titik
}

/**
 * Satu bentuk gambar: jenis, kotak batas, dan titik-titiknya.
 *
 * @typedef {{ jenis: string, kotak: [number, number, number, number], titik: Array<{x: number, y: number}>, fill: string|null }} Bentuk
 * @param {string} isi
 * @returns {Bentuk}
 */
function bentukDari(isi) {
  const jenis = /^<(\w+)/.exec(isi)?.[1] ?? ''
  const kotakDari = (/** @type {Array<{x: number, y: number}>} */ titik) => {
    const xs = titik.map((t) => t.x)
    const ys = titik.map((t) => t.y)
    return /** @type {[number, number, number, number]} */ ([
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs),
      Math.max(...ys),
    ])
  }

  if (jenis === 'path') {
    const titik = titikPath(atur(isi, 'd') ?? '')
    return { jenis, titik, kotak: kotakDari(titik), fill: atur(isi, 'fill') }
  }

  if (jenis === 'circle') {
    const cx = angka(isi, 'cx')
    const cy = angka(isi, 'cy')
    const r = angka(isi, 'r')
    return { jenis, titik: [{ x: cx, y: cy }], kotak: [cx - r, cy - r, cx + r, cy + r], fill: atur(isi, 'fill') }
  }

  if (jenis === 'ellipse') {
    const cx = angka(isi, 'cx')
    const cy = angka(isi, 'cy')
    const rx = angka(isi, 'rx')
    const ry = angka(isi, 'ry')
    return { jenis, titik: [{ x: cx, y: cy }], kotak: [cx - rx, cy - ry, cx + rx, cy + ry], fill: atur(isi, 'fill') }
  }

  if (jenis === 'rect') {
    const x = angka(isi, 'x')
    const y = angka(isi, 'y')
    const lebar = angka(isi, 'width')
    const tinggi = angka(isi, 'height')
    return {
      jenis,
      titik: [{ x, y }, { x: x + lebar, y: y + tinggi }],
      kotak: [x, y, x + lebar, y + tinggi],
      fill: atur(isi, 'fill'),
    }
  }

  const titik = (atur(isi, 'points') ?? '')
    .trim()
    .split(/\s+/)
    .map((pasangan) => {
      const [px, py] = pasangan.split(',').map(Number)
      return { x: px, y: py }
    })

  return { jenis: 'polygon', titik, kotak: kotakDari(titik), fill: atur(isi, 'fill') }
}

/**
 * @param {string} mentah
 * @returns {{ lebar: number, tinggi: number, bentuk: Bentuk[], grup: Map<string, Bentuk[]> }}
 */
function baca(mentah) {
  const vb = (atur(mentah, 'viewBox') ?? '').split(/[\s,]+/).map(Number)
  const bentuk = [...mentah.matchAll(GERBANG)].map((cocok) => bentukDari(cocok[0]))
  /** @type {Map<string, Bentuk[]>} */
  const grup = new Map()

  for (const cocok of mentah.matchAll(GERBANG_GRUP)) {
    grup.set(cocok[1], [...cocok[2].matchAll(GERBANG)].map((anak) => bentukDari(anak[0])))
  }

  // Benda yang berupa SATU bentuk juga boleh jadi tempat pendaratan pos (mis.
  // `<path id="pantai">`, bukan hanya `<g id="...">`).
  for (const cocok of mentah.matchAll(GERBANG)) {
    const id = atur(cocok[2], 'id')
    if (id && !grup.has(id)) grup.set(id, [bentukDari(cocok[0])])
  }

  return { lebar: vb[2] - vb[0], tinggi: vb[3] - vb[1], bentuk, grup }
}

/**
 * Luas kotak batas satu bentuk — perkiraan besar bidangnya.
 * @param {Bentuk} bentuk
 * @returns {number}
 */
function luasKotak(bentuk) {
  return (bentuk.kotak[2] - bentuk.kotak[0]) * (bentuk.kotak[3] - bentuk.kotak[1])
}

/**
 * Kotak batas sekumpulan bentuk.
 * @param {Bentuk[]} daftar
 * @returns {[number, number, number, number]}
 */
function kotakGabungan(daftar) {
  return [
    Math.min(...daftar.map((b) => b.kotak[0])),
    Math.min(...daftar.map((b) => b.kotak[1])),
    Math.max(...daftar.map((b) => b.kotak[2])),
    Math.max(...daftar.map((b) => b.kotak[3])),
  ]
}

/**
 * Garis **atas** sekumpulan bentuk di sekitar satu x (px): titik paling atas di
 * antara titik-titik bentuk itu yang berjarak ≤ 40 px dari x. Dipakai untuk
 * membandingkan kaki sebuah benda dengan permukaan yang ada di bawahnya.
 *
 * @param {Bentuk[]} daftar
 * @param {number} x
 * @returns {number} `Infinity` bila tidak ada titik di sekitar x
 */
function atasPada(daftar, x) {
  const dekat = daftar.flatMap((bentuk) => bentuk.titik).filter((t) => Math.abs(t.x - x) <= 40)
  return dekat.length === 0 ? Infinity : Math.min(...dekat.map((t) => t.y))
}

/**
 * @param {string} warna
 * @returns {number}
 */
function keceriaan(warna) {
  const isi = warna.replace('#', '')
  const penuh = isi.length === 3 ? [...isi].map((c) => c + c).join('') : isi
  return (
    0.2126 * parseInt(penuh.slice(0, 2), 16) +
    0.7152 * parseInt(penuh.slice(2, 4), 16) +
    0.0722 * parseInt(penuh.slice(4, 6), 16)
  )
}

/**
 * Sisi nyaris tegak terpanjang (px) pada satu rangkaian titik.
 * @param {Array<{x: number, y: number}>} titik
 * @param {number} lebar lebar kanvas, untuk melewati sisi di tepi bingkai
 * @returns {number}
 */
function runTegak(titik, lebar) {
  let terpanjang = 0
  let kini = 0

  for (let k = 0; k < titik.length - 1; k += 1) {
    // Sisi pembuangan di tepi bingkai dilewati: bentuk besar sengaja dilebihkan
    // melewati tepi supaya tidak ada celah saat dipotong, dan potongan itu tegak
    // — itu bukan tebing yang terlihat. (Aturan yang sama dengan pagar gunung.)
    const tengah = (titik[k].x + titik[k + 1].x) / 2
    if (tengah < 0 || tengah > lebar) continue

    const dx = titik[k + 1].x - titik[k].x
    const dy = titik[k + 1].y - titik[k].y
    const miring = dx === 0 ? 90 : Math.abs((Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI)

    if (miring > 55) kini += Math.hypot(dx, dy)
    else {
      terpanjang = Math.max(terpanjang, kini)
      kini = 0
    }
  }

  return Math.max(terpanjang, kini)
}

/**
 * Rata-rata kecerahan tiap gradien di dalam berkas, supaya bidang yang diisi
 * `url(#…)` ikut terhitung warnanya (kalau tidak, langit malam dianggap kosong
 * dan "gelap"-nya tidak pernah terukur).
 *
 * @param {string} mentah
 * @returns {Map<string, number>}
 */
function gradien(mentah) {
  /** @type {Map<string, number>} */
  const peta = new Map()
  const pola = /<(?:linear|radial)Gradient id="([^"]+)"([\s\S]*?)<\/(?:linear|radial)Gradient>/g

  for (const cocok of mentah.matchAll(pola)) {
    const warna = [...cocok[2].matchAll(/stop-color="(#[0-9a-fA-F]{3,8})"/g)].map((s) => keceriaan(s[1]))
    if (warna.length > 0) peta.set(cocok[1], warna.reduce((a, b) => a + b, 0) / warna.length)
  }

  return peta
}

/**
 * Palet berkas: tiap bidang berisi warnanya dan luas kotaknya (perkiraan luas).
 *
 * @param {string} mentah
 * @returns {Array<{ warna: number, luas: number }>}
 */
function palet(mentah) {
  const { bentuk } = baca(mentah)
  const rata = gradien(mentah)

  return bentuk
    .map((b) => {
      const isi = b.fill
      const dariGradien = typeof isi === 'string' ? /^url\(#([^)]+)\)$/.exec(isi) : null
      const warna = dariGradien
        ? rata.get(dariGradien[1])
        : typeof isi === 'string' && /^#/.test(isi)
          ? keceriaan(isi)
          : undefined
      const luas = Math.max(0, (b.kotak[2] - b.kotak[0]) * (b.kotak[3] - b.kotak[1]))
      return { warna, luas }
    })
    .filter((satu) => typeof satu.warna === 'number' && satu.luas > 0)
    .map((satu) => ({ warna: /** @type {number} */ (satu.warna), luas: satu.luas }))
}

/** Berkas latar beserta aturan terang/gelapnya. */
const LATAR = [
  { nama: 'gunung', mentah: mentahGunung, terang: true, siluet: true },
  { nama: 'pulau', mentah: mentahPulau, terang: true, siluet: true },
  // Luar angkasa tidak punya siluet daratan sama sekali (memang begitu temanya):
  // aturan "tidak ada dinding tegak" hanya berlaku untuk bentuk besar, dan di
  // sini bentuk besarnya adalah latar + benda-benda, bukan punggungan.
  { nama: 'angkasa', mentah: mentahAngkasa, terang: false, siluet: false },
]

describe('bentuk berkas latar tema', () => {
  for (const { nama, mentah } of LATAR) {
    it(`${nama}: murni vektor, 16:9, ukuran dijaga`, () => {
      // Komentar kepala berkas sengaja MENYEBUT tag terlarang ("tanpa <image>"),
      // jadi komentar dibuang dulu sebelum diperiksa.
      const isi = mentah.replace(/<!--[\s\S]*?-->/g, '')
      expect(isi).not.toMatch(/<image\b|<text\b|<filter\b/)
      expect(mentah).toMatch(/viewBox="0 0 1600 900"/)
      expect(mentah).toMatch(/width="1600"/)
      expect(mentah).toMatch(/height="900"/)

      const { lebar, tinggi, bentuk } = baca(mentah)
      expect(lebar / tinggi).toBeCloseTo(16 / 9, 2)
      expect(bentuk.length).toBeGreaterThan(30)

      // Semua warna harus hex (atau gradien di dalam berkas) — berkas latar
      // tidak boleh memakai nama warna yang bergantung tema antarmuka.
      const warnaAneh = [
        ...mentah.matchAll(/(?:fill|stroke|stop-color)="([^"]+)"/g),
      ].filter((cocok) => {
        const nilai = cocok[1]
        return nilai !== 'none' && !/^#[0-9a-fA-F]{3,8}$/.test(nilai) && !/^url\(#/.test(nilai)
      })
      expect(warnaAneh.map((cocok) => cocok[1])).toEqual([])
    })

    it(`${nama}: tidak ada bidang tanpa luas & tidak ada dinding nyaris tegak yang panjang`, () => {
      const { lebar, tinggi, bentuk } = baca(mentah)
      const bidangPath = bentuk.filter((b) => b.jenis === 'path' && b.fill !== null && b.fill !== 'none')

      const tanpaLuas = bidangPath
        .filter((b) => (b.kotak[2] - b.kotak[0]) * (b.kotak[3] - b.kotak[1]) < 4)
        .map((b) => b.kotak.join(','))
      expect(tanpaLuas).toEqual([])

      // Dua tingkat, karena bendanya memang beda:
      //
      // - **bentuk besar** (siluet: punggungan, laut, bukit) tidak boleh punya
      //   sisi nyaris tegak lebih dari 4% tinggi bingkai (36 px) — di atas itu
      //   terbaca tebing, itulah aturan yang melahirkan pagar ini;
      // - **benda** (layar perahu, badan roket, tiang dermaga) boleh tegak
      //   secara wajar, tetapi tetap tidak boleh seperti dinding: batas 25%
      //   tinggi bingkai (225 px).
      const siluet = bidangPath.filter((b) => b.kotak[2] - b.kotak[0] >= lebar * 0.5)
      if (LATAR.find((l) => l.nama === nama)?.siluet) expect(siluet.length).toBeGreaterThan(0)
      expect(
        siluet.map((b) => Math.round(runTegak(b.titik, lebar))).filter((px) => px > 0.04 * tinggi),
      ).toEqual([])
      expect(
        bidangPath.map((b) => Math.round(runTegak(b.titik, lebar))).filter((px) => px > 0.25 * tinggi),
      ).toEqual([])
    })

    it(`${nama}: tidak ada penanda aset yang belum digambar`, () => {
      // `{{CC0:peti}}` dan `{{CC0:karang}}` pernah tertinggal di `pulau.svg`:
      // peramban tidak menggambar teks di dalam SVG, jadi kedua benda itu
      // tidak pernah tampak walau komentarnya mengaku sudah disisipkan. Pagar
      // ini menutup celah itu — bentuknya tetap lolos aturan lain.
      const isi = mentah.replace(/<!--[\s\S]*?-->/g, '')
      expect(isi.match(/\{\{[^}]*\}\}/g) ?? []).toEqual([])
    })

    it(`${nama}: warnanya sesuai sifat temanya (terang vs gelap)`, () => {
      const terang = LATAR.find((l) => l.nama === nama)?.terang
      const bidang = palet(mentah)
      const luas = bidang.reduce((jumlah, satu) => jumlah + satu.luas, 0)
      const rata = bidang.reduce((jumlah, satu) => jumlah + satu.warna * satu.luas, 0) / luas
      const luasGelap = bidang
        .filter((satu) => satu.warna < 90)
        .reduce((jumlah, satu) => jumlah + satu.luas, 0)

      expect(bidang.length).toBeGreaterThan(10)

      if (terang) {
        // Latar terang supaya jalur pekat & tenda berwarna di atasnya terbaca.
        // Diukur berbobot luas: satu mulut goa gelap tidak dihitung sebagai
        // "latar gelap", tetapi latar yang memang gelap tertangkap.
        expect(rata).toBeGreaterThanOrEqual(150)
        expect(luasGelap / luas).toBeLessThanOrEqual(0.25)
      } else {
        // Langit malam harus GELAP (jalur memakai versi terang di theme.css),
        // tetapi tetap punya benda terang (bintang & Bulan) sebagai penanda.
        expect(rata).toBeLessThan(130)
        expect(luasGelap / luas).toBeGreaterThan(0.3)
        expect(Math.max(...bidang.map((satu) => satu.warna))).toBeGreaterThanOrEqual(200)
      }
    })
  }
})

describe('pos mendarat di latar temanya', () => {
  it('gunung: tidak satu pun pos berdiri di atas punggungan (di langit)', () => {
    const { lebar, tinggi, bentuk } = baca(mentahGunung)
    const bidangPath = bentuk.filter((b) => b.jenis === 'path' && b.fill !== null && b.fill !== 'none')

    /**
     * Garis punggungan: titik teratas bidang path di sekitar x.
     * @param {number} x
     * @returns {number}
     */
    const cakrawala = (x) => {
      let atas = Infinity
      for (const b of bidangPath) {
        for (const t of b.titik) if (Math.abs(t.x - x) <= lebar * 0.012) atas = Math.min(atas, t.y)
      }
      return atas
    }

    const diLangit = RUTE_TEMA.gunung
      .map((titik) => {
        const x = (titik.x / 100) * lebar
        const y = (titik.y / 100) * tinggi
        return { titik, atas: Math.round(cakrawala(x) - y) }
      })
      .filter((hasil) => hasil.atas > 0)

    expect(diLangit.map((hasil) => `${hasil.titik.n} (${hasil.titik.x}%,${hasil.titik.y}%) naik ${hasil.atas}px`)).toEqual([])
  })

  for (const nama of ['pulau', 'angkasa']) {
    it(`${nama}: tiap pos berdiri di dalam benda yang digambar`, () => {
      const berkas = LATAR.find((l) => l.nama === nama)
      const { lebar, tinggi, grup } = baca(String(berkas?.mentah))
      /**
       * @type {Array<{ x: number, y: number, n: string, di?: string }>}
       */
      const rute = RUTE_TEMA[nama]
      const gagal = []

      for (const titik of rute) {
        const benda = grup.get(String(titik.di))
        if (!benda || benda.length === 0) {
          gagal.push(`${titik.n}: benda "${titik.di}" tidak ada di ${nama}.svg`)
          continue
        }

        const [kiri, atas, kanan, bawah] = kotakGabungan(benda)
        const px = (titik.x / 100) * lebar
        const py = (titik.y / 100) * tinggi
        const diLuar = px < kiri || px > kanan || py < atas || py > bawah

        if (diLuar) {
          gagal.push(
            `${titik.n}: (${titik.x}%,${titik.y}%) = ${Math.round(px)},${Math.round(py)} di luar "${titik.di}" ` +
              `(${Math.round(kiri)}–${Math.round(kanan)} × ${Math.round(atas)}–${Math.round(bawah)})`,
          )
        }
      }

      expect(gagal).toEqual([])
    })
  }

  it('pulau: kaki tanjung goa sampai ke pasir pantai (batu tidak melayang di atas air)', () => {
    // Keluhan pemilik produk 14 Okt 2026: *"yang harta karun jangan yang kubah
    // harta karunnya di udara"*. Pangkal tanjung `goa` dulu berhenti di y = 432
    // sementara laut mulai di y ≈ 440 — celah langit 8 px di bawah batunya. Tes
    // ini mengukur jarak kaki tanjung ke garis pasir **di x tempat pos "Goa
    // Harta Karun" berdiri**, jadi berkas yang melayang kembali akan merah.
    const { lebar, tinggi, grup } = baca(mentahPulau)
    const titik = RUTE_TEMA.pulau.find((satu) => satu.di === 'goa')
    const x = ((titik?.x ?? 0) / 100) * lebar
    const y = ((titik?.y ?? 0) / 100) * tinggi
    const goa = grup.get('goa') ?? []
    const pantai = grup.get('pantai') ?? []

    // Yang diukur **badan tanjungnya**, bukan seluruh isi grup: peti, batu-batu
    // kecil, dan butir emas di dalam grup itu bisa saja sudah menyentuh pasir
    // sementara batunya masih melayang. Badan tanjung = bentuk terluas di grup
    // yang memuat titik pos "Goa Harta Karun".
    const badan = [...goa]
      .filter((b) => b.kotak[0] <= x && x <= b.kotak[2] && b.kotak[1] <= y && y <= b.kotak[3])
      .sort((a, b) => luasKotak(b) - luasKotak(a))[0]

    const bawahBadan = badan === undefined ? NaN : badan.kotak[3]
    const atasPasir = atasPada(pantai, x)

    const melayang =
      badan !== undefined && bawahBadan >= atasPasir
        ? []
        : [
            badan === undefined
              ? 'badan tanjung tidak ketemu di grup goa'
              : `badan tanjung berhenti di y ${Math.round(bawahBadan)} padahal pasir pantai sudah mulai ` +
                `di y ${Math.round(atasPasir)} di x ${Math.round(x)} — celah ` +
                `${Math.round(atasPasir - bawahBadan)} px di bawah batu`,
          ]

    expect(melayang).toEqual([])
  })

  it('rute tiap tema naik (y makin kecil) dan tidak meleset keluar panggung', () => {
    for (const [nama, rute] of Object.entries(RUTE_TEMA)) {
      for (const titik of rute) {
        expect(titik.x).toBeGreaterThan(0)
        expect(titik.x).toBeLessThan(100)
        expect(titik.y).toBeGreaterThan(10)
        expect(titik.y).toBeLessThan(95)
      }

      const turun = rute.filter((titik, indeks) => indeks > 0 && titik.y >= rute[indeks - 1].y)
      expect({ tema: nama, turun: turun.map((titik) => titik.n) }).toEqual({ tema: nama, turun: [] })
    }
  })
})
