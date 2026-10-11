// Smoke UI halaman Pengaturan (CDP): saklar anti-cheat per jenis tampil, bisa
// dinyalakan/dimatikan, dan tombol "Nyalakan/Matikan semua" tersedia per kelompok.
//
// Saklar yang diuji (`block_paste`) dikembalikan ke keadaan semula di akhir,
// jadi basis data dev tidak berubah.
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

  const kelompokAntiCheat = `[...document.querySelectorAll('section')].find((s) => s.innerText.startsWith('ANTI-CHEAT') || s.innerText.startsWith('Anti-cheat'))`

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

    await send('Page.navigate', { url: `${APP}/pengaturan` }, sessionId)
    await sleep(4000)

    const ringkas = await evalJs(`(() => {
      const bagian = ${kelompokAntiCheat}
      if (!bagian) return null
      return {
        judul: bagian.querySelector('h2')?.innerText?.replace(/\\\\s+/g, ' ') ?? '',
        saklar: bagian.querySelectorAll('input[role="switch"]').length,
        tombol: [...bagian.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => t.startsWith('Nyalakan') || t.startsWith('Matikan')),
        label: [...bagian.querySelectorAll('.form-check-label')].map((l) => l.textContent.trim()).slice(0, 3),
      }
    })()`)

    catat(
      'kelompok anti-cheat tampil dengan saklar per jenis + tombol massal',
      ringkas !== null && ringkas.saklar >= 10 && ringkas.tombol.length === 2,
      ringkas === null ? 'kelompok tidak ditemukan' : `${ringkas.saklar} saklar · ${ringkas.tombol.join(', ')} · ${ringkas.judul}`,
    )

    // Saklar sungguhan: hidupkan lalu matikan lagi (nilai akhir = seperti semula).
    const saklarUji = `document.querySelector('#set-block_paste')`
    const sebelum = await evalJs(`${saklarUji}?.checked ?? null`)
    catat('saklar blokir tempel tersedia (bawaan mati)', sebelum === false, `checked=${sebelum}`)

    await evalJs(`(async () => {
      const el = ${saklarUji}
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked').set
      setter.call(el, !el.checked)
      el.dispatchEvent(new Event('change', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 1800))
      return el.checked
    })()`)
    const sesudahHidup = await evalJs(`${saklarUji}?.checked ?? null`)
    catat('saklar bisa dinyalakan dan tersimpan', sesudahHidup === true, `checked=${sesudahHidup}`)

    await evalJs(`(async () => {
      const el = ${saklarUji}
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked').set
      setter.call(el, false)
      el.dispatchEvent(new Event('change', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 1800))
      return el.checked
    })()`)
    const sesudahMati = await evalJs(`${saklarUji}?.checked ?? null`)
    catat('saklar bisa dimatikan lagi (kembali ke bawaan)', sesudahMati === false, `checked=${sesudahMati}`)
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
