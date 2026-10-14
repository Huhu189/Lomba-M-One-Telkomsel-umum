// Audit UI kuis DI DALAM materi lewat browser sungguhan (Chrome DevTools Protocol).
//
// Yang diaudit adalah dua tempat kuis bertemu murid di halaman materi:
//   1. panel kuis sisipan di dalam bingkai video (`.pm-kuis`) — mode "jeda",
//      tata vertikal dan horizontal;
//   2. blok kuis yang berdiri sendiri sebagai satu bagian materi.
//
// Cacat yang diukur mesin, bukan selera: panel yang menumpuk/menutupi gambar
// video, panel yang jadi jendela gulir sempit (isinya lebih tinggi dari
// wadahnya) sehingga soal dan tombol kumpulkan tersembunyi, soal yang terpotong
// batas panel, tombol < 44 px, teks yang keluar dari panel, dan halaman yang
// bergeser mendatar.
//
// Panel kuis di sisi murid TIDAK boleh menutupi bingkai video: ia tampil di
// bawah video (tata vertikal, dan tata horizontal di layar < 1200 px) atau di
// sampingnya (tata horizontal di layar >= 1200 px).
//
// Harness ini MANDIRI: soal + kuis + materi ujinya dibuat di awal dan dihapus di
// blok `finally`, jadi bisa dijalankan berulang.
//
// Prasyarat: backend 8000, vite 5173, Chrome --remote-debugging-port=9333.
// Jalankan lewat `docs/jalankan-smoke-ui.sh kuis-materi` (nama harness: kuis-materi).
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness guru
// memakai akun guru sungguhan (guru1@sekolah.test) — bukan akun admin seperti dulu.
// Jalur kepala sekolah diuji terpisah di `docs/smoke-ui-admin.mjs`.
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }

/** Berkas video 5,4 MB yang sudah selesai diunggah di DB dev (mime video/mp4). */
const KODE_VIDEO = 'XZhNiQ6Q9FlH2IYEvN2dxS1IFnKYi36c'

/** Titik jatuh kuis sisipan di dalam klip video (detik). */
const DETIK_VERTIKAL = 15
const DETIK_HORIZONTAL = 30

const VIEWPORT = {
  hp: { width: 390, height: 844, mobile: true },
  laptop: { width: 1366, height: 900, mobile: false },
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Pengukur yang disuntik ke halaman: satu untuk ukuran halaman (selalu ada,
 * termasuk saat panel kuis belum terbuka) dan satu untuk panel kuisnya.
 */
const UKUR = `window.__ukurHalaman = function () {
  const lebar = document.documentElement.clientWidth
  const melampaui = []

  // Semua elemen yang ujung kanannya melewati layar — termasuk yang position-nya
  // fixed dan yang induknya memotong — sebab keduanya tetap ikut dihitung ke
  // dalam area gulir dokumen, dan itulah yang membuat halaman bergeser mendatar
  // di ponsel.
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') continue
    const r = el.getBoundingClientRect()
    if (r.width < 8 || r.right <= lebar + 1) continue
    let pemilikPotong = ''
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const o = getComputedStyle(n)
      if (o.overflowX !== 'visible' || o.overflow !== 'visible') {
        pemilikPotong = n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\\s+/)[0] : '')
        break
      }
    }
    melampaui.push({
      el: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''),
      pos: s.position,
      lewat: Math.round(r.right - lebar),
      lebar: Math.round(r.width),
      potong: pemilikPotong,
      teks: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 24),
    })
  }
  melampaui.sort((a, b) => b.lewat - a.lewat)

  const tombolKecil = []
  for (const el of document.querySelectorAll('main button, main input, main select, main textarea, main a')) {
    let r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue

    // Kotak centang / tombol radio 22 px BUKAN sasaran sentuh yang sebenarnya:
    // yang ditekan anak adalah labelnya (WCAG 2.5.8 menghitung label sebagai
    // bagian sasaran). Aturan yang sama dipakai audit-ui.mjs.
    if (el.type === 'checkbox' || el.type === 'radio') {
      const label = (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) || el.closest('label')
      if (label) {
        const rl = label.getBoundingClientRect()
        r = { width: Math.max(r.width, rl.width), height: Math.max(r.height, rl.height) }
      }
    }

    if (r.width < 43.5 || r.height < 43.5) {
      tombolKecil.push({ el: el.tagName.toLowerCase(), w: Math.round(r.width), h: Math.round(r.height) })
    }
  }

  const overflowHalaman =
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - lebar > 1
      ? Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - lebar
      : 0

  // Saat halaman bergeser mendatar, rincikan lebar bilah atas per anaknya:
  // dari situ kelihatan elemen mana yang mendorong halaman melebar (deret merek,
  // tombol preferensi, dan tombol hamburger yang tidak boleh menyusut).
  const kepala = []
  if (overflowHalaman > 0) {
    const baris = document.querySelector('.kepala-app-isi')
    if (baris) {
      kepala.push({ el: 'kepala-app-isi', w: Math.round(baris.getBoundingClientRect().width) })
      for (const anak of baris.children) {
        kepala.push({
          el: anak.tagName.toLowerCase() + (anak.className && typeof anak.className === 'string' && anak.className.trim() !== ''
            ? '.' + anak.className.trim().split(/\\s+/).slice(0, 2).join('.')
            : ''),
          w: Math.round(anak.getBoundingClientRect().width),
          teks: (anak.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 18),
        })
      }
    }
  }

  // Penjaga bunyi: media yang SEDANG diputar tidak boleh tanpa bisu. Klip uji di
  // halaman materi berisi audio drum sungguhan, dan runner memakai Chrome :9333
  // yang sudah hidup apa adanya — kalau Chrome itu dinyalakan tanpa
  // --mute-audio, klipnya bisa berbunyi keluar speaker saat smoke berjalan.
  const mediaBersuara = []
  for (const el of document.querySelectorAll('video, audio')) {
    if (el.paused || el.readyState === 0 || el.muted || el.volume === 0) continue
    mediaBersuara.push({
      el: el.tagName.toLowerCase(),
      berkas: (el.currentSrc || el.src || '').split('/').pop().slice(0, 16),
      detik: Math.round(el.currentTime),
    })
  }

  return {
    overflowHalaman,
    melampauiTepi: melampaui.slice(0, 5),
    kepalaBilaMeluber: kepala,
    mediaBersuara,
    tombolKecil: tombolKecil.slice(0, 8),
  }
};

window.__ukur = function () {
  const panel = document.querySelector('.pm-kuis')
  const bingkai = document.querySelector('.pm-bingkai')
  if (!panel || !bingkai) return null

  const rp = panel.getBoundingClientRect()
  const rb = bingkai.getBoundingClientRect()
  const kecil = []
  const keluar = []

  for (const el of panel.querySelectorAll('button, input, select, textarea, a')) {
    let r = el.getBoundingClientRect()

    if (el.type === 'checkbox' || el.type === 'radio') {
      const label = (el.id && panel.querySelector('label[for="' + CSS.escape(el.id) + '"]')) || el.closest('label')
      if (label) {
        const rl = label.getBoundingClientRect()
        r = { width: Math.max(r.width, rl.width), height: Math.max(r.height, rl.height) }
      }
    }

    if (r.width < 43.5 || r.height < 43.5) {
      kecil.push({
        el: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''),
        w: Math.round(r.width),
        h: Math.round(r.height),
        teks: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 24),
      })
    }
  }

  for (const el of panel.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width < 8) continue
    if (r.right - rp.right > 1) {
      keluar.push({
        el: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/)[0] : ''),
        lewat: Math.round(r.right - rp.right),
      })
    }
  }

  const tombolKirim = [...panel.querySelectorAll('button')].find((b) => (b.textContent || '').includes('kumpulkan'))
  const opsi = panel.querySelector('.opsi, fieldset, [role="radiogroup"]')
  const barisSoal = panel.querySelectorAll('strong')

  // Posisi panel terhadap BINGKAI VIDEO: kalimatnya harus "di bawah" atau
  // "di samping", bukan "menumpuk" — panel yang menutupi gambar itulah cacat
  // yang diukur harness ini.
  const tumpang =
    rp.left < rb.right - 1 && rp.right > rb.left + 1 && rp.top < rb.bottom - 1 && rp.bottom > rb.top + 1
  const posisi = tumpang
    ? 'tumpang'
    : rp.top >= rb.bottom - 1
      ? 'bawah'
      : rp.left >= rb.right - 1
        ? 'samping'
        : 'lain'

  // Soal yang ujung bawahnya lewat batas panel = soal yang tidak terbaca tanpa
  // menggulir panel. Idealnya 0: panel tumbuh setinggi isinya.
  let soalTerpotong = 0
  for (const el of barisSoal) {
    if (el.getBoundingClientRect().bottom > rp.bottom + 1) soalTerpotong += 1
  }

  return {
    tata: panel.className,
    posisi,
    tumpangBingkai: tumpang,
    bingkai: { w: Math.round(rb.width), h: Math.round(rb.height) },
    panel: { w: Math.round(rp.width), h: Math.round(rp.height) },
    panelDariBingkaiPersen: Number(((rp.height / rb.height) * 100).toFixed(1)),
    jumlahSoal: barisSoal.length,
    soalTerpotong,
    gulir: {
      clientH: panel.clientHeight,
      scrollH: panel.scrollHeight,
      perluGulir: panel.scrollHeight > panel.clientHeight + 2,
      bisaGulir: getComputedStyle(panel).overflowY,
    },
    jarakTombolKirim: tombolKirim ? Math.round(tombolKirim.getBoundingClientRect().top - rp.top) : null,
    terlihatTanpaGulir: tombolKirim ? tombolKirim.getBoundingClientRect().bottom <= rp.bottom + 1 : null,
    jumlahSoalTerlihat: barisSoal.length,
    opsiAda: opsi !== null,
    tombolKecil: kecil,
    keluarPanel: keluar.slice(0, 6),
    teksAwal: (panel.innerText || '').replace(/\\s+/g, ' ').slice(0, 90),
    ...window.__ukurHalaman(),
  }
}; 'siap'`

const hasil = []

function catat(nama, lolos, detail = '') {
  hasil.push({ nama, lolos })
  console.log(`${lolos ? 'LULUS' : 'GAGAL'} · ${nama}${detail ? ' · ' + detail : ''}`)
}

function info(nama, nilai) {
  console.log(`UKUR · ${nama} · ${typeof nilai === 'string' ? nilai : JSON.stringify(nilai)}`)
}

async function main() {
  const ws = new WebSocket(
    await fetch(`${CDP}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl),
  )
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
  await send('Page.addScriptToEvaluateOnNewDocument', { source: UKUR }, sessionId)

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)
    if (r.exceptionDetails) {
      throw new Error('eval error: ' + (r.exceptionDetails.exception?.description ?? ''))
    }
    return r.result.value
  }
  const ukur = async (lebar, tinggi, mobile) =>
    send('Emulation.setDeviceMetricsOverride', { width: lebar, height: tinggi, deviceScaleFactor: 1, mobile }, sessionId)
  const buka = async (jalur, tungguTeks = null) => {
    await send('Page.navigate', { url: APP + jalur }, sessionId)
    await sleep(2600)
    if (tungguTeks) {
      for (let i = 0; i < 15; i++) {
        if (await evalJs(`(document.body.innerText || '').includes(${JSON.stringify(tungguTeks)})`)) break
        await sleep(400)
      }
    }
  }
  const tunggu = async (ekspresi, batas = 20000) => {
    const mulai = Date.now()
    while (Date.now() - mulai < batas) {
      if (await evalJs(ekspresi)) return true
      await sleep(300)
    }
    return false
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
  const masuk = async (akun) => {
    let jawab = await apiJson('/v1/auth/masuk', 'POST', akun)
    for (let coba = 0; coba < 3 && jawab.status === 429; coba++) {
      console.log('   (batas masuk per menit tercapai, menunggu 20 detik…)')
      await sleep(20_000)
      jawab = await apiJson('/v1/auth/masuk', 'POST', akun)
    }
    return jawab
  }
  const keluar = async () => {
    await evalJs(`fetch('/api/v1/auth/keluar', { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } }).then(() => true)`)
    await sleep(300)
  }

  /** @type {number[]} */
  const idSoalUji = []
  let idKuisUji = 0
  let idMateri = 0

  const bersihkan = async () => {
    await keluar()
    await masuk(AKUN_GURU)
    const status = []
    if (idMateri > 0) status.push((await apiJson(`/v1/materi/${idMateri}`, 'DELETE')).status)
    if (idKuisUji > 0) status.push((await apiJson(`/v1/kuis/${idKuisUji}`, 'DELETE')).status)
    for (const soal of idSoalUji) status.push((await apiJson(`/v1/soal/${soal}`, 'DELETE')).status)
    await keluar()
    return { status: status.every((satu) => satu === 200) ? 200 : Math.min(...status), sisa: `materi ${idMateri} · kuis ${idKuisUji} · soal ${idSoalUji.length} → ${status.join(',')}` }
  }

  try {
    await buka('/')
    const guruMasuk = await masuk(AKUN_GURU)
    catat('guru masuk', guruMasuk.status === 200, guruMasuk.isi?.user?.email ?? '')
    if (guruMasuk.status !== 200) throw new Error('guru tidak bisa masuk')

    const semuaMurid = (await apiJson('/v1/murid?filter[cari]=smoke.murid')).isi
    const daftarMurid = Array.isArray(semuaMurid) ? semuaMurid : semuaMurid?.data ?? []
    // Cocokkan lewat EMAIL, bukan hasil pertama: pencarian juga menemukan murid
    // lain yang namanya mirip, dan materi uji harus masuk ke kelas murid yang
    // benar-benar dipakai login nanti.
    const muridUji = daftarMurid.find((satu) => satu.email === AKUN_MURID.email)
    const kelasId = muridUji?.class_id ?? null
    catat('murid uji punya kelas', kelasId !== null, `kelas ${kelasId} · ${muridUji?.nama ?? '—'}`)
    if (kelasId === null) throw new Error(`murid uji ${AKUN_MURID.email} tidak ada di DB dev`)

    const mapelId = (await apiJson('/v1/mapel')).isi.find((satu) => satu.nama === 'Matematika')?.id
    if (!mapelId) throw new Error('mapel Matematika tidak ada')

    const mulai = new Date(Date.now() - 60_000).toISOString()
    const selesai = new Date(Date.now() + 45 * 60_000).toISOString()

    // Dua soal supaya panelnya benar-benar lebih tinggi dari wadahnya.
    const teksSoal = [
      { teks: 'AUDIT: berapa hasil dari 5 + 5?', opsi: [{ id: 'A', teks: '9' }, { id: 'B', teks: '10' }], kunci: 'B' },
      { teks: 'AUDIT: berapa hasil dari 7 × 8?', opsi: [{ id: 'A', teks: '54' }, { id: 'B', teks: '56' }], kunci: 'B' },
    ]

    for (const satu of teksSoal) {
      const buat = await apiJson('/v1/soal', 'POST', {
        subject_id: mapelId,
        tipe: 'pilihan_ganda',
        konten: { teks: satu.teks, opsi: satu.opsi },
        kunci: { jawaban: satu.kunci },
        skor: 5,
        aktif: true,
      })
      if (buat.status !== 201) throw new Error(`gagal membuat soal: ${buat.status}`)
      idSoalUji.push(buat.isi.id)
    }

    const buatKuis = await apiJson('/v1/kuis', 'POST', {
      judul: 'AUDIT Kuis Sisipan Materi',
      deskripsi: 'Kuis sementara untuk audit UI kuis di dalam materi.',
      subject_id: mapelId,
      class_id: kelasId,
      durasi_menit: 30,
      mulai_at: mulai,
      selesai_at: selesai,
      acak_soal: false,
      acak_opsi: false,
    })
    if (buatKuis.status !== 201) throw new Error(`gagal membuat kuis: ${buatKuis.status}`)
    idKuisUji = buatKuis.isi.id
    await apiJson(`/v1/kuis/${idKuisUji}/soal`, 'PUT', { soal: idSoalUji })
    await apiJson(`/v1/kuis/${idKuisUji}/publikasi`, 'POST')

    const buatMateri = await apiJson('/v1/materi', 'POST', {
      judul: 'AUDIT Materi Kuis',
      deskripsi: 'Materi sementara untuk audit UI kuis.',
      subject_id: mapelId,
      class_id: kelasId,
    })
    if (buatMateri.status !== 201) throw new Error(`gagal membuat materi: ${buatMateri.status}`)
    idMateri = buatMateri.isi.id

    // Kuis berdiri sendiri sebagai satu bagian (audit blok kuis biasa) + dua kuis
    // sisipan di dalam klip video (vertikal dan horizontal).
    const blok = [
      { tipe: 'kuis', wajib: false, quiz_id: idKuisUji, isi: {}, track: 0, mulai_detik: 0, durasi_detik: 20 },
      {
        tipe: 'media',
        wajib: true,
        isi: { unggahan_kode: KODE_VIDEO, keterangan: 'Klip audit' },
        track: 0,
        mulai_detik: 20,
        durasi_detik: 60,
      },
      {
        tipe: 'kuis',
        wajib: false,
        quiz_id: idKuisUji,
        isi: {},
        track: 1,
        mulai_detik: 20 + DETIK_VERTIKAL,
        durasi_detik: 10,
        tampilan: { mode: 'jeda', tata: 'vertikal' },
      },
      {
        tipe: 'kuis',
        wajib: false,
        quiz_id: idKuisUji,
        isi: {},
        track: 1,
        mulai_detik: 20 + DETIK_HORIZONTAL,
        durasi_detik: 10,
        tampilan: { mode: 'jeda', tata: 'horizontal' },
      },
    ]

    const sinkron = await apiJson(`/v1/materi/${idMateri}/blok`, 'PUT', { rasio: '16:9', blok })
    catat('guru menyimpan materi audit', sinkron.status === 200, `status ${sinkron.status}`)
    await apiJson(`/v1/materi/${idMateri}/publikasi`, 'POST')

    const idMedia = sinkron.isi.blok[1].block_id
    const idKuisBlok = sinkron.isi.blok[0].block_id

    // --- Bagian 1: blok kuis berdiri sendiri ---
    await keluar()
    await masuk(AKUN_MURID)
    await buka('/materi', 'AUDIT Materi Kuis')
    const terlihat = await evalJs(`(document.body.innerText || '').includes('AUDIT Materi Kuis')`)
    catat('materi audit tampil di daftar materi murid', terlihat, terlihat ? '' : (await evalJs(`(document.body.innerText || '').slice(0, 160)`)))
    await evalJs(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('AUDIT Materi Kuis'))?.click(); true`)
    const adaBagian = await tunggu(`document.querySelectorAll('ol.list-unstyled:not(.jelajah-daftar) > li').length > 0`, 15000)
    catat('daftar bagian materi terbuka', adaBagian, await evalJs(`document.querySelectorAll('ol.list-unstyled:not(.jelajah-daftar) > li').length + ' bagian'`))
    if (!adaBagian) throw new Error('daftar bagian materi tidak muncul')

    for (const [namaVp, vp] of Object.entries(VIEWPORT)) {
      await ukur(vp.width, vp.height, vp.mobile)
      await sleep(500)
      await evalJs(`document.querySelectorAll('ol.list-unstyled:not(.jelajah-daftar) > li')[0].querySelector('button')?.click(); true`)
      const adaSoal = await tunggu(`(document.body.innerText || '').includes('Soal 1')`, 15000)

      const nilai = await evalJs(`(() => {
        const tombol = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('kumpulkan'))
        return {
          adaSoal: (document.body.innerText || '').includes('Soal 1'),
          soalTerlihat: document.querySelectorAll('main .mb-3 strong').length,
          tombolKirimAda: tombol !== undefined,
          tombolKirimH: tombol ? Math.round(tombol.getBoundingClientRect().height) : null,
          terlihatTanpaGulir: tombol ? tombol.getBoundingClientRect().bottom <= window.innerHeight : null,
          jarakTombolKirim: tombol ? Math.round(tombol.getBoundingClientRect().top) : null,
          ...window.__ukurHalaman(),
        }
      })()`)

      info(`blok kuis biasa [${namaVp}]`, nilai)
      catat(`blok kuis biasa tampil lengkap [${namaVp}]`, adaSoal && nilai.tombolKirimAda, `soal ${nilai.soalTerlihat} · tombol ${nilai.tombolKirimH}px`)
      // Pemeriksaan negatif ("tidak ada yang < 44 px") hanya bergigi kalau daftar
      // ukurannya BENAR-BENAR ada; `?? []` membuat kunci yang hilang lulus diam.
      catat(
        `blok kuis biasa: tombol & isian >= 44px [${namaVp}]`,
        Array.isArray(nilai.tombolKecil) && nilai.tombolKecil.length === 0,
        Array.isArray(nilai.tombolKecil) ? JSON.stringify(nilai.tombolKecil) : 'daftar ukur tidak ada (kunci hilang)',
      )
      catat(
        `blok kuis biasa: halaman tidak bergeser mendatar [${namaVp}]`,
        nilai.overflowHalaman === 0,
        nilai.overflowHalaman === 0 ? 'tidak ada gulir mendatar' : `+${nilai.overflowHalaman}px · ${JSON.stringify(nilai.melampauiTepi)}`,
      )
      catat(
        `blok kuis biasa: tidak ada media bersuara yang diputar [${namaVp}]`,
        Array.isArray(nilai.mediaBersuara) && nilai.mediaBersuara.length === 0,
        Array.isArray(nilai.mediaBersuara) ? JSON.stringify(nilai.mediaBersuara) : 'daftar ukur tidak ada (kunci hilang)',
      )

      // --- Bagian 2: kuis sisipan di dalam video ---
      await evalJs(`[...document.querySelectorAll('ol.list-unstyled:not(.jelajah-daftar) > li')].find((li) => li.innerText.includes('Bagian 2'))?.querySelector('button')?.click(); true`)
      const adaVideo = await tunggu(`document.querySelector('.pm-bingkai video')?.readyState >= 1`, 30000)
      catat(`video termuat [${namaVp}]`, adaVideo)

      for (const [nama, detik] of [['vertikal', DETIK_VERTIKAL], ['horizontal', DETIK_HORIZONTAL]]) {
        await evalJs(`(() => {
          const v = document.querySelector('.pm-bingkai video')
          if (!v) return false
          // Dibisukan di sisi halaman, bukan hanya lewat --mute-audio Chrome:
          // Chrome :9333 yang sedang hidup dipakai apa adanya, jadi kalau ia
          // dinyalakan tanpa flag itu, klip uji bersuara drum akan berbunyi
          // keluar speaker saat smoke berjalan.
          v.muted = true
          v.currentTime = ${20 + detik}
          v.play().catch(() => {})
          return true
        })()`)
        const muncul = await tunggu(`document.querySelector('.pm-kuis') !== null`, 20000)

        if (!muncul) {
          catat(`panel kuis ${nama} muncul [${namaVp}]`, false)
          continue
        }

        await sleep(600)
        const m = await evalJs('window.__ukur()')
        info(`panel kuis sisipan ${nama} [${namaVp}]`, m)

        // "horizontal" = panel di samping video, tapi hanya bila layar cukup
        // lebar (>= 1200 px); di ponsel dan laptop sempit kedua tata menumpuk
        // ke bawah. Itu memang aturan CSS-nya, jadi diuji apa adanya.
        const posisiDiminta = nama === 'horizontal' && namaVp === 'laptop' ? 'samping' : 'bawah'
        catat(
          `panel kuis ${nama} tampil di ${posisiDiminta} video, tidak menutupi gambar [${namaVp}]`,
          m !== null && m.posisi === posisiDiminta,
          `posisi ${m?.posisi} · panel ${m?.panel?.w}×${m?.panel?.h} · bingkai ${m?.bingkai?.w}×${m?.bingkai?.h}`,
        )
        catat(
          `panel kuis ${nama}: isi terbaca tanpa gulir dalam panel [${namaVp}]`,
          m !== null && m.gulir.perluGulir === false && m.soalTerpotong === 0,
          `isi ${m?.gulir?.scrollH}px di jendela ${m?.gulir?.clientH}px (panel ${m?.panel?.h}px, bingkai ${m?.bingkai?.h}px) · ${m?.jumlahSoal} soal, terpotong ${m?.soalTerpotong}`,
        )
        catat(
          `panel kuis ${nama}: lebar panel cukup untuk membaca soal [${namaVp}]`,
          m !== null && m.panel.w >= 260,
          `lebar panel ${m?.panel?.w}px`,
        )
        catat(
          `panel kuis ${nama}: tombol kumpulkan terlihat tanpa menggulir [${namaVp}]`,
          m !== null && m.terlihatTanpaGulir === true,
          `jarak tombol dari atas panel ${m?.jarakTombolKirim}px`,
        )
        // `__ukur()` mengembalikan `null` bila panel/bingkai tidak ketemu. Dulu tiga
        // pemeriksaan negatif di bawah ini memakai `m?.x ?? []` sehingga justru LULUS
        // saat panelnya tidak ada ("tidak ada teks keluar panel" — memang, panelnya
        // tidak ada). Sekarang panel yang tidak terukur = GAGAL, bukan lulus.
        catat(
          `panel kuis ${nama}: tidak ada teks keluar panel [${namaVp}]`,
          m !== null && Array.isArray(m.keluarPanel) && m.keluarPanel.length === 0,
          m === null ? 'panel tidak terukur' : JSON.stringify(m.keluarPanel ?? []),
        )
        catat(
          `panel kuis ${nama}: tombol & isian >= 44px [${namaVp}]`,
          m !== null && Array.isArray(m.tombolKecil) && m.tombolKecil.length === 0,
          m === null ? 'panel tidak terukur' : JSON.stringify(m.tombolKecil ?? []),
        )
        catat(
          `panel kuis ${nama}: halaman tidak bergeser mendatar [${namaVp}]`,
          (m?.overflowHalaman ?? 0) === 0,
          m?.overflowHalaman ? `+${m.overflowHalaman}px · ${JSON.stringify(m.melampauiTepi)}` : 'tidak ada gulir mendatar',
        )
        catat(
          `panel kuis ${nama}: video yang diputar dalam keadaan bisu [${namaVp}]`,
          m !== null && Array.isArray(m.mediaBersuara) && m.mediaBersuara.length === 0,
          m === null ? 'panel tidak terukur' : (m.mediaBersuara ?? []).length === 0 ? 'bisu (muted)' : JSON.stringify(m.mediaBersuara),
        )

        // Jawab (lewati) supaya kuis berikutnya bisa diuji di halaman yang sama.
        await evalJs(`[...document.querySelectorAll('.pm-kuis button')].find((b) => (b.textContent || '').includes('Lewati'))?.click(); true`)
        await sleep(800)
      }

      // Kembali ke daftar bagian untuk viewport berikutnya.
      await buka('/materi', 'AUDIT Materi Kuis')
      await evalJs(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('AUDIT Materi Kuis'))?.click(); true`)
      await tunggu(`document.querySelectorAll('ol.list-unstyled:not(.jelajah-daftar) > li').length > 0`, 15000)
    }

    void idMedia
    void idKuisBlok
  } finally {
    const bersih = await bersihkan()
    catat('materi/kuis/soal audit dihapus kembali', bersih.status === 200, bersih.sisa)
  }

  const gagal = hasil.filter((satu) => !satu.lolos)
  console.log(`\n${hasil.length - gagal.length}/${hasil.length} lulus`)

  if (gagal.length > 0) {
    console.log('gagal: ' + gagal.map((satu) => satu.nama).join(' ; '))
    process.exitCode = 1
  }

  ws.close()
}

main()
  .catch(async (error) => {
    console.error('harness error:', error.message)
    process.exitCode = 1
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode ?? 0), 1500)
  })
