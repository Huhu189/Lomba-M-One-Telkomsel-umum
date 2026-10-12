// Smoke UI: ukuran tulisan Normal ↔ Besar (papan desain putaran 3).
//
// Bukti yang dicari bukan "tombolnya ada", tetapi tiga hal yang dijanjikan
// papan: (1) satu variabel --s benar-benar berubah, (2) huruf di layar ikut
// membesar (bukan cuma variabel CSS), dan (3) pilihan diingat sesudah muat
// ulang. Ditambah satu pagar tata letak: halaman tidak boleh melebar melewati
// lebar layar setelah dibesarkan.
//
// Jalankan: docs/jalankan-smoke-ui.sh ukuran
const CDP = 'http://127.0.0.1:9333'
const HALAMAN = 'http://localhost:5173/masuk'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function endpoint() {
  return fetch(`${CDP}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl)
}

/** @type {string[]} */
const gagal = []

/**
 * @param {string} nama
 * @param {boolean} benar
 * @param {string} detail
 */
function periksa(nama, benar, detail) {
  console.log(`${benar ? 'OK  ' : 'GAGAL'} ${nama} — ${detail}`)
  if (!benar) gagal.push(nama)
}

async function main() {
  const url = await endpoint()
  const ws = new WebSocket(url)
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })

  let id = 0
  /** @type {Map<number, { res: Function, rej: Function }>} */
  const pending = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(String(ev.data))
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result)
    }
  }
  const send = (method, params = {}, sessionId) => {
    const myId = ++id
    return new Promise((res, rej) => {
      pending.set(myId, { res, rej })
      ws.send(JSON.stringify({ id: myId, method, params, sessionId }))
    })
  }

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })

  /** @param {string} expression */
  const evalJs = async (expression) => {
    const r = await send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    )
    if (r.exceptionDetails) {
      throw new Error('eval error: ' + (r.exceptionDetails.exception?.description ?? ''))
    }
    return r.result.value
  }

  /**
   * Ukur keadaan halaman sekarang: variabel --s, ukuran huruf akar, ukuran satu
   * judul nyata, tinggi tombol terbesar, dan lebar dokumen.
   */
  const UKUR = `(() => {
    const akar = getComputedStyle(document.documentElement)
    const judul = document.querySelector('.auth-panel h2, h1, h2')
    // Ada dua tombol di halaman masuk (pita atas untuk layar sempit, kanan atas
    // untuk layar lebar); ambil yang benar-benar terlihat supaya tinggi ketuk
    // yang diukur bukan 0.
    const semua = [...document.querySelectorAll('button[aria-label^="Ukuran tulisan"]')]
    const tombol = semua.find((b) => b.getBoundingClientRect().height > 0) ?? semua[0]
    return {
      s: akar.getPropertyValue('--s').trim(),
      akar: parseFloat(akar.fontSize),
      judul: judul ? parseFloat(getComputedStyle(judul).fontSize) : 0,
      tombol: tombol ? Math.round(tombol.getBoundingClientRect().height) : 0,
      lebarDokumen: document.documentElement.scrollWidth,
      lebarLayar: window.innerWidth,
      atribut: document.documentElement.getAttribute('data-ukuran'),
      tersimpan: window.localStorage.getItem('ukuran-ulangan'),
    }
  })()`

  // Titik awal bersih: hapus pilihan lama, lalu muat ulang.
  await send('Page.navigate', { url: HALAMAN }, sessionId)
  await sleep(2500)
  await evalJs(`window.localStorage.removeItem('ukuran-ulangan')`)
  await send('Page.navigate', { url: HALAMAN }, sessionId)
  await sleep(3000)

  const awal = await evalJs(UKUR)
  periksa('normal: --s = 1', awal.s === '1', `--s=${awal.s}`)
  periksa('normal: atribut data-ukuran', awal.atribut === 'normal', `data-ukuran=${awal.atribut}`)

  // Tekan tombolnya seperti murid: sekali klik.
  /** Klik tombol ukuran yang terlihat (sama seperti murid menekannya). */
  const KLIK = `(() => {
    const semua = [...document.querySelectorAll('button[aria-label^="Ukuran tulisan"]')]
    const t = semua.find((b) => b.getBoundingClientRect().height > 0) ?? semua[0]
    if (!t) return false
    t.click()
    return true
  })()`

  const adaTombol = await evalJs(KLIK)
  periksa('tombol ukuran ada di bilah', adaTombol === true, 'button[aria-label^="Ukuran tulisan"]')
  await sleep(600)

  const besar = await evalJs(UKUR)
  periksa('besar: --s = 1,12', besar.s === '1.12', `--s=${besar.s}`)
  periksa(
    'besar: huruf di layar ikut membesar',
    besar.judul > awal.judul * 1.1,
    `${awal.judul}px → ${besar.judul}px`,
  )
  periksa(
    'besar: akar (rem) ikut membesar',
    besar.akar > awal.akar * 1.1,
    `${awal.akar}px → ${besar.akar}px`,
  )
  periksa(
    'besar: sasaran ketuk tidak menyusut',
    besar.tombol >= awal.tombol,
    `${awal.tombol}px → ${besar.tombol}px`,
  )
  periksa(
    'besar: halaman tidak melebar melewati layar',
    besar.lebarDokumen <= besar.lebarLayar + 1,
    `dokumen ${besar.lebarDokumen}px ≤ layar ${besar.lebarLayar}px`,
  )
  periksa('besar: pilihan diingat', besar.tersimpan === 'besar', `localStorage=${besar.tersimpan}`)

  // Muat ulang: pilihan harus bertahan dan dipasang sebelum React merender.
  await send('Page.navigate', { url: HALAMAN }, sessionId)
  await sleep(3000)
  const ulang = await evalJs(UKUR)
  periksa(
    'muat ulang: tetap Besar',
    ulang.s === '1.12' && ulang.atribut === 'besar',
    `--s=${ulang.s} · data-ukuran=${ulang.atribut}`,
  )

  // Balik ke Normal harus mengembalikan ukuran semula (bukan menumpuk).
  await evalJs(KLIK)
  await sleep(600)
  const kembali = await evalJs(UKUR)
  periksa(
    'balik ke normal: ukuran kembali seperti semula',
    kembali.s === '1' && Math.abs(kembali.judul - awal.judul) < 0.5,
    `--s=${kembali.s} · judul ${kembali.judul}px (awal ${awal.judul}px)`,
  )

  ws.close()

  console.log(gagal.length === 0 ? '\nSEMUA LOLOS' : `\nGAGAL: ${gagal.join(' · ')}`)
  if (gagal.length > 0) process.exit(1)
}

main().catch((e) => {
  console.error('GAGAL:', e.message)
  process.exit(1)
})
