// Mengukur bundel per halaman di peramban sungguhan — bukan dari keluaran build.
//
// Pertanyaan yang dijawab: berkas JavaScript mana yang benar-benar diminta
// Chrome saat aplikasi dibuka, dan berkas mana yang baru menyusul ketika sebuah
// halaman dibuka? Yang pertama membuktikan "tidak memuat semua kode sekaligus",
// yang kedua membuktikan halamannya tetap sampai.
//
// Memberi angka dari `npm run build` saja tidak cukup: itu menghitung isi
// bundel, bukan apa yang peramban minta. Skrip ini menyadap CDP `Network`
// sehingga daftarnya adalah permintaan sungguhan.
//
// Cara menjalankan (bangun produksi + serve statis + Chrome ber-CDP):
//
//   cd frontend && npm run build
//   ( npx vite preview --port 4173 --strictPort --host 127.0.0.1 >/tmp/preview.log 2>&1 & echo $! >/tmp/preview.pid )
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
//     --no-first-run --remote-debugging-port=9335 --user-data-dir=/tmp/chrome-ukur-bundel about:blank &
//   node docs/ukur-bundel-peramban.mjs
//   kill $(cat /tmp/preview.pid)
//
// Backend tidak diperlukan: halaman yang diukur adalah `/` (beranda tamu) dan
// halaman auth — keduanya tampil tanpa sesi.
import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const CDP = process.env.CDP || 'http://127.0.0.1:9335'
const APP = process.env.APP || 'http://127.0.0.1:4173'
const DIR_ASET = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'dist', 'assets')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Ukuran berkas di `dist/assets` menurut namanya (untuk melabeli permintaan). */
function petaUkuran() {
  /** @type {Record<string, number>} */
  const peta = {}
  for (const nama of readdirSync(DIR_ASET)) {
    if (nama.endsWith('.js')) peta[nama] = statSync(join(DIR_ASET, nama)).size
  }
  return peta
}

/** Nama berkas dari URL (tanpa query). */
function namaBerkas(url) {
  try {
    return new URL(url).pathname.split('/').pop() || url
  } catch {
    return url
  }
}

async function endpoint() {
  const r = await fetch(`${CDP}/json/version`)
  return (await r.json()).webSocketDebuggerUrl
}

async function main() {
  const ukuran = petaUkuran()
  const ws = new WebSocket(await endpoint())
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })

  let id = 0
  const pending = new Map()
  /** @type {Map<string, { url: string, byte: number }>} */
  const permintaanSkrip = new Map()
  const dimuat = new Set()

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result)
      return
    }
    if (msg.method === 'Network.responseReceived' && msg.params.type === 'Script') {
      const p = msg.params
      permintaanSkrip.set(p.requestId, { url: p.response.url, byte: p.response.encodedDataLength || 0 })
    }
    if (msg.method === 'Network.loadingFinished' && permintaanSkrip.has(msg.params.requestId)) {
      const catat = permintaanSkrip.get(msg.params.requestId)
      permintaanSkrip.set(msg.params.requestId, { ...catat, byte: msg.params.encodedDataLength })
    }
  }

  const send = (method, params = {}, sessionId) => {
    const myId = ++id
    return new Promise((res, rej) => {
      pending.set(myId, { res, rej })
      ws.send(JSON.stringify({ id: myId, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  }

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  await send('Page.enable', {}, sessionId)
  await send('Network.enable', {}, sessionId)

  const evalJs = async (expression) => {
    const r = await send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    )
    if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description ?? ''))
    return r.result.value
  }

  /** Permintaan JS yang belum pernah dilaporkan, lalu tandai sudah dilaporkan. */
  function baru() {
    /** @type {{ nama: string, byte: number, ukuran: number|undefined }[]} */
    const hasil = []
    for (const { url, byte } of permintaanSkrip.values()) {
      const nama = namaBerkas(url)
      if (dimuat.has(nama)) continue
      dimuat.add(nama)
      hasil.push({ nama, byte, ukuran: ukuran[nama] })
    }
    return hasil.sort((a, b) => (b.ukuran ?? 0) - (a.ukuran ?? 0))
  }

  /** @param {{ nama: string, byte: number, ukuran: number|undefined }[]} daftar */
  function cetak(daftar) {
    if (daftar.length === 0) {
      console.log('   (tidak ada berkas JS baru)')
      return
    }
    for (const s of daftar) {
      // kB desimal (÷1000) supaya sebanding dengan angka `npm run build`.
      const kb = ((s.ukuran ?? s.byte) / 1000).toFixed(2)
      console.log(`   ${kb.padStart(8)} kB  ${s.nama}`)
    }
  }

  // ---- Fase 1: buka aplikasi (beranda tamu) --------------------------------
  await send('Page.navigate', { url: `${APP}/` }, sessionId)
  await sleep(2500)
  const awal = baru()
  console.log('== Fase 1 — membuka aplikasi (/) ==')
  cetak(awal)
  const totalAwal = awal.reduce((n, s) => n + (s.ukuran ?? s.byte), 0)
  console.log(`   ${awal.length} berkas · ${(totalAwal / 1000).toFixed(2)} kB (mentah, sebelum gzip)`)

  // Beranda benar-benar tampil (bukan layar "Menyiapkan…" yang menggantung).
  const isiBeranda = await evalJs(`document.body.innerText.replace(/\\s+/g, ' ').slice(0, 120)`)
  console.log(`   isi halaman: ${JSON.stringify(isiBeranda)}`)

  // ---- Fase 2: buka halaman malas lewat tautan (tanpa muat ulang) ---------
  const diklik = await evalJs(`(() => {
    const a = [...document.querySelectorAll('a')].find((x) => x.getAttribute('href') === '/daftar')
    if (!a) return false
    a.click()
    return true
  })()`)
  await sleep(1500)
  console.log(`== Fase 2 — menekan tautan “Daftar” di bilah atas (navigasi dalam aplikasi, tanpa muat ulang) — tautan ditemukan: ${diklik} ==`)
  cetak(baru())
  const isiDaftar = await evalJs(`document.querySelector('#konten')?.innerText?.replace(/\\s+/g, ' ').slice(0, 90) ?? '(tanpa konten)'`)
  console.log(`   isi #konten: ${JSON.stringify(isiDaftar)}`)

  // ---- Fase 3: masuk langsung ke halaman malas lain ------------------------
  await send('Page.navigate', { url: `${APP}/lupa-sandi` }, sessionId)
  await sleep(2500)
  console.log('== Fase 3 — membuka /lupa-sandi langsung dari alamat (muat ulang penuh) ==')
  cetak(baru())
  const isiLupa = await evalJs(`document.querySelector('#konten')?.innerText?.replace(/\\s+/g, ' ').slice(0, 90) ?? '(tanpa konten)'`)
  console.log(`   isi #konten: ${JSON.stringify(isiLupa)}`)

  const semua = Object.keys(ukuran).length
  console.log(`\nRingkasan: dist/assets berisi ${semua} berkas JS; peramban meminta ${dimuat.size} di antaranya untuk tiga fase di atas.`)
  ws.close()
}

main().catch((e) => {
  console.error('GAGAL:', e.message)
  process.exit(1)
})
