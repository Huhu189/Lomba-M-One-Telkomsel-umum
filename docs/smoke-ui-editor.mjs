// Audit tata letak EDITOR MATERI (gaya video editor) lewat browser sungguhan.
//
// Editor materi tidak pernah masuk daftar audit halaman: `smoke-ui-mobile.mjs`
// hanya menyapu 8 halaman non-editor dan `audit-ui.mjs` tidak memuat
// `/materi/:id/editor`. Audit tampilan 12 Oktober 2026 menemukan editor materi
// melebar **+151 px** di 390 px, jadi harness ini mengukurnya di 390/768/1366 px.
//
// Yang diukur mesin, bukan selera:
//   1. halaman bergeser mendatar (overflow dokumen) — harus 0 px;
//   2. elemen di dalam editor yang menembus tepi kanan layar;
//   3. tiap bagian editor (sidebar, kanvas, playback, timeline,
//      inspector) benar-benar muat di layar;
//   4. inspector klip terpilih tidak memotong/meluberkan isinya;
//   5. sasaran sentuh < 44 px pada lebar sentuh (ponsel & tablet).
//
// Harness ini MANDIRI: soal + kuis + materi ujinya dibuat di awal dan dihapus di
// blok `finally`, jadi bisa dijalankan berulang.
//
// Prasyarat: backend 8000, vite 5173, Chrome --remote-debugging-port=9333.
// Jalankan lewat `docs/jalankan-smoke-ui.sh editor` (nama harness: editor).
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness guru
// memakai akun guru sungguhan (guru1@sekolah.test) — bukan akun admin seperti dulu.
// Jalur kepala sekolah diuji terpisah di `docs/smoke-ui-admin.mjs`.
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }

/** Berkas video 5,4 MB yang sudah selesai diunggah di DB dev (mime video/mp4). */
const KODE_VIDEO = 'XZhNiQ6Q9FlH2IYEvN2dxS1IFnKYi36c'

const VIEWPORT = {
  hp: { width: 390, height: 844, mobile: true, sentuh: true },
  tablet: { width: 768, height: 1024, mobile: true, sentuh: true },
  laptop: { width: 1366, height: 900, mobile: false, sentuh: false },
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Pengukur yang disuntik ke halaman. `__ukurHalaman` mengukur halaman secara
 * umum (sama seperti harness kuis-materi), `__ukurEditor` mengukur bagian-bagian
 * editor + inspector.
 */
const UKUR = `window.__ukurHalaman = function () {
  const lebar = document.documentElement.clientWidth
  const melampaui = []

  // Semua elemen yang ujung kanannya melewati layar — termasuk yang position-nya
  // fixed dan yang induknya memotong — sebab keduanya tetap ikut dihitung ke
  // dalam area gulir dokumen, dan itulah yang membuat halaman bergeser mendatar.
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') continue
    const r = el.getBoundingClientRect()
    if (r.width < 8 || r.right <= lebar + 1) continue
    let pemilikPotong = ''
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const o = getComputedStyle(n)
      if (o.overflowX !== 'visible' || o.overflow !== 'visible') {
        pemilikPotong = n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\\\\s+/)[0] : '')
        break
      }
    }
    melampaui.push({
      el: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\\\s+/).slice(0, 2).join('.') : ''),
      pos: s.position,
      lewat: Math.round(r.right - lebar),
      lebar: Math.round(r.width),
      potong: pemilikPotong,
      teks: (el.textContent || '').replace(/\\\\s+/g, ' ').trim().slice(0, 24),
    })
  }
  melampaui.sort((a, b) => b.lewat - a.lewat)

  const tombolKecil = []
  for (const el of document.querySelectorAll('main button, main input, main select, main textarea, main a')) {
    let r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue

    // Kotak centang / tombol radio kecil BUKAN sasaran sentuh yang sebenarnya:
    // yang ditekan anak adalah kotak + labelnya bersama-sama (WCAG 2.5.8
    // menghitung label sebagai bagian sasaran). Di sini keduanya disatukan
    // sebagai satu kotak (union), bukan diambil yang terbesar per sisi — pada
    // struktur Bootstrap kotak centangnya berada di luar kotak label, jadi
    // mengambil nilai terbesar saja akan mengukur labelnya sendirian.
    if (el.type === 'checkbox' || el.type === 'radio') {
      const label = (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) || el.closest('label')
      if (label) {
        const rl = label.getBoundingClientRect()
        const kiri = Math.min(r.left, rl.left)
        const kanan = Math.max(r.right, rl.right)
        const atas = Math.min(r.top, rl.top)
        const bawah = Math.max(r.bottom, rl.bottom)
        r = { width: kanan - kiri, height: bawah - atas }
      }
    }

    if (r.width < 43.5 || r.height < 43.5) {
      tombolKecil.push({
        el: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\\\s+/).slice(0, 2).join('.') : '') + (el.type ? '[' + el.type + ']' : ''),
        w: Math.round(r.width),
        h: Math.round(r.height),
        teks: (el.getAttribute('aria-label') || el.textContent || '').replace(/\\\\s+/g, ' ').trim().slice(0, 22),
      })
    }
  }

  const overflowHalaman =
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - lebar > 1
      ? Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - lebar
      : 0

  const mediaBersuara = []
  for (const el of document.querySelectorAll('video, audio')) {
    if (el.paused || el.readyState === 0 || el.muted || el.volume === 0) continue
    mediaBersuara.push({ el: el.tagName.toLowerCase(), detik: Math.round(el.currentTime) })
  }

  return {
    overflowHalaman,
    lebarDokumen: document.documentElement.clientWidth,
    melampauiTepi: melampaui.slice(0, 6),
    tombolKecil: tombolKecil.slice(0, 20),
    mediaBersuara,
  }
};

window.__ukurEditor = function () {
  const lebar = document.documentElement.clientWidth
  const kotak = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height), kiri: Math.round(r.left), kanan: Math.round(r.right) }
  }

  const bagian = {}
  // Catatan 14 Oktober 2026: .nle-bilah (bilah "Rasio bingkai") sudah dihapus
  // dari editor, jadi tidak lagi masuk daftar bagian yang harus ada. Komentar ini
  // hidup DI DALAM template literal alat ukur — jangan memakai backtick di sini.
  for (const sel of ['.nle', '.nle-sidebar', '.nle-kerja', '.nle-canvas', '.nle-playback', '.nle-timeline', '.nle-inspector']) {
    bagian[sel] = kotak(sel)
  }

  // Elemen di dalam editor yang ujung kanannya melewati layar. Inilah yang
  // membuat seluruh halaman bisa bergeser mendatar. Elemen yang sudah dipotong
  // induknya (mis. gambar peta yang di-zoom di dalam panggung ber-overflow
  // hidden) tidak dihitung: potongan itu tidak menambah lebar dokumen.
  const menembus = []
  for (const el of document.querySelectorAll('.nle *')) {
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden') continue
    const r = el.getBoundingClientRect()
    if (r.width < 8 || r.right <= lebar + 1) continue
    let terpotong = false
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const o = getComputedStyle(n)
      if (o.overflowX !== 'visible' || o.overflow !== 'visible') {
        terpotong = true
        break
      }
    }
    if (terpotong) continue
    menembus.push({
      el: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\\\s+/).slice(0, 2).join('.') : ''),
      lewat: Math.round(r.right - lebar),
      lebar: Math.round(r.width),
    })
  }
  menembus.sort((a, b) => b.lewat - a.lewat)

  // Isi inspector yang keluar dari kotaknya sendiri.
  const insp = document.querySelector('.nle-inspector')
  const keluarInspector = []
  if (insp) {
    const ri = insp.getBoundingClientRect()
    for (const el of insp.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.width < 8) continue
      if (r.right - ri.right > 1 || ri.left - r.left > 1) {
        keluarInspector.push({
          el: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\\\s+/)[0] : ''),
          lewat: Math.round(Math.max(r.right - ri.right, ri.left - r.left)),
        })
      }
    }
  }

  return {
    bagian,
    menembus: menembus.slice(0, 8),
    keluarInspector: keluarInspector.slice(0, 6),
    jumlahKlip: document.querySelectorAll('.nle-klip').length,
    adaInspector: insp !== null,
    lebarPita: (() => {
      const lane = document.querySelector('.nle-lane-wrap')
      return lane ? Math.round(lane.getBoundingClientRect().width) : null
    })(),
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
  const ukurPerangkat = async (vp) =>
    send(
      'Emulation.setDeviceMetricsOverride',
      { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile },
      sessionId,
    )
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
    return {
      status: status.every((satu) => satu === 200) ? 200 : Math.min(...status),
      sisa: `materi ${idMateri} · kuis ${idKuisUji} · soal ${idSoalUji.length} → ${status.join(',')}`,
    }
  }

  try {
    await buka('/')
    const guruMasuk = await masuk(AKUN_GURU)
    catat('guru masuk', guruMasuk.status === 200, guruMasuk.isi?.user?.email ?? '')
    if (guruMasuk.status !== 200) throw new Error('guru tidak bisa masuk')

    const mapelId = (await apiJson('/v1/mapel')).isi.find((satu) => satu.nama === 'Matematika')?.id
    if (!mapelId) throw new Error('mapel Matematika tidak ada')

    const kelasId = (await apiJson('/v1/kelas')).isi?.[0]?.id
    if (!kelasId) throw new Error('belum ada kelas di DB dev')

    const muatSoal = await apiJson('/v1/soal', 'POST', {
      subject_id: mapelId,
      tipe: 'pilihan_ganda',
      konten: {
        teks: 'AUDIT: berapa hasil dari 6 + 7?',
        opsi: [{ id: 'A', teks: '12' }, { id: 'B', teks: '13' }],
      },
      kunci: { jawaban: 'B' },
      skor: 5,
      aktif: true,
    })
    if (muatSoal.status !== 201) throw new Error(`gagal membuat soal: ${muatSoal.status}`)
    idSoalUji.push(muatSoal.isi.id)

    const mulai = new Date(Date.now() - 60_000).toISOString()
    const selesai = new Date(Date.now() + 45 * 60_000).toISOString()
    const buatKuis = await apiJson('/v1/kuis', 'POST', {
      judul: 'AUDIT Kuis Editor Materi',
      deskripsi: 'Kuis sementara untuk audit tata letak editor materi.',
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
      judul: 'AUDIT Editor Materi',
      deskripsi: 'Materi sementara untuk audit tata letak editor materi.',
      subject_id: mapelId,
      class_id: kelasId,
    })
    if (buatMateri.status !== 201) throw new Error(`gagal membuat materi: ${buatMateri.status}`)
    idMateri = buatMateri.isi.id

    // Tiga klip supaya timeline berisi (teks + media + kuis) dan inspector
    // punya banyak isi: teks punya textarea, media punya pemilih + 3 penggeser.
    const blok = [
      {
        tipe: 'teks',
        wajib: true,
        isi: { teks: 'AUDIT: pengantar materi yang cukup panjang untuk mengisi kotak suntingan inspector.' },
        track: 0,
        mulai_detik: 0,
        durasi_detik: 12,
      },
      {
        tipe: 'media',
        wajib: true,
        isi: { unggahan_kode: KODE_VIDEO, keterangan: 'Klip audit editor' },
        track: 0,
        mulai_detik: 12,
        durasi_detik: 60,
      },
      {
        tipe: 'kuis',
        wajib: false,
        quiz_id: idKuisUji,
        isi: {},
        track: 1,
        mulai_detik: 20,
        durasi_detik: 12,
        tampilan: { mode: 'jeda', tata: 'vertikal' },
      },
    ]

    const sinkron = await apiJson(`/v1/materi/${idMateri}/blok`, 'PUT', {
      tema: { kode: 'mendaki-gunung', nama: 'AUDIT Pendakian' },
      blok,
    })
    catat(
      'guru menyimpan materi audit',
      sinkron.status === 200,
      `status ${sinkron.status}${sinkron.status === 200 ? '' : ' · ' + JSON.stringify(sinkron.isi?.errors ?? sinkron.isi)}`,
    )
    if (sinkron.status !== 200) throw new Error('gagal menyimpan blok materi audit')

    for (const [namaVp, vp] of Object.entries(VIEWPORT)) {
      await ukurPerangkat(vp)
      await buka(`/materi/${idMateri}/editor`, 'Timeline materi')
      const siap = await tunggu(`document.querySelectorAll('.nle-klip').length >= 3`, 20000)
      catat(`editor materi terbuka dengan ${namaVp}`, siap, `${await evalJs(`document.querySelectorAll('.nle-klip').length`)} klip`)
      if (!siap) continue

      // Inspector baru muncul setelah satu klip dipilih — dan justru isi inspector
      // itu yang dulu meluber di ponsel.
      await evalJs(`document.querySelectorAll('.nle-klip')[0].click(); true`)
      await tunggu(`document.querySelector('.nle-inspector') !== null`, 8000)
      await sleep(400)

      const teksM = await evalJs('window.__ukurEditor()')
      info(`editor klip teks [${namaVp}]`, teksM)

      catat(
        `editor terbuka: halaman tidak bergeser mendatar [${namaVp}]`,
        teksM.overflowHalaman === 0,
        teksM.overflowHalaman === 0 ? 'tidak ada gulir mendatar' : `+${teksM.overflowHalaman}px · ${JSON.stringify(teksM.melampauiTepi)}`,
      )
      catat(
        `editor terbuka: tidak ada elemen editor menembus tepi kanan [${namaVp}]`,
        teksM.menembus.length === 0,
        teksM.menembus.length === 0 ? 'semua di dalam layar' : JSON.stringify(teksM.menembus),
      )

      const bagianAda = Object.entries(teksM.bagian).filter(([, kotak]) => kotak === null).map(([sel]) => sel)
      const bagianLuber = Object.entries(teksM.bagian)
        .filter(([, kotak]) => kotak !== null && kotak.kanan > teksM.lebarDokumen + 1)
        .map(([sel, kotak]) => `${sel} ${kotak.w}px (+${kotak.kanan - teksM.lebarDokumen})`)
      catat(
        `editor terbuka: tiap bagian editor muat di layar [${namaVp}]`,
        bagianAda.length === 0 && bagianLuber.length === 0,
        bagianAda.length > 0 ? `tidak ada: ${bagianAda.join(', ')}` : bagianLuber.length > 0 ? bagianLuber.join(', ') : 'semua bagian muat',
      )

      catat(
        `inspector klip teks: isinya tidak keluar dari panel [${namaVp}]`,
        teksM.adaInspector && teksM.keluarInspector.length === 0,
        teksM.adaInspector ? JSON.stringify(teksM.keluarInspector) : 'inspector tidak muncul',
      )

      // Klip media: pemilih "fit" + tiga penggeser + isian berkas — isi inspector
      // yang paling lebar.
      await evalJs(`document.querySelectorAll('.nle-klip')[1].click(); true`)
      await tunggu(`document.querySelector('#nle-fit') !== null`, 8000)
      await sleep(400)
      const mediaM = await evalJs('window.__ukurEditor()')
      info(`editor klip media [${namaVp}]`, mediaM)

      catat(
        `inspector klip media: isinya tidak keluar dari panel [${namaVp}]`,
        mediaM.adaInspector && mediaM.keluarInspector.length === 0,
        JSON.stringify(mediaM.keluarInspector),
      )
      catat(
        `klip media: halaman tetap tidak bergeser mendatar [${namaVp}]`,
        mediaM.overflowHalaman === 0,
        mediaM.overflowHalaman === 0 ? 'tidak ada gulir mendatar' : `+${mediaM.overflowHalaman}px · ${JSON.stringify(mediaM.melampauiTepi)}`,
      )
      catat(
        `klip media: tidak ada elemen editor menembus tepi kanan [${namaVp}]`,
        mediaM.menembus.length === 0,
        mediaM.menembus.length === 0 ? 'semua di dalam layar' : JSON.stringify(mediaM.menembus),
      )

      // Klip kuis: daftar pemilih kuis di inspector adalah wadah bergulir
      // BERSARANG di dalam halaman yang panjang — persis tempat yang tidak
      // nyaman saat memakai laptop (13 Okt 2026): roda/trackpad di atas daftar
      // dulu ikut menggeser halaman begitu daftarnya mentok.
      // Klip dipilih lewat KELASNYA, bukan urutan DOM: klip di timeline diurutkan
      // per jalur (track), jadi `.nle-klip[2]` bukan klip ketiga yang terlihat.
      await evalJs(`document.querySelector('.nle-klip-kuis').click(); true`)
      const adaPemilih = await tunggu(`document.querySelector('.nle-pemilih-daftar') !== null`, 8000)
      await sleep(400)
      catat(
        `klip kuis: daftar pemilih kuis muncul di inspector [${namaVp}]`,
        adaPemilih,
        adaPemilih ? 'daftar ada' : 'daftar tidak muncul',
      )

      // Lapisan kuis muncul kalau kepala putar digeser ke klip kuis (mode jeda).
      await evalJs(`document.querySelector('.nle-tool-kuis').click(); true`)
      await sleep(500)

      const gayaWadah = await evalJs(`(() => {
        const ambil = (sel) => {
          const el = document.querySelector(sel)
          if (!el) return 'tidak ada'
          const s = getComputedStyle(el)
          return s.overscrollBehaviorY || s.overscrollBehavior
        }
        return {
          pemilih: ambil('.nle-pemilih-daftar'),
          kanvas: ambil('.nle-canvas-isi'),
          kuis: ambil('.nle-kuis'),
        }
      })()`)
      catat(
        `gulir bersarang: wadah bergulir di editor memakai contain [${namaVp}]`,
        gayaWadah.pemilih === 'contain' && gayaWadah.kanvas === 'contain' && gayaWadah.kuis === 'contain',
        JSON.stringify(gayaWadah),
      )

      if (vp.sentuh) {
        info(`roda mouse tidak diuji [${namaVp}] (perangkat sentuh memakai jari, bukan roda)`, null)
        catat(
          `editor: semua sasaran sentuh >= 44px [${namaVp}]`,
          teksM.tombolKecil.length === 0 && mediaM.tombolKecil.length === 0,
          JSON.stringify(teksM.tombolKecil.length > 0 ? teksM.tombolKecil : mediaM.tombolKecil),
        )
      } else {
        // Roda SUNGGUHAN lewat CDP, bukan pemeriksaan gaya: halaman digulirkan
        // supaya daftar pemilih ada di tengah layar, lalu roda diputar tepat di
        // atas daftar itu.
        // Halaman digulirkan DULU, lalu ditunggu mendarat: `scroll-behavior:
        // smooth` dari Bootstrap membuat `scrollIntoView` beranimasi, dan kalau
        // koordinatnya dibaca saat animasi masih jalan, roda terkirim ke titik
        // lama (di luar daftar) sehingga yang bergerak malah halaman.
        await evalJs(`document.querySelector('.nle-pemilih-daftar').scrollIntoView({ block: 'center' }); true`)
        await sleep(900)
        const sebelum = await evalJs(`(() => {
          const daftar = document.querySelector('.nle-pemilih-daftar')
          if (!daftar) return null
          const r = daftar.getBoundingClientRect()
          const didalam = (nilai, batas) => Math.round(Math.min(Math.max(nilai, 12), batas - 12))
          return {
            x: didalam(r.left + r.width / 2, window.innerWidth),
            y: didalam(r.top + r.height / 2, window.innerHeight),
            bisaGulir: daftar.scrollHeight > daftar.clientHeight + 1,
            atas: Math.round(daftar.scrollTop),
            halaman: Math.round(window.scrollY),
          }
        })()`)
        if (sebelum) info(`titik roda [${namaVp}]`, sebelum)

        catat(
          `gulir bersarang: daftar pemilih ada untuk diuji [${namaVp}]`,
          sebelum !== null && sebelum !== undefined,
          sebelum ? `bisaGulir=${sebelum.bisaGulir}` : 'daftar tidak ditemukan',
        )

        if (sebelum) {
          // Gestur roda lewat `Input.synthesizeScrollGesture` (mode mouse), bukan
          // `Input.dispatchMouseEvent`, karena hanya gestur ini yang benar-benar
          // menebak elemen di bawah koordinat (hit-test) seperti roda sungguhan.
          const putarRoda = async (delta) => {
            await send(
              'Input.synthesizeScrollGesture',
              {
                x: sebelum.x,
                y: sebelum.y,
                xDistance: 0,
                yDistance: -delta,
                gestureSourceType: 'mouse',
                speed: 800,
              },
              sessionId,
            )
          }

          catat(
            `gulir bersarang: daftar pemilih cukup panjang untuk bisa digulir [${namaVp}]`,
            sebelum.bisaGulir,
            `scrollHeight > clientHeight: ${sebelum.bisaGulir}`,
          )

          await putarRoda(240)
          await sleep(300)
          const sesudah = await evalJs(`(() => {
            const daftar = document.querySelector('.nle-pemilih-daftar')
            return { atas: Math.round(daftar.scrollTop), halaman: Math.round(window.scrollY) }
          })()`)
          catat(
            `gulir bersarang: roda di atas daftar menggerakkan DAFTARNYA [${namaVp}]`,
            sesudah.atas > sebelum.atas,
            `daftar ${sebelum.atas} → ${sesudah.atas}`,
          )
          catat(
            `gulir bersarang: roda di atas daftar TIDAK menggeser halaman [${namaVp}]`,
            sesudah.halaman === sebelum.halaman,
            `halaman ${sebelum.halaman} → ${sesudah.halaman}`,
          )

          // Daftar dipindah ke ujung BAWAHNYA lebih dulu (di basis data dev ada
          // ratusan kuis, jadi memutar roda sampai ujung akan memerlukan puluhan
          // gestur). Inilah kasus "sudah mentok" yang dulu membuat halaman
          // melompat: roda tetap diputar, dan halaman harus tetap diam.
          await evalJs(`(() => {
            const daftar = document.querySelector('.nle-pemilih-daftar')
            daftar.scrollTop = daftar.scrollHeight
            return true
          })()`)
          await sleep(300)
          await putarRoda(400)
          await putarRoda(400)
          await sleep(300)
          const mentok = await evalJs(`(() => {
            const daftar = document.querySelector('.nle-pemilih-daftar')
            return {
              atas: Math.round(daftar.scrollTop),
              maks: Math.round(daftar.scrollHeight - daftar.clientHeight),
              halaman: Math.round(window.scrollY),
            }
          })()`)
          catat(
            `gulir bersarang: daftar pemilih sudah mentok [${namaVp}]`,
            mentok.maks > 0 && Math.abs(mentok.atas - mentok.maks) <= 1,
            `daftar ${mentok.atas} dari maks ${mentok.maks}`,
          )
          catat(
            `gulir bersarang: daftar mentok pun halaman tetap diam [${namaVp}]`,
            mentok.halaman === sebelum.halaman,
            `halaman ${sebelum.halaman} → ${mentok.halaman}`,
          )
        }

        info(`sasaran sentuh < 44px [${namaVp}] (alat editor di layar besar, bukan target sentuh)`, teksM.tombolKecil)
      }

      // Tombol ✕ di timeline (14 Oktober 2026): klip media/blok bisa langsung
      // dihapus dari timeline, tidak perlu mencari inspector dulu. Ukurannya ikut
      // diperiksa — di lebar sentuh ia harus jadi sasaran 44 px, dan di laptop
      // cukup kecil supaya tidak menutupi klip sebelahnya.
      await evalJs(`document.querySelectorAll('.nle-klip')[0].click(); true`)
      await sleep(400)
      const sebelumHapus = await evalJs(`document.querySelectorAll('.nle-klip').length`)
      const ukuranHapus = await evalJs(`(() => {
        const t = document.querySelector('.nle-klip-hapus')
        if (t === null) return null
        const k = t.getBoundingClientRect()
        return { w: Math.round(k.width), h: Math.round(k.height), label: t.getAttribute('aria-label') }
      })()`)
      const ukuranHapusCukup =
        ukuranHapus !== null && (vp.sentuh ? ukuranHapus.w >= 44 && ukuranHapus.h >= 44 : ukuranHapus.w > 0 && ukuranHapus.h > 0)
      catat(
        `timeline: tombol ✕ punya sasaran sentuh yang memadai [${namaVp}]`,
        ukuranHapusCukup,
        ukuranHapus === null ? 'tombol tidak ada' : `${ukuranHapus.w}×${ukuranHapus.h} px · "${ukuranHapus.label}"`,
      )
      await evalJs(`document.querySelector('.nle-klip-hapus')?.click(); true`)
      await sleep(600)
      const sesudahHapus = await evalJs(`document.querySelectorAll('.nle-klip').length`)
      catat(
        `timeline: tombol ✕ menghapus klip terpilih [${namaVp}]`,
        ukuranHapus !== null && sesudahHapus === sebelumHapus - 1,
        `${sebelumHapus} → ${sesudahHapus} klip`,
      )

      catat(
        `editor: tidak ada media bersuara yang diputar [${namaVp}]`,
        teksM.mediaBersuara.length === 0,
        JSON.stringify(teksM.mediaBersuara),
      )
    }

    // --- Tombol Delete di papan tombol (14 Oktober 2026) ---
    // Klip bisa dibuang tanpa mencari tombol ✕: cukup pilih klipnya lalu tekan
    // Delete/Backspace. Yang dijaga di sini dua hal — tombolnya benar-benar
    // membuang klip yang sedang terpilih, dan saat fokus sedang di kolom isian
    // tombolnya TIDAK ikut membuang klip (guru mungkin hanya meralat nama pos).
    await ukurPerangkat(VIEWPORT.laptop)
    await buka(`/materi/${idMateri}/editor`, 'Timeline materi')
    const siapPapanTombol = await tunggu(`document.querySelectorAll('.nle-klip').length >= 3`, 20000)
    // Klipnya diberi fokus lebih dulu (klik tetikus sungguhan juga memindahkan
    // fokus ke tombol klip) — papan tombol hanya berlaku di dalam editor.
    await evalJs(`(() => { const el = document.querySelector('.nle-klip-media'); el.focus(); el.click(); return true })()`)
    await tunggu(`document.querySelector('.nle-klip-aktif') !== null`, 8000)
    const klipTerpilih = await evalJs(
      `(() => { const el = document.querySelector('.nle-klip-aktif'); return el ? el.className.replace(/\\s+/g, ' ').trim() : null })()`,
    )
    const sebelumTombol = await evalJs(`document.querySelectorAll('.nle-klip').length`)
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 }, sessionId)
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 }, sessionId)
    await sleep(400)
    const sesudahTombol = await evalJs(`document.querySelectorAll('.nle-klip').length`)
    catat(
      'papan tombol: Delete membuang klip media yang sedang dipilih',
      siapPapanTombol && String(klipTerpilih).includes('nle-klip-media') && sesudahTombol === sebelumTombol - 1,
      `klip aktif ${klipTerpilih ?? '—'} · ${sebelumTombol} → ${sesudahTombol} klip`,
    )

    await evalJs(`(() => { const el = document.querySelector('.nle-klip-teks'); el.focus(); el.click(); return true })()`)
    await tunggu(`document.querySelector('#nle-fase') !== null`, 8000)
    const sebelumKetik = await evalJs(`document.querySelectorAll('.nle-klip').length`)
    await evalJs(`document.querySelector('#nle-fase').focus(); true`)
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 }, sessionId)
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 }, sessionId)
    await sleep(400)
    const sesudahKetik = await evalJs(`document.querySelectorAll('.nle-klip').length`)
    catat(
      'papan tombol: Delete saat fokus di kolom isian tidak membuang klip',
      sesudahKetik === sebelumKetik,
      `${sebelumKetik} → ${sesudahKetik} klip`,
    )

    // --- Pembuangan berkas pustaka dari editor (14 Oktober 2026) ---
    // "Hapus berkas" membuang BERKAS-nya, bukan cuma klipnya. Rantai penuhnya diuji
    // di sini: berkas sungguhan diunggah → dipakai satu klip → dibuang lewat UI
    // (dengan dialog konfirmasi yang menyebut dampaknya) → berkas hilang dari
    // pustaka, klipnya hilang dari timeline, dan susunan yang tertinggal tetap
    // tersimpan (bukti tidak ada rujukan berkas yang mati).
    const pngSatuPiksel =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
    const ukuranPng = await evalJs(`atob('${pngSatuPiksel}').length`)
    const mulaiBerkas = await apiJson(`/v1/materi/${idMateri}/unggahan`, 'POST', {
      nama: 'audit-pustaka.png',
      ukuran: ukuranPng,
    })
    const kodeBerkas = String(mulaiBerkas.isi?.kode ?? '')
    const kirimBerkas = await apiJson(`/v1/unggahan/${kodeBerkas}/potongan/0`, 'PUT', {
      isi_base64: pngSatuPiksel,
    })
    const selesaiBerkas = await apiJson(`/v1/unggahan/${kodeBerkas}/selesai`, 'POST')
    const pasangBerkas = await apiJson(`/v1/materi/${idMateri}/blok`, 'PUT', {
      tema: { kode: 'mendaki-gunung', nama: 'AUDIT Pendakian' },
      blok: [
        {
          tipe: 'media',
          wajib: true,
          isi: { unggahan_kode: kodeBerkas, keterangan: 'AUDIT berkas pustaka' },
          track: 0,
          mulai_detik: 0,
          durasi_detik: 8,
        },
        { tipe: 'teks', wajib: true, isi: { teks: 'AUDIT sisa sesudah berkas dibuang.' }, track: 0, mulai_detik: 8, durasi_detik: 8 },
      ],
    })
    catat(
      'berkas pustaka audit siap dipakai klip',
      mulaiBerkas.status === 201 && kirimBerkas.status === 200 && selesaiBerkas.status === 200 && pasangBerkas.status === 200,
      `unggahan ${mulaiBerkas.status} · potongan ${kirimBerkas.status} · selesai ${selesaiBerkas.status} · simpan ${pasangBerkas.status}`,
    )

    await buka(`/materi/${idMateri}/editor`, 'Pustaka media')
    const adaPustaka = await tunggu(`document.querySelector('.pustaka-media') !== null`, 15000)
    const barisBerkas = await evalJs(`(() => {
      const baris = [...document.querySelectorAll('.pustaka-media li')].find((li) => li.textContent.includes('audit-pustaka.png'))
      if (!baris) return null
      const tombol = [...baris.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Hapus berkas')
      if (!tombol) return { teks: baris.textContent.replace(/\\s+/g, ' ').trim(), w: 0, h: 0 }
      const kotak = tombol.getBoundingClientRect()
      return { teks: baris.textContent.replace(/\\s+/g, ' ').trim(), w: Math.round(kotak.width), h: Math.round(kotak.height) }
    })()`)
    catat(
      'pustaka media: tiap berkas punya tombol "Hapus berkas" dengan sasaran sentuh memadai',
      adaPustaka && barisBerkas !== null && barisBerkas.w > 0 && barisBerkas.h >= 43.5,
      barisBerkas === null ? 'baris berkas tidak ditemukan' : `${barisBerkas.w}×${barisBerkas.h} px · "${barisBerkas.teks}"`,
    )

    await evalJs(`(() => {
      const baris = [...document.querySelectorAll('.pustaka-media li')].find((li) => li.textContent.includes('audit-pustaka.png'))
      ;[...baris.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Hapus berkas').click()
      return true
    })()`)
    const dialogMuncul = await tunggu(`document.querySelector('dialog[open]') !== null`, 8000)
    const isiDialog = await evalJs(
      `(() => { const d = document.querySelector('dialog[open]'); return d ? d.innerText.replace(/\\s+/g, ' ').trim() : '' })()`,
    )
    catat(
      'buang berkas lewat konfirmasi yang lebih dulu menyebut dampaknya',
      dialogMuncul && isiDialog.includes('1 klip media'),
      isiDialog.slice(0, 150),
    )

    const klipSebelumBuang = await evalJs(`document.querySelectorAll('.nle-klip').length`)
    await evalJs(`(() => {
      const d = document.querySelector('dialog[open]')
      ;[...d.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Buang berkas').click()
      return true
    })()`)
    const pustakaBersih = await tunggu(
      `!document.body.innerText.includes('audit-pustaka.png')`,
      15000,
    )
    const klipSesudahBuang = await evalJs(`document.querySelectorAll('.nle-klip').length`)
    catat(
      'buang berkas: berkasnya hilang dari pustaka & klip medianya hilang dari timeline',
      pustakaBersih && klipSesudahBuang === klipSebelumBuang - 1,
      `pustaka ${pustakaBersih ? 'bersih' : 'masih memuat berkas'} · ${klipSebelumBuang} → ${klipSesudahBuang} klip`,
    )

    const sesudahBuang = await apiJson(`/v1/materi/${idMateri}`)
    const blokServer = sesudahBuang.isi?.blok ?? []
    const berkasServer = sesudahBuang.isi?.unggahan ?? []
    catat(
      'buang berkas: server ikut membersihkan blok & baris unggahannya',
      blokServer.length === 1 &&
        blokServer.every((satu) => satu.tipe !== 'media') &&
        !berkasServer.some((satu) => satu.kode === kodeBerkas),
      `${blokServer.length} blok tersisa (${blokServer.map((satu) => satu.tipe).join(', ') || '—'}) · ${berkasServer.length} berkas di pustaka`,
    )
    catat(
      'buang berkas: editor tidak lagi mengaku ada perubahan yang belum disimpan',
      !(await evalJs(`(document.body.innerText || '').includes('Belum tersimpan')`)),
      'badge "Belum tersimpan" tidak muncul',
    )
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
