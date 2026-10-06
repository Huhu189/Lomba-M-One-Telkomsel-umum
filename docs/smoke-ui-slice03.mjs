// Smoke slice 03 lewat browser sungguhan (Chrome DevTools Protocol):
// guru membuat tag + soal lewat formulir, menjadwalkan & menerbitkan kuis,
// lalu murid membuka kuisnya dan dipastikan tidak melihat kunci jawaban.
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }

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
  klik(sel) {
    const el = document.querySelector(sel)
    if (!el) throw new Error('elemen tidak ada: ' + sel)
    el.click()
    return true
  },
  klikTeks(teks) {
    const el = [...document.querySelectorAll('button, a')].find((b) => b.textContent.trim().includes(teks))
    if (!el) throw new Error('tombol tidak ada: ' + teks)
    el.click()
    return true
  },
  ada(teks) { return (document.querySelector('main')?.innerText ?? '').includes(teks) },
  teksKartu(teks) {
    const kartu = [...document.querySelectorAll('.kartu-soal')].find((k) => k.innerText.includes(teks))
    return kartu?.innerText?.replace(/\\s+/g, ' ') ?? null
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

  // Alat bantu harus ada di setiap dokumen baru (SPA dinavigasi ulang per rute).
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

  const info = async () =>
    evalJs(`({
      judul: document.title,
      menu: [...document.querySelectorAll('nav a')].map((a) => a.textContent.trim()).join(' | '),
      isi: document.querySelector('main')?.innerText?.replace(/\\s+/g, ' ').slice(0, 240) ?? '(tanpa main)',
    })`)

  const masuk = async (akun) =>
    evalJs(`(async () => {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
      const res = await fetch('/api/v1/auth/masuk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: JSON.stringify(${JSON.stringify(akun)}),
      })
      return { status: res.status, email: (await res.json())?.user?.email ?? null }
    })()`)

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

  // ---------- 1. Login guru ----------
  await buka('/masuk')
  const masukGuru = await masuk(AKUN_GURU)
  catat('login guru lewat API', masukGuru.status === 200 && masukGuru.email === AKUN_GURU.email, `status ${masukGuru.status}`)


  // ---------- 2. Tag lewat formulir ----------
  await buka('/tag')
  const menuTag = (await info()).menu
  await evalJs(`__alat.isi('#nama-tag', 'Pecahan')`)
  await evalJs(`__alat.isi('#deskripsi-tag', 'Materi pecahan sederhana untuk kelas 5-6.')`)
  await evalJs(`document.querySelector('form button[type="submit"]').click()`)
  await sleep(2000)
  const tagMuncul = await evalJs(`__alat.ada('Pecahan')`)
  catat('halaman tag memberi menu guru + tag baru muncul di tabel', menuTag.includes('Bank Soal') && tagMuncul, menuTag)

  // ---------- 3. Soal baru lewat editor ----------
  await buka('/bank-soal')
  const soalLama = await evalJs(`document.querySelectorAll('table tbody tr').length`)
  await evalJs(`__alat.klikTeks('Tambah soal')`)
  await sleep(600)
  const mapelId = await evalJs(
    `fetch('/api/v1/mapel', { credentials: 'include', headers: { Accept: 'application/json' } }).then((r) => r.json()).then((d) => d.find((m) => m.nama === 'Matematika').id)`,
  )
  await evalJs(`__alat.isi('#soal-mapel', String(${mapelId}))`)
  await evalJs(`__alat.isi('#soal-teks', 'Berapa hasil dari 1/2 + 1/4?')`)
  await evalJs(`__alat.isi('input[aria-label="Teks opsi A"]', '3/4')`)
  await evalJs(`__alat.isi('input[aria-label="Teks opsi B"]', '2/6')`)
  await evalJs(`__alat.klik('#kunci-A')`)
  await evalJs(`__alat.isi('#soal-skor', '4')`)
  await evalJs(`__alat.klikTeks('Simpan soal')`)
  await sleep(2600)
  const soalTersimpan = await evalJs(`__alat.ada('1/2 + 1/4')`)
  const jumlahSoal = await evalJs(`document.querySelectorAll('table tbody tr').length`)
  catat('guru membuat soal pilihan ganda lewat editor', soalTersimpan && jumlahSoal === soalLama + 1, `baris ${soalLama} → ${jumlahSoal}`)

  // ---------- 4. Kuis: jadwal, susun soal, terbitkan ----------
  await buka('/kuis')
  const kartuDraf = await evalJs(`__alat.teksKartu('Latihan Operasi Hitung (draf)')`)
  catat('halaman kuis guru menampilkan kuis draf + jumlah soal', kartuDraf !== null && kartuDraf.includes('Draf'), kartuDraf ?? 'kartu tidak ditemukan')

  await evalJs(`[...document.querySelectorAll('.kartu-soal')].find((k) => k.innerText.includes('Latihan Operasi Hitung (draf)')).querySelector('button').click()`)
  await sleep(800)

  const duaDigit = (angka) => String(angka).padStart(2, '0')
  const lokal = (waktu) =>
    `${waktu.getFullYear()}-${duaDigit(waktu.getMonth() + 1)}-${duaDigit(waktu.getDate())}T${duaDigit(waktu.getHours())}:${duaDigit(waktu.getMinutes())}`
  const mulai = new Date(Date.now() - 60_000)
  const selesai = new Date(Date.now() + 3_600_000)

  await evalJs(`__alat.isi('#kuis-mulai', '${lokal(mulai)}')`)
  await evalJs(`__alat.isi('#kuis-selesai', '${lokal(selesai)}')`)
  await evalJs(`document.querySelector('form button[type="submit"]').click()`)
  await sleep(2400)

  const kuisId = await evalJs(
    `fetch('/api/v1/kuis', { credentials: 'include', headers: { Accept: 'application/json' } }).then((r) => r.json()).then((d) => d.find((k) => k.judul === 'Latihan Operasi Hitung (draf)').id)`,
  )

  await evalJs(`__alat.klikTeks('Susun soal')`)
  await sleep(2000)
  const susunanAwal = await evalJs(`document.querySelectorAll('.col-lg-6 input[type="checkbox"]').length`)
  await evalJs(
    `[...document.querySelectorAll('.col-lg-6 input[type="checkbox"]')].slice(0, 2).forEach((c) => { if (!c.checked) c.click() })`,
  )
  await evalJs(`__alat.klikTeks('Simpan susunan')`)
  await sleep(2000)
  await evalJs(`__alat.klikTeks('Terbitkan')`)
  await sleep(2600)

  const kartuSetelahTerbit = await evalJs(`__alat.teksKartu('Latihan Operasi Hitung (draf)')`)
  catat(
    'guru menyusun soal lalu menerbitkan kuis',
    kartuSetelahTerbit !== null && !kartuSetelahTerbit.includes('Draf') && susunanAwal >= 4,
    kartuSetelahTerbit ?? 'kartu tidak ditemukan',
  )

  // ---------- 5. Sisi murid ----------
  const kelasId = await evalJs(
    `fetch('/api/v1/kuis/' + ${kuisId}, { credentials: 'include', headers: { Accept: 'application/json' } }).then((r) => r.json()).then((k) => k.class_id)`,
  )
  const buatMurid = await apiJson('/v1/murid', 'POST', {
    nama: 'Smoke Murid',
    email: AKUN_MURID.email,
    class_id: kelasId,
    kata_sandi: AKUN_MURID.password,
  })
  console.log('   (murid uji:', buatMurid.status, buatMurid.status === 422 ? 'sudah ada' : 'dibuat', ')')

  await apiJson('/v1/auth/keluar', 'POST')
  await buka('/masuk')
  const masukMurid = await masuk(AKUN_MURID)
  catat('login murid uji', masukMurid.status === 200, `status ${masukMurid.status}`)

  await buka('/kuis')
  const menuMurid = (await info()).menu
  const daftarMurid = await evalJs(`__alat.ada('Latihan Operasi Hitung (draf)')`)
  catat('murid melihat kuis terbit kelasnya', daftarMurid && menuMurid.includes('Ulangan Saya'), menuMurid)

  await buka(`/kuis/${kuisId}`)
  const isiMurid = await evalJs(`document.querySelector('main')?.innerText?.replace(/\\s+/g, ' ') ?? ''`)
  catat(
    'murid melihat soal tanpa kunci jawaban',
    isiMurid.includes('1/2 + 1/4') && !isiMurid.toLowerCase().includes('kunci'),
    isiMurid.slice(0, 120),
  )

  await apiJson('/v1/auth/keluar', 'POST')
  ws.close()

  const gagal = hasil.filter((satu) => !satu.lolos)
  console.log('')
  console.log(`smoke slice 03: ${hasil.length - gagal.length}/${hasil.length} lulus`)
  process.exit(gagal.length === 0 ? 0 : 1)
}

main().catch((galat) => {
  console.error('smoke gagal:', galat.message)
  process.exit(1)
})
