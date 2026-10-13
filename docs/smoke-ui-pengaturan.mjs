// Smoke UI halaman Pengaturan (CDP): skala **per ulangan** (bukan per akun),
// saklar anti-cheat per jenis tampil, bisa dinyalakan/dimatikan, dan tombol
// "Nyalakan/Matikan semua" tersedia per kelompok.
//
// Sejak 12 Oktober 2026 halaman ini tidak lagi menawarkan lapis sekolah/kelas:
// yang diperiksa di sini adalah daftar ulangan sebagai satu-satunya lingkup, dan
// saklar yang diuji dikembalikan ke keadaan semula di akhir — jadi basis data
// dev tidak berubah.
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

    // Lingkup halaman: hanya ulangan. Lapis "Sekolah"/"Kelas" tidak boleh ada
    // lagi di pemilih, karena halaman ini memang bukan setelan akun.
    const lingkup = await evalJs(`(() => {
      const pilih = document.querySelector('#lingkup-pengaturan')
      if (!pilih) return null
      return {
        label: document.querySelector('label[for="lingkup-pengaturan"]')?.innerText?.trim() ?? '',
        opsi: [...pilih.options].map((o) => o.textContent.trim()).filter((t) => t !== ''),
        nilai: pilih.value,
        judul: document.querySelector('h1')?.innerText?.trim() ?? '',
      }
    })()`)

    const adaLapisAkun = (lingkup?.opsi ?? []).some(
      (t) => t.toLowerCase().includes('sekolah') || t.toLowerCase().includes('kelas'),
    )
    catat(
      'lingkup pengaturan hanya per ulangan (tanpa lapis sekolah/kelas)',
      lingkup !== null && lingkup.opsi.length > 0 && !adaLapisAkun && lingkup.nilai.startsWith('kuis:'),
      lingkup === null ? 'pemilih tidak ditemukan' : `${lingkup.label}: ${lingkup.opsi.length} opsi · terpilih=${lingkup.nilai}`,
    )

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

    // Saklar sungguhan: pilih satu saklar anti-cheat yang **tidak dikunci**, ubah,
    // lalu kembalikan ke nilai semula — jadi uji ini tidak mengandaikan bawaan
    // tertentu (nilai ulangan bisa berbeda-beda).
    const saklarUji = `(() => {
      const bagian = ${kelompokAntiCheat}
      if (!bagian) return null
      return [...bagian.querySelectorAll('input[role="switch"]')].find((el) => !el.disabled) ?? null
    })()`

    const sebelum = await evalJs(`${saklarUji}?.checked ?? null`)
    catat('ada saklar anti-cheat yang bisa diubah (tidak dikunci sekolah)', typeof sebelum === 'boolean', `checked=${sebelum}`)

    const ubah = (nilai) => evalJs(`(async () => {
      const el = ${saklarUji}
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked').set
      setter.call(el, ${nilai})
      el.dispatchEvent(new Event('change', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 1800))
      return el.checked
    })()`)

    const sesudahUbah = await ubah(!sebelum)
    catat('saklar bisa diubah dan tersimpan', sesudahUbah === !sebelum, `dari=${sebelum} ke=${sesudahUbah}`)

    const sesudahKembali = await ubah(sebelum)
    catat('saklar dikembalikan ke nilai semula', sesudahKembali === sebelum, `checked=${sesudahKembali}`)
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
