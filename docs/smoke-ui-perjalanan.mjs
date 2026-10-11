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
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }
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
  // Latar peta: video tema (bila guru menempelkannya) MENGGANTIKAN foto tema;
  // bila keduanya tidak ada, panggung memakai gradien. Peta tidak lagi menggambar
  // adegan SVG, jadi "bergerak" dibuktikan oleh autoplay video atau zoom foto.
  latar() {
    const video = document.querySelector('video.jelajah-video')
    if (video) return { jenis: 'video', autoplay: video.autoplay }
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

  const bersihkan = async () => {
    await keluar()
    await masuk(AKUN_GURU)

    const status = []
    for (const id of [idMateri, idRingkas]) {
      if (id > 0) status.push((await apiJson(`/v1/materi/${id}`, 'DELETE')).status)
    }

    return { status: status.every((satu) => satu === 200) ? 200 : (status[0] ?? 0), sisa: `materi ${idMateri} & ${idRingkas} → ${status.join(',')}` }
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

  catat('editor menampilkan peta 4 pos sesuai timeline', petaGuru.ada === 4, `pos ${petaGuru.ada}`)
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
        : latarGuru.jenis === 'foto' && latarGuru.zoom === 'jelajah-zoom'),
    `latar ${latarGuru.jenis}${
      latarGuru.jenis === 'video'
        ? ' autoplay=' + latarGuru.autoplay
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
  // Materi ini sengaja tanpa video latar, jadi peta memakai foto tema bawaan
  // (berkas berlisensi bebas di frontend/public/tema/) — bukan gambar buatan.
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

  const latarFoto = await evalJs('window.__alat.latar()')
  catat(
    'peta memakai foto tema sebagai latar (berkasnya benar-benar termuat)',
    latarFoto.jenis === 'foto' && latarFoto.termuat === true && String(latarFoto.src).includes('/tema/'),
    `jenis ${latarFoto.jenis} · berkas ${latarFoto.src ?? '—'} · termuat ${latarFoto.termuat}`,
  )
  const adeganSvg = await evalJs(`window.__alat.jumlah('.jelajah-adegan')`)
  catat(
    'peta memakai foto tema, tanpa adegan gambar buatan',
    adeganSvg === 0 && latarFoto.jenis === 'foto' && latarFoto.zoom === 'jelajah-zoom',
    `adegan SVG ${adeganSvg} · zoom ${latarFoto.zoom ?? '—'}`,
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
