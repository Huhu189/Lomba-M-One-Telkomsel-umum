// Audit UI lewat browser sungguhan (Chrome DevTools Protocol).
// Tujuan: menemukan cacat UI yang bisa diukur mesin, bukan selera:
//   1. overflow horizontal (halaman/gulir tak diinginkan)
//   2. elemen yang melewati tepi viewport (mentok/terpotong)
//   3. target sentuh < 44 px (ramah anak SD)
//   4. isian tanpa nama aksesibel (label/aria-label/placeholder)
//   5. gambar tanpa alt
//   6. kontras teks di bawah 4.5:1 (WCAG AA teks kecil)
//   7. galat/warning konsol React
//
// Prasyarat: backend :8000, vite :5173, Chrome --remote-debugging-port=9333.
// Tidak mengubah data: hanya GET halaman dan satu POST login biasa.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }

const VIEWPORT = {
  hp: { width: 390, height: 844, mobile: true },
  laptop: { width: 1366, height: 900, mobile: false },
}

// Filter opsional: `node docs/audit-ui.mjs monitor` hanya memeriksa halaman yang
// namanya memuat kata itu (mempercepat pemeriksaan ulang setelah perbaikan).
// `--gelap` menjalankan audit yang sama dalam mode gelap (data-bs-theme=dark).
const args = process.argv.slice(2)
const HANYA = args.find((a) => !a.startsWith('--'))?.toLowerCase() ?? null
const GELAP = args.includes('--gelap')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Fungsi audit yang disuntik ke halaman.
const AUDIT = `window.__audit = function () {
  const lapor = { overflowHalaman: null, keluarTepi: [], targetKecil: [], isianTanpaNama: [], gambarTanpaAlt: [], kontras: [], tanpaNama: [] }
  const W = document.documentElement.clientWidth

  // 1. Gulir horizontal halaman
  const docW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  if (docW > W + 1) lapor.overflowHalaman = docW - W

  const terlihat = (el) => {
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const nama = (el) => {
    const kls = (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')
    const id = el.id ? '#' + el.id : ''
    return el.tagName.toLowerCase() + id + kls
  }
  const teksSingkat = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40)

  const dipotong = (el) => {
    let n = el.parentElement
    while (n && n !== document.documentElement) {
      const o = getComputedStyle(n)
      if (o.overflow !== 'visible' || o.overflowX !== 'visible') return true
      n = n.parentElement
    }
    return false
  }

  // 2. Elemen melewati tepi viewport
  for (const el of document.querySelectorAll('main *, header *, footer *')) {
    if (!terlihat(el)) continue
    const s = getComputedStyle(el)
    if (s.position === 'fixed') continue
    // Elemen di dalam wadah ber-overflow (hero, tabel yang bisa digeser) memang
    // dipotong/ digeser dengan sengaja — bukan cacat tata letak.
    if (dipotong(el)) continue
    const r = el.getBoundingClientRect()
    if (r.right > W + 1 && r.width > 24) {
      // hanya catat elemen terdalam yang melewati tepi
      const anak = [...el.children].some((c) => {
        const rc = c.getBoundingClientRect()
        return rc.right > W + 1 && rc.width > 24
      })
      if (!anak) lapor.keluarTepi.push({ el: nama(el), kanan: Math.round(r.right - W), teks: teksSingkat(el) })
    }
  }

  // 3. Target sentuh kecil
  for (const el of document.querySelectorAll('main a, main button, main input, main select, main textarea, main [role="button"], header a, header button, footer a')) {
    if (!terlihat(el)) continue
    if (el.closest('.sr-saja')) continue
    // Untuk saklar/kotak centang, area tekan yang sah mencakup labelnya
    // (WCAG 2.5.8 "Target Size" menghitung label sebagai bagian sasaran).
    if (el.type === 'checkbox' || el.type === 'radio') {
      const punyaLabel = el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')
      if (punyaLabel) continue
    }
    const r = el.getBoundingClientRect()
    if (r.height < 43.5 || r.width < 43.5) {
      lapor.targetKecil.push({ el: nama(el), w: Math.round(r.width), h: Math.round(r.height), teks: teksSingkat(el) })
    }
  }

  // 4. Isian tanpa nama aksesibel
  for (const el of document.querySelectorAll('main input, main select, main textarea')) {
    if (!terlihat(el)) continue
    const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
    const label = el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]') : null
    const terbungkus = el.closest('label')
    if (!aria && !label && !terbungkus && !el.placeholder) {
      lapor.isianTanpaNama.push({ el: nama(el), type: el.type })
    }
  }

  // 5. Gambar tanpa alt
  for (const el of document.querySelectorAll('img')) {
    if (!terlihat(el)) continue
    if (!el.hasAttribute('alt')) lapor.gambarTanpaAlt.push({ el: nama(el), src: (el.currentSrc || el.src).slice(-40) })
  }

  // 6. Kontras teks (perkiraan: warna terhitung vs latar opaque terdekat)
  const rgb = (c) => {
    const m = c.match(/\\d+(\\.\\d+)?/g)
    return m ? [Number(m[0]), Number(m[1]), Number(m[2]), m[3] === undefined ? 1 : Number(m[3])] : null
  }
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  const rasio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) }
  const latar = (el) => {
    let n = el
    while (n && n !== document.documentElement) {
      const c = rgb(getComputedStyle(n).backgroundColor)
      if (c && c[3] > 0.5) return c
      n = n.parentElement
    }
    return [255, 255, 255, 1]
  }
  for (const el of document.querySelectorAll('main p, main span, main a, main li, main td, main th, main strong, main small, main h1, main h2, main h3, main label, main dd, main dt, main div')) {
    if (!terlihat(el)) continue
    if (!el.textContent || !el.textContent.trim()) continue
    // hanya teks langsung (bukan wadah)
    const punyaTeksAnak = [...el.children].some((c) => (c.textContent || '').trim())
    if (punyaTeksAnak) continue
    const s = getComputedStyle(el)
    const depan = rgb(s.color)
    if (!depan) continue
    const ukuran = parseFloat(s.fontSize)
    const tebal = Number(s.fontWeight) >= 700
    const besar = ukuran >= 24 || (ukuran >= 18.66 && tebal)
    const ambang = besar ? 3 : 4.5
    const depanEfektif = depan[3] < 1 ? depan.slice(0, 3).map((v, i) => v * depan[3] + latar(el)[i] * (1 - depan[3])) : depan.slice(0, 3)
    const r = rasio(depanEfektif, latar(el))
    if (r < ambang) lapor.kontras.push({ el: nama(el), rasio: Number(r.toFixed(2)), teks: teksSingkat(el) })
  }

  // 7. Kontrol tanpa nama aksesibel
  for (const el of document.querySelectorAll('button, a')) {
    if (!terlihat(el)) continue
    if (el.closest('.sr-saja')) continue
    const nama = (el.getAttribute('aria-label') || el.textContent || '').trim()
    const judul = (el.getAttribute('title') || '').trim()
    const svgJudul = el.querySelector('svg > title')
    if (!nama && !judul && !svgJudul) lapor.tanpaNama.push({ el: nama_(el) })
  }
  function nama_(el) {
    const kls = (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')
    return el.tagName.toLowerCase() + kls
  }

  // Lencana jalur data di Live Monitor: 'Langsung (SSE)' vs 'Polling'.
  const hMonitor = [...document.querySelectorAll('h1')].find((x) => x.innerText.includes('Live Monitor'))
  const lencanaSse = hMonitor
    ? hMonitor.parentElement?.parentElement?.querySelector('.badge-status')?.innerText.trim() ?? null
    : null

  return {
    judul: document.title,
    lencanaSse,
    teksKosong: (document.querySelector('main')?.innerText || '').trim().length < 40,
    overflowHalaman: lapor.overflowHalaman,
    keluarTepi: lapor.keluarTepi.slice(0, 8),
    targetKecil: lapor.targetKecil.slice(0, 24),
    jumlahTargetKecil: lapor.targetKecil.length,
    isianTanpaNama: lapor.isianTanpaNama.slice(0, 6),
    gambarTanpaAlt: lapor.gambarTanpaAlt.slice(0, 6),
    kontras: lapor.kontras.slice(0, 8),
    jumlahKontras: lapor.kontras.length,
    tanpaNama: lapor.tanpaNama.slice(0, 6),
  }
}; 'siap'`

async function main() {
  const ws = new WebSocket(await fetch(`${CDP}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl))
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })

  let id = 0
  const pending = new Map()
  let galatKonsol = []
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.method === 'Log.entryAdded' && msg.params?.entry?.level === 'error') {
      galatKonsol.push(`${msg.params.entry.source}: ${String(msg.params.entry.text).slice(0, 160)}`)
    }
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params?.type)) {
      const teks = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 160)
      galatKonsol.push(`console.${msg.params.type}: ${teks}`)
    }
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
  await send('Runtime.enable', {}, sessionId)
  await send('Log.enable', {}, sessionId)
  await send('Page.addScriptToEvaluateOnNewDocument', { source: AUDIT }, sessionId)

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)
    if (r.exceptionDetails) throw new Error('eval error: ' + (r.exceptionDetails.exception?.description ?? ''))
    return r.result.value
  }
  const ukur = async (lebar, tinggi, mobile) =>
    send('Emulation.setDeviceMetricsOverride', { width: lebar, height: tinggi, deviceScaleFactor: 1, mobile }, sessionId)
  const buka = async (jalur, tungguTeks = null) => {
    galatKonsol = []
    await send('Page.navigate', { url: APP + jalur }, sessionId)
    await sleep(2600)
    if (tungguTeks) {
      for (let i = 0; i < 12; i++) {
        const ok = await evalJs(`(document.querySelector('main')?.innerText || '').includes(${JSON.stringify(tungguTeks)})`)
        if (ok) break
        await sleep(400)
      }
    }
    return evalJs('window.__audit ? window.__audit() : null')
  }

  const masuk = async (akun) =>
    evalJs(`(async () => {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
      const res = await fetch('/api/v1/auth/masuk', { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: JSON.stringify(${JSON.stringify(akun)}) })
      return res.status
    })()`)
  const apiJson = async (jalur) =>
    evalJs(`(async () => {
      const res = await fetch('/api${jalur}', { credentials: 'include', headers: { Accept: 'application/json' } })
      return await res.json().catch(() => null)
    })()`)
  const keluar = async () =>
    evalJs(
      `fetch('/api/v1/auth/keluar', { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } }).then(() => true)`,
    )

  const semuaCacat = []
  const periksa = async (label, jalur, tungguTeks = null) => {
    if (HANYA && !label.toLowerCase().includes(HANYA)) return
    for (const [namaVp, vp] of Object.entries(VIEWPORT)) {
      await ukur(vp.width, vp.height, vp.mobile)
      const h = await buka(jalur, tungguTeks)
      if (!h) {
        console.log(`!! ${label} [${namaVp}] gagal audit`)
        continue
      }
      const cacat = {
        label,
        vp: namaVp,
        overflowHalaman: h.overflowHalaman,
        keluarTepi: h.keluarTepi,
        jumlahTargetKecil: h.jumlahTargetKecil,
        targetKecil: h.targetKecil,
        isianTanpaNama: h.isianTanpaNama,
        gambarTanpaAlt: h.gambarTanpaAlt,
        jumlahKontras: h.jumlahKontras,
        kontras: h.kontras,
        tanpaNama: h.tanpaNama,
        teksKosong: h.teksKosong,
        lencanaSse: h.lencanaSse,
        galatKonsol: [...new Set(galatKonsol)].slice(0, 4),
      }
      semuaCacat.push(cacat)
      const ringkas = []
      if (cacat.overflowHalaman) ringkas.push(`OVERFLOW +${cacat.overflowHalaman}px`)
      if (cacat.keluarTepi.length) ringkas.push(`TEPI:${cacat.keluarTepi.map((k) => k.el + `(+${k.kanan})`).join(',')}`)
      if (cacat.jumlahTargetKecil) ringkas.push(`TARGET<44:${cacat.jumlahTargetKecil} ${cacat.targetKecil.map((t) => `${t.el}(${t.w}x${t.h})`).join(',')}`)
      if (cacat.isianTanpaNama.length) ringkas.push(`ISIAN:${cacat.isianTanpaNama.map((i) => i.el).join(',')}`)
      if (cacat.gambarTanpaAlt.length) ringkas.push(`IMG-ALT:${cacat.gambarTanpaAlt.length}`)
      if (cacat.jumlahKontras) ringkas.push(`KONTRAS:${cacat.jumlahKontras} ${cacat.kontras.map((k) => `${k.rasio}@${k.el}`).join(',')}`)
      if (cacat.tanpaNama.length) ringkas.push(`TANPA-NAMA:${cacat.tanpaNama.map((t) => t.el).join(',')}`)
      if (cacat.teksKosong) ringkas.push('KOSONG')
      // Lencana jalur data hanya informasi (SSE vs polling), bukan cacat.
      const infoJalur = cacat.lencanaSse ? ` · jalur data: ${cacat.lencanaSse}` : ''
      if (cacat.galatKonsol.length) ringkas.push(`KONSOL:${cacat.galatKonsol.join(' | ')}`)
      console.log(
        `${ringkas.length ? 'CACAT' : 'BERSIH'} · ${label} [${namaVp}]${ringkas.length ? ' · ' + ringkas.join(' · ') : ''}${infoJalur}`,
      )
    }
  }

  // --- Publik ---
  await ukur(1366, 900, false)
  await buka('/')

  // Mode gelap disimpan di localStorage dan bertahan antar navigasi.
  if (GELAP) {
    await evalJs(`localStorage.setItem('tema-ulangan', 'gelap')`)
    console.log('mode: gelap')
  }
  await periksa('Beranda', '/')
  await periksa('Masuk', '/masuk')
  await periksa('Daftar', '/daftar')
  await periksa('Lupa sandi', '/lupa-sandi')
  await periksa('Tidak ditemukan', '/halaman-ngawur')

  // --- Guru ---
  const statusGuru = await masuk(AKUN_GURU)
  console.log(`login guru: ${statusGuru}`)
  const daftarKuis = await apiJson('/v1/kuis')
  const kuis = (Array.isArray(daftarKuis) ? daftarKuis : daftarKuis?.data ?? [])[0]
  const idKuis = kuis?.id ?? 1
  await periksa('Kelas', '/kelas')
  await periksa('Mapel', '/mapel')
  await periksa('Murid', '/murid')
  await periksa('Impor murid', '/murid/impor')
  await periksa('Bank soal', '/bank-soal')
  await periksa('Tag', '/tag')
  await periksa('Kuis', '/kuis')
  await periksa('Pengaturan', '/pengaturan')
  await periksa('Detail kuis', `/kuis/${idKuis}`)
  await periksa('Laporan kuis', `/kuis/${idKuis}/laporan`)
  await periksa('Koreksi kuis', `/kuis/${idKuis}/koreksi`)
  await periksa('Live Monitor', `/kuis/${idKuis}/monitor`)
  await periksa('Peringkat', `/peringkat/${idKuis}`)
  await keluar()

  // --- Murid ---
  const statusMurid = await masuk(AKUN_MURID)
  console.log(`login murid: ${statusMurid}`)
  const daftarMuridKuis = await apiJson('/v1/kuis')
  const semuaKuisMurid = Array.isArray(daftarMuridKuis) ? daftarMuridKuis : daftarMuridKuis?.data ?? []
  // Utamakan kuis terbit supaya halaman pengerjaan benar-benar terbuka, bukan
  // hanya menampilkan banner galat "belum bisa dimulai".
  const kuisMurid = semuaKuisMurid.find((satu) => satu.status === 'publikasi') ?? semuaKuisMurid[0]
  await periksa('Ulangan saya', '/kuis')
  await periksa('Progres tema', '/progres-tema')
  await periksa('Lencana', '/badge')
  if (kuisMurid?.id) await periksa('Kerjakan kuis', `/kerjakan/${kuisMurid.id}`, 'Soal')
  await keluar()

  console.log('\n=== RINGKASAN CACAT ===')
  const hitung = {}
  for (const c of semuaCacat) {
    if (c.overflowHalaman) hitung['overflow'] = (hitung['overflow'] ?? 0) + 1
    if (c.keluarTepi.length) hitung['keluarTepi'] = (hitung['keluarTepi'] ?? 0) + 1
    if (c.jumlahTargetKecil) hitung['targetKecil'] = (hitung['targetKecil'] ?? 0) + c.jumlahTargetKecil
    if (c.jumlahKontras) hitung['kontras'] = (hitung['kontras'] ?? 0) + c.jumlahKontras
    if (c.isianTanpaNama.length) hitung['isianTanpaNama'] = (hitung['isianTanpaNama'] ?? 0) + c.isianTanpaNama.length
    if (c.tanpaNama.length) hitung['tanpaNama'] = (hitung['tanpaNama'] ?? 0) + c.tanpaNama.length
    if (c.galatKonsol.length) hitung['galatKonsol'] = (hitung['galatKonsol'] ?? 0) + c.galatKonsol.length
  }
  console.log(JSON.stringify(hitung, null, 1))
  ws.close()
}

main().catch((e) => {
  console.error('GAGAL:', e.message)
  process.exit(1)
})
