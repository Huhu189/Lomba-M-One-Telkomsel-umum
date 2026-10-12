/**
 * Pagar mutu latar tema gunung (`frontend/public/tema/gunung.svg`).
 *
 * Latar itu pernah diganti bukan karena warnanya, melainkan karena **bentuknya**:
 * berkas unduhan lama tersusun dari baji bersisi tegak (dua titik dengan x sama
 * pada satu bentuk, bahkan ada path tanpa luas), sehingga di panggung peta
 * terbaca seperti tebing. Permintaan pemilik produk sesudahnya: *"seperti gunung
 * bukan curan tapi tumpul dan lebih detail"*, lalu *"gunungnya hanya 1 saja …
 * dan pasti-kan tidak ada endpoint yang lepas"*, dan pada A.48: *"3 puncak
 * namun yang di sebelah-sebelahnya itu menjadi jalur pendakian"*.
 *
 * Semua sifat itu **diukur**, bukan dikira:
 *
 * - **satu puncak utama + sampai dua puncak jalur** — dari garis cakrawala
 *   (titik teratas tiap kolom gabungan bentuk besar) dihitung berapa puncak yang
 *   menonjol: **tepat satu** yang menonjol ≥ 25% tinggi bingkai (punggung
 *   utama, tempat pos terakhir jalur berdiri), dan **paling banyak dua** puncak
 *   lain yang menonjol ≥ 8%. Yang terakhir itu puncak **jalur pendakian** (sumbu
 *   x ≈ 14% dan 90%, di jalur zigzag pos) dan wajib memenuhi dua syarat supaya
 *   tidak terbaca sebagai gunung saingan: lebih rendah **≥ 10% tinggi bingkai**
 *   dari puncak utama, dan berada **di tepi** (|x − 50%| ≥ 10%).
 *   Lapis bukit yang landai tidak ikut terhitung karena menonjolnya < 8% tinggi.
 * - **puncak tumpul** — lebar punggung sedikit di bawah titik tertinggi; puncak
 *   membulat punya punggung lebar, ujung pisau mendekati nol (berkas lama: 0%).
 * - **bukan tebing** — kemiringan sisi, putaran antarruas, dan **panjang sisi
 *   nyaris tegak yang bersambung** (ujung membulat hanya tegak sekejap, tebing
 *   tegak ratusan piksel).
 * - **tidak ada endpoint lepas** — tidak boleh ada goresan panjang tanpa isi
 *   yang berhenti di tengah gambar. Goresan kecil (burung) tetap boleh.
 * - **tidak gelap** — luminance tiap warna.
 *
 * Yang diukur sebagai garis cakrawala & bentuk besar hanya `<path>`; `<circle>`
 * dan `<ellipse>` (matahari, awan, mahkota pohon, salju) memang bulat, dan
 * `<rect>` (langit, batang pohon) memang bersisi lurus — keduanya bukan siluet
 * gunung, jadi tidak ikut diukur kecuramannya.
 *
 * Ambang di bawah sengaja lebih longgar daripada nilai berkas sekarang supaya
 * tes menjaga **sifat**, bukan mengekang seni — tetapi cukup ketat untuk menolak
 * berkas lama (sudah diuji balik: 6 dari 8 pemeriksaan merah).
 */
import { describe, expect, it } from 'vitest'
import mentah from '../../../public/tema/gunung.svg?raw'

/**
 * Titik per kurva saat menelusuri. Kurva terpanjang di berkas ini ~1024 px,
 * jadi 64 titik memberi ruas ~16 px — cukup halus untuk mengukur kemiringan,
 * putaran, dan garis cakrawala (16 titik membuat ruas 64 px dan cakrawalanya
 * berlubang sehingga hasilnya bergerigi).
 */
const LANGKAH_KURVA = 64
/** Di atas ini bentuk besar terbaca tebing. Berkas lama: 90°. */
const MAKS_KEMIRINGAN = 45
/** Di atas ini bentuk besar terbaca berkunci tajam. Berkas lama: 121,6°. */
const MAKS_PUTARAN = 20
/** Sisi nyaris tegak yang bersambung tidak boleh lebih panjang dari ini. */
const MAKS_RUN_TEGAK = 4
/** Goresan tanpa isi (garis terbuka) harus sekecil ini — kalau tidak, ujungnya lepas. */
const MAKS_GORESAN = 8
/** Lebar/tinggi minimum bidang ber-fill (persen kanvas) supaya bukan garis tipis. */
const MIN_BIDANG = 1
/** Punggung puncak minimum (persen lebar kanvas). Berkas lama: 0%. */
const MIN_PUNGGUNG = 6
/** Sebuah puncak dihitung kalau turun sekurang-kurangnya ini di kedua sisinya. */
const MENONJOL_PUNCAK = 8
/** Puncak utama wajib menonjol sekurang-kurangnya ini (persen tinggi bingkai). */
const MENONJOL_UTAMA = 25
/** Puncak jalur pendakian wajib lebih rendah dari puncak utama sekurang-kurangnya ini. */
const BEDA_TINGGI_JALUR = 10
/** Puncak jalur wajib berada di tepi (|x − 50%| minimal ini), bukan di tengah. */
const TEPI_JALUR = 10
/**
 * Jendela & langkah garis cakrawala (px). Ruas antar-titik sampel paling
 * panjang ~16 px, jadi jendela 16 px menjamin tiap kolom dapat titik dari tiap
 * bentuk — tanpa itu kolom kosong jatuh ke bentuk yang lebih rendah/tinggi dan
 * cakrawalanya bergerigi palsu.
 */
const KOLOM = 16
/** Bentuk ini (persen lebar kanvas) ikut membentuk garis cakrawala. */
const LEBAR_BESAR = 50

const TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)/g
const TAG_PATH = /<path\b([^>]*)>/g
const ATUR = /(\w[\w-]*)="([^"]*)"/g

/**
 * Telusuri atribut `d` menjadi titik-titik nyata (kurva disampel, bukan titik
 * kendali — titik kendali bukan bentuk).
 *
 * @param {string} d
 * @returns {{ x: number, y: number }[]}
 */
function telusuri(d) {
  const token = d.match(TOKEN) ?? []
  /** @type {{ x: number, y: number }[]} */
  const titik = []
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let cmd = ''
  let i = 0

  while (i < token.length) {
    if (/[A-Za-z]/.test(token[i])) {
      cmd = token[i]
      i += 1
      if (cmd === 'Z' || cmd === 'z') {
        x = sx
        y = sy
        titik.push({ x, y })
      }
      continue
    }

    const relatif = cmd === cmd.toLowerCase()
    const huruf = cmd.toUpperCase()

    if (huruf === 'M' || huruf === 'L') {
      const px = Number(token[i])
      const py = Number(token[i + 1])
      i += 2
      x = relatif ? x + px : px
      y = relatif ? y + py : py
      titik.push({ x, y })
      if (huruf === 'M') {
        sx = x
        sy = y
        cmd = relatif ? 'l' : 'L'
      }
      continue
    }

    if (huruf === 'C') {
      const angka = token.slice(i, i + 6).map(Number)
      i += 6
      const p = relatif
        ? [x + angka[0], y + angka[1], x + angka[2], y + angka[3], x + angka[4], y + angka[5]]
        : angka
      const x0 = x
      const y0 = y
      for (let langkah = 1; langkah <= LANGKAH_KURVA; langkah += 1) {
        const u = langkah / LANGKAH_KURVA
        const v = 1 - u
        titik.push({
          x: v ** 3 * x0 + 3 * v ** 2 * u * p[0] + 3 * v * u ** 2 * p[2] + u ** 3 * p[4],
          y: v ** 3 * y0 + 3 * v ** 2 * u * p[1] + 3 * v * u ** 2 * p[3] + u ** 3 * p[5],
        })
      }
      x = p[4]
      y = p[5]
      continue
    }

    throw new Error(`perintah path belum didukung pagar mutu ini: ${huruf}`)
  }

  return titik
}

/** Semua atribut sebuah tag `<path ...>`. @param {string} isi */
function aturDari(isi) {
  /** @type {Record<string, string>} */
  const hasil = {}
  for (const cocok of isi.matchAll(ATUR)) hasil[cocok[1]] = cocok[2]
  return hasil
}

/** @param {string} warna @returns {number} luminance WCAG 0–255 */
function luminance(warna) {
  const isi = warna.replace('#', '')
  const penuh = isi.length === 3 ? [...isi].map((c) => c + c).join('') : isi
  const r = parseInt(penuh.slice(0, 2), 16)
  const g = parseInt(penuh.slice(2, 4), 16)
  const b = parseInt(penuh.slice(4, 6), 16)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const kanvas = (() => {
  const vb = /viewBox="([^"]+)"/.exec(mentah)?.[1] ?? ''
  const angka = (vb.match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []).map(Number)
  return { lebar: angka[2] - angka[0], tinggi: angka[3] - angka[1] }
})()

const berkasPath = [...mentah.matchAll(TAG_PATH)].map((cocok) => {
  const atur = aturDari(cocok[1])
  const titik = telusuri(atur.d ?? '')
  const xs = titik.map((t) => t.x)
  const ys = titik.map((t) => t.y)
  return {
    fill: atur.fill ?? null,
    titik,
    kiri: Math.min(...xs),
    kanan: Math.max(...xs),
    atas: Math.min(...ys),
    bawah: Math.max(...ys),
  }
})

/** Bidang: path yang memang diisi warna (siluet & bidang gambar). */
const bidang = berkasPath.filter((b) => b.fill !== null && b.fill !== 'none')
/** Goresan: path tanpa isi — dipakai hanya untuk bentuk kecil (burung). */
const goresan = berkasPath.filter((b) => b.fill === 'none')
/** Bentuk besar: cukup lebar untuk ikut menentukan garis cakrawala. */
const bentukBesar = bidang.filter((b) => b.kanan - b.kiri >= (LEBAR_BESAR / 100) * kanvas.lebar)

/**
 * Kemiringan tiap ruas (derajat dari mendatar), 0 = datar, 90 = tegak.
 *
 * @param {{ x: number, y: number }[]} titik
 * @returns {number[]}
 */
function kemiringan(titik) {
  /** @type {number[]} */
  const daftar = []
  for (let k = 0; k < titik.length - 1; k += 1) {
    const dx = titik[k + 1].x - titik[k].x
    const dy = titik[k + 1].y - titik[k].y
    // Ruas yang menempel di tepi bingkai dilewati: di situ bentuk memang
    // dipotong kanvas, bukan dibentuk miring oleh gambar.
    const tengah = (titik[k].x + titik[k + 1].x) / 2
    if (tengah < 0.02 * kanvas.lebar || tengah > 0.98 * kanvas.lebar) continue
    if (dx === 0 && dy === 0) continue
    daftar.push(Math.abs((Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI))
  }
  return daftar
}

/**
 * Putaran antarruas (derajat); 0 = lurus sempurna, besar = kunci tajam.
 *
 * @param {{ x: number, y: number }[]} titik
 * @returns {number[]}
 */
function putaran(titik) {
  /** @type {number[]} */
  const daftar = []
  for (let k = 1; k < titik.length - 1; k += 1) {
    const { x, y } = titik[k]
    if (x < 0 || x > kanvas.lebar || y < 0 || y > kanvas.tinggi) continue
    const sudut1 = Math.atan2(titik[k].y - titik[k - 1].y, titik[k].x - titik[k - 1].x)
    const sudut2 = Math.atan2(titik[k + 1].y - titik[k].y, titik[k + 1].x - titik[k].x)
    let selisih = Math.abs(((sudut2 - sudut1) * 180) / Math.PI)
    if (selisih > 180) selisih = 360 - selisih
    daftar.push(selisih)
  }
  return daftar
}

/**
 * Panjang terpanjang sisi nyaris tegak yang **bersambung** (px). Ujung yang
 * membulat hanya tegak sekejap; tebing tegak sampai ratusan piksel.
 *
 * @param {{ x: number, y: number }[]} titik
 * @returns {number}
 */
function runTegak(titik) {
  let terpanjang = 0
  let kini = 0
  for (let k = 0; k < titik.length - 1; k += 1) {
    // Sisi pembuangan di tepi bingkai (x di luar kanvas) dilewati: bentuk besar
    // sengaja dilebihkan melewati tepi supaya tidak ada celah saat dipotong, dan
    // potongan itu tegak — itu bukan tebing yang terlihat.
    const tengah = (titik[k].x + titik[k + 1].x) / 2
    if (tengah < 0 || tengah > kanvas.lebar) continue
    const dx = titik[k + 1].x - titik[k].x
    const dy = titik[k + 1].y - titik[k].y
    const panjang = Math.hypot(dx, dy)
    const miring = dx === 0 ? 90 : Math.abs((Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI)
    if (miring > 55) {
      kini += panjang
    } else {
      terpanjang = Math.max(terpanjang, kini)
      kini = 0
    }
  }
  return Math.max(terpanjang, kini)
}

/**
 * Garis cakrawala: titik teratas tiap kolom gabungan semua bentuk besar. Inilah
 * yang dilihat mata sebagai siluet gunung/bukit.
 *
 * @returns {{ x: number, y: number }[]}
 */
function cakrawala() {
  /** @type {{ x: number, y: number }[]} */
  const langit = []
  // Jendela, bukan kolom keras: titik sampel tiap bentuk jaraknya ~12 px, jadi
  // kolom 16 px bisa kosong dan cakrawalanya jadi bergerigi palsu (naik-turun
  // 100 px) yang terbaca sebagai puncak palsu.
  for (let x = 0; x <= kanvas.lebar; x += KOLOM / 4) {
    let teratas = Infinity
    for (const b of bentukBesar) {
      for (const t of b.titik) {
        if (Math.abs(t.x - x) <= KOLOM && t.y < teratas) teratas = t.y
      }
    }
    if (teratas < Infinity) langit.push({ x, y: teratas })
  }
  return langit
}

/**
 * Titik terendah yang harus dilewati dari sebuah puncak ke satu arah ("kol"):
 * berjalan sampai bertemu titik yang lebih tinggi daripada puncaknya.
 *
 * @param {{ x: number, y: number }[]} langit
 * @param {number} mulai
 * @param {number} arah
 * @returns {number}
 */
function kol(langit, mulai, arah) {
  let terendah = -Infinity
  for (let i = mulai + arah; i >= 0 && i < langit.length; i += arah) {
    if (langit[i].y < langit[mulai].y) return terendah
    if (langit[i].y > terendah) terendah = langit[i].y
  }
  return terendah
}

/**
 * Puncak yang menonjol di garis cakrawala, beserta tinggi menonjolnya (px).
 * Satu puncak dihitung sekali walau punggungnya datar: yang diambil titik
 * pertama (paling kiri) pada punggung itu.
 *
 * @returns {{ x: number, y: number, menonjol: number }[]}
 */
function puncakCakrawala() {
  const langit = cakrawala()
  const ambang = (MENONJOL_PUNCAK / 100) * kanvas.tinggi
  /** @type {{ x: number, y: number, menonjol: number }[]} */
  const hasil = []

  for (let i = 1; i < langit.length - 1; i += 1) {
    if (!(langit[i].y <= langit[i - 1].y && langit[i].y < langit[i + 1].y)) continue
    const menonjol = Math.min(kol(langit, i, -1), kol(langit, i, 1)) - langit[i].y
    if (menonjol >= ambang) hasil.push({ x: langit[i].x, y: langit[i].y, menonjol })
  }

  return hasil
}

describe('latar tema gunung: satu gunung, tumpul, bukan tebing', () => {
  it('memakai kanvas 16:9 dan tidak melebihi aturan ukuran di LISENSI.md', () => {
    expect(kanvas.lebar / kanvas.tinggi).toBeCloseTo(16 / 9, 2)
    const ukuran = /<svg\b[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/.exec(mentah)
    expect(ukuran).not.toBeNull()
    expect(Number(ukuran?.[1] ?? 0)).toBe(kanvas.lebar)
    expect(Number(ukuran?.[2] ?? 0)).toBe(kanvas.tinggi)
    expect(Math.max(kanvas.lebar, kanvas.tinggi)).toBeLessThanOrEqual(1600)
  })

  it('murni vektor: tanpa gambar raster, teks, atau filter', () => {
    // Komentar kepala berkas menyebut nama tag itu untuk menjelaskan berkasnya,
    // jadi diperiksa setelah komentar dibuang — yang dicari tag sungguhan.
    const isi = mentah.replace(/<!--[\s\S]*?-->/g, '')
    expect(isi).not.toMatch(/<image\b/)
    expect(isi).not.toMatch(/<text\b/)
    expect(isi).not.toMatch(/<filter\b/)
  })

  it('hanya memakai perintah path M, L, C, Z', () => {
    const atributD = [...mentah.matchAll(/<path\b[^>]*\bd="([^"]*)"/g)].map((cocok) => cocok[1]).join('')
    const perintah = new Set(atributD.match(/[A-Za-z]/g))
    expect([...perintah].sort()).toEqual(['C', 'L', 'M', 'Z'])
  })

  it('tidak ada bidang tanpa luas (garis tegak tanpa isi, seperti berkas lama)', () => {
    const cacat = bidang
      .filter(
        (b) =>
          b.kanan - b.kiri < (MIN_BIDANG / 100) * kanvas.lebar ||
          b.bawah - b.atas < (MIN_BIDANG / 100) * kanvas.tinggi,
      )
      .map((b) => `${b.kiri},${b.atas} → ${b.kanan},${b.bawah}`)
    expect(cacat).toEqual([])
  })

  it('tidak ada sisi nyaris tegak yang panjang (bekas tebing)', () => {
    const tebing = bidang.map((b) => runTegak(b.titik)).filter((px) => px > (MAKS_RUN_TEGAK / 100) * kanvas.tinggi)
    expect(tebing).toEqual([])
  })

  it('bentuk besar melengkung halus dan tidak curam', () => {
    expect(bentukBesar.length).toBeGreaterThanOrEqual(3)
    const curam = bentukBesar
      .map((b) => Math.max(...kemiringan(b.titik)))
      .filter((derajat) => derajat > MAKS_KEMIRINGAN)
    const terpatah = bentukBesar.map((b) => Math.max(...putaran(b.titik))).filter((derajat) => derajat > MAKS_PUTARAN)
    expect({ curam, terpatah }).toEqual({ curam: [], terpatah: [] })
  })

  it('satu puncak utama di tengah; puncak lain hanya boleh di tepi jalur dan lebih rendah', () => {
    const puncak = puncakCakrawala()
    const utama = puncak.filter((p) => p.menonjol >= (MENONJOL_UTAMA / 100) * kanvas.tinggi)

    // Tepat satu puncak yang benar-benar tinggi: puncak kedua yang setara akan
    // terbaca sebagai dua gunung berhadapan (berkas unduhan lama: 11 puncak).
    expect(utama).toHaveLength(1)

    const tertinggi = utama[0]
    // Puncak utama berdiri di bagian atas bingkai (langit tetap bagian terbesar).
    expect(tertinggi.y).toBeLessThan(0.45 * kanvas.tinggi)

    // Puncak jalur pendakian: paling banyak dua, wajib lebih rendah dan di tepi —
    // di situlah jalur zigzag pos memanjat (sumbu x 12–20% dan 80–90%).
    const jalur = puncak.filter((p) => p !== tertinggi)
    expect(jalur.length).toBeLessThanOrEqual(2)

    for (const satu of jalur) {
      expect(satu.y - tertinggi.y).toBeGreaterThanOrEqual((BEDA_TINGGI_JALUR / 100) * kanvas.tinggi)
      expect(Math.abs(satu.x / kanvas.lebar - 0.5)).toBeGreaterThanOrEqual(TEPI_JALUR / 100)
    }

    // Tumpul: di 2,2% tinggi di bawah titik tertinggi, punggungnya masih lebar.
    const ambang = tertinggi.y + 0.022 * kanvas.tinggi
    const punggung = cakrawala().filter((t) => t.y <= ambang).map((t) => t.x)
    const lebar = Math.max(...punggung) - Math.min(...punggung)
    expect((lebar / kanvas.lebar) * 100).toBeGreaterThanOrEqual(MIN_PUNGGUNG)
  })

  it('tidak ada goresan panjang yang menggantung (endpoint lepas)', () => {
    const lepas = goresan
      .filter(
        (b) =>
          b.kanan - b.kiri > (MAKS_GORESAN / 100) * kanvas.lebar ||
          b.bawah - b.atas > (MAKS_GORESAN / 100) * kanvas.tinggi,
      )
      .map((b) => `${b.kiri},${b.atas} → ${b.kanan},${b.bawah}`)
    expect(lepas).toEqual([])
  })

  it('semua warnanya cukup terang untuk panggung peta', () => {
    const warna = [...mentah.matchAll(/(?:fill|stroke|stop-color)="(#[0-9a-fA-F]{3,6})"/g)].map((cocok) =>
      luminance(cocok[1]),
    )
    expect(warna.length).toBeGreaterThanOrEqual(12)
    expect(Math.min(...warna)).toBeGreaterThanOrEqual(90)
    expect(warna.reduce((a, b) => a + b, 0) / warna.length).toBeGreaterThanOrEqual(170)
  })
})
