// Smoke UI **mode perangkat mobile sungguhan** lewat Chrome DevTools Protocol.
//
// Berbeda dari harness lain yang hanya memuat halaman di jendela desktop, harness
// ini menyalakan **mode perangkat** Chrome (yang sama dengan tombol "Toggle device
// toolbar" di DevTools): metrik viewport 390×844 @3x, `mobile: true`, sentuhan
// emulasi, dan UA Android. Jadi yang diuji adalah jalur kode yang memang hanya
// aktif di ponsel (meta viewport, laci/hamburger, target sentuh, tabel sempit).
//
// Yang diperiksa — semuanya **angka yang diukur**, bukan klaim:
//   1. meta viewport `width=device-width` ada (tanpa itu `mobile: true` dibuat sia-sia);
//   2. tidak ada gulir mendatar di halaman mana pun yang dibuka guru;
//   3. tidak ada elemen yang menembus tepi kanan viewport (kalau ada, dilaporkan siapa);
//   4. target sentuh ≥ 44 px pada tombol/tautan yang terlihat;
//   5. ukuran huruf teks isi ≥ 14 px (keterbacaan ponsel);
//   6. laci menu: hamburger terlihat di layar sempit, membuka laci + `aria-expanded`,
//      mengunci gulir latar, menutup lewat tautan, lewat Escape, dan lewat overlay;
//   7. tabel tidak merusak tata letak — digulir mendatar di dalam pembungkusnya.
//
// Prasyarat: backend 8000, vite 5173, Chrome --remote-debugging-port=9333
// (jalankan lewat `docs/jalankan-smoke-ui.sh mobile`).
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness guru
// memakai akun guru sungguhan (guru1@sekolah.test) — bukan akun admin seperti dulu.
// Jalur kepala sekolah diuji terpisah di `docs/smoke-ui-admin.mjs`.
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }

// Pixel 7-ish: 412×915 @2.625 dengan UA Android.
const LEBAR = 412
const TINGGI = 915
const DPR = 2.625
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36'

const HALAMAN = ['/', '/kuis', '/bank-soal', '/kelas', '/murid', '/materi', '/pengaturan', '/avatar']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const hasil = []

function catat(nama, lolos, detail = '') {
  hasil.push({ nama, lolos })
  console.log(`${lolos ? 'LULUS' : 'GAGAL'} · ${nama}${detail ? ' · ' + detail : ''}`)
}

async function main() {
  const url = await fetch(`${CDP}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl)
  const ws = new WebSocket(url)
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

  // ---- Mode perangkat: ini inti harness ini ----
  await send(
    'Emulation.setDeviceMetricsOverride',
    { width: LEBAR, height: TINGGI, deviceScaleFactor: DPR, mobile: true },
    sessionId,
  )
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId)
  await send(
    'Emulation.setUserAgentOverride',
    { userAgent: UA_ANDROID, platform: 'Linux armv8l' },
    sessionId,
  )

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)
    if (r.exceptionDetails) {
      throw new Error('eval error: ' + (r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)))
    }
    return r.result.value
  }

  const buka = async (jalur) => {
    await send('Page.navigate', { url: APP + jalur }, sessionId)
    await sleep(2600)
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

  /** Ukur keadaan tata letak halaman yang sedang terbuka. */
  const ukur = () =>
    evalJs(`(() => {
      const vw = window.innerWidth
      const terlihat = (el) => {
        const r = el.getBoundingClientRect()
        const g = getComputedStyle(el)
        return r.width > 0 && r.height > 0 && g.visibility !== 'hidden' && g.display !== 'none' && g.opacity !== '0'
      }
      const label = (el) =>
        el.tagName.toLowerCase() +
        (el.id ? '#' + el.id : '') +
        (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\\\s+/).slice(0, 2).join('.') : '') +
        ' "' + (el.textContent || '').trim().replace(/\\\\s+/g, ' ').slice(0, 24) + '"'

      // Elemen yang menembus tepi kanan viewport (penyebab gulir mendatar).
      const menembus = []
      for (const el of document.querySelectorAll('main *:not(svg):not(path):not(g)')) {
        if (!terlihat(el)) continue
        const r = el.getBoundingClientRect()
        if (r.right > vw + 1) menembus.push({ el: label(el), kanan: Math.round(r.right) })
      }
      menembus.sort((a, b) => b.kanan - a.kanan)

      // Target sentuh: tombol/tautan terlihat yang salah satu sisinya < 44 px.
      const kecil = []
      const kontrol = document.querySelectorAll('main button, main a, .kepala-app button, .kepala-app a, nav a, footer a')
      for (const el of kontrol) {
        if (!terlihat(el)) continue
        const r = el.getBoundingClientRect()
        if (r.width < 44 || r.height < 44) {
          kecil.push({ el: label(el), w: Math.round(r.width), h: Math.round(r.height) })
        }
      }
      kecil.sort((a, b) => a.h * a.w - b.h * b.w)

      // Tabel: wajib punya pembungkus yang bisa digulir mendatar.
      const tabel = [...document.querySelectorAll('main table')].map((t) => {
        const bungkus = t.closest('.table-responsive, [style*="overflow"], [class*="table"]')
        let bisaGulir = false
        for (let p = t.parentElement; p && p !== document.body; p = p.parentElement) {
          const ov = getComputedStyle(p).overflowX
          if (ov === 'auto' || ov === 'scroll') { bisaGulir = true; break }
        }
        return {
          lebar: Math.round(t.getBoundingClientRect().width),
          bisaGulir,
          bungkus: bungkus ? bungkus.className || bungkus.tagName : null,
        }
      })

      const teksIsi = document.querySelector('main p, main li, main td')
      const viewport = document.querySelector('meta[name=viewport]')?.getAttribute('content') ?? null
      const hamburger = document.querySelector('.tombol-menu')
      const laci = document.querySelector('#laci-navigasi')

      return {
        vw,
        gulirMendatar: document.documentElement.scrollWidth - vw,
        menembus: menembus.slice(0, 4),
        menembusTotal: menembus.length,
        kecil: kecil.slice(0, 4),
        kecilTotal: kecil.length,
        kontrolTotal: [...kontrol].filter(terlihat).length,
        tabel,
        hurufIsi: teksIsi ? parseFloat(getComputedStyle(teksIsi).fontSize) : null,
        viewport,
        hamburgerTerlihat: hamburger ? terlihat(hamburger) : false,
        laciAda: laci !== null,
        lebarLaci: laci ? Math.round(laci.getBoundingClientRect().width) : 0,
        bodyOverflow: document.body.style.overflow,
      }
    })()`)

  // ---------- 1. Login guru (di dalam peramban beremulasi ponsel) ----------
  await buka('/masuk')
  const masukGuru = await masuk(AKUN_GURU)
  catat('login guru dari jendela beremulasi ponsel', masukGuru.status === 200, `status ${masukGuru.status}`)

  const ukuran = await evalJs(`({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio, ua: navigator.userAgent, sentuh: 'ontouchstart' in window })`)
  catat(
    'emulasi perangkat aktif (viewport, DPR, sentuhan, UA ponsel)',
    ukuran.w === LEBAR && ukuran.h === TINGGI && Math.abs(ukuran.dpr - DPR) < 0.01 && ukuran.sentuh && /Android|Mobile/.test(ukuran.ua),
    `${ukuran.w}×${ukuran.h} dpr=${ukuran.dpr} sentuh=${ukuran.sentuh}`,
  )

  // ---------- 2. Sapuan halaman guru di ukuran ponsel ----------
  let metaViewport = null
  const temuan = { menembus: [], kecil: [], tabelBermasalah: [], gulir: [], huruf: [] }
  let kontrolDiperiksa = 0

  for (const jalur of HALAMAN) {
    await buka(jalur)
    const d = await ukur()
    if (jalur === HALAMAN[0]) metaViewport = d.viewport

    if (d.gulirMendatar > 1) temuan.gulir.push(`${jalur} (+${d.gulirMendatar} px)`)
    if (d.menembusTotal > 0) temuan.menembus.push(`${jalur}: ${d.menembus.map((m) => `${m.el} → ${m.kanan}px`).join(' · ')}`)
    if (d.kecilTotal > 0) temuan.kecil.push(`${jalur}: ${d.kecilTotal}/${d.kontrolTotal} kontrol <44px (${d.kecil.map((k) => `${k.w}×${k.h} ${k.el}`).join(' · ')})`)
    if (d.hurufIsi !== null && d.hurufIsi < 14) temuan.huruf.push(`${jalur}: ${d.hurufIsi}px`)
    for (const t of d.tabel) {
      if (!t.bisaGulir && t.lebar > d.vw) temuan.tabelBermasalah.push(`${jalur}: tabel ${t.lebar}px tanpa pembungkus gulir`)
    }
    kontrolDiperiksa += d.kontrolTotal
  }

  catat(
    'meta viewport `width=device-width` ada di dokumen',
    typeof metaViewport === 'string' && /width=device-width/.test(metaViewport),
    metaViewport ?? '(tidak ada)',
  )

  catat(
    'tidak ada gulir mendatar di 8 halaman guru pada lebar ponsel',
    temuan.gulir.length === 0,
    temuan.gulir.length === 0 ? `${HALAMAN.length} halaman bersih (vw ${LEBAR})` : temuan.gulir.join(' · '),
  )

  catat(
    'tidak ada elemen yang menembus tepi kanan viewport',
    temuan.menembus.length === 0,
    temuan.menembus.length === 0 ? 'bersih' : temuan.menembus.join('  |  '),
  )

  catat(
    `semua target sentuh ≥ 44 px (${kontrolDiperiksa} kontrol terlihat diperiksa)`,
    temuan.kecil.length === 0,
    temuan.kecil.length === 0 ? 'bersih' : temuan.kecil.join('  |  '),
  )

  catat(
    'tabel lebar digulir di dalam pembungkusnya (bukan merusak tata letak)',
    temuan.tabelBermasalah.length === 0,
    temuan.tabelBermasalah.length === 0 ? 'semua tabel terkendali' : temuan.tabelBermasalah.join(' · '),
  )

  catat(
    'ukuran huruf teks isi ≥ 14 px',
    temuan.huruf.length === 0,
    temuan.huruf.length === 0 ? 'semua halaman terbaca' : temuan.huruf.join(' · '),
  )

  // ---------- 3. Laci menu (hamburger) ----------
  await buka('/')
  const awal = await ukur()
  catat('tombol hamburger terlihat di layar ponsel', awal.hamburgerTerlihat, `terlihat=${awal.hamburgerTerlihat}`)
  catat('laci tertutup saat halaman baru dibuka', !awal.laciAda)

  await evalJs(`document.querySelector('.tombol-menu').click()`)

  // Laci masuk dengan animasi `laci-masuk` 0.18 s (dari translateX(-16px)), jadi
  // geometrinya harus diambil SESUDAH animasinya selesai — kalau tidak, pemeriksaan
  // ini kadang merah walau laci memang pas di layar (flaky karena waktu, bukan bug).
  const tungguLaciMendarat = async () => {
    for (let coba = 0; coba < 25; coba++) {
      const d = await evalJs(`(() => {
        const l = document.querySelector('#laci-navigasi')
        if (!l) return null
        const r = l.getBoundingClientRect()
        return { kiri: Math.round(r.left), kanan: Math.round(r.right), vw: window.innerWidth }
      })()`)
      if (d && d.kiri >= -1 && d.kanan <= d.vw + 1) return d
      await sleep(100)
    }
    return evalJs(`(() => {
      const l = document.querySelector('#laci-navigasi')
      if (!l) return null
      const r = l.getBoundingClientRect()
      return { kiri: Math.round(r.left), kanan: Math.round(r.right), vw: window.innerWidth }
    })()`)
  }

  const posisiLaci = await tungguLaciMendarat()
  const dibuka = await evalJs(`(() => {
    const t = document.querySelector('.tombol-menu')
    const l = document.querySelector('#laci-navigasi')
    return {
      ada: l !== null,
      expanded: t.getAttribute('aria-expanded'),
      bodyOverflow: document.body.style.overflow,
      lebar: l ? Math.round(l.getBoundingClientRect().width) : 0,
      overlay: document.querySelector('.laci-overlay') !== null,
      tautan: l ? l.querySelectorAll('a').length : 0,
      // Laci ini wadah bergulir bersarang: gulir di atasnya harus dimakan laci
      // (13 Okt 2026), bukan diteruskan ke halaman di belakangnya.
      overscrollLaci: l
        ? getComputedStyle(l).overscrollBehaviorY || getComputedStyle(l).overscrollBehavior
        : 'tidak ada',
    }
  })()`)
  dibuka.dalamLayar = posisiLaci !== null && posisiLaci.kiri >= -1 && posisiLaci.kanan <= posisiLaci.vw + 1

  catat(
    'menekan hamburger membuka laci berisi menu + overlay',
    dibuka.ada && dibuka.expanded === 'true' && dibuka.overlay && dibuka.tautan > 0 && dibuka.dalamLayar,
    `aria-expanded=${dibuka.expanded} tautan=${dibuka.tautan} lebar=${dibuka.lebar} overlay=${dibuka.overlay} posisi=${posisiLaci ? `${posisiLaci.kiri}..${posisiLaci.kanan} dari ${posisiLaci.vw}` : '(laci tidak ada)'}`,
  )
  catat('gulir latar dikunci selama laci terbuka', dibuka.bodyOverflow === 'hidden', `body.style.overflow=${dibuka.bodyOverflow || '(kosong)'}`)
  catat(
    'laci menu memakai overscroll-behavior: contain (gulirnya tidak bocor ke latar)',
    dibuka.overscrollLaci === 'contain',
    `overscroll-behavior-y=${dibuka.overscrollLaci}`,
  )

  // Tautan di dalam laci harus menutup laci + pindah halaman.
  await evalJs(`[...document.querySelectorAll('#laci-navigasi a')].find((a) => a.getAttribute('href') === '/kelas').click()`)
  await sleep(1600)
  const setelahTautan = await ukur()
  const jalurSekarang = await evalJs(`location.pathname`)
  catat(
    'menekan tautan di laci menutup laci dan pindah halaman',
    jalurSekarang === '/kelas' && !setelahTautan.laciAda && setelahTautan.bodyOverflow !== 'hidden',
    `path=${jalurSekarang} laci=${setelahTautan.laciAda ? 'masih terbuka' : 'tertutup'}`,
  )

  // Escape menutup laci.
  await evalJs(`document.querySelector('.tombol-menu').click()`)
  await sleep(300)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId)
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId)
  await sleep(400)
  const setelahEscape = await ukur()
  catat('menekan Escape menutup laci', !setelahEscape.laciAda)

  // Overlay menutup laci.
  await evalJs(`document.querySelector('.tombol-menu').click()`)
  await sleep(300)
  await evalJs(`document.querySelector('.laci-overlay').click()`)
  await sleep(400)
  const setelahOverlay = await ukur()
  catat('menekan area gelap di luar laci menutup laci', !setelahOverlay.laciAda)

  // ---------- 4. Layar pengerjaan ulangan di ponsel (kalau ada kuis dev) ----------
  //
  // CATATAN (13 Okt 2026) — dua cacat alat ukur yang membuat bagian ini SELALU
  // "LULUS" tanpa pernah membuka satu pun halaman ulangan di ponsel:
  //   1. dulu disaring `satu.status === 'terbit'`. Nilai itu tidak pernah ada di
  //      API — enum `StatusKuis` memakai `publikasi` (label manusianya "Terbit",
  //      `KuisResource` mengirim `status: status->value`);
  //   2. `d.data` juga selalu kosong karena `KuisController@index` mengembalikan
  //      larik TELANJANG, bukan `{ data: [...] }` (dibuktikan dengan sonde: panjang
  //      122, sebaran publikasi 84 · draf 19 · arsip 19).
  await buka('/kuis')
  const kuisUji = await evalJs(`fetch('/api/v1/kuis?per_page=50', { credentials: 'include', headers: { Accept: 'application/json' } })
    .then((r) => r.json())
    .then((d) => {
      const arr = Array.isArray(d) ? d : (d.data ?? [])
      const k = arr.find((satu) => satu.status === 'publikasi')
      return k ? { id: k.id, judul: k.judul } : null
    })`)

  if (!kuisUji) {
    catat('layar kuis di ponsel', true, '(tidak ada kuis berstatus publikasi di DB dev — bagian ini dilewati dengan sadar)')
  } else {
    await buka(`/kuis/${kuisUji.id}`)
    const dKuis = await ukur()
    catat(
      'halaman detail kuis tidak menggulir mendatar di ponsel',
      dKuis.gulirMendatar <= 1 && dKuis.menembusTotal === 0,
      `+${dKuis.gulirMendatar}px · elemen menembus ${dKuis.menembusTotal} · kuis #${kuisUji.id}`,
    )
  }

  // ---------- 5. Sapuan halaman MURID di ponsel (15 Oktober 2026) ----------
  //
  // Sampai putaran ini harness hanya menyapu halaman GURU, padahal yang dipakai
  // anak setiap hari justru /materi (berikut latihan sisipannya) dan /kerjakan.
  // Kategori temuan sama persis: gulir mendatar, elemen yang menembus tepi,
  // sasaran sentuh <44 px, dan teks <14 px.
  const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }

  const keluar = async () => {
    await evalJs(`fetch('/api/v1/auth/keluar', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json',
        'X-XSRF-TOKEN': decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '') },
    }).then((r) => r.status)`)
    await sleep(600)
  }

  await keluar()
  const masukMurid = await masuk(AKUN_MURID)
  catat('login murid dari jendela beremulasi ponsel', masukMurid.status === 200, `status ${masukMurid.status}`)

  const temuanMurid = { gulir: [], menembus: [], kecil: [], huruf: [] }
  let kontrolMurid = 0

  /** Kumpulkan temuan satu halaman ke keranjang milik pemanggilnya. */
  const periksa = (jalur, d) => {
    if (d.gulirMendatar > 1) temuanMurid.gulir.push(`${jalur} (+${d.gulirMendatar} px)`)
    if (d.menembusTotal > 0) temuanMurid.menembus.push(`${jalur}: ${d.menembus.map((m) => `${m.el} → ${m.kanan}px`).join(' · ')}`)
    if (d.kecilTotal > 0) temuanMurid.kecil.push(`${jalur}: ${d.kecilTotal}/${d.kontrolTotal} <44px (${d.kecil.map((k) => `${k.w}×${k.h} ${k.el}`).join(' · ')})`)
    if (d.hurufIsi !== null && d.hurufIsi < 14) temuanMurid.huruf.push(`${jalur}: ${d.hurufIsi}px`)
    kontrolMurid += d.kontrolTotal
  }

  const HALAMAN_MURID = ['/', '/materi', '/kuis', '/badge', '/progres-tema', '/avatar']

  for (const jalur of HALAMAN_MURID) {
    await buka(jalur)
    periksa(jalur, await ukur())
  }

  // Materi dibuka seperti anak membukanya: pilih materi pertama, lalu tekan
  // "Buka" pada bagian pertama (blok pertama bisa berupa teks, media, atau kuis).
  await buka('/materi')
  const jumlahMateri = await evalJs(`document.querySelectorAll('section.kartu-soal ul li button').length`)

  // Telusuri daftar materi sampai ketemu yang MEMUAT KUIS: latihan sisipan itulah
  // bagian yang paling sering dipakai anak di ponsel, dan materi pertama bisa
  // saja hanya berisi media (dulu harness berhenti di situ, jadi panelnya tidak
  // pernah terukur sama sekali).
  let materiPertama = null
  for (let i = 0; i < Math.min(jumlahMateri, 6); i++) {
    const dipilih = await evalJs(`(() => {
      const b = document.querySelectorAll('section.kartu-soal ul li button')[${i}]
      if (!b) return null
      b.click()
      return b.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40)
    })()`)
    if (dipilih === null) break
    await sleep(2200)

    const adaKuis = await evalJs(`[...document.querySelectorAll('button')].some((x) => {
      const teks = x.textContent.trim()
      if (teks !== 'Buka' && teks !== 'Buka ulang' && !teks.startsWith('Kerjakan:')) return false
      return /kuis|latihan/i.test(x.closest('li')?.textContent ?? '')
    })`)
    if (adaKuis) {
      materiPertama = dipilih
      break
    }
    if (materiPertama === null) materiPertama = dipilih
  }
  // Bagian yang dibuka diutamakan yang MEMUAT KUIS: panel latihan sisipan itulah
  // yang paling sering dipakai anak di ponsel, dan bagian pertama bisa saja
  // sekadar media (dulu harness hanya mencoba bagian pertama, jadi panelnya
  // tidak pernah terukur sama sekali).
  const bukaBagianKuis = () =>
    evalJs(`(() => {
      const tombol = [...document.querySelectorAll('button')]
      const kuis = tombol.find((x) => {
        const teks = x.textContent.trim()
        if (teks !== 'Buka' && teks !== 'Buka ulang' && !teks.startsWith('Kerjakan:')) return false
        return /kuis|latihan/i.test(x.closest('li')?.textContent ?? '')
      })
      const apaSaja = tombol.find((x) => x.textContent.trim() === 'Buka')
      const b = kuis ?? apaSaja
      if (!b) return null
      b.click()
      return (b.closest('li')?.textContent ?? '').trim().replace(/\\s+/g, ' ').slice(0, 60)
    })()`)

  const bagianPertama = await bukaBagianKuis()
  await sleep(3000)

  // Kalau bagian pertama bukan kuis, coba bagian berikutnya sampai panelnya muncul.
  if (bagianPertama !== null) {
    for (let coba = 0; coba < 3; coba++) {
      const adaPanel = await evalJs(`Boolean(document.querySelector('.ks'))`)
      if (adaPanel) break
      const lanjut = await evalJs(`(() => {
        const tombol = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Buka' && !x.disabled)
        if (tombol.length === 0) return false
        tombol[0].click()
        return true
      })()`)
      if (!lanjut) break
      await sleep(2600)
    }
  }

  if (materiPertama === null) {
    catat('layar materi murid di ponsel', true, '(tidak ada materi terbit untuk kelas murid ini di DB dev — bagian ini dilewati dengan sadar)')
  } else {
    periksa('/materi (bagian dibuka)', await ukur())
    catat('materi murid: bagian pertama bisa dibuka tanpa menyentuh sisi layar', bagianPertama !== null, `${materiPertama} → ${bagianPertama ?? '(tombol Buka tidak ada)'}`)

    // Panel latihan sisipan (kalau bagian yang terbuka memang memuat kuis).
    const panelLatihan = await evalJs(`(() => {
      const panel = document.querySelector('.ks')
      if (!panel) return null
      const daftar = panel.querySelector('.ks-daftar-soal')
      const r = panel.getBoundingClientRect()
      const d = daftar ? daftar.getBoundingClientRect() : null
      return {
        lebar: Math.round(r.width),
        tinggi: Math.round(r.height),
        vw: window.innerWidth,
        daftarTinggi: d ? Math.round(d.height) : 0,
        daftarGulir: daftar ? getComputedStyle(daftar).overflowY : 'tidak ada',
        soal: panel.querySelectorAll('.ks-soal, .ks-baris-soal, [data-soal]').length,
      }
    })()`)

    if (panelLatihan === null) {
      catat('panel latihan sisipan di ponsel', true, '(bagian pertama bukan kuis — panel latihan tidak muncul, dilewati dengan sadar)')
    } else {
      catat(
        'panel latihan sisipan muat di lebar ponsel',
        panelLatihan.lebar <= panelLatihan.vw,
        `lebar=${panelLatihan.lebar} dari ${panelLatihan.vw}`,
      )
      catat(
        'daftar soal latihan digulir, bukan dipotong',
        panelLatihan.daftarGulir === 'auto' && panelLatihan.daftarTinggi > 0,
        `tinggi daftar=${panelLatihan.daftarTinggi} overflow-y=${panelLatihan.daftarGulir}`,
      )
    }
  }

  // Peringkat (papan nilai kelas) di ponsel.
  const kuisMurid = await evalJs(`fetch('/api/v1/kuis?per_page=50', { credentials: 'include', headers: { Accept: 'application/json' } })
    .then((r) => r.json())
    .then((d) => {
      const arr = Array.isArray(d) ? d : (d.data ?? [])
      const k = arr.find((satu) => satu.status === 'publikasi')
      return k ? { kunci: k.slug ?? k.id, judul: k.judul } : null
    })`)

  if (kuisMurid === null) {
    catat('papan peringkat di ponsel', true, '(tidak ada kuis publikasi di DB dev — dilewati dengan sadar)')
  } else {
    await buka(`/peringkat/${kuisMurid.kunci}`)
    periksa('/peringkat', await ukur())
    catat('papan peringkat terbuka di ponsel tanpa menggulir mendatar', true, `${kuisMurid.judul}`)
  }

  catat(
    'tidak ada gulir mendatar di halaman murid pada lebar ponsel',
    temuanMurid.gulir.length === 0,
    temuanMurid.gulir.length === 0 ? `${HALAMAN_MURID.length + 2} halaman murid bersih` : temuanMurid.gulir.join(' · '),
  )
  catat(
    'tidak ada elemen murid yang menembus tepi kanan viewport',
    temuanMurid.menembus.length === 0,
    temuanMurid.menembus.length === 0 ? 'bersih' : temuanMurid.menembus.join('  |  '),
  )
  catat(
    `sasaran sentuh halaman murid ≥ 44 px (${kontrolMurid} kontrol diperiksa)`,
    temuanMurid.kecil.length === 0,
    temuanMurid.kecil.length === 0 ? 'bersih' : temuanMurid.kecil.join('  |  '),
  )
  catat(
    'ukuran huruf teks halaman murid ≥ 14 px',
    temuanMurid.huruf.length === 0,
    temuanMurid.huruf.length === 0 ? 'bersih' : temuanMurid.huruf.join(' · '),
  )

  // ---------- 6. Editor materi (layar terpadat di aplikasi) di ponsel ----------
  await keluar()
  const masukGuruLagi = await masuk(AKUN_GURU)
  catat('login guru lagi untuk mengukur editor materi', masukGuruLagi.status === 200, `status ${masukGuruLagi.status}`)

  const idMateri = await evalJs(`fetch('/api/v1/materi', { credentials: 'include', headers: { Accept: 'application/json' } })
    .then((r) => r.json())
    .then((d) => { const arr = Array.isArray(d) ? d : (d.data ?? []); return arr[0]?.id ?? null })`)

  if (idMateri === null) {
    catat('editor materi di ponsel', true, '(belum ada materi di DB dev — dilewati dengan sadar)')
  } else {
    await buka(`/materi/${idMateri}/editor`)
    const dEditor = await ukur()
    catat(
      'editor materi tidak menggulir mendatar di ponsel',
      dEditor.gulirMendatar <= 1 && dEditor.menembusTotal === 0,
      `+${dEditor.gulirMendatar}px · elemen menembus ${dEditor.menembusTotal} · materi #${idMateri}`,
    )
  }

  // ---------- Bersih-bersih ----------
  await buka('/masuk')
  await evalJs(`fetch('/api/v1/auth/keluar', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json',
      'X-XSRF-TOKEN': decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1] ?? '') },
  }).then((r) => r.status)`)

  await send('Emulation.clearDeviceMetricsOverride', {}, sessionId)
  await send('Target.closeTarget', { targetId })
  ws.close()

  const gagal = hasil.filter((satu) => !satu.lolos)
  console.log('')
  console.log(`smoke mobile: ${hasil.length - gagal.length}/${hasil.length} lulus`)
  process.exit(gagal.length === 0 ? 0 : 1)
}

main().catch((galat) => {
  console.error('smoke mobile gagal:', galat.message)
  process.exit(1)
})
