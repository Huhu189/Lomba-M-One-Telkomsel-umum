// Smoke UI pita palet panel samping (CDP): warna panel guru (`var(--panel)`)
// harus menutupi SELURUH tepi kiri dari bawah kepala sampai bawah kolom konten,
// di halaman sepanjang apa pun — pita warna tidak boleh berhenti ("putus") di
// tengah halaman sementara konten masih berlanjut. Diuji di mode terang DAN
// gelap, karena paletnya memang bertukar nilai di antara keduanya.
//
// Dua kebijakan sekaligus dijaga, karena keduanya datang dari waktu berbeda:
//   1. 13 Okt 2026 — "panjangkan warna palet yang sidebar, jangan putus": pita
//      warna mengikuti tinggi kolom konten (termasuk kaki halaman).
//   2. 12 Okt 2026 — "sidebar harap flex agar tidak ada scrollbar": panel tetap
//      TIDAK punya gulir sendiri dan tetap ikut tergulir bersama halaman.
//      Tautan menu juga tidak boleh ikut meregang ke bawah hanya karena pitanya
//      memanjang (isi menu tetap menempel di atas).
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }

// Halaman guru dengan panjang isi berbeda-beda, supaya sifat "ikut setinggi
// kolom" terbukti di beberapa tinggi sekaligus (termasuk yang lebih pendek
// dari jendela).
const HALAMAN = ['/murid', '/kelas', '/kuis', '/pengaturan', '/beranda']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const hasil = []

function catat(nama, lolos, detail = '') {
  hasil.push({ nama, lolos })
  console.log(`${lolos ? 'LULUS' : 'GAGAL'} · ${nama}${detail ? ' · ' + detail : ''}`)
}

/** `#1a2f65` → `rgb(26, 47, 101)`, bentuk yang dikembalikan getComputedStyle. */
function hexKeRgb(hex) {
  const cocok = /^#([0-9a-f]{6})$/i.exec(String(hex).trim())
  if (cocok === null) return null
  const n = parseInt(cocok[1], 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
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

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)
    if (r.exceptionDetails) {
      throw new Error('eval error: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails))
    }
    return r.result.value
  }

  // Layar lebar: di bawah 992 px panel memang digantikan laci (Bootstrap
  // `d-lg-flex`), jadi tanpa ini yang terukur hanyalah laci yang tersembunyi.
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId)

  /**
   * Geometri pita palet: batas bawah kolom kiri, batas bawah panel, warna yang
   * benar-benar terlihat di lima titik tepi kiri, plus status gulir panel.
   */
  const ukur = `(async () => {
    const nav = document.querySelector('nav.papan-nav')
    if (!nav) return null
    const gaya = getComputedStyle(nav)
    const kotak = nav.getBoundingClientRect()
    const isi = document.querySelector('.kerangka-isi')
    const kaki = document.querySelector('.kaki-app')
    const konten = document.querySelector('#konten')
    // Batas bawah kolom kiri = dasar .kerangka-badan (baris yang memuat panel,
    // konten, dan kaki halaman) — inilah yang harus tertutup pita warna.
    const badan = document.querySelector('.kerangka-badan')
    const bawahKolom = Math.round((badan ?? isi ?? konten ?? nav).getBoundingClientRect().bottom)
    // Kepala lengket selalu menutupi 68 px teratas setelah halaman digulir, jadi
    // titik ukur teratas dimulai di bawahnya — kalau tidak, yang terukur adalah
    // kepalanya, bukan panelnya.
    const kepalaBawah = Math.round(document.querySelector('.kepala-app')?.getBoundingClientRect().bottom ?? 0)
    const taut = [...nav.querySelectorAll('.papan-nav-taut')]
    const tautTerakhir = taut.length > 0 ? taut[taut.length - 1].getBoundingClientRect() : null

    // Titik di tepi kiri, sedikit di dalam panel (x = 8 px). Yang dicatat adalah
    // PEMILIK pikselnya (elemen panel) dan warna latar elemen panel itu.
    const titik = (y) => {
      const el = document.elementFromPoint(8, y)
      const pemilik = el?.closest('nav.papan-nav')
      return {
        y: Math.round(y),
        ada: Boolean(pemilik),
        tag: el ? el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : '') : '—',
        warnaPanel: pemilik ? getComputedStyle(pemilik).backgroundColor : '—',
      }
    }

    return {
      tema: document.documentElement.getAttribute('data-bs-theme'),
      warnaPanelDeklarasi: getComputedStyle(document.documentElement).getPropertyValue('--panel').trim().toLowerCase(),
      warnaPanelElemen: gaya.backgroundColor,
      navBawah: Math.round(kotak.bottom),
      navTinggi: Math.round(kotak.height),
      bawahKolom,
      // Positif = pita warna MELAMPAUI dasar kolom (aman); negatif = PUTUS.
      selisih: Math.round(kotak.bottom) - bawahKolom,
      kenaKaki: kaki ? Math.round(kotak.bottom - kaki.getBoundingClientRect().bottom) : null,
      tautTerakhirBawah: tautTerakhir ? Math.round(tautTerakhir.bottom) : null,
      jarakMenuKeBawahPanel: tautTerakhir ? Math.round(kotak.bottom - tautTerakhir.bottom) : null,
      overflowY: gaya.overflowY,
      isi: nav.scrollHeight,
      muat: nav.clientHeight,
      gulirY: Math.round(window.scrollY),
      jendela: window.innerHeight,
      dokumen: document.scrollingElement.scrollHeight,
      titik: [
        titik(Math.max(kepalaBawah + 4, kotak.top + 4)),
        titik(window.innerHeight * 0.35),
        titik(window.innerHeight * 0.6),
        titik(window.innerHeight * 0.85),
        titik(window.innerHeight - 2),
      ],
    }
  })`

  try {
    await send('Page.navigate', { url: `${APP}/masuk` }, sessionId)
    await sleep(3500)
    const masuk = await evalJs(`(async () => {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
      const res = await fetch('/api/v1/auth/masuk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: JSON.stringify(${JSON.stringify(AKUN_GURU)}),
      })
      return res.status
    })()`)
    catat('login guru', masuk === 200, `status ${masuk}`)

    let adaHalamanPanjang = false

    /** Periksa satu halaman pada tema yang sedang berlaku. */
    const periksa = async (alamat, tema) => {
      await send('Page.navigate', { url: `${APP}${alamat}` }, sessionId)
      await sleep(3000)
      await evalJs('window.scrollTo(0, 0)')
      await sleep(300)
      // Tema ditentukan eksplisit: tema awal peramban headless mengikuti
      // preferensi perangkat, jadi "terang" tidak boleh diasumsikan.
      await evalJs(`document.documentElement.setAttribute('data-bs-theme','${tema === 'gelap' ? 'dark' : 'light'}')`)
      await sleep(400)

      const u = await evalJs(`${ukur}()`)
      const label = `${alamat} ${tema}`
      if (u === null) {
        catat(`panel samping ada (${label})`, false, 'nav.papan-nav tidak ditemukan')
        return
      }

      const panjang = u.dokumen > u.jendela + 200
      if (panjang) adaHalamanPanjang = true
      console.log(
        `  · ${label}: nav ${u.navTinggi}px (bawah ${u.navBawah}) · kolom kiri bawah ${u.bawahKolom} · ` +
          `selisih ${u.selisih}px · dokumen ${u.dokumen} vs jendela ${u.jendela}${panjang ? ' (panjang)' : ' (muat)'}`,
      )

      // Inti: pita warna minimal sedalam kolom kiri (tidak putus di tengah).
      catat(
        `pita palet menutupi sampai bawah kolom kiri (${label})`,
        u.selisih >= -1,
        `nav bawah=${u.navBawah} kolom bawah=${u.bawahKolom} selisih=${u.selisih}px`,
      )

      // Bukti piksel: di lima titik sepanjang tinggi jendela, yang tampak di tepi
      // kiri harus panelnya — bukan latar halaman yang kosong.
      catat(
        `tepi kiri berwarna panel di lima titik jendela (${label})`,
        u.titik.every((t) => t.ada),
        u.titik.map((t) => `y=${t.y}:${t.ada ? 'panel' : t.tag}`).join(' · '),
      )

      // Warna yang terpaku harus benar-benar warna palet --panel tema itu.
      const harusWarna = hexKeRgb(u.warnaPanelDeklarasi)
      catat(
        `warna pita sama dengan var(--panel) tema ${tema} (${alamat})`,
        harusWarna !== null && u.warnaPanelElemen === harusWarna && u.titik.every((t) => t.warnaPanel === harusWarna),
        `--panel=${u.warnaPanelDeklarasi} → ${harusWarna} · elemen=${u.warnaPanelElemen} · ` +
          `titik=${[...new Set(u.titik.map((t) => t.warnaPanel))].join('/')}`,
      )

      // Kebijakan 12 Okt: tetap tanpa gulir sendiri.
      catat(
        `panel tetap tanpa gulir sendiri (${label})`,
        u.isi <= u.muat + 1 && u.overflowY !== 'auto' && u.overflowY !== 'scroll',
        `isi=${u.isi} muat=${u.muat} overflowY=${u.overflowY}`,
      )

      // Isi menu tidak boleh ikut meregang: jarak dari tautan terakhir ke dasar
      // panel besar hanya kalau halaman panjang (pita yang memanjang).
      if (panjang) {
        catat(
          `menu tetap menempel di atas, pita yang memanjang (${label})`,
          u.jarakMenuKeBawahPanel !== null && u.jarakMenuKeBawahPanel > 100,
          `tautan terakhir → dasar panel = ${u.jarakMenuKeBawahPanel}px`,
        )
      }

      // Setelah menggulir: pita tidak boleh berhenti di tengah jendela.
      const target = Math.min(600, Math.max(0, u.dokumen - u.jendela))
      if (target > 100) {
        await evalJs(`window.scrollTo(0, ${target})`)
        await sleep(500)
        const g = await evalJs(`${ukur}()`)
        catat(
          `setelah digulir ${target}px tepi kiri masih berwarna panel (${label})`,
          g !== null && g.titik.every((t) => t.ada),
          g === null ? 'panel hilang' : g.titik.map((t) => `y=${t.y}:${t.ada ? 'panel' : t.tag}`).join(' · '),
        )
        await evalJs('window.scrollTo(0, 0)')
        await sleep(200)
      }
    }

    for (const alamat of HALAMAN) await periksa(alamat, 'terang')
    for (const alamat of HALAMAN) await periksa(alamat, 'gelap')

    catat('ada halaman guru dengan konten lebih panjang dari jendela', adaHalamanPanjang, `diperiksa: ${HALAMAN.join(', ')}`)
  } finally {
    const gagal = hasil.filter((satu) => !satu.lolos)
    console.log(`\n${hasil.length - gagal.length}/${hasil.length} pemeriksaan lulus.`)
    ws.close()
    if (gagal.length > 0) process.exit(1)
  }
}

main().catch((e) => {
  console.error('GAGAL:', e.message)
  process.exit(1)
})
