// Smoke sistem LURING lewat browser sungguhan (Chrome DevTools Protocol):
// murid mengerjakan ulangan, lalu koneksinya diputus dari DEVTOOLS (bukan
// dimock di aplikasi) — jawaban harus tetap tersimpan di perangkat, riwayat
// jawaban lokal harus terbaca, jam perangkat yang dimundurkan tidak menambah
// waktu, soal masih bisa dibuka dari salinan perangkat, dan begitu koneksi
// kembali semuanya tersinkron ke server.
//
// Harness ini MANDIRI: ulangan dan soalnya dibuat di awal lalu dihapus lagi di
// akhir, jadi bisa dijalankan berulang kali tanpa bergantung sisa data uji.
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness guru
// memakai akun guru sungguhan (guru1@sekolah.test) — bukan akun admin seperti dulu.
// Jalur kepala sekolah diuji terpisah di `docs/smoke-ui-admin.mjs`.
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }

/** Kunci penyimpanan perangkat yang dipakai mode luring. */
const KUNCI_CADANGAN = 'ulangan-cadangan-jawaban-v1'
const KUNCI_RIWAYAT = 'ulangan-riwayat-jawaban-v1'
const KUNCI_SNAPSHOT = 'ulangan-snapshot-attempt-v1'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alat bantu di sisi halaman (disuntik ulang setiap dokumen baru). */
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
  kartuSoal() { return document.querySelector('section.kartu-ulangan') },
  tungguKartu(teks, batasMs) {
    return new Promise((selesai) => {
      const mulai = Date.now()
      const cek = () => {
        const isi = document.querySelector('section.kartu-ulangan')?.innerText ?? ''
        if (isi.includes(teks) || Date.now() - mulai > batasMs) return selesai(isi.includes(teks))
        setTimeout(cek, 100)
      }
      cek()
    })
  },
  async bukaSoal(teks) {
    if (await window.__alat.tungguKartu(teks, 600)) return true
    const semua = [...document.querySelectorAll('button[aria-label^="Soal "]')]
    const unik = [...new Map(semua.map((t) => [t.getAttribute('aria-label'), t])).values()]
    for (const tombol of unik) {
      tombol.click()
      if (await window.__alat.tungguKartu(teks, 500)) return true
    }
    return false
  },
  async pilihOpsi(teksSoal, nilaiOpsi) {
    if (!(await window.__alat.bukaSoal(teksSoal))) throw new Error('kartu soal tidak ada: ' + teksSoal)
    const input = window.__alat.kartuSoal()?.querySelector('input[value="' + nilaiOpsi + '"]')
    if (!input) throw new Error('opsi tidak ada: ' + nilaiOpsi)
    input.click()
    return true
  },
  /** Nilai opsi yang tercentang di kartu soal yang sedang terbuka. */
  opsiTercentang() { return window.__alat.kartuSoal()?.querySelector('input:checked')?.value ?? null },
  ada(teks) { return (document.querySelector('main')?.innerText ?? '').includes(teks) },
  teksMain() { return document.querySelector('main')?.innerText?.replace(/\\\\s+/g, ' ') ?? '' },
  timer() { return document.querySelector('[role="timer"]')?.textContent?.trim() ?? null },
  timerDetik() {
    const bagian = (window.__alat.timer() ?? '').split(':').map((n) => Number(n))
    if (bagian.some((n) => Number.isNaN(n))) return -1
    return bagian.reduce((total, n) => total * 60 + n, 0)
  },
  /** Panel riwayat jawaban: jumlah tercatat + jumlah yang menunggu terkirim. */
  riwayat() {
    const panel = document.querySelector('[data-riwayat]')
    if (!panel) return null
    return { jumlah: Number(panel.dataset.riwayat ?? -1), tertunda: Number(panel.dataset.tertunda ?? -1) }
  },
  bukaRiwayat() {
    const panel = document.querySelector('[data-riwayat]')
    if (panel) panel.open = true
    return panel?.innerText?.replace(/\\\\s+/g, ' ') ?? ''
  },
  /** Isi penyimpanan perangkat yang dipakai mode luring. */
  simpanan() {
    const baca = (kunci) => {
      try { return JSON.parse(localStorage.getItem(kunci) ?? 'null')?.state ?? null } catch { return null }
    }
    return { cadangan: baca(${JSON.stringify(KUNCI_CADANGAN)}), riwayat: baca(${JSON.stringify(KUNCI_RIWAYAT)}) }
  },
  snapshot() {
    try { return JSON.parse(localStorage.getItem(${JSON.stringify(KUNCI_SNAPSHOT)}) ?? 'null') } catch { return null }
  },
  /** Navigasi DALAM aplikasi (tanpa memuat ulang berkas dari Vite). */
  pindahDalam(jalur, teksTunggu, batasMs) {
    window.history.pushState({}, '', jalur)
    window.dispatchEvent(new PopStateEvent('popstate'))
    const mulai = Date.now()
    return new Promise((selesai) => {
      const cek = () => {
        const isi = document.querySelector('main')?.innerText ?? ''
        if (isi.includes(teksTunggu) || Date.now() - mulai > batasMs) return selesai(isi.includes(teksTunggu))
        setTimeout(cek, 150)
      }
      cek()
    })
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

/** Soal uji yang dibuat harness ini (kunci diketahui pasti). */
const SOAL_UJI = [
  {
    teks: 'SMOKE-LURING: berapa hasil dari 6 + 7?',
    opsi: [
      { id: 'A', teks: '12' },
      { id: 'B', teks: '13' },
      { id: 'C', teks: '14' },
    ],
    kunci: 'B',
    skor: 5,
  },
  {
    teks: 'SMOKE-LURING: berapa hasil dari 9 + 4?',
    opsi: [
      { id: 'A', teks: '12' },
      { id: 'B', teks: '13' },
      { id: 'C', teks: '14' },
    ],
    kunci: 'B',
    skor: 5,
  },
]

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
  await send('Network.enable', {}, sessionId)
  await send('Page.addScriptToEvaluateOnNewDocument', { source: ALAT }, sessionId)
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.confirm = () => true' }, sessionId)

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)
    if (r.exceptionDetails) {
      throw new Error('eval error: ' + (r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)))
    }
    return r.result.value
  }

  /** Putus/sambung kembali jaringan dari DevTools (bukan mock di aplikasi). */
  const setLuring = async (luring) => {
    await send(
      'Network.emulateNetworkConditions',
      {
        offline: luring,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
        connectionType: luring ? 'none' : 'wifi',
      },
      sessionId,
    )
    await sleep(500)
  }

  const buka = async (jalur) => {
    await send('Page.navigate', { url: APP + jalur }, sessionId)
    await sleep(3200)
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
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
      const res = await fetch('/api${jalur}', {
        method: '${metode}',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: ${muatan === null ? 'null' : `JSON.stringify(${JSON.stringify(muatan)})`},
      })
      return { status: res.status, isi: await res.json().catch(() => null) }
    })()`)

  const mulai = new Date(Date.now() - 60_000).toISOString()
  const selesai = new Date(Date.now() + 3_600_000).toISOString()

  /** @type {number[]} */ const idSoalUji = []
  let idKuisUji = 0

  const bersihkan = async () => {
    if (idKuisUji === 0 && idSoalUji.length === 0) return { status: 0, sisa: '(tidak ada yang dibuat)' }

    await setLuring(false)
    await apiJson('/v1/auth/keluar', 'POST')
    await masuk(AKUN_GURU)

    let status = 0
    if (idKuisUji > 0) status = (await apiJson(`/v1/kuis/${idKuisUji}`, 'DELETE')).status
    for (const idSoal of idSoalUji) {
      const hapus = await apiJson(`/v1/soal/${idSoal}`, 'DELETE')
      if (hapus.status !== 200) status = hapus.status
    }

    return { status, sisa: `kuis ${idKuisUji} · soal ${idSoalUji.join(',')}` }
  }

  // ---------- 1. Guru menyiapkan ulangan ----------
  await buka('/masuk')
  const masukGuru = await masuk(AKUN_GURU)
  catat('login guru lewat API', masukGuru.status === 200, `status ${masukGuru.status}`)

  const daftarMurid = await apiJson('/v1/murid?per_page=100')
  const muridUji = (daftarMurid.isi?.data ?? []).find((satu) => satu.email === AKUN_MURID.email)
  const daftarMapel = await apiJson('/v1/mapel')
  const mapelId = (daftarMapel.isi ?? []).find((satu) => satu.nama === 'Matematika')?.id
  if (!muridUji || !mapelId) throw new Error('murid uji atau mapel Matematika tidak ada di DB dev — jalankan seeder')

  for (const satu of SOAL_UJI) {
    const dibuat = await apiJson('/v1/soal', 'POST', {
      subject_id: mapelId,
      tipe: 'pilihan_ganda',
      konten: { teks: satu.teks, opsi: satu.opsi },
      kunci: { jawaban: satu.kunci },
      skor: satu.skor,
      aktif: true,
    })
    if (dibuat.status !== 201) throw new Error(`gagal membuat soal uji: ${dibuat.status}`)
    idSoalUji.push(dibuat.isi.id)
  }

  try {
    const buatKuis = await apiJson('/v1/kuis', 'POST', {
      judul: 'SMOKE-LURING Ulangan Mode Luring',
      deskripsi: 'Ulangan sementara untuk smoke sistem luring.',
      subject_id: mapelId,
      class_id: muridUji.class_id,
      durasi_menit: 20,
      mulai_at: mulai,
      selesai_at: selesai,
      acak_soal: false,
      acak_opsi: false,
    })
    if (buatKuis.status !== 201) throw new Error(`gagal membuat kuis uji: ${buatKuis.status}`)
    idKuisUji = buatKuis.isi.id

    await apiJson(`/v1/kuis/${idKuisUji}/soal`, 'PUT', { soal: idSoalUji })
    const terbit = await apiJson(`/v1/kuis/${idKuisUji}/publikasi`, 'POST')
    catat('guru menyiapkan ulangan uji (2 soal, terbit)', terbit.status === 200, `kuis ${idKuisUji}`)

    // ---------- 2. Murid mengerjakan sambil DARING ----------
    await apiJson('/v1/auth/keluar', 'POST')
    await buka('/masuk')
    const masukMurid = await masuk(AKUN_MURID)
    catat('login murid lewat API', masukMurid.status === 200, `status ${masukMurid.status}`)

    await buka(`/kerjakan/${idKuisUji}`)
    const kosong = await evalJs(`__alat.riwayat()`)
    catat('layar pengerjaan terbuka dengan panel riwayat kosong', kosong !== null && kosong.jumlah === 0, JSON.stringify(kosong))

    const mulaiApi = await apiJson(`/v1/kuis/${idKuisUji}/mulai`, 'POST')
    const attempt = mulaiApi.isi
    const soalSatu = (attempt.soal ?? []).find((s) => s.konten?.teks === SOAL_UJI[0].teks)
    const soalDua = (attempt.soal ?? []).find((s) => s.konten?.teks === SOAL_UJI[1].teks)
    if (!soalSatu || !soalDua) throw new Error('soal uji tidak ada di attempt')
    catat('attempt memuat dua soal uji', attempt.jumlah_soal === 2, `attempt ${attempt.id}`)

    // Jawab soal 1 saat daring: harus sampai ke server DAN tercatat di riwayat.
    await evalJs(`__alat.pilihOpsi(${JSON.stringify(SOAL_UJI[0].teks)}, ${JSON.stringify(SOAL_UJI[0].kunci)})`)
    await sleep(2600)

    const daring = await apiJson(`/v1/attempt/${attempt.id}`)
    const tersimpanDaring = (daring.isi?.jawaban ?? []).find((j) => j.question_id === soalSatu.id)
    const riwayatDaring = await evalJs(`__alat.bukaRiwayat()`)
    catat(
      'jawaban daring tersimpan di server + riwayat menandainya terkirim',
      tersimpanDaring?.jawaban === SOAL_UJI[0].kunci && riwayatDariTeks(riwayatDaring),
      `jawaban ${JSON.stringify(tersimpanDaring?.jawaban)}`,
    )

    // ---------- 3. Server tidak terjangkau, tetapi internet "hidup" ----------
    // Jalur manual: wifi tersambung (`navigator.onLine` true) tetapi server kuis
    // tidak bisa dihubungi. Salinan perangkat tidak boleh dipakai otomatis
    // (penolakan 4xx juga lewat jalur ini), jadi murid yang memutuskan.
    const tanyaSalinan = await evalJs(
      `(async () => {
        const res = await fetch('/api/v1/kuis/${idKuisUji}/mulai', { method: 'POST', headers: { Accept: 'application/json' } })
        return res.status
      })().catch(() => 'gagal')`,
    )
    await send('Network.setBlockedURLs', { urls: ['*/api/v1/kuis/*/mulai'] }, sessionId)

    // Muat ulang penuh (bukan navigasi dalam aplikasi) supaya cache TanStack
    // Query ikut kosong dan layar benar-benar masuk ke keadaan galat.
    await buka(`/kerjakan/${idKuisUji}`)
    const galatServer = await evalJs(
      `({ galat: __alat.ada('Tidak bisa menghubungi server'), tombol: __alat.ada('Lanjutkan dari salinan di perangkat') })`,
    )
    catat(
      'server tak terjangkau (bukan luring) → layar galat menawarkan salinan perangkat',
      galatServer.galat === true && galatServer.tombol === true,
      `status pertama ${tanyaSalinan} · ${JSON.stringify(galatServer)}`,
    )

    await evalJs(`__alat.klikTeks('Lanjutkan dari salinan di perangkat')`)
    await sleep(1600)
    const lanjutSalinan = await evalJs(
      `({ banner: __alat.ada('Melanjutkan dari salinan di perangkat'), timer: __alat.timerDetik(), riwayat: __alat.riwayat() })`,
    )
    catat(
      'tombol "Lanjutkan dari salinan" membuka ulangan dari perangkat',
      lanjutSalinan.banner === true && lanjutSalinan.timer > 0,
      `timer ${lanjutSalinan.timer} dtk · riwayat ${JSON.stringify(lanjutSalinan.riwayat)}`,
    )

    await send('Network.setBlockedURLs', { urls: [] }, sessionId)
    await sleep(500)

    // ---------- 4. Koneksi diputus dari DevTools ----------
    await setLuring(true)
    const luring = await evalJs(
      `({ online: navigator.onLine, banner: __alat.ada('Koneksi putus'), boleh: document.querySelectorAll('[data-riwayat]').length })`,
    )
    catat(
      'koneksi putus terbaca sebagai mode luring',
      luring.online === false && luring.banner === true,
      `navigator.onLine ${luring.online}`,
    )

    // Jawab soal 2 saat LURING: harus masuk cadangan + riwayat, tanpa hilang.
    await evalJs(`__alat.pilihOpsi(${JSON.stringify(SOAL_UJI[1].teks)}, ${JSON.stringify(SOAL_UJI[1].kunci)})`)
    await sleep(3000)

    const simpanan = await evalJs(`__alat.simpanan()`)
    const tertunda = simpanan.cadangan?.perAttempt?.[String(attempt.id)]?.belumTerkirim?.[String(soalDua.id)]
    const entriLuring = simpanan.riwayat?.perAttempt?.[String(attempt.id)]?.entri ?? []
    const riwayatLuring = await evalJs(`__alat.riwayat()`)
    catat(
      'jawaban luring tersimpan di perangkat (belum terkirim)',
      tertunda === SOAL_UJI[1].kunci && riwayatLuring?.tertunda === 1,
      `belumTerkirim ${JSON.stringify(tertunda)} · menunggu ${riwayatLuring?.tertunda}`,
    )
    catat(
      'riwayat mencatat kedua jawaban dengan status berbeda',
      entriLuring.length === 2 &&
        entriLuring.some((satu) => satu.soal_id === soalSatu.id && satu.status === 'terkirim') &&
        entriLuring.some((satu) => satu.soal_id === soalDua.id && satu.status === 'lokal'),
      entriLuring.map((satu) => `${satu.nomor}:${satu.status}`).join(' '),
    )
    const teksRiwayat = await evalJs(`__alat.bukaRiwayat()`)
    catat(
      'riwayat di layar menyebut "di perangkat ini" + "menunggu terkirim"',
      teksRiwayat.includes('di perangkat ini') && teksRiwayat.includes('1 menunggu terkirim'),
      teksRiwayat.slice(0, 120),
    )

    // ---------- 5. Masih luring: soal bisa dibuka lagi dari salinan perangkat ----------
    const salinanAda = await evalJs(`__alat.snapshot() !== null`)
    const balik = await evalJs(
      `__alat.pindahDalam('/kuis', 'Ulangan Saya', 4000).then(() => window.__alat.pindahDalam('/kerjakan/${idKuisUji}', 'Koneksi putus', 10_000))`,
    )
    // Beri waktu query attempt menyerah ke server dan beralih ke salinan.
    await sleep(2500)
    const dariSalinan = await evalJs(
      `({ banner: __alat.ada('Melanjutkan dari salinan di perangkat'), timer: __alat.timerDetik(),
          riwayat: __alat.riwayat(), teks: __alat.teksMain().slice(0, 150) })`,
    )
    const opsiTersimpan = await evalJs(
      `__alat.bukaSoal(${JSON.stringify(SOAL_UJI[1].teks)}).then(() => __alat.opsiTercentang())`,
    )
    catat(
      'soal masih terbuka dari salinan perangkat saat luring',
      salinanAda === true && balik === true && dariSalinan.banner === true && dariSalinan.timer > 0,
      `salinan ${salinanAda} · balik ${balik} · banner ${dariSalinan.banner} · timer ${dariSalinan.timer} dtk · ${dariSalinan.teks}`,
    )
    catat(
      'jawaban yang diketik saat luring tetap tampil setelah kembali ke soal',
      opsiTersimpan === SOAL_UJI[1].kunci,
      `tercentang ${JSON.stringify(opsiTersimpan)}`,
    )

    // ---------- 6. Jam perangkat dimundurkan 1 jam (masih luring) ----------
    const timerSebelum = await evalJs(`__alat.timerDetik()`)
    await evalJs(`window.__jamAsli = Date.now; Date.now = () => window.__jamAsli() - 3_600_000; true`)
    await sleep(2600)
    const setelahGeser = await evalJs(
      `({ timer: __alat.timerDetik(), banner: __alat.ada('Jam perangkat berubah') })`,
    )
    await evalJs(`Date.now = window.__jamAsli; true`)
    await sleep(1200)
    const sesudahPulih = await evalJs(`__alat.timerDetik()`)
    catat(
      'jam perangkat dimundurkan 1 jam tidak menambah sisa waktu',
      timerSebelum > 0 &&
        setelahGeser.timer <= timerSebelum &&
        timerSebelum - setelahGeser.timer <= 5 &&
        setelahGeser.banner === true,
      `${timerSebelum} → ${setelahGeser.timer} dtk`,
    )
    catat(
      'sisa waktu kembali normal setelah jam dipulihkan',
      sesudahPulih <= setelahGeser.timer && setelahGeser.timer - sesudahPulih <= 4,
      `${setelahGeser.timer} → ${sesudahPulih} dtk`,
    )

    // ---------- 7. Koneksi kembali: antrean diborong ke server ----------
    await setLuring(false)
    await sleep(4500)

    const sinkron = await apiJson(`/v1/attempt/${attempt.id}`)
    const tersimpanLuring = (sinkron.isi?.jawaban ?? []).find((j) => j.question_id === soalDua.id)
    const simpananSesudah = await evalJs(`__alat.simpanan()`)
    const sisaAntrean = simpananSesudah.cadangan?.perAttempt?.[String(attempt.id)]?.belumTerkirim ?? {}
    const riwayatSesudah = simpananSesudah.riwayat?.perAttempt?.[String(attempt.id)]?.entri ?? []
    catat(
      'jawaban luring terkirim ke server begitu koneksi kembali',
      tersimpanLuring?.jawaban === SOAL_UJI[1].kunci && Object.keys(sisaAntrean).length === 0,
      `jawaban ${JSON.stringify(tersimpanLuring?.jawaban)} · sisa antrean ${Object.keys(sisaAntrean).length}`,
    )
    catat(
      'riwayat menandai semua jawaban terkirim + banner luring hilang',
      riwayatSesudah.length === 2 &&
        riwayatSesudah.every((satu) => satu.status === 'terkirim') &&
        (await evalJs(`!__alat.ada('Koneksi putus')`)) === true,
      riwayatSesudah.map((satu) => satu.status).join(','),
    )

    // ---------- 8. Kumpulkan: riwayat & salinan perangkat hilang ----------
    await evalJs(`__alat.klikTeks('Selesai')`)
    await sleep(600)
    await evalJs(`__alat.klikTeks('Kumpulkan')`)
    await sleep(3500)

    const jalurHasil = await evalJs(`location.pathname`)
    const bersih = await evalJs(
      `({ riwayat: __alat.simpanan().riwayat?.perAttempt?.[${JSON.stringify(String(attempt.id))}] ?? null,
          snapshot: __alat.snapshot() })`,
    )
    catat(
      'setelah dikumpulkan, murid diarahkan ke hasil',
      /^\/hasil\/\d+$/.test(jalurHasil),
      jalurHasil,
    )
    catat(
      'riwayat jawaban + salinan soal hilang dari perangkat setelah submit',
      bersih.riwayat === null && bersih.snapshot === null,
      `riwayat ${JSON.stringify(bersih.riwayat)} · snapshot ${bersih.snapshot === null ? 'kosong' : 'masih ada'}`,
    )

    const hasilApi = await apiJson(`/v1/attempt/${attempt.id}/hasil`)
    catat(
      'server menilai kedua jawaban (5 + 5)',
      hasilApi.isi?.skor === 10 && hasilApi.isi?.jumlah_benar === 2,
      `skor ${hasilApi.isi?.skor}/${hasilApi.isi?.skor_maksimal} · benar ${hasilApi.isi?.jumlah_benar}`,
    )
  } finally {
    const beres = await bersihkan()
    catat('ulangan & soal uji dihapus lagi (DB dev tidak menumpuk)', beres.status === 200, beres.sisa)
  }

  await send('Target.closeTarget', { targetId })
  ws.close()

  const gagal = hasil.filter((satu) => !satu.lolos)
  console.log('')
  console.log(`smoke luring: ${hasil.length - gagal.length}/${hasil.length} lulus`)
  process.exit(gagal.length === 0 ? 0 : 1)
}

/** Apakah teks panel riwayat menyebut jawaban terkirim ke server. */
function riwayatDariTeks(teks) {
  return typeof teks === 'string' && teks.includes('tersimpan di server')
}

main().catch((galat) => {
  console.error('smoke gagal:', galat.message)
  process.exit(1)
})
