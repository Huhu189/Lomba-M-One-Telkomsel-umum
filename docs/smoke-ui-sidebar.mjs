// Smoke UI panel samping guru (CDP): panel harus terkunci di layar — setinggi
// jendela dikurangi kepala, menempel rata ke tepi kiri tanpa padding/sudut, dan
// tetap di tempatnya saat halaman digulir.
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const hasil = []

function catat(nama, lolos, detail = '') {
  hasil.push({ nama, lolos })
  console.log(`${lolos ? 'LULUS' : 'GAGAL'} · ${nama}${detail ? ' · ' + detail : ''}`)
}

async function main() {
  const url = await fetch(`${CDP}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl)
  const ws = new WebSocket(url)
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
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)
    if (r.exceptionDetails) {
      throw new Error('eval error: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails))
    }
    return r.result.value
  }

  // Layar lebar: di bawah 992 px panel memang digantikan laci.
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId)

  try {
    await send('Page.navigate', { url: `${APP}/masuk` }, sessionId)
    await sleep(3500)
    const masuk = await evalJs(`(async () => {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
      const res = await fetch('/api/v1/auth/masuk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: JSON.stringify(${JSON.stringify(AKUN_GURU)}),
      })
      return res.status
    })()`)
    catat('login guru', masuk === 200, `status ${masuk}`)

    await send('Page.navigate', { url: `${APP}/kuis` }, sessionId)
    await sleep(3500)

    /** Ukur panel + konten; `gulir` menggeser halaman dulu bila diisi. */
    const ukur = `(async (gulir) => {
      if (gulir > 0) {
        window.scrollTo(0, gulir)
        await new Promise((r) => setTimeout(r, 400))
      }
      const nav = document.querySelector('nav.papan-nav')
      if (!nav) return null
      const gaya = getComputedStyle(nav)
      const kotak = nav.getBoundingClientRect()
      // Jarak diukur dari ISI halaman (kartu di dalam #konten), bukan dari
      // pembungkus .kerangka-isi yang bounding-nya sudah termasuk padding-nya.
      const isi = document.querySelector('#konten .container')?.getBoundingClientRect() ?? { left: kotak.right }
      return {
        position: gaya.position,
        borderRadius: gaya.borderRadius,
        boxShadow: gaya.boxShadow,
        overflowY: gaya.overflowY,
        left: Math.round(kotak.left),
        top: Math.round(kotak.top),
        height: Math.round(kotak.height),
        lebar: Math.round(kotak.width),
        jarakKeKonten: Math.round(isi.left - kotak.right),
        jendela: { tinggi: window.innerHeight, gulirY: Math.round(window.scrollY) },
      }
    })`

    const awal = await evalJs(`${ukur}(0)`)
    if (awal === null) {
      catat('panel samping ada di layar ≥ lg', false, 'nav.papan-nav tidak ditemukan')
    } else {
      catat('panel samping menempel rata ke tepi kiri (tanpa padding luar)', awal.left === 0, `left=${awal.left}`)
      catat('panel setinggi jendela dikurangi kepala', awal.height === awal.jendela.tinggi - 68, `tinggi=${awal.height} (jendela ${awal.jendela.tinggi})`)
      catat('panel bersudut datar (tanpa radius/bayangan melayang)', awal.borderRadius === '0px' && awal.boxShadow === 'none', `radius=${awal.borderRadius} shadow=${awal.boxShadow}`)
      catat('panel tetap punya lebar 260 px', awal.lebar === 260, `lebar=${awal.lebar}`)
      catat('konten tidak menempel ke panel', awal.jarakKeKonten > 0, `jarak=${awal.jarakKeKonten} px`)

      // Gulir 500 px: panel yang benar tidak ikut naik.
      const setelahGulir = await evalJs(`${ukur}(500)`)
      // Kalau panel ikut tergulir, posisinya akan naik 500 px (jadi negatif) —
      // bukan tetap di ambang 68 px di bawah kepala.
      catat(
        'panel terkunci saat halaman digulir',
        setelahGulir !== null &&
          setelahGulir.jendela.gulirY >= 400 &&
          Math.abs(setelahGulir.top - 68) <= 2,
        setelahGulir === null
          ? 'panel hilang'
          : `top ${awal.top} → ${setelahGulir.top}, gulirY=${setelahGulir.jendela.gulirY}`,
      )
    }
  } finally {
    const gagal = hasil.filter((satu) => !satu.lolos)
    console.log(`\n${hasil.length - gagal.length}/${hasil.length} pemeriksaan lulus.`)
    ws.close()
    if (gagal.length > 0) process.exit(1)
  }
}

main().catch((e) => {
  console.error('GAGAL:', e.message)
  process.exit(1)
})
