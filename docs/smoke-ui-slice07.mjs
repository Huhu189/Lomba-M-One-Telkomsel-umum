// Smoke slice 07 lewat browser sungguhan (Chrome DevTools Protocol):
// guru menyalakan proteksi lewat pengaturan tiga lapis → murid melihat
// pemberitahuannya → percobaan menempel jawaban tercatat → guru memantau
// presence di Live Monitor dan meninjau catatannya.
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
// Idempoten: kuis publikasi pertama dipakai ulang, dan pengaturan anti-cheat
// dikembalikan ke mati di akhir supaya data demo tidak tertinggal menyala.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alat bantu di sisi halaman (disuntik ulang setiap navigasi). */
const ALAT = `window.__alat = {
  ada(teks) { return (document.querySelector('main')?.innerText ?? '').includes(teks) },
  hitung(sel) { return document.querySelectorAll(sel).length },
  klik(teks) {
    const tombol = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(teks))
    if (!tombol) return false
    tombol.click()
    return true
  },
  tempel() {
    const peristiwa = new ClipboardEvent('paste', { bubbles: true, cancelable: true })
    return document.dispatchEvent(peristiwa)
  },
  barisMonitior() {
    return [...document.querySelectorAll('tbody tr')].map((tr) => tr.innerText.replace(/\\\\s+/g, ' ').trim())
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

  const tunggu = async (ekspresi, batas = 12000) => {
    const mulai = Date.now()
    while (Date.now() - mulai < batas) {
      if (await evalJs(ekspresi)) return true
      await sleep(400)
    }
    return false
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

  const keluar = () => apiJson('/v1/auth/keluar', 'POST')
  const aturKuis = (kuisId, kunci, nilai) =>
    apiJson('/v1/pengaturan', 'PUT', { lingkup: 'kuis', lingkup_id: kuisId, kunci, nilai })

  await buka('/')

  // --- 1. Guru menyalakan proteksi untuk satu kuis (lapis kuis) ---
  const guruMasuk = await masuk(AKUN_GURU)
  catat('guru masuk', guruMasuk.status === 200, guruMasuk.email ?? '')

  const daftarKuis = await apiJson('/v1/kuis')
  // Daftar kuis tidak dipaginasi dan API ini tanpa pembungkus "data".
  const semuaKuis = Array.isArray(daftarKuis.isi) ? daftarKuis.isi : (daftarKuis.isi?.data ?? [])

  // Kuis harus se-kelas dengan murid uji, kalau tidak `mulai` akan ditolak.
  const daftarMurid = await apiJson('/v1/murid')
  const semuaMurid = Array.isArray(daftarMurid.isi) ? daftarMurid.isi : (daftarMurid.isi?.data ?? [])
  const muridUji = semuaMurid.find((satu) => satu.email === AKUN_MURID.email)
  const kelasId = muridUji?.class_id ?? null

  catat('murid uji punya kelas', kelasId !== null, `kelas ${kelasId} · ${muridUji?.kelas_nama ?? '—'}`)

  const kandidat = semuaKuis.filter(
    (satu) => satu.class_id === kelasId && Number(satu.jumlah_soal ?? 0) > 0 && satu.status !== 'arsip',
  )
  const kuis =
    kandidat.find((satu) => satu.status === 'publikasi') ??
    kandidat.sort((a, b) => Number(b.jumlah_soal ?? 0) - Number(a.jumlah_soal ?? 0))[0]

  if (!kuis) {
    catat('ada kuis yang bisa dipakai', false, 'tidak ada kuis se-kelas dengan soal')
    await keluar()
    ws.close()
    process.exit(1)
  }

  catat('kuis uji ditemukan', Boolean(kuis.id), `${kuis.judul} (id ${kuis.id}, ${kuis.jumlah_soal} soal)`)

  // Kuis harus terbit supaya bisa dijalankan murid. Status awal diingat untuk
  // dikembalikan di akhir smoke (data demo tidak ditinggal berubah).
  const statusAwal = kuis.status

  if (statusAwal !== 'publikasi') {
    const terbit = await apiJson(`/v1/kuis/${kuis.id}/publikasi`, 'POST')
    catat('kuis uji diterbitkan sementara oleh smoke', terbit.status === 200, `status ${terbit.status}`)
  }

  // Jadwal kuis dari smoke pengujian lama sudah lewat; buka jendela baru supaya
  // murid benar-benar bisa mulai (dan ingat jadwal lamanya untuk dipulihkan).
  const jadwalAwal = { mulai_at: kuis.mulai_at ?? null, selesai_at: kuis.selesai_at ?? null }

  const simpanKuis = (tambahan) =>
    apiJson(`/v1/kuis/${kuis.id}`, 'PUT', {
      judul: kuis.judul,
      deskripsi: kuis.deskripsi ?? null,
      subject_id: kuis.subject_id,
      class_id: kuis.class_id,
      durasi_menit: kuis.durasi_menit ?? 30,
      acak_soal: kuis.acak_soal ?? false,
      acak_opsi: kuis.acak_opsi ?? false,
      ...tambahan,
    })

  const jadwalBaru = await simpanKuis({
    mulai_at: new Date(Date.now() - 60_000).toISOString(),
    selesai_at: new Date(Date.now() + 45 * 60_000).toISOString(),
  })

  catat('jadwal kuis dibuka sementara oleh smoke', jadwalBaru.status === 200, `status ${jadwalBaru.status}`)

  await aturKuis(kuis.id, 'anti_cheat', true)
  await aturKuis(kuis.id, 'block_paste', true)
  await aturKuis(kuis.id, 'block_tab_switch', true)

  // --- 2. Murid mengerjakan: pemberitahuan proteksi harus muncul ---
  await keluar()
  await buka('/')
  const muridMasuk = await masuk(AKUN_MURID)
  catat('murid masuk', muridMasuk.status === 200, muridMasuk.email ?? '')

  // Kontrak server diperiksa dulu supaya kegagalan di UI bisa dibedakan dari
  // payload yang salah.
  const mulai = await apiJson(`/v1/kuis/${kuis.id}/mulai`, 'POST')
  catat(
    'server mengirim saklar proteksi ke klien',
    mulai.status === 201 && mulai.isi?.proteksi?.block_paste === true,
    `status ${mulai.status} · proteksi ${JSON.stringify(mulai.isi?.proteksi ?? null)} · attempt ${mulai.isi?.status ?? '-'} · ${JSON.stringify(mulai.isi?.errors ?? mulai.isi?.message ?? null)}`,
  )

  await buka(`/kerjakan/${kuis.id}`)
  const adaModal = await tunggu(`window.__alat.ada('memakai pengaman')`)

  catat('murid melihat pemberitahuan proteksi aktif (bukan gerbang)', adaModal)

  if (adaModal) {
    await evalJs(`window.__alat.klik('Saya mengerti')`)
    await sleep(600)
  }

  const lanjutBisaDikerjakan = await evalJs(`window.__alat.ada('Kumpulkan jawaban')`)
  catat('ulangan tetap bisa dikerjakan setelah pemberitahuan ditutup', lanjutBisaDikerjakan === true)

  // --- 3. Percobaan menempel jawaban dicatat (pagar + sensor) ---
  await evalJs(`window.__alat.tempel()`)
  await sleep(4000)

  await keluar()
  await buka('/')
  await masuk(AKUN_GURU)

  const kejadianAwal = await apiJson(`/v1/kuis/${kuis.id}/kejadian`)
  const adaTempel = (kejadianAwal.isi ?? []).some((satu) => satu.kategori === 'paste_attempt')

  catat(
    'percobaan menempel jawaban tercatat di server',
    Array.isArray(kejadianAwal.isi) && adaTempel,
    `${(kejadianAwal.isi ?? []).length} catatan`,
  )

  // --- 4. Live Monitor guru: presence + progres + catatan ---
  await buka(`/kuis/${kuis.id}/monitor`)
  const adaMonitor = await tunggu(`window.__alat.ada('Live Monitor') && window.__alat.hitung('tbody tr') > 0`)

  catat('halaman Live Monitor tampil dengan baris murid', adaMonitor)

  const baris = await evalJs(`window.__alat.barisMonitior()`)
  const adaHadir = (baris ?? []).some((teks) => teks.includes('Hadir'))
  catat('kehadiran murid terbaca dari aktivitas normal (tanpa heartbeat)', adaHadir, (baris ?? [])[0] ?? '')

  // Panel dimuat dari permintaan kedua, jadi ditunggu (bukan sekali baca).
  const adaPanelKecurangan = await tunggu(
    `window.__alat.ada('Catatan kejadian') && window.__alat.ada('Percobaan menempel jawaban')`,
  )
  catat('panel catatan kejadian menampilkan kejadian menempel', adaPanelKecurangan === true)

  const adaSelesaikan = await evalJs(`window.__alat.hitung('button') > 0`)
  catat('tombol tinjauan tersedia untuk guru', adaSelesaikan === true)

  // --- 4b. Aliran SSE dari service Node (tiket sekali pakai) ---
  const tiket = await apiJson(`/v1/kuis/${kuis.id}/sse-tiket`, 'POST')
  catat(
    'guru mendapat tiket SSE berumur pendek',
    tiket.status === 201 && typeof tiket.isi?.tiket === 'string' && tiket.isi?.ttl_detik === 45,
    `ttl ${tiket.isi?.ttl_detik}`,
  )

  const REALTIME = 'http://127.0.0.1:4000'
  const pengawas = new AbortController()
  const aliran = await fetch(`${REALTIME}/sse/monitor?tiket=${encodeURIComponent(tiket.isi?.tiket ?? '')}`, {
    signal: pengawas.signal,
  })
  const pembaca = aliran.body.getReader()
  const { value } = await pembaca.read()
  const potongan = new TextDecoder().decode(value ?? new Uint8Array())
  pengawas.abort()

  catat(
    'aliran SSE menyambung dan mengirim peristiwa pembuka',
    aliran.status === 200 && potongan.includes('event: siap') && potongan.includes(`"quiz_id":${kuis.id}`),
    `status ${aliran.status}`,
  )
  catat('header anti-buffer nginx dipasang', aliran.headers.get('x-accel-buffering') === 'no')

  const tiketUlang = await fetch(
    `${REALTIME}/sse/monitor?tiket=${encodeURIComponent(tiket.isi?.tiket ?? '')}`,
  )
  catat('tiket SSE tidak bisa dipakai dua kali', tiketUlang.status === 401, `status ${tiketUlang.status}`)

  // --- 5. Tinjauan guru lewat DOM sungguhan ---
  const catatanMenunggu = (kejadianAwal.isi ?? []).find((satu) => satu.review_status === 'menunggu')

  if (catatanMenunggu) {
    await evalJs(`window.__alat.klik('Tidak valid')`)
    const berubah = await tunggu(`window.__alat.ada('Tidak valid')`)

    const setelah = await apiJson(`/v1/kuis/${kuis.id}/kejadian?status=tidak_valid`)
    const jadiTidakValid = (setelah.isi ?? []).some(
      (satu) => satu.id === catatanMenunggu.id && satu.review_status === 'tidak_valid',
    )

    catat('guru menandai catatan "tidak valid" lewat DOM', berubah && jadiTidakValid)

    const audit = await apiJson(`/v1/kuis/${kuis.id}/kejadian?status=menunggu`)
    catat(
      'catatan yang ditinjau keluar dari antrean menunggu',
      (audit.isi ?? []).every((satu) => satu.id !== catatanMenunggu.id),
    )
  }

  // --- 6. Kembalikan pengaturan demo ke kondisi aman (semua proteksi mati) ---
  await aturKuis(kuis.id, 'anti_cheat', false)
  await aturKuis(kuis.id, 'block_paste', false)
  await aturKuis(kuis.id, 'block_tab_switch', false)

  const pengaturanAkhir = await apiJson(`/v1/pengaturan?kuis_id=${kuis.id}`)
  const proteksiMati = pengaturanAkhir.isi?.pengaturan?.anti_cheat?.nilai === false
  catat('pengaturan anti-cheat kuis dikembalikan mati', proteksiMati)

  if (statusAwal !== 'publikasi') {
    // Kembalikan ke draf; bila tidak diizinkan, arsipkan supaya tidak menggantung
    // sebagai kuis terbit yang tidak diminta.
    const kembali = await apiJson(`/v1/kuis/${kuis.id}`, 'PUT', { status: 'draf' })

    if (kembali.status !== 200) {
      await apiJson(`/v1/kuis/${kuis.id}/arsip`, 'POST')
    }

    catat('status kuis uji dikembalikan tidak terbit', kembali.status === 200, `PUT status ${kembali.status}`)
  }

  const jadwalPulih = await simpanKuis(jadwalAwal)
  catat('jadwal kuis dipulihkan seperti semula', jadwalPulih.status === 200, `status ${jadwalPulih.status}`)


  await keluar()
  ws.close()

  const gagal = hasil.filter((satu) => !satu.lolos)
  console.log('')
  console.log(`smoke slice 07: ${hasil.length - gagal.length}/${hasil.length} lulus`)
  process.exit(gagal.length === 0 ? 0 : 1)
}

main().catch((galat) => {
  console.error('smoke gagal:', galat.message)
  process.exit(1)
})
