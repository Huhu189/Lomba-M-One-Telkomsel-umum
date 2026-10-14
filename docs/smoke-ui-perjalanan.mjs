// Smoke tema perjalanan materi lewat browser sungguhan (Chrome DevTools Protocol):
// guru memilih template tema ("Mendaki Gunung"), mengganti nama tema & nama pos,
// menempelkan video latar, lalu menerbitkannya. Murid membuka materinya dan melihat
// **peta perjalanan bermedia** (video latar guru atau foto tema), menuntaskan
// satu bagian, dan mendapat **kenaikan** — posisi di peta maju sendiri.
//
// Materi KEDUA menguji dua hal yang tidak diuji materi pertama: peta dengan
// **foto tema** (tanpa video latar) dan pilihan **"tanpa peta"** — materi yang
// berjalan sebagai daftar bagian biasa tanpa pos, tingkat, maupun panggung peta.
//
// Harness ini MANDIRI: materi uji + berkas video kecilnya dibuat di awal dan
// dihapus di blok `finally`, jadi bisa dijalankan berulang.
//
// Prasyarat: backend 8000, vite 5173, Chrome --remote-debugging-port=9333, dan
// berkas video kecil di VIDEO_UJI (dibuat oleh docs/jalankan-smoke-perjalanan.sh).
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness guru
// memakai akun guru sungguhan (guru1@sekolah.test) — bukan akun admin seperti dulu.
// Jalur kepala sekolah diuji terpisah di `docs/smoke-ui-admin.mjs`.
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }

/** Video uji 2 detik (dibuat ffmpeg) yang diunggah ke materi uji. */
const VIDEO_UJI = process.env.VIDEO_UJI ?? '/tmp/jelajah-smoke.mp4'

const NAMA_TEMA = 'Ekspedisi Smoke'
/** Nama pos yang diganti guru (pos 1 & 2); pos 3–4 memakai nama bawaan tema. */
const FASE_GANTI = ['Basecamp Sekolah', 'Jembatan Sungai']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alat bantu di sisi halaman (disuntik ulang setiap navigasi). */
const ALAT = `window.__alat = {
  teks(sel) { return document.querySelector(sel)?.textContent?.trim() ?? '' },
  jumlah(sel) { return document.querySelectorAll(sel).length },
  nilai(sel) { return document.querySelector(sel)?.value ?? null },
  gaya(sel, properti) {
    const el = document.querySelector(sel)
    return el ? getComputedStyle(el)[properti] : null
  },
  klik(teks, sel = 'button') {
    const tombol = [...document.querySelectorAll(sel)].find((b) => b.textContent.includes(teks))
    if (!tombol) return false
    tombol.click()
    return true
  },
  // Sama seperti klik, tapi MENOLAK tombol yang nonaktif. Dipakai untuk menunggu
  // sampai keadaan sebelumnya benar-benar selesai (mis. tombol “Buka” bagian
  // berikutnya baru hidup setelah bagian sebelumnya tercatat selesai di server).
  klikAktif(teks, sel = 'button') {
    const tombol = [...document.querySelectorAll(sel)].find((b) => b.textContent.includes(teks) && !b.disabled)
    if (!tombol) return false
    tombol.click()
    return true
  },
  // Klik tombol “Buka” milik bagian tertentu lewat barisnya, BUKAN tombol “Buka”
  // pertama di halaman — bagian yang sudah selesai pun tetap bisa dibuka ulang,
  // jadi mencari teks “Buka” saja akan selalu mengenai bagian paling atas.
  klikBagian(nomor) {
    const baris = [...document.querySelectorAll('ol.list-unstyled li')].find(
      (li) => li.querySelector('.badge-status')?.textContent?.trim() === 'Bagian ' + nomor,
    )
    const tombol = [...(baris?.querySelectorAll('button') ?? [])].find((b) => !b.disabled)
    if (!tombol) return false
    tombol.click()
    return true
  },
  // Letak tiap tanda pos dalam PERSEN panggung. Dipakai untuk membuktikan
  // keluhan "pos masih di udara": dulu rumus jalur berhenti di y = 12%,
  // sementara punggungan gambarnya ada di y ≈ 39% — jadi pos berdiri di langit.
  letakPos() {
    const panggung = document.querySelector('.jelajah-panggung')
    if (!panggung) return null
    const kotak = panggung.getBoundingClientRect()
    if (kotak.width === 0 || kotak.height === 0) return null

    return [...document.querySelectorAll('.jelajah-pos')].map((el) => {
      const k = el.getBoundingClientRect()
      return {
        nomor: el.querySelector('.jelajah-pos-nomor')?.textContent?.trim() ?? '',
        x: Math.round(((k.left + k.width / 2 - kotak.left) / kotak.width) * 1000) / 10,
        y: Math.round(((k.top + k.height / 2 - kotak.top) / kotak.height) * 1000) / 10,
      }
    })
  },
  pos() {
    const aktif = document.querySelector('.jelajah-pos[data-status="dibuka"]')
    return {
      ada: document.querySelectorAll('.jelajah-pos').length,
      nomorAktif: aktif?.querySelector('.jelajah-pos-nomor')?.textContent?.trim() ?? null,
      selesai: document.querySelectorAll('.jelajah-pos[data-status="selesai"]').length,
      penanda: document.querySelector('.jelajah-penanda') ? 1 : 0,
      label: document.querySelector('.jelajah-panggung')?.getAttribute('aria-label') ?? '',
    }
  },
  // Latar peta sesuai prioritas di PetaPerjalanan: video tema (bila guru
  // menempelkannya) MENGGANTIKAN semuanya → adegan yang digambar sendiri
  // (SVG beranimasi) → berkas gambar tema di public/tema/* → gradien.
  // "foto" di sini berarti "berkas gambar tema" — bukan harus fotografi:
  // tema "Mendaki Gunung" memakai ilustrasi rata domain publik.
  // "Bergerak" dibuktikan autoplay video, animasi adegan, atau zoom gambar.
  latar() {
    const video = document.querySelector('video.jelajah-video')
    if (video) return { jenis: 'video', autoplay: video.autoplay }
    const gambar = document.querySelector('svg.jelajah-adegan')
    if (gambar) {
      return {
        jenis: 'ilustrasi',
        animasi: this.gaya('.jelajah-adegan', 'animationName'),
        awan: this.jumlah('.jelajah-adegan .jelajah-awan'),
        kabut: this.jumlah('.jelajah-adegan .jelajah-kabut'),
        burung: this.jumlah('.jelajah-adegan .jelajah-burung'),
      }
    }
    const foto = document.querySelector('img.jelajah-foto')
    if (foto) {
      return {
        jenis: 'foto',
        src: foto.getAttribute('src'),
        termuat: foto.naturalWidth > 0,
        zoom: this.gaya('.jelajah-foto', 'animationName'),
      }
    }
    return { jenis: 'gradien' }
  },
  // Keadaan "tanpa peta": tidak boleh ada panggung maupun pos, yang ada daftar bagian.
  tanpa() {
    return {
      panel: this.jumlah('[data-tanpa="true"]'),
      adaPanggung: this.jumlah('.jelajah-panggung'),
      adaPos: this.jumlah('.jelajah-pos'),
      daftar: this.jumlah('.jelajah-daftar-baris'),
      teks: (document.querySelector('.jelajah')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 200),
    }
  },
  daftarPos() {
    return [...document.querySelectorAll('.jelajah-daftar-baris')].map((baris) => baris.textContent.trim())
  },
  // Mengukur berkas latar tema dari HASIL RENDER-nya (bukan dari teks SVG-nya):
  // gambar digambar ke kanvas 400x225, lalu dihitung berapa warna berbeda yang
  // muncul (tingkat detail), seberapa terang rata-ratanya (sesuai tema terang
  // atau gelap), apakah ada bagian panggung yang benar-benar kosong (bidang
  // polos), dan warna tepat di bawah tiap pos.
  //
  // Ini yang membuat "gambarnya sudah matang" bisa diuji angkanya: pagar Vitest
  // mengukur bentuk berkasnya, sedangkan di sini yang diukur adalah piksel yang
  // benar-benar dilihat murid — termasuk apakah pos berdiri di benda berwarna
  // atau di langit/ruang kosong.
  async ukurGambar(src, titik = []) {
    const img = new Image()
    img.src = src
    await img.decode()
    const kanvas = document.createElement('canvas')
    kanvas.width = 400
    kanvas.height = 225
    const ctx = kanvas.getContext('2d')
    ctx.drawImage(img, 0, 0, 400, 225)
    const piksel = ctx.getImageData(0, 0, 400, 225).data
    const warnaSet = new Set()
    const petak = new Map()
    let jumlah = 0
    let terang = 0

    for (let i = 0; i < piksel.length; i += 4) {
      const urutan = i / 4
      const kecerahan = 0.2126 * piksel[i] + 0.7152 * piksel[i + 1] + 0.0722 * piksel[i + 2]
      jumlah += kecerahan
      if (kecerahan >= 200) terang++

      // Warna dikuantisasi ke 32 tingkat per kanal supaya gradien halus tidak
      // terhitung sebagai ratusan "warna" palsu, tetapi perbedaan gambar tetap
      // terlihat.
      const kunci = (piksel[i] >> 3) + ':' + (piksel[i + 1] >> 3) + ':' + (piksel[i + 2] >> 3)
      warnaSet.add(kunci)

      const kolom = Math.floor(urutan % 400 / 50)
      const baris = Math.floor(urutan / 400 / 45)
      const kunciPetak = kolom + 'x' + baris
      if (!petak.has(kunciPetak)) petak.set(kunciPetak, new Set())
      petak.get(kunciPetak).add(kunci)
    }

    const blok = (px, py) => {
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const x = Math.round(px) + dx
          const y = Math.round(py) + dy
          if (x < 0 || y < 0 || x >= 400 || y >= 225) continue
          const i = (y * 400 + x) * 4
          r += piksel[i]
          g += piksel[i + 1]
          b += piksel[i + 2]
          n++
        }
      }
      return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
    }

    const seluruh = piksel.length / 4
    return {
      rata: Math.round(jumlah / seluruh),
      warna: warnaSet.size,
      terangPersen: Math.round((terang / seluruh) * 1000) / 10,
      polos: [...petak.entries()].filter(([, isi]) => isi.size < 4).map(([kunci]) => kunci),
      petak: petak.size,
      titik: titik.map((satu) => ({
        nama: satu.nama,
        warna: blok((satu.x / 100) * 400, (satu.y / 100) * 225),
      })),
      acuan: blok(24, 18),
    }
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
  const video = readFileSync(VIDEO_UJI)

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

  const tunggu = async (ekspresi, batas = 15000) => {
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
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '')
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

  let idMateri = 0
  // Materi kedua (latar foto + pilihan "tanpa peta") juga harus dibersihkan.
  let idRingkas = 0
  // Materi ketiga: tema latar baru (putaran A.50).
  let idTemaBaru = 0
  // Materi keempat: tema Harta Karun di Pulau.
  let idPulau = 0

  /**
   * Kecerahan terkecil dari sebuah warna CSS (`rgb(...)`/`rgba(...)`), atau -1
   * kalau bentuknya tidak dikenali. Dipakai untuk memisahkan jalur peta yang
   * pekat (latar terang) dari yang terang (latar gelap).
   * @param {string} warna
   * @returns {number}
   */
  const kecerahan = (warna) => {
    const angka = String(warna ?? '')
      .match(/\d+/g)
      ?.map(Number)
    return angka && angka.length >= 3 ? Math.min(...angka.slice(0, 3)) : -1
  }

  /** Selisih terbesar antar dua warna RGB (0–255). */
  const selisihWarna = (a, b) => Math.max(...a.map((nilai, indeks) => Math.abs(nilai - b[indeks])))

  /** Warna jadi "r,g,b" untuk pesan hasil. */
  const warnaTeks = (warna) => (Array.isArray(warna) ? warna.join(',') : '—')

  const bersihkan = async () => {
    await keluar()
    await masuk(AKUN_GURU)

    const status = []
    for (const id of [idMateri, idRingkas, idTemaBaru, idPulau]) {
      if (id > 0) status.push((await apiJson(`/v1/materi/${id}`, 'DELETE')).status)
    }

    return {
      status: status.every((satu) => satu === 200) ? 200 : (status[0] ?? 0),
      sisa: `materi ${idMateri}, ${idRingkas}, ${idTemaBaru}, ${idPulau} → ${status.join(',')}`,
    }
  }

  await buka('/')

  // --- 1. Guru menyiapkan materi bertema perjalanan ---
  const guruMasuk = await masuk(AKUN_GURU)
  catat('guru masuk', guruMasuk.status === 200, guruMasuk.email ?? '')

  const daftarMurid = await apiJson('/v1/murid?per_page=100')
  const semuaMurid = Array.isArray(daftarMurid.isi) ? daftarMurid.isi : (daftarMurid.isi?.data ?? [])
  const muridUji = semuaMurid.find((satu) => satu.email === AKUN_MURID.email)
  const kelasId = muridUji?.class_id ?? null
  catat('murid uji ada di kelas yang diketahui', kelasId !== null, `kelas ${kelasId} · ${muridUji?.kelas_nama ?? '—'}`)
  if (kelasId === null) throw new Error('murid uji tidak ada di DB dev — jalankan seeder')

  const daftarMapel = await apiJson('/v1/mapel?per_page=100')
  const mapelPertama = (Array.isArray(daftarMapel.isi) ? daftarMapel.isi : (daftarMapel.isi?.data ?? []))[0]
  if (!mapelPertama) throw new Error('tidak ada mapel di DB dev')

  const katalog = await apiJson('/v1/materi/tema')
  catat(
    'katalog template tema datang dari server',
    katalog.status === 200 && katalog.isi?.tema?.[0]?.kode === 'mendaki-gunung',
    `status ${katalog.status} · ${katalog.isi?.tema?.map((satu) => satu.kode).join(',') ?? '—'}`,
  )
  catat(
    'template memuat fase & tingkat bawaan',
    katalog.isi?.tema?.[0]?.fase?.length === 6 && katalog.isi?.tema?.[0]?.tingkat?.length === 4,
    `fase ${katalog.isi?.tema?.[0]?.fase?.length} · tingkat ${katalog.isi?.tema?.[0]?.tingkat?.length}`,
  )

  const judul = `Perjalanan Smoke ${Date.now()}`
  const buat = await apiJson('/v1/materi', 'POST', {
    judul,
    subject_id: mapelPertama.id,
    class_id: kelasId,
  })
  idMateri = buat.isi?.id ?? 0
  catat('guru membuat materi uji', buat.status === 201 && idMateri > 0, `materi ${idMateri}`)
  if (idMateri === 0) throw new Error('gagal membuat materi uji: ' + JSON.stringify(buat.isi))

  // --- 2. Unggah video latar tema (berpotongan, seperti klien asli) ---
  const mulaiUnggah = await apiJson(`/v1/materi/${idMateri}/unggahan`, 'POST', {
    nama: 'latar-tema.mp4',
    ukuran: video.length,
  })
  const kodeVideo = mulaiUnggah.isi?.kode ?? ''
  const ukuranPotongan = Number(mulaiUnggah.isi?.ukuran_potongan ?? 0)
  const jumlahPotongan = Number(mulaiUnggah.isi?.jumlah_potongan ?? 0)
  let unggahGagal = 0

  for (let indeks = 0; indeks < jumlahPotongan; indeks++) {
    const bagian = video.subarray(indeks * ukuranPotongan, (indeks + 1) * ukuranPotongan)
    const kirim = await apiJson(`/v1/unggahan/${kodeVideo}/potongan/${indeks}`, 'PUT', {
      isi_base64: bagian.toString('base64'),
      hash: createHash('sha256').update(bagian).digest('hex'),
    })
    if (kirim.status !== 200) unggahGagal = kirim.status
  }

  const selesaiUnggah = await apiJson(`/v1/unggahan/${kodeVideo}/selesai`, 'POST')
  catat(
    'video latar tema terunggah lewat jalur berpotongan',
    unggahGagal === 0 && selesaiUnggah.status === 200 && selesaiUnggah.isi?.mime === 'video/mp4',
    `mime ${selesaiUnggah.isi?.mime ?? '—'} · ${unggahGagal === 0 ? 'semua potongan diterima' : 'potongan gagal ' + unggahGagal}`,
  )

  // --- 3. Susun 4 pos: nama tema & dua nama pos diganti guru ---
  const blok = [
    { tipe: 'teks', wajib: true, isi: { teks: 'Bagian satu.' }, fase: FASE_GANTI[0], track: 0, mulai_detik: 0, durasi_detik: 10 },
    { tipe: 'teks', wajib: true, isi: { teks: 'Bagian dua.' }, fase: FASE_GANTI[1], track: 0, mulai_detik: 10, durasi_detik: 10 },
    { tipe: 'teks', wajib: true, isi: { teks: 'Bagian tiga.' }, track: 0, mulai_detik: 20, durasi_detik: 10 },
    { tipe: 'teks', wajib: true, isi: { teks: 'Bagian empat.' }, track: 0, mulai_detik: 30, durasi_detik: 10 },
  ]

  const simpan = await apiJson(`/v1/materi/${idMateri}/blok`, 'PUT', {
    blok,
    tema: { kode: 'mendaki-gunung', nama: NAMA_TEMA, video_kode: kodeVideo },
  })

  catat('guru menyimpan tema + nama pos', simpan.status === 200 && simpan.isi?.perjalanan?.nama === NAMA_TEMA, `nama ${simpan.isi?.perjalanan?.nama ?? '—'}`)
  catat(
    'nama pos ganti tersimpan, yang kosong tetap bawaan tema',
    simpan.isi?.blok?.[0]?.fase === FASE_GANTI[0] && simpan.isi?.blok?.[2]?.fase === null,
    `pos1 “${simpan.isi?.blok?.[0]?.fase ?? '—'}” · pos3 ${simpan.isi?.blok?.[2]?.fase ?? 'null'}`,
  )
  catat(
    'video latar tema tersimpan di materi',
    simpan.isi?.perjalanan?.video_kode === kodeVideo,
    `kode ${simpan.isi?.perjalanan?.video_kode ?? 'null'}`,
  )

  const terbit = await apiJson(`/v1/materi/${idMateri}/publikasi`, 'POST')
  catat('materi diterbitkan', terbit.status === 200, `status ${terbit.status}`)

  // --- 4. Editor guru: pratinjau peta beranimasi + nama pos ---
  await buka(`/materi/${idMateri}/editor`)
  await tunggu(`document.querySelectorAll('.jelajah-pos').length === 4`)

  const petaGuru = await evalJs('window.__alat.pos()')
  const daftarGuru = await evalJs('window.__alat.daftarPos()')
  const namaTemaInput = await evalJs(`window.__alat.nilai('#nle-tema-nama')`)
  const latarGuru = await evalJs(`window.__alat.latar()`)
  const animasiPendaki = await evalJs(`window.__alat.gaya('.jelajah-penanda-orang', 'animationName')`)

  const letakGuru = await evalJs('window.__alat.letakPos()')

  catat('editor menampilkan peta 4 pos sesuai timeline', petaGuru.ada === 4, `pos ${petaGuru.ada}`)
  catat(
    'tidak ada pos yang berdiri di langit (semuanya di bawah punggungan)',
    Array.isArray(letakGuru) && letakGuru.length === 4 && letakGuru.every((satu) => satu.y >= 40),
    (letakGuru ?? []).map((satu) => `pos${satu.nomor} (${satu.x}%, ${satu.y}%)`).join(' · '),
  )
  catat('nama tema ganti muncul di editor', namaTemaInput === NAMA_TEMA, `input “${namaTemaInput}”`)
  catat(
    'daftar pos memakai nama ganti guru dan bawaan tema',
    daftarGuru.some((baris) => baris.includes(FASE_GANTI[0])) && daftarGuru.some((baris) => baris.includes('Sungai Deras')),
    daftarGuru.join(' | ').slice(0, 160),
  )
  catat(
    'peta memakai media bergerak, bukan gambar diam',
    animasiPendaki === 'jelajah-langkah' &&
      (latarGuru.jenis === 'video'
        ? latarGuru.autoplay === true
        : latarGuru.jenis === 'ilustrasi'
          ? latarGuru.animasi === 'jelajah-zoom'
          : latarGuru.jenis === 'foto' && latarGuru.zoom === 'jelajah-zoom'),
    `latar ${latarGuru.jenis}${
      latarGuru.jenis === 'video'
        ? ' autoplay=' + latarGuru.autoplay
        : latarGuru.jenis === 'ilustrasi'
          ? ' animasi=' + latarGuru.animasi
          : latarGuru.jenis === 'foto'
            ? ' zoom=' + latarGuru.zoom
            : ''
    } · pendaki ${animasiPendaki}`,
  )
  catat('video latar tema terpasang di editor', (await evalJs(`window.__alat.jumlah('video.jelajah-video')`)) === 1)

  // --- 5. Murid: peta perjalanan di layar materi ---
  await keluar()
  await buka('/masuk')
  const muridMasuk = await masuk(AKUN_MURID)
  catat('murid masuk', muridMasuk.status === 200, muridMasuk.email ?? '')

  const ringkasan = await apiJson(`/v1/materi/${idMateri}/progres`)
  catat(
    'API murid mengirim peta perjalanan lengkap',
    ringkasan.status === 200 && ringkasan.isi?.perjalanan?.jumlah_langkah === 4 && ringkasan.isi?.perjalanan?.posisi === 1,
    `posisi ${ringkasan.isi?.perjalanan?.posisi} · total ${ringkasan.isi?.perjalanan?.total} · tingkat ${ringkasan.isi?.perjalanan?.tingkat?.nama}`,
  )
  catat(
    'nama pos murid sama dengan yang dilihat guru',
    ringkasan.isi?.perjalanan?.langkah?.[0]?.nama === FASE_GANTI[0] && ringkasan.isi?.perjalanan?.langkah?.[2]?.nama === 'Sungai Deras',
    `pos1 “${ringkasan.isi?.perjalanan?.langkah?.[0]?.nama}” · pos3 “${ringkasan.isi?.perjalanan?.langkah?.[2]?.nama}”`,
  )
  catat('video latar tema dikirim sebagai URL bertanda tangan', typeof ringkasan.isi?.perjalanan?.video_url === 'string' && ringkasan.isi.perjalanan.video_url.includes('signature'))

  await buka('/materi')
  catat('materi uji tampil di daftar materi murid', await tunggu(`window.__alat.klik(${JSON.stringify(judul)})`))
  catat('peta perjalanan tampil untuk murid', await tunggu(`document.querySelectorAll('.jelajah-pos').length === 4`))

  const petaMurid = await evalJs('window.__alat.pos()')
  catat(
    'murid mulai di pos 1 dan penanda posisi terpasang',
    petaMurid.nomorAktif === '1' && petaMurid.penanda === 1 && petaMurid.label.includes('pos 1 dari 4'),
    `aktif ${petaMurid.nomorAktif} · label “${petaMurid.label}”`,
  )
  catat('murid juga melihat video latar tema', (await evalJs(`window.__alat.jumlah('video.jelajah-video')`)) === 1)

  // --- 6. Tuntaskan pos 1: peta maju + kenaikan tingkat ---
  // Tombol “Buka”/“Tandai selesai” hanya diklik saat benar-benar hidup, dan
  // setiap penantian memastikan keadaan SEBELUMNYA sudah tercatat di server —
  // tanpa ini harness balapan dengan mutasi yang masih berjalan.
  catat('murid membuka bagian pertama', await tunggu(`window.__alat.klikBagian(1)`))
  catat('tombol tandai selesai tersedia', await tunggu(`window.__alat.klikAktif('Tandai bagian ini selesai')`))

  await tunggu(
    `document.querySelectorAll('.jelajah-pos[data-status="selesai"]').length === 1 && document.querySelector('.jelajah-pos[data-status="dibuka"] .jelajah-pos-nomor')?.textContent?.trim() === '2'`,
  )
  const setelah = await evalJs('window.__alat.pos()')
  catat(
    'peta maju: pos 1 selesai, pos 2 jadi posisi kini',
    setelah.selesai === 1 && setelah.nomorAktif === '2',
    `selesai ${setelah.selesai} · aktif ${setelah.nomorAktif}`,
  )

  const adaKenaikan = await tunggu(`(document.querySelector('main')?.innerText ?? '').includes('Naik tingkat')`)
  const teksKenaikan = await evalJs(`(document.querySelector('main')?.innerText ?? '').replace(/\\s+/g, ' ').slice(0, 400)`)
  catat('kenaikan tingkat diumumkan setelah pos ditutup', adaKenaikan, teksKenaikan.slice(0, 160))

  // --- 7. Tuntaskan pos 2: kenaikan pos (bukan tingkat) ---
  catat('murid membuka bagian kedua', await tunggu(`window.__alat.klikBagian(2)`))
  catat('murid menutup bagian kedua', await tunggu(`window.__alat.klikAktif('Tandai bagian ini selesai')`))

  await tunggu(
    `document.querySelectorAll('.jelajah-pos[data-status="selesai"]').length === 2 && document.querySelector('.jelajah-pos[data-status="dibuka"] .jelajah-pos-nomor')?.textContent?.trim() === '3'`,
  )
  const kenaikanPos = await tunggu(`(document.querySelector('main')?.innerText ?? '').includes('Naik ke pos 3')`)
  const setelahDua = await evalJs('window.__alat.pos()')

  catat('kenaikan pos menyebut nama pos berikutnya', kenaikanPos)
  catat(
    'posisi peta maju ke pos 3 dari 4',
    setelahDua.selesai === 2 && setelahDua.nomorAktif === '3',
    `selesai ${setelahDua.selesai} · aktif ${setelahDua.nomorAktif}`,
  )

  // Sesi browser masih memegang akun murid dari alur di atas, sedangkan murid
  // tidak boleh membuat materi. Masuk lagi sebagai guru sebelum menyiapkan
  // materi kedua — kalau tidak, POST /v1/materi ditolak dan sisa harness runtuh.
  await keluar()
  await masuk(AKUN_GURU)

  // --- 8. Materi kedua: latar FOTO tema, lalu pilihan "tanpa peta" ---
  // Materi ini sengaja tanpa video latar, jadi peta memakai adegan gunung yang
  // digambar sendiri (ilustrasi SVG beranimasi) — bukan foto pihak lain.
  const judulRingkas = `Ringkas Smoke ${Date.now()}`
  const buatRingkas = await apiJson('/v1/materi', 'POST', {
    judul: judulRingkas,
    subject_id: mapelPertama.id,
    class_id: kelasId,
  })
  idRingkas = buatRingkas.isi?.id ?? 0
  catat('guru membuat materi kedua (uji tanpa peta)', buatRingkas.status === 201 && idRingkas > 0, `materi ${idRingkas}`)

  const simpanRingkas = await apiJson(`/v1/materi/${idRingkas}/blok`, 'PUT', {
    blok: [
      { tipe: 'teks', wajib: true, isi: { teks: 'Bagian satu.' }, track: 0, mulai_detik: 0, durasi_detik: 10 },
      { tipe: 'teks', wajib: true, isi: { teks: 'Bagian dua.' }, track: 0, mulai_detik: 10, durasi_detik: 10 },
    ],
    tema: { kode: 'mendaki-gunung', nama: '' },
  })
  catat(
    'tema bawaan dipakai tanpa video latar',
    simpanRingkas.status === 200 && simpanRingkas.isi?.perjalanan?.video_kode === null,
    `video ${simpanRingkas.isi?.perjalanan?.video_kode ?? 'null'} · nama “${simpanRingkas.isi?.perjalanan?.nama ?? '—'}”`,
  )
  await apiJson(`/v1/materi/${idRingkas}/publikasi`, 'POST')

  await keluar()
  await buka('/masuk')
  await masuk(AKUN_GURU)
  await buka(`/materi/${idRingkas}/editor`)
  await tunggu(`document.querySelectorAll('.jelajah-pos').length === 2`)

  const latarAdegan = await evalJs('window.__alat.latar()')
  const adaAdeganTangan = await evalJs(`window.__alat.jumlah('svg.jelajah-adegan')`)
  catat(
    'peta memakai gambar tema domain publik yang benar-benar termuat, bukan gambar tangan',
    latarAdegan.jenis === 'foto' &&
      latarAdegan.src === '/tema/gunung.svg' &&
      latarAdegan.termuat === true &&
      adaAdeganTangan === 0,
    `jenis ${latarAdegan.jenis} · src ${latarAdegan.src ?? '—'} · termuat ${latarAdegan.termuat} · adegan tangan ${adaAdeganTangan}`,
  )
  catat(
    'gambar tema bergerak halus (zoom panggung), bukan gambar diam',
    latarAdegan.zoom === 'jelajah-zoom',
    `zoom ${latarAdegan.zoom ?? '—'}`,
  )
  const kotakPanggung = await evalJs(
    `(() => { const r = document.querySelector('.jelajah-panggung').getBoundingClientRect(); return { lebar: r.width, tinggi: r.height } })()`,
  )
  catat(
    'panggung peta tetap 16:9 supaya gambar tema tidak digepengkan',
    kotakPanggung.tinggi > 0 && Math.abs(kotakPanggung.lebar / kotakPanggung.tinggi - 16 / 9) < 0.05,
    `lebar ${kotakPanggung.lebar.toFixed(0)} · tinggi ${kotakPanggung.tinggi.toFixed(0)} · rasio ${(kotakPanggung.lebar / kotakPanggung.tinggi).toFixed(2)}`,
  )

  // Guru memilih "tanpa peta": peta hilang, nama tema & latar tidak dipakai lagi.
  catat('guru memilih template tanpa peta', await tunggu(`window.__alat.klik('Tanpa tema', '.nle-template')`))
  catat(
    'pratinjau langsung jadi daftar bagian (tanpa panggung peta)',
    await tunggu(`window.__alat.jumlah('[data-tanpa="true"]') === 1 && window.__alat.jumlah('.jelajah-panggung') === 0`),
  )
  const tanpaEditor = await evalJs('window.__alat.tanpa()')
  catat(
    'nama tema & latar dinonaktifkan saat tanpa peta',
    await evalJs(
      `document.querySelector('#nle-tema-nama')?.disabled === true && document.querySelector('#nle-tema-video')?.disabled === true`,
    ),
    `panel “${tanpaEditor.teks.slice(0, 90)}”`,
  )
  catat('guru menyimpan pilihan tanpa peta', await tunggu(`window.__alat.klik('Simpan', '.nle-sidebar button')`))

  let tersimpanTanpa = { isi: null }
  for (let coba = 0; coba < 20; coba++) {
    tersimpanTanpa = await apiJson(`/v1/materi/${idRingkas}`)
    if (tersimpanTanpa.isi?.perjalanan?.tanpa === true) break
    await sleep(500)
  }
  catat(
    'server menyimpan mode tanpa peta (tanpa tingkat, satuan “bagian”)',
    tersimpanTanpa.isi?.perjalanan?.tanpa === true && tersimpanTanpa.isi?.perjalanan?.satuan === 'bagian',
    `tanpa ${tersimpanTanpa.isi?.perjalanan?.tanpa ?? '—'} · satuan ${tersimpanTanpa.isi?.perjalanan?.satuan ?? '—'} · tingkat ${tersimpanTanpa.isi?.perjalanan?.tingkat?.length ?? '—'}`,
  )

  // Murid: materi tanpa peta tampil sebagai daftar bagian, dan kemajuannya
  // memakai kata "bagian" — bukan "naik pos/tingkat".
  await keluar()
  await buka('/masuk')
  await masuk(AKUN_MURID)
  await buka('/materi')
  catat('materi kedua tampil di daftar materi murid', await tunggu(`window.__alat.klik(${JSON.stringify(judulRingkas)})`))
  catat(
    'murid melihat daftar bagian, bukan peta',
    await tunggu(`window.__alat.jumlah('.jelajah-daftar-baris') === 2 && window.__alat.jumlah('.jelajah-panggung') === 0`),
  )

  const tanpaMurid = await evalJs('window.__alat.tanpa()')
  catat(
    'tidak ada pos maupun tingkat di layar murid',
    tanpaMurid.adaPos === 0 && !tanpaMurid.teks.includes('Tingkat'),
    tanpaMurid.teks.slice(0, 120),
  )
  catat('murid membuka bagian pertama materi tanpa peta', await tunggu(`window.__alat.klikBagian(1)`))
  catat('murid menutup bagian pertama', await tunggu(`window.__alat.klikAktif('Tandai bagian ini selesai')`))
  const kenaikanBagian = await tunggu(
    `(document.querySelector('main')?.innerText ?? '').includes('Bagian 1 dari 2 selesai')`,
  )
  const teksBagian = await evalJs(
    `(document.querySelector('main')?.innerText ?? '').replace(/\\s+/g, ' ').slice(0, 300)`,
  )
  catat('kemajuan diumumkan memakai kata “bagian”', kenaikanBagian, teksBagian.slice(0, 150))
  catat(
    'tidak ada pesan naik pos/tingkat untuk materi tanpa peta',
    !teksBagian.includes('Naik ke pos') && !teksBagian.includes('Naik tingkat'),
    teksBagian.slice(0, 150),
  )
  catat(
    'daftar bagian menandai bagian yang sudah selesai',
    await tunggu(`document.querySelectorAll('.jelajah-daftar-baris[data-status="selesai"]').length === 1`),
  )

  // --- 9. Laporan guru memuat perjalanan kelas ---
  await keluar()
  await buka('/masuk')
  await masuk(AKUN_GURU)

  const laporan = await apiJson(`/v1/materi/${idMateri}/laporan`)
  catat(
    'laporan guru memuat peta perjalanan kelas',
    laporan.status === 200 && laporan.isi?.perjalanan?.langkah?.[1]?.nama === FASE_GANTI[1],
    `pos2 “${laporan.isi?.perjalanan?.langkah?.[1]?.nama ?? '—'}”`,
  )
  const barisMurid = (laporan.isi?.murid ?? []).find((satu) => satu.murid_id === muridUji?.id)
  catat(
    'laporan menunjukkan posisi & tingkat murid uji',
    barisMurid?.perjalanan?.selesai === 2 && barisMurid?.perjalanan?.posisi === 3,
    `posisi ${barisMurid?.perjalanan?.posisi} · selesai ${barisMurid?.perjalanan?.selesai} · tingkat “${barisMurid?.perjalanan?.tingkat_nama}”`,
  )

  // --- 9b. Tema latar baru: luar angkasa (latar gelap) end-to-end ---
  const buatTema = await apiJson('/v1/materi', 'POST', {
    judul: `Antariksa Smoke ${Date.now()}`,
    subject_id: mapelPertama.id,
    class_id: kelasId,
  })
  idTemaBaru = buatTema.isi?.id ?? 0
  catat('guru membuat materi bertema luar angkasa', buatTema.status === 201 && idTemaBaru > 0, `materi ${idTemaBaru}`)

  const blokAntariksa = [1, 2, 3, 4, 5].map((nomor) => ({
    tipe: 'teks',
    wajib: true,
    isi: { teks: `Bagian ${nomor}.` },
    track: 0,
    mulai_detik: (nomor - 1) * 10,
    durasi_detik: 10,
  }))

  const simpanAntariksa = await apiJson(`/v1/materi/${idTemaBaru}/blok`, 'PUT', {
    blok: blokAntariksa,
    tema: { kode: 'luar-angkasa', nama: '', video_kode: null },
  })
  catat(
    'tema luar angkasa tersimpan dengan nama & fase bawaannya',
    simpanAntariksa.status === 200 &&
      simpanAntariksa.isi?.perjalanan?.nama === 'Luar Angkasa' &&
      simpanAntariksa.isi?.perjalanan?.adegan === 'angkasa',
    `nama “${simpanAntariksa.isi?.perjalanan?.nama ?? '—'}” · adegan ${simpanAntariksa.isi?.perjalanan?.adegan ?? '—'} · tingkat “${simpanAntariksa.isi?.perjalanan?.tingkat?.nama ?? '—'}”`,
  )

  await buka(`/materi/${idTemaBaru}/editor`)
  await tunggu(`document.querySelectorAll('.jelajah-pos').length === 5`)

  const latarAntariksa = await evalJs('window.__alat.latar()')
  const letakAntariksa = await evalJs('window.__alat.letakPos()')
  const jalurAntariksa = await evalJs(
    `(() => { const el = document.querySelector('.jelajah-ruas[data-status="belum"]'); return el ? getComputedStyle(el).stroke : null })()`,
  )
  const jalurDefault = await evalJs(
    `(() => { const el = document.querySelector('.jelajah-ruas[data-status="belum"]'); return el ? getComputedStyle(el).strokeDasharray : null })()`,
  )

  // Titik rute tema angkasa (RUTE_TEMA.angkasa): landasan → Bumi → asteroid →
  // Saturnus → Bulan. Panggung dan marker-nya sama persis seperti di layar murid.
  const diharapAntariksa = [
    { x: 11, y: 79 },
    { x: 26, y: 52 },
    { x: 50, y: 50 },
    { x: 72, y: 33 },
    { x: 86, y: 20 },
  ]
  const selisihAntariksa = (letakAntariksa ?? []).map((satu, indeks) =>
    Math.max(
      Math.abs(satu.x - (diharapAntariksa[indeks]?.x ?? 999)),
      Math.abs(satu.y - (diharapAntariksa[indeks]?.y ?? 999)),
    ),
  )

  catat(
    'pos tema luar angkasa berdiri di benda rutenya (landasan → Bulan)',
    selisihAntariksa.length === 5 && selisihAntariksa.every((selisih) => selisih <= 1.5),
    `selisih maks ${selisihAntariksa.length > 0 ? Math.max(...selisihAntariksa).toFixed(1) : '—'}%`,
  )
  catat(
    'latar tema luar angkasa memakai berkas angkasa.svg yang benar-benar termuat',
    latarAntariksa?.jenis === 'foto' &&
      String(latarAntariksa?.src).includes('/tema/angkasa.svg') &&
      latarAntariksa?.termuat === true,
    `src ${latarAntariksa?.src ?? '—'} · termuat ${latarAntariksa?.termuat}`,
  )
  catat(
    'jalur peta dipakai versi terang di langit malam (aturannya berlaku)',
    kecerahan(jalurAntariksa) >= 200 && jalurDefault === '6px, 6px',
    `stroke ${jalurAntariksa} · dash ${jalurDefault}`,
  )

  // Yang diukur di sini bukan teks SVG-nya, melainkan piksel hasil render di
  // peramban: seberapa gelap, seberapa beragam warnanya, apakah ada bagian
  // panggung yang kosong, dan warna tepat di bawah tiap pos.
  const ukurAntariksa = await evalJs(
    `window.__alat.ukurGambar('/tema/angkasa.svg', ${JSON.stringify(diharapAntariksa.map((satu, i) => ({ ...satu, nama: `pos${i + 1}` })))})`,
  )
  const posAntariksa = (ukurAntariksa?.titik ?? []).map((satu) =>
    selisihWarna(satu.warna, ukurAntariksa?.acuan ?? [0, 0, 0]),
  )

  catat(
    'latar luar angkasa tetap gelap setelah dirender',
    (ukurAntariksa?.rata ?? 999) <= 150 && (ukurAntariksa?.terangPersen ?? 999) <= 30,
    `rata ${ukurAntariksa?.rata ?? '—'} · piksel terang ${ukurAntariksa?.terangPersen ?? '—'}%`,
  )
  catat(
    'gambar luar angkasa berisi detail, bukan bidang polos',
    (ukurAntariksa?.warna ?? 0) >= 200 && (ukurAntariksa?.polos ?? ['x']).length === 0,
    `${ukurAntariksa?.warna ?? '—'} warna berbeda · petak polos ${(ukurAntariksa?.polos ?? []).length}/${ukurAntariksa?.petak ?? '—'}`,
  )
  catat(
    'tiap pos tema luar angkasa berdiri di benda, bukan di ruang kosong',
    posAntariksa.length === 5 && posAntariksa.every((selisih) => selisih >= 25),
    `selisih terkecil ${posAntariksa.length > 0 ? Math.min(...posAntariksa) : '—'} vs ruang kosong ${warnaTeks(ukurAntariksa?.acuan)}`,
  )

  // --- 9c. Tema latar Harta Karun di Pulau (latar terang) end-to-end ---
  const buatPulau = await apiJson('/v1/materi', 'POST', {
    judul: `Harta Karun Smoke ${Date.now()}`,
    subject_id: mapelPertama.id,
    class_id: kelasId,
  })
  idPulau = buatPulau.isi?.id ?? 0
  catat(
    'guru membuat materi bertema harta karun',
    buatPulau.status === 201 && idPulau > 0,
    `materi ${idPulau}`,
  )

  const blokPulau = [1, 2, 3, 4, 5, 6].map((nomor) => ({
    tipe: 'teks',
    wajib: true,
    isi: { teks: `Bagian ${nomor}.` },
    track: 0,
    mulai_detik: (nomor - 1) * 10,
    durasi_detik: 10,
  }))

  const simpanPulau = await apiJson(`/v1/materi/${idPulau}/blok`, 'PUT', {
    blok: blokPulau,
    tema: { kode: 'harta-karun', nama: '', video_kode: null },
  })
  // `perjalanan.tingkat` adalah DAFTAR tingkat tema (bukan satu tingkat), sama
  // seperti tema bawaan: satuannya "pos" karena tema ini memang berpeta.
  catat(
    'tema harta karun tersimpan dengan nama, adegan, & tingkat bawaannya',
    simpanPulau.status === 200 &&
      simpanPulau.isi?.perjalanan?.nama === 'Harta Karun di Pulau' &&
      simpanPulau.isi?.perjalanan?.adegan === 'pulau' &&
      simpanPulau.isi?.perjalanan?.satuan === 'pos' &&
      simpanPulau.isi?.perjalanan?.tingkat?.length === 4 &&
      simpanPulau.isi?.perjalanan?.tingkat?.[0]?.nama === 'Pelaut Pemula',
    `nama “${simpanPulau.isi?.perjalanan?.nama ?? '—'}” · adegan ${simpanPulau.isi?.perjalanan?.adegan ?? '—'} · satuan ${simpanPulau.isi?.perjalanan?.satuan ?? '—'} · tingkat 1 “${simpanPulau.isi?.perjalanan?.tingkat?.[0]?.nama ?? '—'}”`,
  )

  await buka(`/materi/${idPulau}/editor`)
  await tunggu(`document.querySelectorAll('.jelajah-pos').length === 6`)

  const latarPulau = await evalJs('window.__alat.latar()')
  const letakPulau = await evalJs('window.__alat.letakPos()')
  const jalurPulau = await evalJs(
    `(() => { const el = document.querySelector('.jelajah-ruas[data-status="belum"]'); return el ? getComputedStyle(el).stroke : null })()`,
  )

  // Titik rute tema pulau (RUTE_TEMA.pulau): dermaga → perahu → karang → pantai
  // → hutan kelapa → goa harta karun.
  const diharapPulau = [
    { x: 8, y: 84 },
    { x: 26, y: 74 },
    { x: 46, y: 72 },
    { x: 62, y: 62 },
    { x: 74, y: 50 },
    { x: 80, y: 41 },
  ]
  const selisihPulau = (letakPulau ?? []).map((satu, indeks) =>
    Math.max(
      Math.abs(satu.x - (diharapPulau[indeks]?.x ?? 999)),
      Math.abs(satu.y - (diharapPulau[indeks]?.y ?? 999)),
    ),
  )

  catat(
    'pos tema harta karun berdiri di benda rutenya (dermaga → goa)',
    selisihPulau.length === 6 && selisihPulau.every((selisih) => selisih <= 1.5),
    `selisih maks ${selisihPulau.length > 0 ? Math.max(...selisihPulau).toFixed(1) : '—'}%`,
  )
  catat(
    'latar tema harta karun memakai berkas pulau.svg yang benar-benar termuat',
    latarPulau?.jenis === 'foto' &&
      String(latarPulau?.src).includes('/tema/pulau.svg') &&
      latarPulau?.termuat === true,
    `src ${latarPulau?.src ?? '—'} · termuat ${latarPulau?.termuat}`,
  )
  catat(
    'jalur peta tetap versi pekat di latar terang (aturan gelap tidak bocor)',
    kecerahan(jalurPulau) > 0 && kecerahan(jalurPulau) <= 150,
    `stroke ${jalurPulau}`,
  )

  const ukurPulau = await evalJs(
    `window.__alat.ukurGambar('/tema/pulau.svg', ${JSON.stringify(diharapPulau.map((satu, i) => ({ ...satu, nama: `pos${i + 1}` })))})`,
  )
  const posPulau = (ukurPulau?.titik ?? []).map((satu) =>
    selisihWarna(satu.warna, ukurPulau?.acuan ?? [0, 0, 0]),
  )

  catat(
    'latar harta karun terang setelah dirender (jalur & tenda tetap terbaca)',
    (ukurPulau?.rata ?? 0) >= 150 && (ukurPulau?.terangPersen ?? 0) >= 15,
    `rata ${ukurPulau?.rata ?? '—'} · piksel terang ${ukurPulau?.terangPersen ?? '—'}%`,
  )
  catat(
    'gambar harta karun berisi detail, bukan bidang polos',
    (ukurPulau?.warna ?? 0) >= 200 && (ukurPulau?.polos ?? ['x']).length === 0,
    `${ukurPulau?.warna ?? '—'} warna berbeda · petak polos ${(ukurPulau?.polos ?? []).length}/${ukurPulau?.petak ?? '—'}`,
  )
  catat(
    'tiap pos tema harta karun berdiri di benda, bukan di langit',
    posPulau.length === 6 && posPulau.every((selisih) => selisih >= 25),
    `selisih terkecil ${posPulau.length > 0 ? Math.min(...posPulau) : '—'} vs langit ${warnaTeks(ukurPulau?.acuan)}`,
  )

  // --- 10. Bersihkan data uji ---
  const bersih = await bersihkan()
  catat('materi uji dihapus kembali', bersih.status === 200, bersih.sisa)

  const gagal = hasil.filter((satu) => !satu.lolos)
  console.log(`\n${hasil.length - gagal.length}/${hasil.length} lulus`)

  if (gagal.length > 0) {
    console.log('gagal: ' + gagal.map((satu) => satu.nama).join(' ; '))
    process.exitCode = 1
  }

  // Koneksi CDP adalah satu-satunya handle yang menahan proses Node hidup.
  // Tanpa ditutup, harness tidak pernah keluar dan runner menggantung sehingga
  // kode keluarnya tidak pernah terbaca — tutup di sini supaya `exit` jujur.
  ws.close()
}

main()
  .catch(async (error) => {
    console.error('harness error:', error.message)
    process.exitCode = 1
  })
  // Jaring pengaman: kalau main() berhenti karena galat, WebSocket CDP mungkin
  // belum ditutup. Keluar paksa sesudah jeda singkat supaya runner selalu dapat
  // kode keluar yang sebenarnya, bukan proses yang menggantung.
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode ?? 0), 1500)
  })
