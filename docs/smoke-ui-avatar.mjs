// Smoke avatar & moderasi (slice 08) lewat browser sungguhan (CDP), TIGA peran
// dalam tiga konteks peramban yang terpisah (cookie tidak saling menendang):
//
//   - A = murid uji (`smoke.murid@sekolah.test`) — pemilik avatar yang dilaporkan
//   - B = murid pendamping (dibuat harness ini) — yang melaporkan lewat ANTARMUKA
//   - C = guru/admin — pemilik halaman Moderasi Avatar
//
// Rute `/avatar` dipakai dua peran (`PilihHalamanAvatar`): murid mengurus
// fotonya sendiri, guru meninjau laporan. Keduanya **belum pernah dibuka di
// peramban**: `mobile` hanya menyapu tata letaknya, dan `Slice08AvatarTest`
// menguji HTTP-nya. Yang dibuktikan di sini:
//
// 1. Murid memulai dari avatar bawaan (inisial nama), dan berkas yang bukan
//    gambar ditolak DI KLIEN (magic bytes) — termasuk berkas >2 MiB yang ditolak
//    lebih awal lagi, sebelum ada satu byte pun dikirim.
// 2. Unggahan PNG yang sah diterima, dan yang tampil adalah **gambar hasil
//    encode ulang server** (256×256), bukan berkas kiriman apa adanya.
// 3. "Kembalikan ke bawaan" benar-benar menghapus berkasnya.
// 4. Laporan teman lewat antarmuka: panel alasan, kirim, hasil yang jujur.
//    Satu laporan **belum** menyembunyikan apa pun (ambangnya di server), dan
//    laporan berulang dari anak yang sama tidak menambah hitungan.
// 5. Setelah beberapa anak berbeda melapor, avatar berhenti tampil bagi murid
//    lain — sedangkan **pemiliknya masih melihat fotonya** (keputusan ada di
//    guru, bukan di pelapor).
// 6. Guru memulihkan (antrean kembali kosong, hitungan laporan direset) dan bisa
//    menghapus berkasnya; pemiliknya kembali ke avatar bawaan.
// 7. Pagar peran: murid tidak bisa memulihkan lewat jalur guru, tidak bisa
//    membuka antrean moderasi, dan tidak bisa melaporkan avatarnya sendiri.
//
// Harness ini MANDIRI: dua murid pendamping dibuat lalu dihapus di `finally`,
// dan avatar murid uji dikembalikan ke keadaan bawaan.
//
// Prasyarat: backend 8000, vite 5173, Chrome :9333
// (dijalankan oleh `docs/jalankan-smoke-ui.sh avatar`).
import { writeFileSync } from 'node:fs'
import { crc32, deflateSync } from 'node:zlib'

const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }
const SANDI_UJI = 'Passw0rd!Aman'

const TANDA = String(Date.now()).slice(-6)

/**
 * PNG 64×64 yang benar-benar sah — dibuat sendiri supaya harness tidak
 * bergantung pada berkas contoh di repo, dan supaya server benar-benar bisa
 * mendekodenya (harness pertama memakai PNG 1×1 dari base64 yang ternyata
 * ditolak server dengan "Gambar tidak bisa dibaca").
 * @param {number} sisi
 * @returns {Buffer}
 */
function buatPng(sisi = 64) {
  const baris = []
  for (let y = 0; y < sisi; y++) {
    const data = Buffer.alloc(1 + sisi * 3)
    data[0] = 0 // filter: none
    for (let x = 0; x < sisi; x++) {
      data[1 + x * 3] = 200
      data[2 + x * 3] = 60
      data[3 + x * 3] = 60
    }
    baris.push(data)
  }

  const potongan = (tipe, isi) => {
    const panjang = Buffer.alloc(4)
    panjang.writeUInt32BE(isi.length, 0)
    const badan = Buffer.concat([Buffer.from(tipe, 'ascii'), isi])
    const cek = Buffer.alloc(4)
    cek.writeUInt32BE(crc32(badan) >>> 0, 0)
    return Buffer.concat([panjang, badan, cek])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(sisi, 0)
  ihdr.writeUInt32BE(sisi, 4)
  ihdr[8] = 8 // kedalaman bit
  ihdr[9] = 2 // truecolor RGB

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    potongan('IHDR', ihdr),
    potongan('IDAT', deflateSync(Buffer.concat(baris))),
    potongan('IEND', Buffer.alloc(0)),
  ])
}

const PNG_SAH = buatPng(64)
const BERKAS_PNG = `/tmp/smoke-avatar-${TANDA}.png`
const BERKAS_BUKAN_GAMBAR = `/tmp/smoke-avatar-bukan-${TANDA}.txt`
const BERKAS_TERLALU_BESAR = `/tmp/smoke-avatar-besar-${TANDA}.png`

/** Jumlah pelapor berbeda yang diharapkan menyembunyikan avatar (config bawaan). */
const AMBANG = 3

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ALAT = `window.__alat = {
  halaman() { return (document.querySelector('main')?.innerText ?? '').replace(/\\s+/g, ' ').trim() },
  teks(sel) { return document.querySelector(sel)?.textContent?.replace(/\\s+/g, ' ').trim() ?? '' },
  ada(sel) { return Boolean(document.querySelector(sel)) },
  nilai(sel) { return document.querySelector(sel)?.value ?? null },
  tombolMati(teks) {
    const tombol = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === teks)
    return tombol ? tombol.disabled : null
  },
  klikTeks(teks) {
    const tombol = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === teks)
    if (!tombol) return false
    tombol.click()
    return true
  },
  /** Teks baris murid tertentu di daftar teman, atau null bila tidak ada. */
  barisTeman(nama) {
    const li = [...document.querySelectorAll('li')].find((satu) => (satu.innerText ?? '').includes(nama))
    return li ? (li.innerText ?? '').replace(/\\s+/g, ' ').trim() : null
  },
  laporTeman(nama) {
    const li = [...document.querySelectorAll('li')].find((satu) => (satu.innerText ?? '').includes(nama))
    const tombol = li ? [...li.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Lapor') : null
    if (!tombol) return false
    tombol.click()
    return true
  },
  isi(sel, teks) {
    const el = document.querySelector(sel)
    if (!el) return false
    const tipe = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(tipe.prototype, 'value').set
    setter.call(el, teks)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  },
  pilih(sel, nilai) {
    const el = document.querySelector(sel)
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    setter.call(el, String(nilai))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  },
}`

const hasil = []
function catat(nama, lolos, detail = '') {
  hasil.push({ nama, lolos: Boolean(lolos) })
  console.log(`${lolos ? 'LULUS' : 'GAGAL'} · ${nama}${detail ? ' · ' + detail : ''}`)
}

async function main() {
  // Berkas uji di cakram: masukan berkas hanya bisa diisi dari jalur nyata.
  writeFileSync(BERKAS_PNG, PNG_SAH)
  writeFileSync(BERKAS_BUKAN_GAMBAR, 'ini bukan gambar, hanya teks biasa\n')
  writeFileSync(BERKAS_TERLALU_BESAR, Buffer.alloc(2 * 1024 * 1024 + 1024, 7))

  const wsUrl = await fetch(`${CDP}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl)
  const ws = new WebSocket(wsUrl)
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

  /** Satu konteks = satu profil cookie (murid & guru tidak saling menendang). */
  async function pasang(browserContextId) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    await send('Page.enable', {}, sessionId)
    await send('DOM.enable', {}, sessionId)
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
      await sleep(2600)
    }

    const tunggu = async (ekspresi, batas = 25_000) => {
      const mulai = Date.now()
      while (Date.now() - mulai < batas) {
        if (await evalJs(ekspresi)) return true
        await sleep(400)
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

    const masuk = async (akun, { keluarDulu = false } = {}) => {
      // Halaman aplikasi dibuka lebih dulu: apiJson memakai URL relatif.
      if ((await evalJs('location.origin')) !== APP) await buka('/masuk')
      if (keluarDulu) await apiJson('/v1/auth/keluar', 'POST')

      let jawab = await apiJson('/v1/auth/masuk', 'POST', akun)
      for (let coba = 0; coba < 3 && jawab?.status === 429; coba++) {
        console.log('   (batas masuk per menit tercapai, menunggu 20 detik…)')
        await sleep(20_000)
        jawab = await apiJson('/v1/auth/masuk', 'POST', akun)
      }
      return jawab
    }

    /** Ganti identitas di konteks ini tanpa membuka peramban baru. */
    const gantiSesi = (akun) => masuk(akun, { keluarDulu: true })

    /** Isi masukan berkas dengan berkas nyata di cakram. */
    const pilihBerkas = async (selector, jalur) => {
      const { root } = await send('DOM.getDocument', {}, sessionId)
      const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector }, sessionId)
      if (!nodeId) return false
      await send('DOM.setFileInputFiles', { files: [jalur], nodeId }, sessionId)
      return true
    }

    return { targetId, sessionId, evalJs, buka, tunggu, apiJson, masuk, gantiSesi, pilihBerkas }
  }

  const { browserContextId: ctxGuru } = await send('Target.createBrowserContext')
  const { browserContextId: ctxA } = await send('Target.createBrowserContext')
  const { browserContextId: ctxB } = await send('Target.createBrowserContext')

  /** @type {number[]} */
  const idPendamping = []
  let avatarAId = 0
  let avatarBId = 0

  const guru = await pasang(ctxGuru)
  const muridA = await pasang(ctxA)
  const muridB = await pasang(ctxB)

  /** Lapor lewat API sebagai anak tertentu (di konteks B supaya cookie-nya sendiri). */
  const laporSebagai = async (akun, avatarId, alasan) => {
    await muridB.gantiSesi(akun)
    return muridB.apiJson(`/v1/avatar/${avatarId}/lapor`, 'POST', { alasan })
  }

  /** Daftar avatar versi guru (seluruh sekolah); `kelas_id` disaring di sisi harness. */
  const daftarAvatarGuru = async () => {
    const jawab = await guru.apiJson('/v1/avatar')
    return Array.isArray(jawab.isi?.avatar) ? jawab.isi.avatar : []
  }

  try {
    // ---------- Persiapan ----------
    const masukGuru = await guru.masuk(AKUN_GURU)
    catat('guru masuk', masukGuru?.status === 200, `status ${masukGuru?.status}`)
    if (masukGuru?.status !== 200) throw new Error('guru tidak bisa masuk')

    const masukA = await muridA.masuk(AKUN_MURID)
    catat('murid uji masuk (konteks A)', masukA?.status === 200, `status ${masukA?.status}`)
    if (masukA?.status !== 200) throw new Error('murid uji tidak bisa masuk')

    const daftarMurid = await guru.apiJson('/v1/murid?per_page=100')
    const semuaMurid = Array.isArray(daftarMurid.isi) ? daftarMurid.isi : (daftarMurid.isi?.data ?? [])
    const barisMuridUji = semuaMurid.find((satu) => satu.email === AKUN_MURID.email)
    const kelasId = barisMuridUji?.class_id ?? null
    const namaA = barisMuridUji?.nama ?? 'Murid Uji'
    catat('murid uji ada beserta kelasnya', kelasId !== null && Boolean(barisMuridUji?.id), `kelas=${kelasId}`)
    if (kelasId === null) throw new Error('murid uji tidak punya kelas — jalankan seeder DB dev')

    // Mulai dari keadaan bersih: avatar murid uji sisa jalan sebelumnya dibuang.
    await muridA.apiJson('/v1/avatar', 'DELETE')

    // Pelapor harus anak BERBEDA, dan pemilik avatar tidak bisa melaporkan
    // avatarnya sendiri — jadi jumlah pelapor yang perlu dibuat adalah ambangnya
    // sendiri (pelapor pertama melapor lewat antarmuka, sisanya lewat API).
    /** @type {{nama: string, email: string}[]} */
    const pendamping = []
    for (let urut = 1; urut <= AMBANG; urut++) {
      const nama = `Smoke Avatar ${TANDA}-${urut}`
      const email = `smoke.avatar.${TANDA}.${urut}@sekolah.test`
      const buat = await guru.apiJson('/v1/murid', 'POST', { nama, email, class_id: kelasId, kata_sandi: SANDI_UJI })
      if (buat.isi?.id) idPendamping.push(buat.isi.id)
      pendamping.push({ nama, email })
    }
    catat(
      'murid pendamping (untuk laporan unik) dibuat di kelas yang sama',
      idPendamping.length === AMBANG,
      `${idPendamping.length} pendamping · ids ${idPendamping.join(',')}`,
    )
    if (pendamping.length === 0) throw new Error('pendamping tidak bisa dibuat')

    // ---------- 1. Murid: halaman avatarnya sendiri ----------
    await muridA.buka('/avatar')
    catat(
      'murid melihat halaman "Avatar Saya", bukan antrean moderasi',
      (await muridA.evalJs(`__alat.teks('h1')`)) === 'Avatar Saya',
      await muridA.evalJs(`__alat.teks('h1')`),
    )
    catat(
      'sebelum unggah: avatar bawaan & tombol "Kembalikan ke bawaan" mati',
      (await muridA.tunggu(`__alat.halaman().includes('masih memakai avatar bawaan')`)) &&
        (await muridA.evalJs(`__alat.tombolMati('Kembalikan ke bawaan')`)) === true,
      `mati=${await muridA.evalJs(`__alat.tombolMati('Kembalikan ke bawaan')`)}`,
    )

    // ---------- 2. Berkas yang bukan gambar ditolak di klien ----------
    await muridA.pilihBerkas('input[aria-label="Pilih gambar avatar"]', BERKAS_BUKAN_GAMBAR)
    catat(
      'berkas bukan gambar ditolak di klien (magic bytes)',
      await muridA.tunggu(`__alat.halaman().includes('Hanya gambar JPEG, PNG, atau WebP')`, 8000),
      (await muridA.evalJs(`__alat.halaman()`)).slice(-120),
    )

    await muridA.pilihBerkas('input[aria-label="Pilih gambar avatar"]', BERKAS_TERLALU_BESAR)
    catat(
      'berkas lebih dari 2 MiB ditolak lebih awal lagi',
      await muridA.tunggu(`__alat.halaman().includes('Gambar terlalu besar (maksimal 2 MiB)')`, 8000),
      '',
    )

    // ---------- 3. Unggahan sah: server yang meng-encode ulang ----------
    await muridA.buka('/avatar')
    await muridA.pilihBerkas('input[aria-label="Pilih gambar avatar"]', BERKAS_PNG)
    catat(
      'unggahan PNG sah tersimpan',
      await muridA.tunggu(`__alat.halaman().includes('Avatar baru tersimpan')`, 30_000),
      (await muridA.evalJs(`__alat.halaman()`)).slice(0, 140),
    )
    const setelahUnggah = await muridA.evalJs(`({
      adaGambar: __alat.ada('img[alt="Avatar saya"]'),
      ukuran: __alat.halaman().match(/Aktif · (\\d+)×(\\d+) px/)?.[0] ?? '',
      kembalikanMati: __alat.tombolMati('Kembalikan ke bawaan'),
    })`)
    catat('gambar hasil encode ulang server yang tampil', setelahUnggah.adaGambar === true, '')
    catat(
      'hasilnya 256×256 px (berkas kiriman tidak disajikan apa adanya)',
      setelahUnggah.ukuran.includes('256×256'),
      setelahUnggah.ukuran || '(tidak ada teks ukuran)',
    )
    catat('tombol "Kembalikan ke bawaan" kini hidup', setelahUnggah.kembalikanMati === false, '')

    // ---------- 4. Kembalikan ke bawaan benar-benar menghapus ----------
    await muridA.evalJs(`__alat.klikTeks('Kembalikan ke bawaan')`)
    catat(
      'mengembalikan ke bawaan dilaporkan & inisial nama kembali',
      await muridA.tunggu(`__alat.halaman().includes('avatar bawaan') && !__alat.ada('img[alt="Avatar saya"]')`, 20_000),
      '',
    )

    // Unggah sekali lagi: avatar inilah yang dilaporkan teman & ditinjau guru.
    await muridA.buka('/avatar')
    await muridA.pilihBerkas('input[aria-label="Pilih gambar avatar"]', BERKAS_PNG)
    catat(
      'avatar kedua tersimpan (bahan uji laporan)',
      await muridA.tunggu(`__alat.ada('img[alt="Avatar saya"]')`, 30_000),
      '',
    )

    // ---------- 5. Pendamping: melihat avatar teman & melaporkannya ----------
    const masukB = await muridB.masuk({ email: pendamping[0].email, password: SANDI_UJI })
    catat('murid pendamping masuk (konteks B)', masukB?.status === 200, `status ${masukB?.status}`)
    await muridB.buka('/avatar')

    catat(
      'avatarnya sendiri tidak ditawarkan untuk dilaporkan',
      (await muridB.evalJs(`__alat.barisTeman(${JSON.stringify(pendamping[0].nama)})`)) === null,
      '',
    )
    catat(
      'avatar murid uji terlihat oleh teman sekelas, dengan tombol Lapor',
      await muridB.tunggu(`(__alat.barisTeman(${JSON.stringify(namaA)}) ?? '').includes('Lapor')`, 25_000),
      (await muridB.evalJs(`__alat.barisTeman(${JSON.stringify(namaA)}) ?? '(tidak ada baris)'`)).slice(0, 110),
    )

    // Avatar pendamping juga dipasang: bahannya untuk uji "Hapus avatar" nanti.
    await muridB.buka('/avatar')
    await muridB.pilihBerkas('input[aria-label="Pilih gambar avatar"]', BERKAS_PNG)
    catat(
      'pendamping bisa memasang avatarnya sendiri',
      await muridB.tunggu(`__alat.ada('img[alt="Avatar saya"]')`, 30_000),
      '',
    )

    await muridB.evalJs(`__alat.laporTeman(${JSON.stringify(namaA)})`)
    catat(
      'panel laporan terbuka dengan pilihan alasannya',
      await muridB.tunggu(
        `__alat.halaman().includes('Laporkan avatar') && __alat.ada('#alasan-laporan')`,
        10_000,
      ),
      await muridB.evalJs(`__alat.teks('h3')`),
    )

    await muridB.evalJs(`__alat.pilih('#alasan-laporan', 'bullying')`)
    await muridB.evalJs(`__alat.isi('#keterangan-laporan', 'SMOKE-AVATAR: gambarnya tidak pantas untuk kelas.')`)
    await muridB.evalJs(`__alat.klikTeks('Kirim laporan')`)
    catat(
      'laporan terkirim lewat antarmuka & hasilnya dilaporkan ke pelapor',
      await muridB.tunggu(`__alat.halaman().includes('Laporan diterima')`, 20_000),
      (await muridB.evalJs(`__alat.halaman()`)).slice(0, 130),
    )

    // ---------- 6. Satu laporan belum menyembunyikan; hitungannya tidak berlipat ----------
    const daftarSetelahLapor = await daftarAvatarGuru()
    const avatarASetelahLapor = daftarSetelahLapor.find((satu) => satu.nama_murid === namaA) ?? null
    avatarAId = avatarASetelahLapor?.id ?? 0
    catat(
      'avatar murid uji tercatat di server',
      avatarAId > 0 && avatarASetelahLapor?.terlihat === true,
      `id=${avatarAId} terlihat=${avatarASetelahLapor?.terlihat}`,
    )
    catat(
      'satu laporan belum menyembunyikan apa pun (ambang ditentukan server)',
      avatarASetelahLapor?.jumlah_laporan === 1,
      `jumlah_laporan=${avatarASetelahLapor?.jumlah_laporan ?? '—'}`,
    )

    // Anak yang sama melapor lagi: idempoten, hitungannya tidak bertambah.
    await muridB.evalJs(`__alat.laporTeman(${JSON.stringify(namaA)})`)
    await sleep(500)
    await muridB.evalJs(`__alat.klikTeks('Kirim laporan')`)
    await sleep(2000)
    const setelahLaporDuaKali = (await daftarAvatarGuru()).find((satu) => satu.id === avatarAId) ?? null
    catat(
      'laporan berulang anak yang sama tidak menambah hitungan',
      setelahLaporDuaKali?.jumlah_laporan === 1,
      `jumlah_laporan=${setelahLaporDuaKali?.jumlah_laporan ?? '—'}`,
    )

    await muridA.buka('/avatar')
    catat(
      'pemilik tetap melihat fotonya walau temannya melapor',
      await muridA.tunggu(`__alat.ada('img[alt="Avatar saya"]')`, 20_000),
      (await muridA.evalJs(`__alat.halaman()`)).slice(0, 120),
    )

    // ---------- 7. Antrean guru masih kosong sebelum ambangnya tercapai ----------
    await guru.buka('/avatar')
    catat(
      'guru melihat halaman "Moderasi Avatar", bukan "Avatar Saya"',
      await guru.tunggu(`__alat.teks('h1') === 'Moderasi Avatar'`, 20_000),
      await guru.evalJs(`__alat.teks('h1')`),
    )
    catat(
      'selama belum tersembunyi, antrean guru kosong dan mengatakannya',
      await guru.tunggu(`__alat.halaman().includes('Tidak ada avatar yang menunggu tinjauan')`, 20_000),
      '',
    )

    // ---------- 8. Anak-anak lain melapor: ambang tercapai ----------
    for (const anak of pendamping.slice(1)) {
      const lapor = await laporSebagai({ email: anak.email, password: SANDI_UJI }, avatarAId, 'tidak_pantas')
      catat(`laporan dari ${anak.nama} diterima`, lapor.status === 201, `status=${lapor.status}`)
    }
    const avatarATersembunyi = (await daftarAvatarGuru()).find((satu) => satu.id === avatarAId) ?? null
    catat(
      `avatar berhenti tampil setelah ${AMBANG} pelapor berbeda`,
      avatarATersembunyi?.terlihat === false,
      `terlihat=${avatarATersembunyi?.terlihat} jumlah=${avatarATersembunyi?.jumlah_laporan ?? '—'}`,
    )

    await muridB.gantiSesi({ email: pendamping[0].email, password: SANDI_UJI })
    await muridB.buka('/avatar')
    catat(
      'murid lain tidak lagi melihatnya di daftar teman sekelas',
      await muridB.tunggu(`__alat.barisTeman(${JSON.stringify(namaA)}) === null`, 25_000),
      '',
    )
    await muridA.buka('/avatar')
    catat(
      'pemiliknya masih melihat fotonya (laporan menyembunyikan, bukan menghapus)',
      await muridA.tunggu(`__alat.ada('img[alt="Avatar saya"]')`, 20_000),
      (await muridA.evalJs(`__alat.halaman()`)).slice(0, 160),
    )

    // ---------- 9. Guru memulihkan ----------
    await guru.buka('/avatar')
    catat(
      'avatar yang dilaporkan masuk antrean tinjauan beserta laporannya',
      await guru.tunggu(
        `__alat.halaman().includes(${JSON.stringify(namaA)}) && __alat.halaman().includes('Menyinggung teman') && __alat.halaman().includes('SMOKE-AVATAR')`,
        25_000,
      ),
      (await guru.evalJs(`__alat.halaman()`)).slice(0, 190),
    )
    await guru.evalJs(`__alat.isi('#catatan-${avatarAId}', 'SMOKE-AVATAR: sudah diperiksa, gambarnya wajar.')`)
    await guru.evalJs(`__alat.klikTeks('Pulihkan')`)
    catat(
      'pemulihan dilaporkan & antrean kembali kosong',
      await guru.tunggu(
        `__alat.halaman().includes('Avatar dipulihkan dan kembali tampil') && __alat.halaman().includes('Tidak ada avatar yang menunggu tinjauan')`,
        25_000,
      ),
      '',
    )
    const avatarAPulih = (await daftarAvatarGuru()).find((satu) => satu.id === avatarAId) ?? null
    catat(
      'avatar kembali tampil untuk semua & hitungan laporannya direset',
      avatarAPulih?.terlihat === true && avatarAPulih?.jumlah_laporan === 0,
      `terlihat=${avatarAPulih?.terlihat} jumlah=${avatarAPulih?.jumlah_laporan ?? '—'}`,
    )

    // ---------- 10. Guru menghapus avatar pendamping ----------
    const avatarB = (await daftarAvatarGuru()).find((satu) => satu.nama_murid === pendamping[0].nama) ?? null
    avatarBId = avatarB?.id ?? 0
    catat('avatar pendamping tercatat untuk uji penghapusan', avatarBId > 0, `id ${avatarBId}`)

    const laporA = await muridA.apiJson(`/v1/avatar/${avatarBId}/lapor`, 'POST', { alasan: 'spam' })
    catat('murid uji ikut melaporkan avatar pendamping', laporA.status === 201, `status=${laporA.status}`)
    for (const anak of pendamping.slice(1)) {
      await laporSebagai({ email: anak.email, password: SANDI_UJI }, avatarBId, 'lainnya')
    }

    await guru.buka('/avatar')
    catat(
      'avatar pendamping juga masuk antrean setelah dilaporkan',
      await guru.tunggu(`__alat.halaman().includes(${JSON.stringify(pendamping[0].nama)})`, 25_000),
      '',
    )
    await guru.evalJs(`__alat.klikTeks('Hapus avatar')`)
    catat(
      'penghapusan moderator dilaporkan & tercatat sebagai audit',
      await guru.tunggu(`__alat.halaman().includes('Avatar dihapus dan tercatat di audit')`, 25_000),
      (await guru.evalJs(`__alat.halaman()`)).slice(0, 140),
    )

    await muridB.gantiSesi({ email: pendamping[0].email, password: SANDI_UJI })
    await muridB.buka('/avatar')
    catat(
      'pemilik avatar yang dihapus moderator kembali ke avatar bawaan',
      await muridB.tunggu(`__alat.halaman().includes('masih memakai avatar bawaan')`, 30_000),
      (await muridB.evalJs(`__alat.halaman()`)).slice(0, 140),
    )

    // ---------- 11. Pagar peran ----------
    const muridPulihkan = await muridA.apiJson(`/v1/avatar/${avatarAId}/pulihkan`, 'POST', {})
    catat('murid tidak bisa memulihkan avatar lewat jalur guru', muridPulihkan.status === 403, `status=${muridPulihkan.status}`)

    const muridModerasi = await muridA.apiJson('/v1/avatar/moderasi')
    catat('murid tidak bisa membuka antrean moderasi', muridModerasi.status === 403, `status=${muridModerasi.status}`)

    const laporSendiri = await muridA.apiJson(`/v1/avatar/${avatarAId}/lapor`, 'POST', { alasan: 'spam' })
    catat(
      'murid tidak bisa melaporkan avatarnya sendiri (ditolak server, bukan cuma disembunyikan di UI)',
      laporSendiri.status === 403 || laporSendiri.status === 422,
      `status=${laporSendiri.status}`,
    )
  } catch (galat) {
    catat('alur avatar selesai tanpa galat tak terduga', false, galat?.message ?? String(galat))
  } finally {
    // ---------- Pembersihan ----------
    try {
      const bersihAvatar = await muridA.apiJson('/v1/avatar', 'DELETE')
      catat(
        'pembersihan: avatar murid uji dikembalikan ke bawaan',
        bersihAvatar.status === 200 || bersihAvatar.status === 204,
        `status=${bersihAvatar.status}`,
      )
    } catch (galat) {
      catat('pembersihan avatar murid uji', false, galat?.message ?? String(galat))
    }

    try {
      let terhapus = 0
      for (const satuId of idPendamping) {
        const hapus = await guru.apiJson(`/v1/murid/${satuId}`, 'DELETE')
        if (hapus.status === 200 || hapus.status === 204) terhapus++
      }
      catat('pembersihan: murid pendamping dihapus', terhapus === idPendamping.length, `${terhapus}/${idPendamping.length}`)
    } catch (galat) {
      catat('pembersihan murid pendamping', false, galat?.message ?? String(galat))
    }    await send('Target.disposeBrowserContext', { browserContextId: ctxB }).catch(() => {})
.catch(() => {})
    await send('Target.disposeBrowserContext', { browserContextId: ctxA }).catch(() => {})
    await send('Target.disposeBrowserContext', { browserContextId: ctxGuru }).catch(() => {})
    ws.close()

    const gagal = hasil.filter((satu) => !satu.lolos)
    console.log(`\nTotal: ${hasil.length - gagal.length}/${hasil.length} lulus · ${gagal.length} gagal`)
    process.exit(gagal.length === 0 ? 0 : 1)
  }
}

main().catch((e) => {
  console.error('harness error:', e.message)
  process.exit(1)
})
