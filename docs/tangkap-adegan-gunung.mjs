/**
 * Bukti visual latar peta perjalanan tema gunung: tangkapan `.jelajah-panggung`
 * di tema terang & gelap, plus **angka** kecerahan pikselnya (rata-rata,
 * minimum, dan rata-rata per pita) — supaya "lebih terang, jangan gelap" diukur,
 * bukan dikira-kira dari mata.
 *
 * Menerima kedua bentuk latar: berkas gambar tema (`img.jelajah-foto`, mis.
 * `public/tema/gunung.svg`) maupun adegan yang digambar sendiri
 * (`svg.jelajah-adegan`), karena keduanya masih ada di `PetaPerjalanan.jsx`.
 *
 * Output: docs/log-mentah/adegan-gunung-terang.png · adegan-gunung-gelap.png
 * Prasyarat: backend :8000, vite :5173, Chrome headless --remote-debugging-port=9333.
 * Tanpa pustaka: WebSocket global Node 22.
 */
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function utama() {
  const buatan = await fetch(`${CDP}/json/new`, { method: 'PUT' })
  const tab = await buatan.json()

  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  let urut = 0
  const tunggu = new Map()
  ws.onmessage = (kejadian) => {
    const pesan = JSON.parse(kejadian.data)
    if (pesan.id && tunggu.has(pesan.id)) {
      tunggu.get(pesan.id)(pesan)
      tunggu.delete(pesan.id)
    }
  }
  const kirim = (method, params = {}) =>
    new Promise((selesai) => {
      urut += 1
      tunggu.set(urut, selesai)
      ws.send(JSON.stringify({ id: urut, method, params }))
    })

  await new Promise((s, g) => {
    ws.onopen = s
    ws.onerror = () => g(new Error('WS gagal'))
  })
  await kirim('Page.enable')
  await kirim('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 1000,
    deviceScaleFactor: 2,
    mobile: false,
  })

  const evalJs = async (expression) => {
    const r = await kirim('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    const ex = r.result.exceptionDetails
    if (ex) throw new Error('eval error: ' + (ex.exception?.description ?? JSON.stringify(ex)))
    return r.result.result.value
  }

  await kirim('Page.navigate', { url: `${APP}/masuk` })
  await sleep(7000)

  const masuk = await evalJs(`(async () => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
    const kue = document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))
    const token = decodeURIComponent((kue ?? '').split('=')[1] ?? '')
    const res = await fetch('/api/v1/auth/masuk', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
      body: JSON.stringify(${JSON.stringify(AKUN_GURU)}),
    })
    return res.status
  })()`)
  if (masuk !== 200) throw new Error('login guru gagal: ' + masuk)
  console.log('login guru: 200')

  // Cari materi yang memakai tema gunung (mode "tanpa peta" tidak punya panggung).
  const kandidat = await evalJs(`(async () => {
    const r = await fetch('/api/v1/materi', { credentials: 'include', headers: { Accept: 'application/json' } })
    const badan = await r.json()
    // API ini tidak membungkus respons resource (tanpa kunci data), jadi badan
    // daftar = array dan badan detail = objek apa adanya.
    const isi = Array.isArray(badan) ? badan : (badan.data ?? [])
    const cocok = []
    for (const satu of isi) {
      const d = await fetch('/api/v1/materi/' + satu.id, { credentials: 'include', headers: { Accept: 'application/json' } })
      const detail = await d.json()
      if (detail?.perjalanan?.kode === 'mendaki-gunung' && detail.perjalanan.tanpa !== true) {
        cocok.push({ id: satu.id, blok: detail.blok?.length ?? satu.jumlah_blok ?? 0 })
      }
    }
    // Yang paling banyak bloknya dulu: tanpa blok tidak ada titik pos maupun
    // jalur, sehingga tangkapan tidak membuktikan keterbacaan peta.
    cocok.sort((a, b) => b.blok - a.blok)
    return { status: r.status, pesan: badan.message ?? null, jumlah: isi.length, cocok }
  })()`)
  console.log(
    'daftar materi: HTTP',
    kandidat.status,
    kandidat.pesan ? '(' + kandidat.pesan + ')' : '',
    '· jumlah',
    kandidat.jumlah,
    '· kandidat tema gunung (id:blok):',
    kandidat.cocok.map((satu) => satu.id + ':' + satu.blok).join(', '),
  )
  if (kandidat.cocok.length === 0) throw new Error('tidak ada materi bertema gunung — jalankan smoke perjalanan dulu')
  if (kandidat.cocok[0].blok === 0) {
    throw new Error('tidak ada materi bertema gunung yang punya blok — jalankan smoke perjalanan dulu')
  }

  /**
   * Buka editor materi lalu tunggu latar panggungnya benar-benar terender
   * (editor bisa lambat saat pertama kali memuat katalog tema).
   */
  const bukaEditor = async (materiId, putusan) => {
    await kirim('Page.navigate', { url: `${APP}/materi/${materiId}/editor?t=${putusan}` })
    await sleep(4000)
    for (let coba = 0; coba < 12; coba++) {
      const ada = await evalJs(`document.querySelectorAll('.jelajah-panggung').length`)
      if (ada > 0) break
      await sleep(1500)
    }
    const siap = await evalJs(`(() => {
      const panggung = document.querySelector('.jelajah-panggung')
      if (!panggung) return null
      const berkas = panggung.querySelector('img.jelajah-foto')
      const tangan = panggung.querySelector('svg.jelajah-adegan')
      if (!berkas && !tangan) return null
      const kotak = panggung.getBoundingClientRect()
      const gambar = berkas ?? tangan
      return {
        tema: document.documentElement.getAttribute('data-bs-theme'),
        jenis: berkas ? 'berkas' : 'gambar-tangan',
        src: berkas ? berkas.getAttribute('src') : null,
        termuat: berkas ? berkas.naturalWidth > 0 : null,
        lebarAlami: berkas ? berkas.naturalWidth + 'x' + berkas.naturalHeight : null,
        gerak: getComputedStyle(gambar).animationName,
        pos: document.querySelectorAll('.jelajah-pos').length,
        ruas: document.querySelectorAll('.jelajah-ruas').length,
        kotak: { x: kotak.x, y: kotak.y, width: kotak.width, height: kotak.height },
      }
    })()`)
    if (!siap) {
      // Diagnosa: apa yang sebenarnya tampil, supaya kegagalan tidak buta.
      const keadaan = await evalJs(`({
        judul: document.title,
        alamat: location.pathname,
        isi: (document.querySelector('main')?.innerText ?? '(tanpa main)').replace(/\\s+/g, ' ').slice(0, 200),
      })`)
      return { gagal: true, materiId, ...keadaan }
    }
    return siap
  }

  /**
   * Ukur kecerahan dari PNG hasil tangkapan: pikselnya dibaca balik lewat canvas
   * DI DALAM peramban (Node tidak punya dekoder PNG tanpa pustaka tambahan).
   * Luminance = rumus WCAG (0,2126 R + 0,7152 G + 0,0722 B), skala 0–255.
   */
  const ukurKecerahan = async (b64) => {
    const hasil = await evalJs(`(async () => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + ${JSON.stringify(b64)}
      await img.decode()
      const kanvas = document.createElement('canvas')
      kanvas.width = img.width
      kanvas.height = img.height
      const g = kanvas.getContext('2d')
      g.drawImage(img, 0, 0)
      const piksel = g.getImageData(0, 0, kanvas.width, kanvas.height).data
      const L = []
      for (let i = 0; i < piksel.length; i += 4) {
        L.push(0.2126 * piksel[i] + 0.7152 * piksel[i + 1] + 0.0722 * piksel[i + 2])
      }
      const urut = [...L].sort((a, b) => a - b)
      const rata = (dari, sampai) => {
        const potong = L.slice(dari, sampai)
        return potong.reduce((a, b) => a + b, 0) / potong.length
      }
      const t = kanvas.width * kanvas.height
      // Bagian piksel yang gelap. Teks angka di lencana pos MEMANG gelap
      // (#0f172a, luminance ~22,6) dan hanya menempati sebagian kecil luas,
      // jadi ukuran yang benar untuk "gambarnya gelap atau tidak" adalah
      // LUASNYA, bukan piksel tergelap.
      const gelap = L.filter((satu) => satu < 70).length / L.length
      return {
        lebar: kanvas.width,
        tinggi: kanvas.height,
        rata: L.reduce((a, b) => a + b, 0) / L.length,
        minimum: urut[0],
        p5: urut[Math.floor(t * 0.05)],
        median: urut[Math.floor(t * 0.5)],
        gelap,
        pitaAtas: rata(0, Math.floor(t * 0.34)),
        pitaTengah: rata(Math.floor(t * 0.34), Math.floor(t * 0.67)),
        pitaBawah: rata(Math.floor(t * 0.67), t),
      }
    })()`)
    return hasil
  }

  const fs = await import('node:fs')
  fs.mkdirSync('docs/log-mentah', { recursive: true })

  // Materi pertama yang editornya benar-benar merender panggung peta; kalau ada
  // yang gagal, lanjut ke kandidat berikutnya dengan catatan.
  let id = 0
  for (const satu of kandidat.cocok.slice(0, 4)) {
    const percobaan = await bukaEditor(satu.id, 'terang')
    if (!percobaan.gagal) {
      id = satu.id
      console.log('materi uji:', id, `(${satu.blok} blok)`)
      break
    }
    console.log(`materi ${satu.id} tidak menampilkan peta — dilewati: ${percobaan.isi.slice(0, 90)}`)
  }
  if (id === 0) throw new Error('tidak ada materi bertema gunung yang editornya menampilkan peta')

  const semua = {}
  for (const [putusan, nama] of [
    ['terang', 'adegan-gunung-terang.png'],
    ['gelap', 'adegan-gunung-gelap.png'],
  ]) {
    await evalJs(`window.localStorage.setItem('tema-ulangan', ${JSON.stringify(putusan)})`)
    const info = await bukaEditor(id, putusan)
    if (info.gagal) throw new Error(`editor materi ${id} tidak menampilkan peta (${info.isi.slice(0, 80)})`)
    const temaLayar = info.tema === 'dark' ? 'gelap' : 'terang'
    if (temaLayar !== putusan) throw new Error(`tema ${putusan} tidak aktif (layar: ${temaLayar})`)
    if (info.jenis === 'berkas' && info.termuat !== true) {
      throw new Error(`berkas gambar tema gagal dimuat: ${info.src}`)
    }

    // Dipotong 14 px ke dalam: sudut panggung membulat, jadi tanpa ini tepi
    // tangkapan ikut membawa warna kartu di belakangnya (dan di tema gelap itu
    // terbaca sebagai "piksel gelap" yang bukan bagian gambar).
    const potong = 14
    const tembakan = await kirim('Page.captureScreenshot', {
      format: 'png',
      clip: {
        x: info.kotak.x + potong,
        y: info.kotak.y + potong,
        width: info.kotak.width - potong * 2,
        height: info.kotak.height - potong * 2,
        scale: 2,
      },
    })
    fs.writeFileSync(`docs/log-mentah/${nama}`, Buffer.from(tembakan.result.data, 'base64'))

    const angka = await ukurKecerahan(tembakan.result.data)
    semua[putusan] = { info, angka }

    console.log(`\n== ${putusan} → docs/log-mentah/${nama} ==`)
    console.log(
      `   latar ${info.jenis}${info.src ? ' ' + info.src : ''} · termuat ${info.termuat} · ukuran asli ${info.lebarAlami ?? '—'} · gerak ${info.gerak}`,
    )
    console.log(`   pos ${info.pos} · ruas ${info.ruas} · tangkapan ${angka.lebar}x${angka.tinggi}`)
    console.log(
      `   luminance rata ${angka.rata.toFixed(1)} · minimum ${angka.minimum.toFixed(1)} · p5 ${angka.p5.toFixed(1)} · median ${angka.median.toFixed(1)}`,
    )
    console.log(`   piksel gelap (<70) ${(angka.gelap * 100).toFixed(2)}% dari luas`),
    console.log(
      `   pita: atas ${angka.pitaAtas.toFixed(1)} · tengah ${angka.pitaTengah.toFixed(1)} · bawah ${angka.pitaBawah.toFixed(1)}`,
    )
  }

  // Pagar: latar ini memang cerah. Kalau ada bagian yang mendekati hitam, atau
  // rata-ratanya jatuh ke gelap, maka perubahan ini gagal tujuannya.
  const terang = semua.terang.angka
  const gelap = semua.gelap.angka
  const masalah = []
  if (terang.gelap > 0.005) masalah.push(`bidang gelap menutupi ${(terang.gelap * 100).toFixed(2)}% luas`)
  if (terang.rata < 130) masalah.push(`rata-rata terlalu gelap (${terang.rata.toFixed(1)})`)
  if (terang.pitaAtas < 150) masalah.push(`langit tidak cerah (${terang.pitaAtas.toFixed(1)})`)
  if (gelap.gelap > 0.005) masalah.push(`tema gelap ikut menggelapkan gambar (${(gelap.gelap * 100).toFixed(2)}%)`)
  if (gelap.rata < 130) masalah.push(`tema gelap ikut menggelapkan gambar (${gelap.rata.toFixed(1)})`)
  if (masalah.length > 0) throw new Error('latar masih gelap: ' + masalah.join('; '))
  console.log(
    '\nTERANG: ya — bidang gelap < 0,5% luas (hanya teks lencana pos), langit & lereng cerah di kedua tema',
  )

  ws.close()
  await fetch(`${CDP}/json/close/${tab.id}`)
}

utama().catch((e) => {
  console.error('gagal:', e.message)
  process.exit(1)
})
