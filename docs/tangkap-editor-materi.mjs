/**
 * Bukti visual editor materi gaya video editor (pratinjau langsung).
 * Output: docs/log-mentah/editor-materi-terang.png & editor-materi-gelap.png
 * Prasyarat: backend 8000, vite 5173, Chrome headless --remote-debugging-port=9333
 * (diluncurkan dengan --no-proxy-server). Tanpa pustaka: WebSocket global Node 22.
 *
 * Tema gelap dipaksa lewat addScriptToEvaluateOnNewDocument + reload (bukan
 * setAttribute pasca-render) karena tangkapan pasca-ubah atribut terbukti beku.
 */
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }
const TEKS_BLOK = 'Bahan bangunan punya sifat yang berbeda-beda.\nBaca pelan-pelan, lalu kerjakan latihannya.'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function utama() {
  const buatan = await fetch(`${CDP}/json/new`, { method: 'PUT' })
  const tab = await buatan.json()

  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  let urut = 0
  const tunggu = new Map()
  ws.onmessage = (kejadian) => {
    const pesan = JSON.parse(kejadian.data)
    if (pesan.id && tunggu.has(pesan.id)) {
      tunggu.get(pesan.id)(pesan)
      tunggu.delete(pesan.id)
    }
  }
  const kirim = (method, params = {}) =>
    new Promise((selesai, gagal) => {
      urut += 1
      tunggu.set(urut, selesai)
      ws.send(JSON.stringify({ id: urut, method, params }))
    })

  await new Promise((s, g) => {
    ws.onopen = s
    ws.onerror = () => g(new Error('WS gagal'))
  })
  await kirim('Page.enable')
  await kirim('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 2,
    mobile: false,
  })

  await kirim('Page.navigate', { url: `${APP}/masuk` })
  await sleep(8000)

  const evalJs = async (expression) => {
    const r = await kirim('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.result.exceptionDetails) {
      throw new Error(
        'eval error: ' + (r.result.exceptionDetails.exception?.description ?? JSON.stringify(r.result.exceptionDetails)),
      )
    }
    return r.result.result.value
  }

  // ---------- 1. Login guru lewat API ----------
  const masuk = await evalJs(`(async () => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
    const res = await fetch('/api/v1/auth/masuk', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': 'x' },
      body: JSON.stringify(${JSON.stringify(AKUN_GURU)}),
    })
    if (res.status !== 200) return 'http-' + res.status
    return 'ok-cookie:' + (document.cookie.split('; ').some((c) => c.startsWith('XSRF-TOKEN=')) ? 'ada' : 'tidak-ada')
  })()`)
  console.log('login:', masuk)
  if (!String(masuk).startsWith('ok-cookie')) {
    throw new Error('login guru gagal: ' + masuk)
  }

  /** Susun editor: pilih materi pertama, tambah blok teks, isi teksnya. */
  const susunEditor = async () => {
    await kirim('Page.navigate', { url: `${APP}/materi` })
    await sleep(5000)
    const dipilih = await evalJs(`(() => {
      const tombol = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('jjn'))
      if (!tombol) return false
      tombol.click()
      return true
    })()`)
    if (!dipilih) throw new Error('materi "jjn" tidak ditemukan di daftar')
    await sleep(2500)

    await evalJs(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '+ Teks').click()`)
    await sleep(800)
    await evalJs(`(() => {
      const ta = document.querySelector('.editor-materi textarea.form-control')
      if (!ta) throw new Error('textarea blok teks tidak ada')
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      set.call(ta, ${JSON.stringify(TEKS_BLOK)})
      ta.dispatchEvent(new Event('input', { bubbles: true }))
    })()`)
    await sleep(800)

    const cek = await evalJs(`({
      klip: document.querySelectorAll('.klip').length,
      aktif: document.querySelector('.klip-aktif')?.innerText?.replace(/\\s+/g, ' ') ?? null,
      pratinjau: document.querySelector('.monitor-materi')?.innerText?.replace(/\\s+/g, ' ').slice(0, 160) ?? null,
      posisi: [...document.querySelectorAll('span')].find((s) => /^Blok \\d+ dari \\d+$/.test(s.textContent))?.textContent ?? null,
    })`)
    console.log(JSON.stringify(cek, null, 2))
    if (cek.klip < 2 || !cek.aktif || !cek.posisi) throw new Error('editor tidak merespons seperti yang diharapkan')
    if (!cek.pratinjau.includes('Bahan bangunan')) throw new Error('pratinjau tidak menampilkan teks blok')
  }

  const fs = await import('node:fs')
  fs.mkdirSync('docs/log-mentah', { recursive: true })

  // Capture setelah Page.reload terbukti mengembalikan gambar beku (stale
  // surface) di Chrome headless ini. Solusi: dua putusan terpisah dengan
  // navigasi lintas-dokumen (capture sehat), tema dipilih via localStorage
  // sebelum navigasi — jalur resmi aplikasi (tema-ulangan), tanpa hack atribut.

  // ---------- 2. Terang: pastikan tema terang lalu tangkap ----------
  await evalJs(`window.localStorage.setItem('tema-ulangan', 'terang')`)
  await kirim('Page.navigate', { url: `${APP}/materi` })
  await sleep(5000)
  await susunEditor()
  const terang = await kirim('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('docs/log-mentah/editor-materi-terang.png', Buffer.from(terang.result.data, 'base64'))
  console.log('tersimpan docs/log-mentah/editor-materi-terang.png')

  // ---------- 3. Gelap: navigasi ulang dengan tema gelap tersimpan ----------
  // Query param membuat URL berbeda dari putusan terang — navigasi ke URL yang
  // sama terbukti memicu stale surface lagi (capture mengembalikan gambar lama).
  await evalJs(`window.localStorage.setItem('tema-ulangan', 'gelap')`)
  await kirim('Page.navigate', { url: `${APP}/materi?putusan=gelap` })
  await sleep(5000)
  const temaKini = await evalJs(`document.documentElement.getAttribute('data-bs-theme')`)
  if (temaKini !== 'dark') throw new Error('tema gelap tidak aktif: ' + temaKini)

  await susunEditor()
  const gelap = await kirim('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('docs/log-mentah/editor-materi-gelap.png', Buffer.from(gelap.result.data, 'base64'))
  console.log('tersimpan docs/log-mentah/editor-materi-gelap.png')

  if (terang.result.data === gelap.result.data) throw new Error('tangkapan terang & gelap identik — capture beku')

  ws.close()
  await fetch(`${CDP}/json/close/${tab.id}`)
}

utama().catch((e) => {
  console.error('gagal:', e.message)
  process.exit(1)
})
