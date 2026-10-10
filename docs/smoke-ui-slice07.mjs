// Smoke slice 07 lewat browser sungguhan (Chrome DevTools Protocol):
// guru menyalakan proteksi lewat pengaturan tiga lapis → murid melihat
// pemberitahuannya → percobaan menempel jawaban tercatat → guru memantau
// presence di Live Monitor dan meninjau catatannya → aliran SSE dari service
// Node dipakai sekali saja.
//
// Harness ini MANDIRI: ulangan + soal ujinya dibuat di awal (kelas murid uji
// sendiri) dan dihapus di akhir, begitu pula saklar proteksinya dimatikan dan
// baris pengaturannya dibersihkan — jadi tidak ada kuis milik guru lain yang
// diubah, dan bisa dijalankan berulang.
//
// Prasyarat: backend 8000, vite 5173, realtime 4000, dan Chrome
// --remote-debugging-port=9333.
const CDP = 'http://127.0.0.1:9333'
const REALTIME = 'http://127.0.0.1:4000'
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
  barisMonitor() {
    return [...document.querySelectorAll('tbody tr')].map((tr) => tr.innerText.split('\\n').join(' ').trim())
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

  const masukSekali = async (akun) =>
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

  const masuk = async (akun) => {
    let hasilMasuk = await masukSekali(akun)

    for (let coba = 0; coba < 3 && hasilMasuk.status === 429; coba++) {
      console.log('   (batas masuk per menit tercapai, menunggu 20 detik…)')
      await sleep(20_000)
      hasilMasuk = await masukSekali(akun)
    }

    return hasilMasuk
  }

  const apiJson = async (jalur, metode = 'GET', muatan = null) =>
    evalJs(`(async () => {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '')
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

  const mulai = new Date(Date.now() - 60_000).toISOString()
  const selesai = new Date(Date.now() + 45 * 60_000).toISOString()

  let idKuisUji = 0
  /** @type {number[]} */ const idSoalUji = []

  /** Matikan saklar proteksi + hapus data uji (saat lulus maupun saat gagal). */
  const bersihkan = async () => {
    await keluar()
    await masuk(AKUN_GURU)

    if (idKuisUji > 0) {
      for (const kunci of ['anti_cheat', 'block_paste', 'block_tab_switch']) {
        await aturKuis(idKuisUji, kunci, false)
      }
    }

    let status = 0
    if (idKuisUji > 0) status = (await apiJson(`/v1/kuis/${idKuisUji}`, 'DELETE')).status
    for (const idSoal of idSoalUji) {
      const hapus = await apiJson(`/v1/soal/${idSoal}`, 'DELETE')
      if (hapus.status !== 200) status = hapus.status
    }

    return { status, sisa: `kuis ${idKuisUji} · soal ${idSoalUji.join(',')}` }
  }

  await buka('/')

  // --- 1. Guru menyiapkan ulangan uji ---
  const guruMasuk = await masuk(AKUN_GURU)
  catat('guru masuk', guruMasuk.status === 200, guruMasuk.email ?? '')

  const daftarMurid = await apiJson('/v1/murid?per_page=100')
  const semuaMurid = Array.isArray(daftarMurid.isi) ? daftarMurid.isi : (daftarMurid.isi?.data ?? [])
  const muridUji = semuaMurid.find((satu) => satu.email === AKUN_MURID.email)
  const kelasId = muridUji?.class_id ?? null
  catat('murid uji ada di kelas yang diketahui', kelasId !== null, `kelas ${kelasId} · ${muridUji?.kelas_nama ?? '—'}`)
  if (kelasId === null) throw new Error('murid uji tidak ada di DB dev — jalankan seeder')

  const daftarMapel = await apiJson('/v1/mapel')
  const mapelId = (daftarMapel.isi ?? []).find((satu) => satu.nama === 'Matematika')?.id
  if (!mapelId) throw new Error('mapel Matematika tidak ada di DB dev')

  const buatSoal = await apiJson('/v1/soal', 'POST', {
    subject_id: mapelId,
    tipe: 'pilihan_ganda',
    konten: {
      teks: 'SMOKE-07: berapa hasil dari 3 + 4?',
      opsi: [
        { id: 'A', teks: '6' },
        { id: 'B', teks: '7' },
        { id: 'C', teks: '8' },
      ],
    },
    kunci: { jawaban: 'B' },
    skor: 5,
    aktif: true,
  })
  if (buatSoal.status !== 201) throw new Error(`gagal membuat soal uji: ${buatSoal.status}`)
  idSoalUji.push(buatSoal.isi.id)

  try {
    const buatKuis = await apiJson('/v1/kuis', 'POST', {
      judul: 'SMOKE-07 Ulangan Pengaman',
      deskripsi: 'Ulangan sementara untuk smoke proteksi, presence, dan Live Monitor.',
      subject_id: mapelId,
      class_id: kelasId,
      durasi_menit: 30,
      mulai_at: mulai,
      selesai_at: selesai,
      acak_soal: false,
      acak_opsi: false,
    })
    if (buatKuis.status !== 201) throw new Error(`gagal membuat kuis uji: ${buatKuis.status}`)
    idKuisUji = buatKuis.isi.id

    const susun = await apiJson(`/v1/kuis/${idKuisUji}/soal`, 'PUT', { soal: idSoalUji })
    const terbit = await apiJson(`/v1/kuis/${idKuisUji}/publikasi`, 'POST')
    catat(
      'guru menyiapkan ulangan uji yang sedang berjalan',
      susun.status === 200 && terbit.status === 200 && terbit.isi?.sedang_berjalan === true,
      `kuis ${idKuisUji} · soal ${buatSoal.isi.id}`,
    )

    for (const kunci of ['anti_cheat', 'block_paste', 'block_tab_switch']) {
      await aturKuis(idKuisUji, kunci, true)
    }
    const pengaturanKuis = await apiJson(`/v1/pengaturan?kuis_id=${idKuisUji}`)
    catat(
      'guru menyalakan proteksi lewat pengaturan tiga lapis (lapis kuis)',
      pengaturanKuis.isi?.pengaturan?.anti_cheat?.nilai === true &&
        pengaturanKuis.isi?.pengaturan?.anti_cheat?.sumber === 'kuis' &&
        pengaturanKuis.isi?.pengaturan?.block_paste?.nilai === true,
      `sumber ${pengaturanKuis.isi?.pengaturan?.anti_cheat?.sumber}`,
    )

    // --- 2. Murid mengerjakan: pemberitahuan proteksi harus muncul ---
    await keluar()
    await buka('/')
    const muridMasuk = await masuk(AKUN_MURID)
    catat('murid masuk', muridMasuk.status === 200, muridMasuk.email ?? '')

    // Kontrak server diperiksa dulu supaya kegagalan di UI bisa dibedakan dari
    // payload yang salah.
    const mulaiApi = await apiJson(`/v1/kuis/${idKuisUji}/mulai`, 'POST')
    catat(
      'server mengirim saklar proteksi ke klien',
      mulaiApi.status === 201 && mulaiApi.isi?.proteksi?.block_paste === true,
      `status ${mulaiApi.status} · proteksi ${JSON.stringify(mulaiApi.isi?.proteksi ?? null)}`,
    )

    await buka(`/kerjakan/${idKuisUji}`)
    const adaModal = await tunggu(`window.__alat.ada('memakai pengaman')`)
    catat('murid melihat pemberitahuan proteksi aktif (bukan gerbang)', adaModal)

    if (adaModal) {
      await evalJs(`window.__alat.klik('Saya mengerti')`)
      await sleep(600)
    }

    const lanjutBisaDikerjakan = await evalJs(
      `window.__alat.hitung('section.kartu-ulangan input[type="radio"]') > 0 && window.__alat.ada('Sisa waktu')`,
    )
    catat('ulangan tetap bisa dikerjakan setelah pemberitahuan ditutup', lanjutBisaDikerjakan === true)

    // --- 3. Percobaan menempel jawaban dicatat (pagar + sensor) ---
    await evalJs(`window.__alat.tempel()`)
    await sleep(4000)

    await keluar()
    await buka('/')
    await masuk(AKUN_GURU)

    const kejadianAwal = await apiJson(`/v1/kuis/${idKuisUji}/kejadian`)
    const adaTempel = (kejadianAwal.isi ?? []).some((satu) => satu.kategori === 'paste_attempt')
    catat(
      'percobaan menempel jawaban tercatat di server',
      Array.isArray(kejadianAwal.isi) && adaTempel,
      `${(kejadianAwal.isi ?? []).length} catatan`,
    )

    // --- 4. Live Monitor guru: presence + progres + catatan ---
    await buka(`/kuis/${idKuisUji}/monitor`)
    const adaMonitor = await tunggu(`window.__alat.ada('Live Monitor') && window.__alat.hitung('tbody tr') > 0`)
    catat('halaman Live Monitor tampil dengan baris murid', adaMonitor)

    const baris = await evalJs(`window.__alat.barisMonitor()`)
    const adaHadir = (baris ?? []).some((teks) => teks.includes('Hadir'))
    catat('kehadiran murid terbaca dari aktivitas normal (tanpa heartbeat)', adaHadir, (baris ?? [])[0] ?? '')

    // Panel dimuat dari permintaan kedua, jadi ditunggu (bukan sekali baca).
    const adaPanelKecurangan = await tunggu(
      `window.__alat.ada('Catatan untuk ditinjau') && window.__alat.ada('Percobaan menempel jawaban')`,
    )
    catat('panel catatan menampilkan kejadian menempel', adaPanelKecurangan === true)

    const adaTombolTinjau = await evalJs(
      `[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Tidak valid'))`,
    )
    catat('tombol tinjauan tersedia untuk guru', adaTombolTinjau === true)

    // --- 4b. Aliran SSE dari service Node (tiket sekali pakai) ---
    const tiket = await apiJson(`/v1/kuis/${idKuisUji}/sse-tiket`, 'POST')
    catat(
      'guru mendapat tiket SSE berumur pendek',
      tiket.status === 201 && typeof tiket.isi?.tiket === 'string' && tiket.isi?.ttl_detik === 45,
      `ttl ${tiket.isi?.ttl_detik}`,
    )

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
      aliran.status === 200 && potongan.includes('event: siap') && potongan.includes(`"quiz_id":${idKuisUji}`),
      `status ${aliran.status}`,
    )
    catat('header anti-buffer nginx dipasang', aliran.headers.get('x-accel-buffering') === 'no')

    const tiketUlang = await fetch(`${REALTIME}/sse/monitor?tiket=${encodeURIComponent(tiket.isi?.tiket ?? '')}`)
    catat('tiket SSE tidak bisa dipakai dua kali', tiketUlang.status === 401, `status ${tiketUlang.status}`)

    // --- 5. Tinjauan guru lewat DOM sungguhan ---
    const catatanMenunggu = (kejadianAwal.isi ?? []).find((satu) => satu.review_status === 'menunggu')

    if (catatanMenunggu) {
      await evalJs(`window.__alat.klik('Tidak valid')`)
      const berubah = await tunggu(`window.__alat.ada('Tidak valid')`)

      const setelah = await apiJson(`/v1/kuis/${idKuisUji}/kejadian?status=tidak_valid`)
      const jadiTidakValid = (setelah.isi ?? []).some(
        (satu) => satu.id === catatanMenunggu.id && satu.review_status === 'tidak_valid',
      )

      catat('guru menandai catatan "tidak valid" lewat DOM', berubah && jadiTidakValid)

      const audit = await apiJson(`/v1/kuis/${idKuisUji}/kejadian?status=menunggu`)
      catat(
        'catatan yang ditinjau keluar dari antrean menunggu',
        (audit.isi ?? []).every((satu) => satu.id !== catatanMenunggu.id),
      )
    }
  } finally {
    // --- 6. Bersih-bersih: proteksi dimatikan, ulangan & soal dihapus ---
    const beres = await bersihkan()
    const sisaKuis = idKuisUji > 0 ? await apiJson(`/v1/kuis/${idKuisUji}`) : { status: 404 }
    catat(
      'proteksi dimatikan + ulangan & soal uji dihapus',
      beres.status === 200 && (sisaKuis.status === 404 || sisaKuis.status === 403),
      `${beres.sisa} · baca ulang kuis ${sisaKuis.status}`,
    )
  }

  await keluar()
  // Tab yang dibuat harness ini ditutup supaya target Chrome tidak menumpuk
  // saat smoke dijalankan berulang.
  await send('Target.closeTarget', { targetId })
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
