// Smoke mode tamu lewat browser sungguhan (Chrome DevTools Protocol).
//
// Yang dibuktikan di sini hanya bisa dibuktikan dari sisi peramban: formulir tamu
// yang benar-benar dirender, kode perangkat yang benar-benar disimpan
// `localStorage`, dan aturan "tamu yang menekan Keluar membuang kode perangkatnya"
// (supaya komputer yang dipakai bergantian tidak mewariskan akun).
//
// Prasyarat: backend 8000, vite 5173, realtime 4000, Chrome --remote-debugging-port=9333
// (jalankan lewat `docs/jalankan-smoke-ui.sh tamu`).
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_ADMIN = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }
const KUNCI_PERANGKAT = 'ulangan:perangkat-tamu'
const NAMA_TAMU = 'Tamu Smoke Perangkat'
const NOMOR_HP_SALAH = 'bukan-perangkat-123456'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alat bantu di sisi halaman (disuntik ulang setiap navigasi). */
const ALAT = `window.__alat = {
  isi(sel, nilai) {
    const el = document.querySelector(sel)
    if (!el) throw new Error('elemen tidak ada: ' + sel)
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, nilai)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  },
  klikTeks(teks) {
    const el = [...document.querySelectorAll('button, a')].find((b) => b.textContent.trim().includes(teks))
    if (!el) throw new Error('tombol tidak ada: ' + teks)
    el.click()
    return true
  },
  isiTamu(nama) {
    const form = document.querySelector('section.auth-tamu form')
    if (!form) throw new Error('formulir tamu tidak ada')
    const el = form.querySelector('input#nama-input') ?? form.querySelector('input')
    if (!el) throw new Error('kolom nama tamu tidak ada')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, nama)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    form.requestSubmit()
    return true
  },
  kode() { return window.localStorage.getItem('${KUNCI_PERANGKAT}') },
  teksTamu() {
    const bagian = document.querySelector('section.auth-tamu')
    return bagian ? bagian.innerText.replace(/\\\\s+/g, ' ') : null
  },
}`

const hasil = []

function catat(nama, lolos, detail = '') {
  hasil.push({ nama, lolos })
  console.log(`${lolos ? 'LULUS' : 'GAGAL'} · ${nama}${detail ? ' · ' + detail : ''}`)
}

async function endpoint() {
  return fetch(`${CDP}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl)
}

async function main() {
  const ws = new WebSocket(await endpoint())
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

  await send('Page.enable', {}, sessionId)
  await send('Page.addScriptToEvaluateOnNewDocument', { source: ALAT }, sessionId)

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)
    if (r.exceptionDetails) {
      throw new Error('eval error: ' + (r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)))
    }
    return r.result.value
  }

  const buka = async (jalur) => {
    await send('Page.navigate', { url: APP + jalur }, sessionId)
    await sleep(3200)
  }

  const apiJson = async (jalur, metode = 'GET', muatan = null) =>
    evalJs(`(async () => {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
      const res = await fetch('/api${jalur}', {
        method: '${metode}',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: ${muatan === null ? 'null' : `JSON.stringify(${JSON.stringify(muatan)})`},
      })
      return { status: res.status, isi: await res.json().catch(() => null) }
    })()`)

  /** Siapa yang sedang masuk menurut server (dipakai untuk membandingkan id tamu). */
  const saya = async () => {
    const r = await evalJs(
      `fetch('/api/v1/auth/saya', { credentials: 'include', headers: { Accept: 'application/json' } })
        .then((x) => x.json()).then((d) => ({ id: d.id ?? null, isTamu: d.isTamu ?? false, nama: d.name ?? null }))`,
    )

    return r
  }

  const masuk = async (akun) => {
    for (let coba = 0; coba < 3; coba++) {
      const r = await evalJs(`(async () => {
        await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
        const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
        const res = await fetch('/api/v1/auth/masuk', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
          body: JSON.stringify(${JSON.stringify(akun)}),
        })
        return { status: res.status }
      })()`)

      if (r.status !== 429) return r

      console.log('   (batas masuk per menit tercapai, menunggu 20 detik…)')
      await sleep(20_000)
    }

    return { status: 429 }
  }

  // ---------- 0. Guru/admin membuka pintu tamu (lapis sekolah, dikembalikan di akhir) ----------
  await buka('/masuk')
  const masukAdmin = await masuk(AKUN_ADMIN)
  catat('login admin lewat API', masukAdmin.status === 200, `status ${masukAdmin.status}`)

  const bukaTamu = await apiJson('/v1/pengaturan', 'PUT', {
    lingkup: 'sekolah',
    kunci: 'izinkan_tamu',
    nilai: true,
  })
  const infoTamu = await apiJson('/v1/tamu')
  catat(
    'admin membuka pintu tamu untuk sekolah',
    bukaTamu.status === 200 && infoTamu.isi?.diizinkan === true,
    `PUT ${bukaTamu.status} · diizinkan=${infoTamu.isi?.diizinkan}`,
  )

  await apiJson('/v1/auth/keluar', 'POST')
  await evalJs(`window.localStorage.removeItem('${KUNCI_PERANGKAT}'); true`)

  // ---------- 1. Formulir tamu tampil di halaman masuk ----------
  await buka('/masuk')
  const teksForm = await evalJs(`__alat.teksTamu()`)

  catat(
    'formulir "ikut sebagai siswa tamu" tampil dan menjelaskan perangkatnya',
    typeof teksForm === 'string' &&
      teksForm.includes('siswa tamu') &&
      teksForm.includes('perangkat yang sama'),
    (teksForm ?? '(tidak ada)').slice(0, 120),
  )

  // ---------- 2. Masuk sebagai tamu lewat formulir: kode perangkat tersimpan ----------
  await evalJs(`__alat.isiTamu(${JSON.stringify(NAMA_TAMU)})`)
  await sleep(3500)

  const kodePertama = await evalJs(`__alat.kode()`)
  const tamuPertama = await saya()

  catat(
    'tamu masuk lewat formulir dan dapat kode perangkat unik',
    tamuPertama.isTamu === true && tamuPertama.nama === NAMA_TAMU && typeof kodePertama === 'string' && kodePertama.length >= 8,
    `id=${tamuPertama.id} · kode=${(kodePertama ?? '(kosong)').slice(0, 12)}…`,
  )

  // ---------- 3. Halaman dimuat ulang: identitas perangkat tetap ----------
  await buka('/')
  const setelahMuatUlang = await saya()
  const kodeSetelahMuatUlang = await evalJs(`__alat.kode()`)

  catat(
    'muat ulang halaman: akun dan kode perangkat tidak berubah',
    setelahMuatUlang.id === tamuPertama.id && kodeSetelahMuatUlang === kodePertama,
    `id=${setelahMuatUlang.id}`,
  )

  // ---------- 4. Tekan Keluar: kode perangkat dibuang (komputer dipakai bergantian) ----------
  await evalJs(`__alat.klikTeks('Keluar')`)
  await sleep(3000)

  const kodeSetelahKeluar = await evalJs(`__alat.kode()`)
  catat('tamu menekan Keluar: kode perangkat dibuang', kodeSetelahKeluar === null, `kode=${kodeSetelahKeluar}`)

  // ---------- 5. Nama yang sama setelah Keluar = anak berbeda, bukan akun warisan ----------
  await evalJs(`__alat.isiTamu(${JSON.stringify(NAMA_TAMU)})`)
  await sleep(3500)

  const tamuKedua = await saya()
  const kodeKedua = await evalJs(`__alat.kode()`)

  catat(
    'nama sama di perangkat yang sudah dikosongkan: akun BARU (tidak mewarisi)',
    tamuKedua.isTamu === true && tamuKedua.id !== tamuPertama.id && typeof kodeKedua === 'string' && kodeKedua !== kodePertama,
    `id pertama=${tamuPertama.id} · id kedua=${tamuKedua.id}`,
  )

  // ---------- 6. Kode ngawur tidak dipakai sebagai identitas ----------
  await evalJs(`window.localStorage.setItem('${KUNCI_PERANGKAT}', ${JSON.stringify(NOMOR_HP_SALAH)}); true`)
  const kodeNgawur = await evalJs(
    `fetch('/api/v1/auth/tamu', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json',
        'X-XSRF-TOKEN': decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1] ?? '') },
      body: JSON.stringify({ nama: 'Tamu Kode Ngawur', kode_perangkat: 'spasi tidak boleh' }),
    }).then((r) => r.status)`,
  )

  catat('kode perangkat bentuk aneh ditolak validasi (422)', kodeNgawur === 422, `status ${kodeNgawur}`)

  // ---------- Bersih-bersih ----------
  await apiJson('/v1/auth/keluar', 'POST')
  await buka('/masuk')
  await masuk(AKUN_ADMIN)
  const matikan = await apiJson('/v1/pengaturan', 'PUT', {
    lingkup: 'sekolah',
    kunci: 'izinkan_tamu',
    nilai: false,
  })
  const infoTamuAkhir = await apiJson('/v1/tamu')
  catat(
    'pintu tamu dikembalikan ke keadaan semula (mati)',
    matikan.status === 200 && infoTamuAkhir.isi?.diizinkan === false,
    `diizinkan=${infoTamuAkhir.isi?.diizinkan}`,
  )

  await apiJson('/v1/auth/keluar', 'POST')
  await send('Target.closeTarget', { targetId })
  ws.close()

  const gagal = hasil.filter((satu) => !satu.lolos)
  console.log('')
  console.log(`smoke tamu: ${hasil.length - gagal.length}/${hasil.length} lulus`)
  process.exit(gagal.length === 0 ? 0 : 1)
}

main().catch((galat) => {
  console.error('smoke gagal:', galat.message)
  process.exit(1)
})
