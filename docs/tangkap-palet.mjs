/**
 * Tangkap halaman masuk (auth) untuk bukti visual palet baru.
 * Output: /tmp/palet-masuk.png (terang) dan /tmp/palet-masuk-gelap.png.
 * Prasyarat: Chrome headless --remote-debugging-port=9333 dan Vite di 5173.
 * Tanpa pustaka: memakai WebSocket global bawaan Node 22.
 */
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function utama() {
  const buatan = await fetch(`${CDP}/json/new?${encodeURIComponent(`${APP}/masuk`)}`, { method: 'PUT' })
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
  const kirim = (method, params = {}) => new Promise((selesai) => {
    urut += 1
    tunggu.set(urut, selesai)
    ws.send(JSON.stringify({ id: urut, method, params }))
  })

  await new Promise((s, g) => { ws.onopen = s; ws.onerror = () => g(new Error('WS gagal')) })
  await kirim('Page.enable')
  await kirim('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false })
  await sleep(3000)

  const fs = await import('node:fs')
  const terang = await kirim('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('/tmp/palet-masuk.png', Buffer.from(terang.result.data, 'base64'))
  console.log('tersimpan /tmp/palet-masuk.png')

  await kirim('Runtime.evaluate', { expression: `document.documentElement.setAttribute('data-bs-theme','dark')` })
  await sleep(600)
  const gelap = await kirim('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('/tmp/palet-masuk-gelap.png', Buffer.from(gelap.result.data, 'base64'))
  console.log('tersimpan /tmp/palet-masuk-gelap.png')

  ws.close()
  await fetch(`${CDP}/json/close/${tab.id}`)
}

utama().catch((e) => { console.error('gagal:', e.message); process.exit(1) })
