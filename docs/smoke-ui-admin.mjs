// Smoke UI **jalur kepala sekolah** (peran `admin`) lewat Chrome DevTools Protocol.
//
// Peran `admin` (kepala sekolah) sejak 14 Oktober 2026 hanya MELIHAT data akademik
// dan mengelola akun guru/murid. Harness ini membuktikan dua sisi itu di peramban
// sungguhan, di dua ukuran layar:
//
//   1. **Dasbor + kelola akun tetap jalan** — menunya sendiri (Dasbor Sekolah,
//      Kelola Akun), `/admin/akun` memuat daftar, dan menu "…" di panelnya membuka
//      pilihan BER-TEKS (pengganti tiga pil yang dulu berjajar).
//   2. **Yang memang tulis tidak ditawarkan** — Kelas/Mapel/Murid/Bank Soal/Tag/
//      Kuis/Materi tidak lagi memuat tombol tambah/ubah/hapus, tetapi tetap memuat
//      catatan "Hanya melihat." supaya halaman tanpa tombol tidak terbaca rusak.
//   3. **Jalur baca yang jadi tugasnya tetap terbuka** — laporan, monitor ulangan
//      (catatan kecurangan ikut, tanpa tombol meninjau), dan halaman akun sendiri.
//   4. **Server yang memutuskan, bukan tombolnya** — dari sesi peramban ini,
//      `PUT /api/v1/kelas/{id}` harus 403 sedangkan `GET /api/v1/admin/monitor`
//      dan `GET /api/v1/admin/akun` harus 200.
//   5. **Tata letak di dua ukuran** — lebar 1280 px dan emulasi perangkat 390×844:
//      tanpa gulir mendatar, tanpa elemen menembus tepi, target sentuh ≥ 44 px, dan
//      huruf teks isi ≥ 14 px.
//
// Prasyarat: backend 8000, vite 5173, realtime 4000, Chrome :9333 — jalankan lewat
// `docs/jalankan-smoke-ui.sh admin` (skrip itu menyalakan semuanya sendiri).
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_ADMIN = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }

// Lebar desktop dipakai untuk memeriksa tata letak lebar; 390×844 @3 dengan UA
// Android dipakai untuk memeriksa jalur ponsel (laci, target sentuh, tabel).
const LEBAR_DESKTOP = 1280
const TINGGI_DESKTOP = 800
const LEBAR_HP = 390
const TINGGI_HP = 844
const DPR_HP = 3
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36'

/** Halaman yang memang boleh dibuka kepala sekolah. */
const HALAMAN = [
  '/',
  '/admin/akun',
  '/kelas',
  '/mapel',
  '/murid',
  '/bank-soal',
  '/tag',
  '/kuis',
  '/materi',
  '/pengaturan',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const hasil = []
function catat(nama, lolos, detail = '') {
  hasil.push({ nama, lolos })
  console.log(`${lolos ? 'LULUS' : 'GAGAL'} · ${nama}${detail ? ' · ' + detail : ''}`)
}

async function main() {
  const endpoint = await fetch(`${CDP}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl)
  const ws = new WebSocket(endpoint)
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

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)
    if (r.exceptionDetails) {
      throw new Error('eval error: ' + (r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)))
    }
    return r.result.value
  }

  const buka = async (jalur, jeda = 2400) => {
    await send('Page.navigate', { url: APP + jalur }, sessionId)
    await sleep(jeda)
  }

  /** Ganti ukuran jendela: desktop biasa, atau emulasi perangkat ponsel. */
  const pakaiLebar = async (lebar, tinggi, ponsel) => {
    if (ponsel) {
      await send('Emulation.setDeviceMetricsOverride', { width: lebar, height: tinggi, deviceScaleFactor: DPR_HP, mobile: true }, sessionId)
      await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId)
      await send('Emulation.setUserAgentOverride', { userAgent: UA_ANDROID, platform: 'Linux armv8l' }, sessionId)
      return
    }

    await send('Emulation.clearDeviceMetricsOverride', {}, sessionId)
    await send('Emulation.setTouchEmulationEnabled', { enabled: false }, sessionId)
    await send('Emulation.setUserAgentOverride', { userAgent: '' }, sessionId)
    await send('Emulation.setDeviceMetricsOverride', { width: lebar, height: tinggi, deviceScaleFactor: 1, mobile: false }, sessionId)
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
        const isi = await res.json().catch(() => null)
        return { status: res.status, peran: isi?.user?.role ?? isi?.data?.role ?? null }
      })()`)

      if (r.status !== 429) return r
      console.log('   (batas masuk per menit tercapai, menunggu 20 detik…)')
      await sleep(20_000)
    }
    return { status: 429, peran: null }
  }

  /**
   * Ukur keadaan tata letak halaman yang sedang terbuka.
   *
   * Ditulis ulang di sini (bukan memakai regex ber-escape ganda seperti harness
   * lain) supaya teks labelnya tetap terbaca di keluaran.
   */
  const ukur = () =>
    evalJs(`(() => {
      const vw = window.innerWidth
      const terlihat = (el) => {
        const r = el.getBoundingClientRect()
        const g = getComputedStyle(el)
        return r.width > 0 && r.height > 0 && g.visibility !== 'hidden' && g.display !== 'none' && g.opacity !== '0'
      }
      const label = (el) => {
        const kelas = typeof el.className === 'string' ? el.className.trim().split(' ').slice(0, 2).join('.') : ''
        const teks = (el.textContent || '').trim().split(' ').slice(0, 5).join(' ')
        return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (kelas ? '.' + kelas : '') + ' "' + teks.slice(0, 28) + '"'
      }

      const menembus = []
      for (const el of document.querySelectorAll('main *:not(svg):not(path):not(g)')) {
        if (!terlihat(el)) continue
        const r = el.getBoundingClientRect()
        if (r.right > vw + 1) menembus.push({ el: label(el), kanan: Math.round(r.right) })
      }
      menembus.sort((a, b) => b.kanan - a.kanan)

      const kecil = []
      const kontrol = [...document.querySelectorAll('main button, main a, .kepala-app button, .kepala-app a, nav a, footer a')]
      let kontrolTerlihat = 0
      for (const el of kontrol) {
        if (!terlihat(el)) continue
        kontrolTerlihat++
        const r = el.getBoundingClientRect()
        if (r.width < 44 || r.height < 44) kecil.push({ el: label(el), w: Math.round(r.width), h: Math.round(r.height) })
      }
      kecil.sort((a, b) => a.h * a.w - b.h * b.w)

      const tabel = [...document.querySelectorAll('main table')].map((t) => {
        let bisaGulir = false
        for (let p = t.parentElement; p && p !== document.body; p = p.parentElement) {
          const ov = getComputedStyle(p).overflowX
          if (ov === 'auto' || ov === 'scroll') {
            bisaGulir = true
            break
          }
        }
        return { lebar: Math.round(t.getBoundingClientRect().width), bisaGulir }
      })

      const teksIsi = document.querySelector('main p, main li, main td')
      return {
        vw,
        jalur: location.pathname,
        gulirMendatar: document.documentElement.scrollWidth - vw,
        menembus: menembus.slice(0, 3),
        menembusTotal: menembus.length,
        kecil: kecil.slice(0, 3),
        kecilTotal: kecil.length,
        kontrolTotal: kontrolTerlihat,
        tabel,
        hurufIsi: teksIsi ? parseFloat(getComputedStyle(teksIsi).fontSize) : null,
      }
    })()`)

  /** Teks seluruh menu (panel samping desktop atau laci ponsel). */
  const teksMenu = () =>
    evalJs(`(() => {
      const panel = document.querySelector('.papan-nav')
      const laci = document.querySelector('#laci-navigasi')
      const wadah = panel && panel.offsetParent !== null ? panel : laci
      return wadah ? wadah.textContent || '' : ''
    })()`)

  const adaTeks = (teks) => evalJs(`(document.body.innerText || '').includes(${JSON.stringify(teks)})`)

  const adaTombolBerteks = (teks) =>
    evalJs(`[...document.querySelectorAll('button, a.btn')].some((b) => (b.textContent || '').includes(${JSON.stringify(teks)}))`)

  const adaLabel = (label) => evalJs(`document.querySelector('[aria-label="' + ${JSON.stringify(label)} + '"]') !== null`)

  /** @type {string[]} */
  const gagal = []

  // ---------- 1. Masuk sebagai kepala sekolah ----------
  await buka('/masuk')
  const masukAdmin = await masuk(AKUN_ADMIN)
  catat('masuk sebagai kepala sekolah (admin@sekolah.test)', masukAdmin.status === 200 && masukAdmin.peran === 'admin', `status ${masukAdmin.status} · peran ${masukAdmin.peran ?? '(tidak ada)'}`)

  // ---------- 2. Sapuan tata letak di dua ukuran ----------
  for (const [namaUkuran, lebar, tinggi, ponsel] of [
    ['lebar 1280 px', LEBAR_DESKTOP, TINGGI_DESKTOP, false],
    ['ponsel 390×844', LEBAR_HP, TINGGI_HP, true],
  ]) {
    await pakaiLebar(lebar, tinggi, ponsel)

    const temuan = { gulir: [], menembus: [], kecil: [], huruf: [], tabel: [] }
    let kontrolDiperiksa = 0
    let vwTerukur = 0

    for (const jalur of HALAMAN) {
      await buka(jalur)
      const d = await ukur()
      vwTerukur = d.vw

      if (d.gulirMendatar > 1) temuan.gulir.push(`${jalur} (+${d.gulirMendatar} px)`)
      if (d.menembusTotal > 0) temuan.menembus.push(`${jalur}: ${d.menembus.map((m) => `${m.el} → ${m.kanan}px`).join(' · ')}`)
      if (ponsel && d.kecilTotal > 0) temuan.kecil.push(`${jalur}: ${d.kecilTotal}/${d.kontrolTotal} <44px (${d.kecil.map((k) => `${k.w}×${k.h} ${k.el}`).join(' · ')})`)
      if (d.hurufIsi !== null && d.hurufIsi < 14) temuan.huruf.push(`${jalur}: ${d.hurufIsi}px`)
      for (const t of d.tabel) {
        if (!t.bisaGulir && t.lebar > d.vw) temuan.tabel.push(`${jalur}: tabel ${t.lebar}px tanpa pembungkus gulir`)
      }
      kontrolDiperiksa += d.kontrolTotal
    }

    catat(`${namaUkuran} · lebar viewport terpakai`, vwTerukur === lebar, `vw=${vwTerukur} (diminta ${lebar})`)
    catat(
      `${namaUkuran} · tidak ada gulir mendatar di ${HALAMAN.length} halaman kepala sekolah`,
      temuan.gulir.length === 0,
      temuan.gulir.length === 0 ? 'bersih' : temuan.gulir.join(' · '),
    )
    catat(
      `${namaUkuran} · tidak ada elemen menembus tepi kanan`,
      temuan.menembus.length === 0,
      temuan.menembus.length === 0 ? 'bersih' : temuan.menembus.join('  |  '),
    )
    if (ponsel) {
      catat(
        `${namaUkuran} · semua target sentuh ≥ 44 px (${kontrolDiperiksa} kontrol diperiksa)`,
        temuan.kecil.length === 0,
        temuan.kecil.length === 0 ? 'bersih' : temuan.kecil.join('  |  '),
      )
    }
    catat(
      `${namaUkuran} · huruf teks isi ≥ 14 px`,
      temuan.huruf.length === 0,
      temuan.huruf.length === 0 ? 'terbaca' : temuan.huruf.join(' · '),
    )
    catat(
      `${namaUkuran} · tabel lebar digulir di dalam pembungkusnya`,
      temuan.tabel.length === 0,
      temuan.tabel.length === 0 ? 'semua tabel terkendali' : temuan.tabel.join(' · '),
    )
  }

  // ---------- 3. Menu kepala sekolah ----------
  await pakaiLebar(LEBAR_DESKTOP, TINGGI_DESKTOP, false)
  await buka('/')
  const menuDesktop = await teksMenu()
  catat(
    'menu kepala sekolah memuat Dasbor Sekolah + Kelola Akun',
    menuDesktop.includes('Dasbor Sekolah') && menuDesktop.includes('Kelola Akun'),
    menuDesktop.replace(/\s+/g, ' ').trim().slice(0, 80) || '(menu kosong)',
  )
  catat(
    'menu kepala sekolah tidak menawarkan jalur tulis (Impor Murid / Moderasi Avatar)',
    !menuDesktop.includes('Impor Murid') && !menuDesktop.includes('Moderasi Avatar'),
    menuDesktop.includes('Impor Murid') || menuDesktop.includes('Moderasi Avatar') ? 'masih ada' : 'bersih',
  )

  await pakaiLebar(LEBAR_HP, TINGGI_HP, true)
  await buka('/')
  await evalJs(`document.querySelector('.tombol-menu').click()`)
  await sleep(450)
  const menuPonsel = await teksMenu()
  catat(
    'di ponsel, menu kepala sekolah terbaca dari laci',
    menuPonsel.includes('Dasbor Sekolah') && menuPonsel.includes('Kelola Akun'),
    menuPonsel.replace(/\s+/g, ' ').trim().slice(0, 80) || '(laci kosong)',
  )
  await evalJs(`document.querySelector('#laci-navigasi a[href="/kelas"]').click()`)
  await sleep(1600)

  // ---------- 4. Halaman baca: tombol tulis hilang, catatannya ada ----------
  await pakaiLebar(LEBAR_DESKTOP, TINGGI_DESKTOP, false)

  await buka('/kelas')
  const kelasTambah = await adaTombolBerteks('Tambah kelas')
  const kelasUbah = await adaLabel('Ubah kelas') // label penuh memuat nama kelas
  const kelasUbahSemua = await evalJs(`[...document.querySelectorAll('main [aria-label]')].filter((el) => (el.getAttribute('aria-label') || '').startsWith('Ubah kelas')).length`)
  catat('halaman Kelas tanpa tombol tambah & aksi', !kelasTambah && !kelasUbah, `tambah=${kelasTambah} aksi=${kelasUbahSemua}`)
  catat('halaman Kelas memuat catatan "Hanya melihat."', await adaTeks('Hanya melihat.'))

  await buka('/murid')
  const muridTambah = await adaTombolBerteks('Tambah murid')
  const muridImpor = await adaTombolBerteks('Impor CSV')
  const muridEkspor = await adaTombolBerteks('Ekspor CSV')
  catat(
    'halaman Murid: tambah & impor hilang, ekspor tetap ada (itu membaca)',
    !muridTambah && !muridImpor && muridEkspor,
    `tambah=${muridTambah} impor=${muridImpor} ekspor=${muridEkspor}`,
  )

  await buka('/bank-soal')
  catat(
    'Bank soal: tanpa "Tambah soal", catatan hanya-melihat tampil',
    !(await adaTombolBerteks('Tambah soal')) && (await adaTeks('Hanya melihat.')),
  )

  await buka('/kuis')
  const kuisBuat = await adaTombolBerteks('Buat kuis')
  const kuisDetail = await adaTombolBerteks('Lihat detail')
  catat('Kuis: tanpa "Buat kuis", tetapi punya jalan masuk "Lihat detail"', !kuisBuat && kuisDetail, `buat=${kuisBuat} detail=${kuisDetail}`)

  await buka('/materi')
  const materiBaru = await adaTombolBerteks('Buat & buka editor')
  const materiEditor = await adaTombolBerteks('Buka editor')
  catat('Materi: form materi baru & editor hilang, daftarnya tetap terbaca', !materiBaru && !materiEditor, `baru=${materiBaru} editor=${materiEditor}`)

  // ---------- 5. Jalur baca yang memang tugasnya ----------
  const kuisUntukMonitor = await evalJs(`fetch('/api/v1/kuis?per_page=50', { credentials: 'include', headers: { Accept: 'application/json' } })
    .then((r) => r.json())
    .then((d) => {
      const arr = Array.isArray(d) ? d : (d.data ?? [])
      const k = arr[0]
      return k ? { kunci: k.slug ?? k.id, judul: k.judul } : null
    })`)

  if (!kuisUntukMonitor) {
    catat('Monitor ulangan terbuka untuk kepala sekolah', false, 'tidak ada kuis di DB dev — bagian ini tidak bisa dibuktikan')
  } else {
    await buka(`/kuis/${kuisUntukMonitor.kunci}/monitor`, 3200)
    const diMonitor = await ukur()
    const tombolTinjau = await evalJs(`[...document.querySelectorAll('main button')].filter((b) => /^(Valid|Tidak valid)$/.test((b.textContent || '').trim())).length`)
    catat(
      'Monitor ulangan terbuka untuk kepala sekolah',
      diMonitor.jalur.includes('/monitor'),
      `jalur=${diMonitor.jalur} · kuis "${kuisUntukMonitor.judul}"`,
    )
    catat('Monitor ulangan tanpa tombol meninjau (Valid/Tidak valid)', tombolTinjau === 0, `tombol tinjau=${tombolTinjau}`)
    catat('Monitor ulangan memuat catatan "Hanya melihat."', await adaTeks('Hanya melihat.'))
  }

  await buka('/pengaturan')
  const jalurAkun = await evalJs('location.pathname')
  catat('halaman akun sendiri tetap milik kepala sekolah', jalurAkun === '/pengaturan', `jalur=${jalurAkun}`)

  await buka('/avatar')
  const jalurAvatar = await evalJs('location.pathname')
  catat('halaman avatar dialihkan untuk kepala sekolah', jalurAvatar === '/', `jalur=${jalurAvatar}`)

  await buka('/murid/impor')
  const jalurImpor = await evalJs('location.pathname')
  catat('halaman impor murid dialihkan untuk kepala sekolah', jalurImpor === '/', `jalur=${jalurImpor}`)

  // ---------- 6. Panel kelola akun: menu "…" berteks ----------
  await buka('/admin/akun')
  const barisAkun = await evalJs(`document.querySelectorAll('main [aria-label^="Menu aksi untuk"]').length`)
  catat('daftar akun termuat (ada baris ber-menu "…")', barisAkun > 0, `baris menu=${barisAkun}`)

  if (barisAkun > 0) {
    await evalJs(`document.querySelector('main [aria-label^="Menu aksi untuk"]').click()`)
    await sleep(300)
    const itemBaris = await evalJs(`[...document.querySelectorAll('.menu-aksi-daftar button')].map((b) => (b.textContent || '').trim())`)
    catat(
      'menu baris menampilkan tiga tindakan sebagai TEKS',
      itemBaris.length === 3 && itemBaris.some((t) => t.includes('Ubah email')) && itemBaris.some((t) => t.includes('kata sandi')),
      itemBaris.join(' · ') || '(kosong)',
    )

    await evalJs(`[...document.querySelectorAll('.menu-aksi-daftar button')][0].click()`)
    await sleep(700)

    const pilLama = await evalJs(`document.querySelector('[role="group"][aria-label="Pilih tindakan"]') !== null`)
    const tombolPanel = await evalJs(`document.querySelector('dialog [aria-label^="Pilih tindakan untuk"]') !== null`)
    catat('tiga pil tindakan sudah tidak ada di panel', !pilLama, `pil=${pilLama}`)
    catat('panel kelola akun punya satu tombol menu "…" berteks', tombolPanel, `tombol=${tombolPanel}`)

    await evalJs(`document.querySelector('dialog [aria-label^="Pilih tindakan untuk"]').click()`)
    await sleep(300)
    const itemPanel = await evalJs(`[...document.querySelectorAll('dialog .menu-aksi-daftar button')].map((b) => (b.textContent || '').trim())`)
    catat(
      'menu "…" panel membuka pilihan berteks (email · sandi · status)',
      itemPanel.length === 3,
      itemPanel.join(' · ') || '(kosong)',
    )

    await evalJs(`[...document.querySelectorAll('dialog .menu-aksi-daftar button')].find((b) => (b.textContent || '').includes('kata sandi')).click()`)
    await sleep(400)
    const judulPanel = await evalJs(`(document.querySelector('#judul-panel-form')?.textContent || '').trim()`)
    const menuTertutup = await evalJs(`document.querySelectorAll('dialog .menu-aksi-daftar').length === 0`)
    catat(
      'memilih tindakan menutup menu dan mengganti isi panel',
      judulPanel.toLowerCase().includes('sandi') && menuTertutup,
      `judul="${judulPanel}" menuTertutup=${menuTertutup}`,
    )

    // Esc menutup menu tanpa menutup panelnya.
    await evalJs(`document.querySelector('dialog [aria-label^="Pilih tindakan untuk"]').click()`)
    await sleep(250)
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId)
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId)
    await sleep(350)
    const setelahEsc = await evalJs(`({ menu: document.querySelectorAll('dialog .menu-aksi-daftar').length, panel: document.querySelector('dialog')?.open === true })`)
    catat('Escape menutup menu "…" tanpa menutup panelnya', setelahEsc.menu === 0 && setelahEsc.panel, `menu=${setelahEsc.menu} panelTerbuka=${setelahEsc.panel}`)
  }

  // Tata letak panel itu sendiri di ponsel: dialognya harus muat di layar.
  await pakaiLebar(LEBAR_HP, TINGGI_HP, true)
  await buka('/admin/akun', 3000)
  await evalJs(`document.querySelector('main [aria-label^="Menu aksi untuk"]')?.click()`)
  await sleep(300)
  await evalJs(`document.querySelectorAll('.menu-aksi-daftar button')[0]?.click()`)
  await sleep(800)
  const panelHp = await evalJs(`(() => {
    const d = document.querySelector('dialog')
    if (!d) return null
    const r = d.getBoundingClientRect()
    const kiri = Math.round(r.left), kanan = Math.round(r.right)
    const isian = [...d.querySelectorAll('input, textarea, select, button')].filter((el) => el.getBoundingClientRect().width > 0)
    const kecil = isian.filter((el) => {
      const rr = el.getBoundingClientRect()
      return rr.width < 44 || rr.height < 44
    }).length
    return { kiri, kanan, vw: window.innerWidth, gulir: d.scrollWidth - d.clientWidth, isian: isian.length, kecil }
  })()`)
  catat(
    'panel kelola akun muat di layar ponsel (tanpa gulir mendatar, isiannya ≥44 px)',
    panelHp !== null && panelHp.kiri >= -1 && panelHp.kanan <= panelHp.vw + 1 && panelHp.gulir <= 1 && panelHp.kecil === 0,
    panelHp ? `kiri=${panelHp.kiri} kanan=${panelHp.kanan} vw=${panelHp.vw} gulir=${panelHp.gulir} isian<44px=${panelHp.kecil}/${panelHp.isian}` : 'panel tidak terbuka',
  )

  await evalJs(`document.querySelector('dialog [aria-label^="Tutup panel"]')?.click()`)
  await sleep(400)

  // ---------- 7. Server yang memutuskan (dari sesi peramban ini) ----------
  const kelasId = await evalJs(`fetch('/api/v1/kelas', { credentials: 'include', headers: { Accept: 'application/json' } })
    .then((r) => r.json())
    .then((d) => {
      const arr = Array.isArray(d) ? d : (d.data ?? [])
      return arr[0]?.id ?? null
    })`)

  const tulisIzin = await evalJs(`(async () => {
    const xsrf = () => decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '')
    const kirim = async (url, metode, isi) => {
      const res = await fetch(url, {
        method: metode,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': xsrf() },
        body: isi ? JSON.stringify(isi) : undefined,
      })
      return res.status
    }
    const baca = async (url) => (await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } })).status
    return {
      ubahKelas: ${kelasId === null ? "'tidak ada kelas untuk diuji'" : `await kirim('/api/v1/kelas/${kelasId}', 'PUT', { nama: 'Coba ubah kepala sekolah', tingkat: 4 })`},
      tambahKelas: await kirim('/api/v1/kelas', 'POST', { nama: 'Kelas dari kepala sekolah', tingkat: 4 }),
      monitor: await baca('/api/v1/admin/monitor'),
      akun: await baca('/api/v1/admin/akun'),
      kuis: await baca('/api/v1/kuis'),
    }
  })()`)

  catat('server menolak ubah kelas oleh kepala sekolah (403)', tulisIzin.ubahKelas === 403, `status=${tulisIzin.ubahKelas}`)
  catat('server menolak tambah kelas oleh kepala sekolah (403)', tulisIzin.tambahKelas === 403, `status=${tulisIzin.tambahKelas}`)
  catat('dasbor sekolah & daftar akun tetap terbuka (200)', tulisIzin.monitor === 200 && tulisIzin.akun === 200, `monitor=${tulisIzin.monitor} akun=${tulisIzin.akun}`)
  catat('daftar kuis tetap terbaca kepala sekolah (200)', tulisIzin.kuis === 200, `status=${tulisIzin.kuis}`)

  // ---------- Bersih-bersih ----------
  await pakaiLebar(LEBAR_DESKTOP, TINGGI_DESKTOP, false)
  await buka('/masuk')
  await evalJs(`fetch('/api/v1/auth/keluar', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json',
      'X-XSRF-TOKEN': decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '') },
  }).then((r) => r.status)`)

  await send('Emulation.clearDeviceMetricsOverride', {}, sessionId)
  await send('Target.closeTarget', { targetId })
  ws.close()

  const gagalTotal = hasil.filter((satu) => !satu.lolos)
  console.log('')
  console.log(`smoke admin: ${hasil.length - gagalTotal.length}/${hasil.length} lulus`)
  process.exit(gagalTotal.length === 0 ? 0 : 1)
}

main().catch((galat) => {
  console.error('smoke admin gagal:', galat.message)
  process.exit(1)
})
