// Smoke slice 04 lewat browser sungguhan (Chrome DevTools Protocol):
// guru menjadwalkan ulang kuis terbit, lalu murid mengerjakan lewat layar
// pengerjaan — timer tampil, soal tanpa kunci, jawaban tersimpan otomatis ke
// server, dikumpulkan (idempoten), dan hasil tampil tanpa kunci/pembahasan.
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
  // Pilih opsi pada kartu soal yang memuat teks tertentu (jawaban sungguhan).
  pilihOpsi(teksSoal, nilaiOpsi) {
    const kartu = [...document.querySelectorAll('section.kartu-soft')].find((k) => k.innerText.includes(teksSoal))
    if (!kartu) throw new Error('kartu soal tidak ada: ' + teksSoal)
    const input = kartu.querySelector('input[value="' + nilaiOpsi + '"]')
    if (!input) throw new Error('opsi tidak ada: ' + nilaiOpsi)
    input.click()
    return true
  },
  ada(teks) { return (document.querySelector('main')?.innerText ?? '').includes(teks) },
  teksMain() { return document.querySelector('main')?.innerText?.replace(/\\s+/g, ' ') ?? '' },
  timer() { return document.querySelector('[role="timer"]')?.textContent?.trim() ?? null },
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

  // Alat bantu + confirm diterima otomatis di setiap dokumen baru.
  await send('Page.enable', {}, sessionId)
  await send('Page.addScriptToEvaluateOnNewDocument', { source: ALAT }, sessionId)
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.confirm = () => true' }, sessionId)

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

  // Server menyimpan waktu dalam UTC — kirim ISO agar jendela jadwal tepat.
  const mulai = new Date(Date.now() - 60_000).toISOString()
  const selesai = new Date(Date.now() + 3_600_000).toISOString()

  // ---------- 1. Guru menyiapkan kuis ----------
  await buka('/masuk')
  const masukGuru = await masuk(AKUN_GURU)
  catat('login guru lewat API', masukGuru.status === 200, `status ${masukGuru.status}`)

  const daftarGuru = await apiJson('/v1/kuis')
  const kuis = (daftarGuru.isi ?? []).find((k) => (k.jumlah_soal ?? 0) > 0)
  if (!kuis) throw new Error('tidak ada kuis terbit dengan soal di DB dev')

  const detailGuru = await apiJson(`/v1/kuis/${kuis.id}`)
  const dataGuru = detailGuru.isi
  const soalPilihan = (dataGuru.soal ?? []).find((s) => s.tipe === 'pilihan_ganda')
  if (!soalPilihan) throw new Error('tidak ada soal pilihan ganda untuk diuji')
  const opsiBenar = soalPilihan.kunci?.jawaban
  const teksSoal = soalPilihan.konten?.teks ?? ''
  const skorSoal = soalPilihan.skor
  console.log(`   (kuis ${kuis.id} · soal ${soalPilihan.id} · skor ${skorSoal} · kunci ${opsiBenar})`)

  const ubahJadwal = await apiJson(`/v1/kuis/${kuis.id}`, 'PUT', {
    judul: dataGuru.judul,
    deskripsi: dataGuru.deskripsi,
    subject_id: dataGuru.subject_id,
    class_id: dataGuru.class_id,
    durasi_menit: dataGuru.durasi_menit,
    mulai_at: mulai,
    selesai_at: selesai,
    acak_soal: dataGuru.acak_soal,
    acak_opsi: dataGuru.acak_opsi,
  })
  catat('guru menjadwalkan ulang kuis agar sedang berjalan', ubahJadwal.status === 200, `status ${ubahJadwal.status}`)

  // ---------- 2. Murid mengerjakan ----------
  await apiJson('/v1/auth/keluar', 'POST')
  await buka('/masuk')
  const masukMurid = await masuk(AKUN_MURID)
  catat('login murid lewat API', masukMurid.status === 200, `status ${masukMurid.status}`)

  await buka('/kuis')
  const adaTombol = await evalJs(`!!([...document.querySelectorAll('a')].find((a) => a.textContent.includes('Kerjakan sekarang')))`)
  catat('daftar ulangan murid menampilkan tombol Kerjakan sekarang', adaTombol)

  await buka(`/kerjakan/${kuis.id}`)
  const timer = await evalJs(`__alat.timer()`)
  const mainKerjakan = await evalJs(`__alat.teksMain()`)
  catat(
    'layar pengerjaan menampilkan timer dan soal tanpa kunci',
    /^\d{1,2}:\d{2}(:\d{2})?$/.test(timer ?? '') &&
      mainKerjakan.includes(teksSoal) &&
      !mainKerjakan.includes('Kunci') &&
      !mainKerjakan.includes('Pembahasan'),
    `timer ${timer}`,
  )

  // Ambil attempt aktif lewat API (mulai idempoten) + pastikan tanpa kunci.
  const mulaiApi = await apiJson(`/v1/kuis/${kuis.id}/mulai`, 'POST')
  const attempt = mulaiApi.isi
  const soalTerjawab = (attempt.soal ?? []).find((s) => s.konten?.teks === teksSoal)
  const bocor = JSON.stringify(attempt.soal ?? []).toLowerCase()
  catat(
    'respons attempt tidak memuat kunci/pembahasan',
    !bocor.includes('kunci') && !bocor.includes('pembahasan') && soalTerjawab !== undefined,
    `attempt ${attempt.id}`,
  )

  // Jawab soal pilihan ganda dengan kunci yang benar → skor penuh untuk soal itu.
  await evalJs(`__alat.pilihOpsi(${JSON.stringify(teksSoal)}, ${JSON.stringify(opsiBenar)})`)
  await sleep(2200)

  const setelahJawab = await apiJson(`/v1/attempt/${attempt.id}`)
  const tersimpan = (setelahJawab.isi?.jawaban ?? []).find((j) => j.question_id === soalTerjawab.id)
  catat(
    'autosave mengirim jawaban ke server',
    tersimpan !== undefined && tersimpan.jawaban === opsiBenar,
    `jawaban ${JSON.stringify(tersimpan?.jawaban)}`,
  )

  const hitungan = await evalJs(`__alat.ada('1 / ${attempt.jumlah_soal}')`)
  catat('penghitung terjawab di layar bertambah', hitungan)

  // ---------- 3. Kumpulkan + hasil ----------
  await evalJs(`__alat.klikTeks('Kumpulkan jawaban')`)
  await sleep(3200)

  const jalurHasil = await evalJs(`location.pathname`)
  catat('murid diarahkan ke halaman hasil', /^\/hasil\/\d+$/.test(jalurHasil), jalurHasil)

  const mainHasil = await evalJs(`__alat.teksMain()`)
  const adaSkor = await evalJs(`__alat.ada('Skor')`)
  // Tidak ada lencana kunci maupun teks pembahasan; catatan "kunci tidak
  // ditampilkan" pada halaman hasil memang disengaja, jadi bukan kebocoran.
  const adaLencanaKunci = await evalJs(`document.querySelectorAll('.badge-kunci').length > 0`)
  catat(
    'hasil menampilkan skor dan tidak membocorkan kunci',
    adaSkor && !adaLencanaKunci && !mainHasil.includes('Pembahasan:'),
    mainHasil.slice(0, 100),
  )

  const attemptId = Number(jalurHasil.split('/').pop())
  const hasilApi = await apiJson(`/v1/attempt/${attemptId}/hasil`)
  const h = hasilApi.isi
  const soalDinilai = (h?.per_soal ?? []).find((s) => s.question_id === soalTerjawab.id)
  catat(
    'hasil server: soal benar dinilai penuh, sisanya belum dijawab',
    h?.skor === skorSoal &&
      h?.jumlah_benar === 1 &&
      soalDinilai?.benar === true &&
      h?.ringkasan_penilaian?.belum_dijawab === h.jumlah_soal - 1,
    `skor ${h?.skor}/${h?.skor_maksimal} · benar ${h?.jumlah_benar} · belum ${h?.ringkasan_penilaian?.belum_dijawab}`,
  )

  // Kumpulkan ulang (idempoten) tidak menggandakan/mengubah hasil.
  const kumpul2 = await apiJson(`/v1/attempt/${attemptId}/kumpulkan`, 'POST', { idempotency_key: 'smoke-ulang-0001' })
  catat(
    'kumpulkan ulang tetap 200 dan hasil tidak berubah',
    kumpul2.status === 200 && kumpul2.isi?.skor === h?.skor && kumpul2.isi?.jumlah_benar === h?.jumlah_benar,
    `status ${kumpul2.status}`,
  )

  // Jawab sesudah dikumpulkan ditolak.
  const jawabLagi = await apiJson(`/v1/attempt/${attemptId}/jawab`, 'POST', {
    question_id: soalTerjawab.id,
    jawaban: opsiBenar,
  })
  catat('server menolak jawaban sesudah dikumpulkan', jawabLagi.status === 403 || jawabLagi.status === 422, `status ${jawabLagi.status}`)

  await apiJson('/v1/auth/keluar', 'POST')
  ws.close()

  const gagal = hasil.filter((satu) => !satu.lolos)
  console.log('')
  console.log(`smoke slice 04: ${hasil.length - gagal.length}/${hasil.length} lulus`)
  process.exit(gagal.length === 0 ? 0 : 1)
}

main().catch((galat) => {
  console.error('smoke gagal:', galat.message)
  process.exit(1)
})
