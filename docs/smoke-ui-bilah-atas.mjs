// Smoke UI bilah atas (Chrome DevTools Protocol) — pagar putaran A.58.
//
// Latar: pada A.49 bilah atas mendapat tombol **ukuran tulisan Normal/Besar**
// (`TombolUkuran`) yang menyetel atribut `data-ukuran` di <html> dan menyimpan
// pilihan di `localStorage: ukuran-ulangan`. Pemilik produk meminta tombol itu
// dibuang, dan seluruh sisa mesinnya ikut dibuang supaya tidak ada kode mati.
//
// Harness ini menjaga supaya:
//   1. tidak ada satu pun tombol berlabel "Ukuran tulisan" — di halaman masuk
//      (dulu DUA: panel + pojok kanan atas) maupun di halaman guru;
//   2. atribut `data-ukuran` tidak pernah dipasang lagi;
//   3. pilihan lama yang masih tersimpan di perangkat murid/guru **tidak**
//      berpengaruh apa pun (atribut tetap kosong, ukuran huruf <html> tetap);
//   4. yang tersisa di bilah atas memang masih ada: tombol tema terang/gelap —
//      supaya "dibuang" tidak berarti "bilah atasnya rusak".
//
// Prasyarat: backend 8000 + vite 5173 (paling mudah `./nyalakan-local.sh`) dan
// Chrome `--remote-debugging-port=9333`. Paling ringkas lewat
// `docs/jalankan-smoke-ui.sh bilah-atas`, yang menyiapkan layanan + Chrome
// sendiri. Harness ini tidak membuat/mengubah data apa pun di basis data, dan
// menghapus kembali kunci `ukuran-ulangan` yang sengaja ia tulis.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const hasil = []
function cek(nama, lulus, catatan = '') {
  hasil.push(lulus)
  console.log(`${lulus ? 'OK  ' : 'GAGAL'} ${nama}${catatan ? ` — ${catatan}` : ''}`)
}

async function main() {
  const ws = new WebSocket(
    await fetch(`${CDP}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl),
  )
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })

  let id = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result)
    }
  }
  const send = (method, params = {}, sessionId) =>
    new Promise((res, rej) => {
      const myId = ++id
      pending.set(myId, { res, rej })
      ws.send(JSON.stringify({ id: myId, method, params, sessionId }))
    })

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })

  const evalJs = async (expression) => {
    const r = await send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    )
    if (r.exceptionDetails) {
      throw new Error(
        'eval error: ' + (r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)),
      )
    }
    return r.result.value
  }

  // Diukur di peramban sungguhan, bukan dari berkas sumber.
  const probe = `({
    tombolUkuran: [...document.querySelectorAll('button')]
      .filter((b) => (b.getAttribute('aria-label') || '').startsWith('Ukuran tulisan')).length,
    atribut: document.documentElement.getAttribute('data-ukuran'),
    akarPx: getComputedStyle(document.documentElement).fontSize,
  })`

  // 1) Halaman masuk (kerangka auth) — dulu dua tombol ukuran di sini.
  await send('Page.navigate', { url: `${APP}/masuk` }, sessionId)
  await sleep(3500)

  const masuk = await evalJs(probe)
  const tombolAuth = await evalJs(
    `[...document.querySelectorAll('button.tombol-ikon')].map((b) => b.getAttribute('aria-label')).join(' | ')`,
  )

  cek('halaman masuk: tak ada tombol "Ukuran tulisan"', masuk.tombolUkuran === 0, `ketemu ${masuk.tombolUkuran}`)
  cek('halaman masuk: atribut data-ukuran tidak ada', masuk.atribut === null, `data-ukuran=${masuk.atribut}`)
  cek(
    'halaman masuk: tombol tema masih ada di panel dan pojok atas',
    (tombolAuth.match(/mode (gelap|terang)/g) ?? []).length === 2,
    tombolAuth || '(tidak ada tombol .tombol-ikon)',
  )

  const login = await evalJs(`(async () => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
    const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
    const res = await fetch('/api/v1/auth/masuk', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
      body: JSON.stringify(${JSON.stringify(AKUN)}),
    })
    return res.status
  })()`)
  cek('login guru lewat proxy vite', login === 200, `status ${login}`)

  // 2) Halaman guru — bilah atas.
  await send('Page.navigate', { url: `${APP}/kelas` }, sessionId)
  await sleep(3500)

  const guru = await evalJs(probe)
  const bilah = await evalJs(
    `[...document.querySelectorAll('.kepala-app button')]
      .map((b) => b.getAttribute('aria-label') || b.textContent.trim()).join(' | ')`,
  )
  const isi = await evalJs(`document.querySelector('main')?.innerText?.replace(/\\s+/g, ' ').slice(0, 80) ?? ''`)

  cek('halaman guru: tak ada tombol "Ukuran tulisan"', guru.tombolUkuran === 0, `ketemu ${guru.tombolUkuran}`)
  cek('halaman guru: atribut data-ukuran tidak ada', guru.atribut === null, `data-ukuran=${guru.atribut}`)
  cek(
    'halaman guru: bilah atas isinya keluar + tema + hamburger',
    /mode (gelap|terang)/.test(bilah) && !bilah.includes('Ukuran'),
    bilah,
  )
  cek('halaman guru: isi halaman tetap ter-render', isi.length > 20, isi)

  // 3) Pilihan lama yang masih tersimpan di perangkat tidak boleh berpengaruh.
  await evalJs(`window.localStorage.setItem('ukuran-ulangan', 'besar')`)
  await send('Page.navigate', { url: `${APP}/kelas` }, sessionId)
  await sleep(3500)

  const ulang = await evalJs(probe)
  cek('kunci lama "ukuran-ulangan=besar" diabaikan', ulang.atribut === null, `data-ukuran=${ulang.atribut}`)
  cek('ukuran huruf <html> tetap seperti semula', ulang.akarPx === guru.akarPx, `${guru.akarPx} → ${ulang.akarPx}`)

  await evalJs(`window.localStorage.removeItem('ukuran-ulangan')`)

  ws.close()

  const gagal = hasil.filter((satu) => !satu).length
  console.log(`\nsmoke bilah-atas: ${hasil.length - gagal}/${hasil.length} lulus`)
  process.exit(gagal === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('GAGAL:', e.message)
  process.exit(1)
})
