// Smoke slice 05 lewat browser sungguhan (Chrome DevTools Protocol):
// skor asli tetap utuh setelah retry, peringkat hanya memakai skor asli dan
// mengikuti saklar pengaturan, laporan per tema hanya untuk guru, serta halaman
// lencana dan progres tema tampil untuk murid.
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alat bantu di sisi halaman (disuntik ulang setiap navigasi). */
const ALAT = `window.__alat = {
  ada(teks) { return (document.querySelector('main')?.innerText ?? '').includes(teks) },
  teksMain() { return document.querySelector('main')?.innerText?.replace(/\\s+/g, ' ') ?? '' },
  hitung(sel) { return document.querySelectorAll(sel).length },
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

  const atur = (kunci, nilai) =>
    apiJson('/v1/pengaturan', 'PUT', { lingkup: 'sekolah', kunci, nilai })

  const mulai = new Date(Date.now() - 60_000).toISOString()
  const selesai = new Date(Date.now() + 3_600_000).toISOString()

  // ---------- 1. Guru menyiapkan demo ----------
  await buka('/masuk')
  catat('login guru lewat API', (await masuk(AKUN_GURU)).status === 200)

  const daftarGuru = await apiJson('/v1/kuis')
  const kuis = (daftarGuru.isi ?? []).find((k) => (k.jumlah_soal ?? 0) > 0)
  if (!kuis) throw new Error('tidak ada kuis terbit dengan soal di DB dev')

  const detailGuru = await apiJson(`/v1/kuis/${kuis.id}`)
  const dataGuru = detailGuru.isi
  const soalPilihan = (dataGuru.soal ?? []).find((s) => s.tipe === 'pilihan_ganda')
  if (!soalPilihan) throw new Error('tidak ada soal pilihan ganda untuk diuji')
  const opsiBenar = soalPilihan.kunci?.jawaban

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

  const retryBuka = await atur('retry', true)
  await atur('batas_percobaan', 99)
  const rankingMati = await atur('ranking', false)
  catat(
    'guru menyalakan retry dan mematikan ranking (bawaan mati)',
    retryBuka.status === 200 && rankingMati.isi?.pengaturan?.ranking?.nilai === false,
    `ranking ${rankingMati.isi?.pengaturan?.ranking?.nilai}`,
  )

  // ---------- 2. Murid: skor asli + retry ----------
  await apiJson('/v1/auth/keluar', 'POST')
  await buka('/masuk')
  catat('login murid lewat API', (await masuk(AKUN_MURID)).status === 200)

  // Identitas murid diambil dari endpoint progres (bukan urutan daftar kelas).
  const profilSaya = await apiJson('/v1/progres/saya')
  const muridId = profilSaya.isi?.murid_id
  if (!muridId) throw new Error('progres murid tidak mengembalikan murid_id')

  // Peringkat saat saklar mati: murid tidak melihat isinya.
  const mati = await apiJson(`/v1/kuis/${kuis.id}/ranking`)
  catat(
    'murid tidak melihat peringkat saat saklar ranking mati',
    mati.status === 200 && mati.isi?.tampil === false && (mati.isi?.peringkat ?? []).length === 0,
    `total ${mati.isi?.total}`,
  )

  // Kerjakan (retry) satu soal benar → skor ulang, bukan skor asli.
  const mulaiApi = await apiJson(`/v1/kuis/${kuis.id}/mulai`, 'POST')
  const attempt = mulaiApi.isi
  await apiJson(`/v1/attempt/${attempt.id}/jawab`, 'POST', {
    question_id: soalPilihan.id,
    jawaban: opsiBenar,
  })
  const kumpul = await apiJson(`/v1/attempt/${attempt.id}/kumpulkan`, 'POST', { idempotency_key: 'smoke-05-a' })

  catat(
    'attempt retry berjalan dengan attempt_no > 1 dan asli false',
    attempt.attempt_no > 1 && attempt.asli === false,
    `attempt_no ${attempt.attempt_no} · asli ${attempt.asli}`,
  )
  catat(
    'skor ulang tercatat terpisah',
    kumpul.status === 200 && kumpul.isi?.skor === soalPilihan.skor && kumpul.isi?.asli === false,
    `skor ulang ${kumpul.isi?.skor}`,
  )

  // Hasil murid memuat tautan peringkat & progres tema.
  await buka(`/hasil/${attempt.id}`)
  const tautanHasil = await evalJs(`__alat.ada('Peringkat') && __alat.ada('Progres tema')`)
  catat('halaman hasil menautkan peringkat dan progres tema', tautanHasil)

  // ---------- 3. Halaman murid ----------
  await buka(`/peringkat/${kuis.id}`)
  const peringkatMati = await evalJs(`__alat.teksMain()`)
  catat(
    'halaman peringkat memberi tahu ranking sedang dimatikan',
    peringkatMati.includes('Peringkat') && peringkatMati.includes('dimatikan guru'),
    peringkatMati.slice(0, 90),
  )

  await buka('/progres-tema')
  const progres = (await evalJs(`__alat.teksMain()`)).toLowerCase()
  catat(
    'halaman progres tema tampil dengan ambang dan remedial',
    progres.includes('progres tema') && progres.includes('latihan remedial') && progres.includes('paham ≥'),
    progres.slice(0, 90),
  )

  await buka('/badge')
  const badge = await evalJs(`__alat.teksMain()`)
  catat(
    'halaman lencana tampil per mapel',
    badge.includes('Lencana Saya') && badge.includes('nilai asli'),
    badge.slice(0, 90),
  )

  const progresApi = await apiJson('/v1/progres/saya')
  const tema = progresApi.isi?.tema ?? []
  const remedial = progresApi.isi?.remedial ?? {}
  catat(
    'API progres: tema berlabel tingkat dan remedial aktif tanpa kunci',
    tema.length > 0 &&
      typeof tema[0].tingkat === 'string' &&
      remedial.diaktifkan === true &&
      !JSON.stringify(remedial.soal ?? []).toLowerCase().includes('kunci'),
    `tema ${tema.length} · soal remedial ${(remedial.soal ?? []).length}`,
  )

  // ---------- 4. Guru menyalakan ranking ----------
  await apiJson('/v1/auth/keluar', 'POST')
  await buka('/masuk')
  await masuk(AKUN_GURU)
  const rankingNyala = await atur('ranking', true)
  catat('guru menyalakan ranking', rankingNyala.isi?.pengaturan?.ranking?.nilai === true)

  // Skor asli tidak berubah walau ada retry berskor lebih tinggi.
  const laporan = await apiJson(`/v1/kuis/${kuis.id}/laporan`)
  const barisMurid = (laporan.isi?.murid ?? []).find((m) => m.murid_id === muridId)
  const peringkatApi = await apiJson(`/v1/kuis/${kuis.id}/ranking?top=5`)
  const barisAsli = (peringkatApi.isi?.peringkat ?? []).find((p) => p.murid_id === muridId)
  const attemptRetryDiPeringkat = (peringkatApi.isi?.peringkat ?? []).some((p) => p.attempt_id === attempt.id)
  catat(
    'ranking memakai attempt asli, bukan attempt ulang',
    peringkatApi.isi?.tampil === true &&
      barisAsli !== undefined &&
      barisAsli.attempt_id !== attempt.id &&
      attemptRetryDiPeringkat === false &&
      peringkatApi.isi?.peringkat_saya === null,
    `peringkat attempt ${barisAsli?.attempt_id} · retry attempt ${attempt.id} · skor asli ${barisAsli?.skor}`,
  )
  catat(
    'laporan per tema tersedia untuk guru dengan ambang pengaturan',
    laporan.status === 200 && laporan.isi?.ambang?.ambang_paham > 0 && barisMurid !== undefined,
    `ambang ${laporan.isi?.ambang?.ambang_paham}% · murid ${(laporan.isi?.murid ?? []).length}`,
  )

  await buka(`/kuis/${kuis.id}/laporan`)
  const halamanLaporan = await evalJs(`__alat.teksMain()`)
  catat(
    'halaman laporan tema tampil untuk guru',
    halamanLaporan.includes('Laporan Tema') && halamanLaporan.includes('hanya nilai asli'),
    halamanLaporan.slice(0, 90),
  )

  // ---------- 5. Murid melihat peringkat setelah saklar menyala ----------
  await apiJson('/v1/auth/keluar', 'POST')
  await buka('/masuk')
  await masuk(AKUN_MURID)

  await buka(`/peringkat/${kuis.id}`)
  const peringkatNyala = await evalJs(`__alat.teksMain()`)
  const barisSendiri = await evalJs(`__alat.hitung('tr.sorot-hangat')`)
  catat(
    'halaman peringkat menampilkan tabel dan menyorot baris murid',
    peringkatNyala.includes('Peringkat') &&
      peringkatNyala.includes('(kamu)') &&
      peringkatNyala.includes('nilai asli') &&
      barisSendiri === 1,
    `baris disorot ${barisSendiri}`,
  )

  await apiJson('/v1/auth/keluar', 'POST')
  ws.close()

  const gagal = hasil.filter((satu) => !satu.lolos)
  console.log('')
  console.log(`smoke slice 05: ${hasil.length - gagal.length}/${hasil.length} lulus`)
  process.exit(gagal.length === 0 ? 0 : 1)
}

main().catch((galat) => {
  console.error('smoke gagal:', galat.message)
  process.exit(1)
})
