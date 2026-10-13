// Smoke halaman Impor Murid dari CSV lewat browser sungguhan (Chrome DevTools
// Protocol).
//
// Halaman ini satu-satunya pintu masuk data massal bagi guru, dan sampai
// 13 Oktober 2026 ia **tidak pernah** diuji di peramban: berkasnya dipilih lewat
// <input type="file"> yang tidak bisa disentuh `eval` biasa, jadi seluruh jalur
// unggah → validasi per baris → tabel galat → daftar murid belum pernah
// dibuktikan bekerja dari sisi guru.
//
// Yang dibuktikan harness ini:
//
// 1. Berkas dengan judul kolom lazim guru ( **"Nama Lengkap", "E-mail",
//    "Nama Kelas", "Nomor Induk Siswa"** ) diterima apa adanya — janji A.60 yang
//    sebelumnya hanya diuji di backend. Pembuktiannya di sini sampai ke daftar
//    murid: kolom Kelas & NIS benar-benar terisi dari kolom ber-alias.
// 2. Berkas berisi BOM dan pemisah `;` (begitu Excel Indonesia menyimpan CSV)
//    tetap terbaca; baris yang salah dilaporkan **per nomor baris** dengan pesan
//    yang menyebut sebabnya (kelas tidak ada, email milik akun non-murid, NIS
//    ganda) — bukan satu pesan umum yang menyalahkan gurunya.
// 3. Berkas dengan judul resmi (`nama,email,kelas`, pemisah koma) masih bekerja
//    seperti sebelum alias ada — jalur lama tidak rusak oleh jalur baru.
// 4. Murid yang tidak lolos validasi **tidak** meninggalkan jejak di daftar
//    murid (pencarian server dipakai untuk membuktikannya).
//
// Harness ini MANDIRI: murid ujinya dibuat lewat unggahan itu sendiri lalu
// dihapus lagi (beserta berkas CSV sementaranya) di blok `finally`, dan tidak
// menyentuh murid bernama lain.
//
// Prasyarat: backend 8000, vite 5173, Chrome --remote-debugging-port=9333
// (dijalankan oleh `docs/jalankan-smoke-ui.sh impor-murid`).
import { unlinkSync, writeFileSync } from 'node:fs'

const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }

const TANDA = String(Date.now()).slice(-6)
const KELAS_ADA = '6A'
const KELAS_SALAH = `Kelas Hantu ${TANDA}`
const EMAIL_1 = `smoke.impor.${TANDA}.1@sekolah.test`
const EMAIL_2 = `smoke.impor.${TANDA}.2@sekolah.test`
const EMAIL_3 = `smoke.impor.${TANDA}.3@sekolah.test`
const EMAIL_4 = `smoke.impor.${TANDA}.4@sekolah.test`
const NIS_1 = `IMP${TANDA}1`
const NAMA_1 = `Smoke Impor ${TANDA} Satu`
const NAMA_3 = `Smoke Impor ${TANDA} Tiga`

const CSV_EXCEL = `/tmp/smoke-impor-excel-${TANDA}.csv`
const CSV_RESMI = `/tmp/smoke-impor-resmi-${TANDA}.csv`

// Berkas pertama: judul kolom seperti yang benar-benar ditulis guru (Excel:
// "Nama Lengkap", email: "E-mail"), pemisah `;`, dan BOM di depan (begitu Excel
// menyimpan berkasnya). Lima baris, tiga di antaranya memang harus gagal.
const ISI_EXCEL =
  '\uFEFF' +
  [
    'Nama Lengkap;E-mail;Nama Kelas;Nomor Induk Siswa',
    `${NAMA_1};${EMAIL_1};${KELAS_ADA};${NIS_1}`,
    `Smoke Impor ${TANDA} Dua;${EMAIL_2};${KELAS_SALAH};IMP${TANDA}2`,
    `Smoke Impor ${TANDA} Empat;admin@sekolah.test;${KELAS_ADA};IMP${TANDA}4`,
    `Smoke Impor ${TANDA} Lima;${EMAIL_4};${KELAS_ADA};${NIS_1}`,
  ].join('\n') +
  '\n'

// Berkas kedua: judul resmi + pemisah koma — jalur yang sudah ada sebelum alias.
const ISI_RESMI = ['nama,email,kelas', `${NAMA_3},${EMAIL_3},${KELAS_ADA}`].join('\n') + '\n'

// Varian berkas yang diunggah langsung lewat API (tanpa dialog berkas) dengan
// satu baris sah masing-masing: memisahkan "berkasnya ditolak" dari "jalurnya
// bermasalah", dan menjaga janji A.60 tentang berkas Excel tetap berlaku.
const VARIAN_API = [
  {
    nama: 'Excel: BOM + pemisah ";"',
    isi: `\uFEFFNama Lengkap;E-mail;Nama Kelas;Nomor Induk Siswa\nSmoke API ${TANDA} BOM;smoke.impor.${TANDA}.api1@sekolah.test;${KELAS_ADA};S${TANDA}A1\n`,
  },
  {
    nama: 'Excel tanpa BOM, pemisah ";"',
    isi: `Nama Lengkap;E-mail;Nama Kelas;Nomor Induk Siswa\nSmoke API ${TANDA} Semicolon;smoke.impor.${TANDA}.api2@sekolah.test;${KELAS_ADA};S${TANDA}A2\n`,
  },
  {
    nama: 'judul resmi, pemisah ","',
    isi: `nama,email,kelas\nSmoke API ${TANDA} Resmi,smoke.impor.${TANDA}.api3@sekolah.test,${KELAS_ADA}\n`,
  },
]

writeFileSync(CSV_EXCEL, ISI_EXCEL, 'utf8')
writeFileSync(CSV_RESMI, ISI_RESMI, 'utf8')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alat bantu di sisi halaman (disuntik ulang setiap navigasi). */
const ALAT = `window.__alat = {
  teks(sel) { return document.querySelector(sel)?.textContent?.replace(/\\s+/g, ' ').trim() ?? '' },
  halaman() { return (document.querySelector('main')?.innerText ?? '').replace(/\\s+/g, ' ') },
  nilai(sel) { return document.querySelector(sel)?.value ?? null },
  tombolImpor() {
    return [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Impor') ?? null
  },
  tombolImporMati() { const t = this.tombolImpor(); return t ? t.disabled : null },
  klikImpor() { const t = this.tombolImpor(); if (!t) return false; t.click(); return true },
  // Hasil impor dibaca dari kotak hasil DI DALAM kartu impor. Selektor
  // '[role="status"]' polos salah: tata letak juga punya penanda "Server
  // terhubung" ber-role status, dan dialah yang terbaca lebih dulu.
  kotakHasil() {
    const kotak = [...document.querySelectorAll('main [role="status"], main [role="alert"]')]
    return kotak.find((el) => (el.innerText ?? '').includes('baris')) ?? null
  },
  ringkasImpor() {
    const kotak = this.kotakHasil()
    return kotak ? (kotak.innerText ?? '').replace(/\\s+/g, ' ').trim() : ''
  },
  roleRingkas() {
    const kotak = this.kotakHasil()
    return kotak ? kotak.getAttribute('role') : null
  },
  barisGalat() {
    const kotak = this.kotakHasil()
    if (!kotak) return []
    return [...kotak.querySelectorAll('table tbody tr')].map((tr) =>
      [...tr.querySelectorAll('th, td')].map((sel) => (sel.innerText ?? '').replace(/\\s+/g, ' ').trim()),
    )
  },
  toast() {
    return [...document.querySelectorAll('.toast-item')].map((t) => (t.innerText ?? '').replace(/\\s+/g, ' ')).join(' | ')
  },
  // Mengetik seperti guru: React membaca event 'input', jadi nilainya dipasang
  // lewat setter asli elemen lalu event-nya dilepas (kotak cari menunggu 300 ms
  // sesudah ketikan terakhir sebelum bertanya ke server).
  ketik(sel, teks) {
    const el = document.querySelector(sel)
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, teks)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  },
  barisTabel() {
    return [...document.querySelectorAll('main table tbody tr')].map((tr) =>
      (tr.innerText ?? '').replace(/\\s+/g, ' ').trim(),
    )
  },
  /** Unggah langsung lewat API dari dalam halaman (dipakai untuk varian berkas). */
  async unggah(konten) {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
    const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '')
    const form = new FormData()
    form.append('file', new File([konten], 'murid.csv', { type: 'text/csv' }))
    const res = await fetch('/api/v1/murid/impor', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
      body: form,
    })
    return { status: res.status, isi: await res.json().catch(() => null) }
  },
}`

const hasil = []
function cek(nama, lolos, detail = '') {
  hasil.push({ nama, lolos: Boolean(lolos) })
  console.log(`${lolos ? 'LULUS' : 'GAGAL'} · ${nama}${detail ? ' · ' + detail : ''}`)
}

async function endpoint() {
  return fetch(`${CDP}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl)
}

async function main() {
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

  const tunggu = async (ekspresi, batas = 15000) => {
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

  /**
   * Memilih berkas seperti guru memilihnya dari cakram — lewat CDP, bukan dengan
   * menyuntik `File` buatan: jalur inilah yang memicu `change` sungguhan di
   * <input type="file">.
   */
  const pilihBerkas = async (jalurCsv) => {
    const { root } = await send('DOM.getDocument', {}, sessionId)
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#berkas-murid' }, sessionId)
    if (!nodeId) return false
    await send('DOM.setFileInputFiles', { files: [jalurCsv], nodeId }, sessionId)
    await sleep(400)
    return true
  }

  /** Murid uji yang sedang ada di server, dicari lewat kotak pencarian server. */
  const cariMurid = async (kata) =>
    (await apiJson(`/v1/murid?filter[cari]=${encodeURIComponent(kata)}&per_page=50`)).isi?.data ?? []

  /** Membuka daftar murid dengan pencarian yang diketik seperti guru. */
  const cariDiDaftar = async (kata) => {
    await buka('/murid')
    await evalJs(`__alat.ketik('#cari-murid', ${JSON.stringify(kata)})`)
    await sleep(1400)
    return evalJs(`({ baris: __alat.barisTabel(), isi: __alat.halaman() })`)
  }

  try {
    // ---------- Masuk sebagai guru ----------
    // Halaman aplikasi dibuka lebih dulu: alat bantu API memakai URL relatif,
    // jadi origin-nya harus sudah aplikasi (bukan about:blank).
    await buka('/masuk')
    let masuk = await apiJson('/v1/auth/masuk', 'POST', AKUN_GURU)
    for (let coba = 0; coba < 3 && masuk?.status === 429; coba++) {
      console.log('   (batas masuk per menit tercapai, menunggu 20 detik…)')
      await sleep(20_000)
      masuk = await apiJson('/v1/auth/masuk', 'POST', AKUN_GURU)
    }
    cek('guru masuk · admin@sekolah.test', masuk?.status === 200, `status ${masuk?.status}`)

    // ---------- 1. Halaman impor ----------
    await buka('/murid/impor')
    const halaman = await evalJs(`({
      judul: __alat.teks('h1'),
      petunjuk: __alat.halaman().slice(0, 240),
      adaInput: document.querySelector('#berkas-murid')?.getAttribute('type') ?? null,
      tombolMati: __alat.tombolImporMati(),
      tombolAda: Boolean(__alat.tombolImpor()),
    })`)
    cek('halaman impor terbuka dengan satu h1', halaman.judul.toLowerCase().includes('impor murid'), halaman.judul)
    cek('berkas dipilih lewat <input type="file">', halaman.adaInput === 'file', `type=${halaman.adaInput}`)
    cek(
      'halaman menyebut kolom wajib & opsional apa adanya',
      halaman.petunjuk.includes('nama') &&
        halaman.petunjuk.includes('email') &&
        halaman.petunjuk.includes('kelas') &&
        halaman.petunjuk.includes('kata_sandi') &&
        halaman.petunjuk.includes('100 galat'),
      halaman.petunjuk.slice(0, 120),
    )
    cek('tombol "Impor" mati sebelum ada berkas', halaman.tombolAda && halaman.tombolMati === true, `mati=${halaman.tombolMati}`)

    // ---------- 2. Berkas gaya Excel (BOM, ";", judul kolom ber-alias) ----------
    cek('berkas CSV guru bisa dipilih dari cakram', await pilihBerkas(CSV_EXCEL))
    cek('berkas terpasang di isian berkas', (await evalJs(`document.querySelector('#berkas-murid').files.length`)) === 1)
    cek('tombol "Impor" hidup setelah berkas dipilih', (await evalJs(`__alat.tombolImporMati()`)) === false)

    await evalJs(`__alat.klikImpor()`)
    const selesai = await tunggu(`__alat.ringkasImpor().length > 0`, 25000)
    cek('impor berjalan & halaman melaporkan hasilnya', selesai, '')

    const laporan = await evalJs(`({
      ringkas: __alat.ringkasImpor(),
      role: __alat.roleRingkas(),
      baris: __alat.barisGalat(),
      toast: __alat.toast(),
    })`)
    const semuaPesan = laporan.baris.map((b) => b.join(' ')).join(' | ')

    cek(
      'judul kolom lazim guru diterima (bukan 422 "kolom wajib tidak ditemukan")',
      laporan.ringkas.includes('1 baris berhasil diimpor') && !laporan.ringkas.includes('Kolom wajib tidak ditemukan'),
      laporan.ringkas.slice(0, 160) || `toast: ${laporan.toast}`,
    )
    cek(
      'ringkasan menyebut jumlah berhasil & gagal',
      laporan.ringkas.includes('1 baris berhasil diimpor') && laporan.ringkas.includes('3 baris gagal'),
      laporan.ringkas,
    )
    cek('gangguan dilaporkan sebagai alert, bukan status biasa', laporan.role === 'alert', `role=${laporan.role}`)
    cek(
      'tabel galat menyebut nomor baris & sebabnya (kelas tidak ada)',
      new RegExp(`Kelas "Kelas Hantu \\d+" tidak ditemukan\\.`).test(semuaPesan),
      semuaPesan.slice(0, 200),
    )
    cek('tabel galat menolak email milik akun non-murid', semuaPesan.includes('Email sudah dipakai akun non-murid.'), '')
    cek('tabel galat menolak NIS ganda di dalam berkas', semuaPesan.includes('NIS ganda di dalam berkas.'), '')
    cek(
      'nomor baris yang dilaporkan mengikuti baris berkas (3, 4, 5)',
      laporan.baris.map((b) => b[0]).join(',') === '3,4,5',
      laporan.baris.map((b) => b[0]).join(','),
    )

    // ---------- 3. Hasilnya benar-benar masuk ke daftar murid ----------
    const daftarSatu = await cariDiDaftar(EMAIL_1)
    const barisSatu = daftarSatu.baris.filter((b) => b.includes(EMAIL_1))
    cek('murid yang sah muncul di daftar murid', barisSatu.length === 1, `${barisSatu.length} baris · ${barisSatu.join(' / ').slice(0, 160)}`)
    cek('nama & email dari berkas tersimpan apa adanya', barisSatu[0]?.includes(NAMA_1) ?? false, barisSatu[0]?.slice(0, 120) ?? '')
    cek('kolom "Nama Kelas" ber-alias benar-benar mengisi kolom Kelas', barisSatu[0]?.includes(KELAS_ADA) ?? false, barisSatu[0]?.slice(0, 120) ?? '')
    cek('kolom "Nomor Induk Siswa" ber-alias benar-benar mengisi NIS', barisSatu[0]?.includes(NIS_1) ?? false, barisSatu[0]?.slice(0, 120) ?? '')

    const daftarGagal = await cariDiDaftar(EMAIL_2)
    cek(
      'baris yang ditolak tidak meninggalkan murid di daftar',
      daftarGagal.baris.filter((b) => b.includes(EMAIL_2)).length === 0 &&
        daftarGagal.isi.includes('Tidak ada murid yang cocok'),
      daftarGagal.isi.slice(0, 140),
    )

    const muridUi = (await cariMurid(`smoke.impor.${TANDA}`)).filter((m) =>
      String(m.email ?? '').startsWith(`smoke.impor.${TANDA}.`),
    )
    cek('hanya baris sah yang membuat murid di server', muridUi.length === 1, `${muridUi.length} murid`)

    // ---------- 4. Berkas berjudul resmi tetap bekerja (regresi jalur lama) ----------
    await buka('/murid/impor')
    await pilihBerkas(CSV_RESMI)
    await evalJs(`__alat.klikImpor()`)
    cek(
      'berkas berjudul resmi (nama,email,kelas) juga diterima',
      await tunggu(`__alat.ringkasImpor().includes('1 baris berhasil diimpor')`, 25000),
      await evalJs(`__alat.ringkasImpor() || __alat.toast()`),
    )
    const laporanResmi = await evalJs(`({ ringkas: __alat.ringkasImpor(), role: __alat.roleRingkas() })`)
    cek(
      'impor bersih dilaporkan sebagai status (bukan alert)',
      laporanResmi.ringkas.includes('0 baris gagal') && laporanResmi.role === 'status',
      `${laporanResmi.role} · ${laporanResmi.ringkas}`,
    )
    const daftarTiga = await cariDiDaftar(EMAIL_3)
    cek('murid kedua dari berkas resmi ikut terdaftar', daftarTiga.baris.filter((b) => b.includes(EMAIL_3)).length === 1, daftarTiga.baris.join(' / ').slice(0, 120))

    // ---------- 5. Varian berkas langsung ke API (BOM / pemisah / judul) ----------
    for (const varian of VARIAN_API) {
      const jawab = await evalJs(`__alat.unggah(${JSON.stringify(varian.isi)})`)
      cek(
        `API: berkas ${varian.nama} diterima`,
        jawab.status === 200 && jawab.isi?.laporan?.sukses === 1 && jawab.isi?.laporan?.gagal === 0,
        `status=${jawab.status} · ${jawab.isi?.message ?? JSON.stringify(jawab.isi?.errors ?? {}).slice(0, 120)}`,
      )
    }
  } catch (galat) {
    // Galat tak terduga (mis. perintah CDP ditolak) harus terbaca sebagai
    // kegagalan harness — bukan hilang diam-diam karena blok `finally` yang
    // tetap keluar dengan kode 0.
    cek('alur impor selesai tanpa galat tak terduga', false, galat?.message ?? String(galat))
  } finally {
    // ---------- Pembersihan ----------
    const daftarAkhir = await cariMurid(`smoke.impor.${TANDA}`).catch(() => [])
    const statusHapus = []
    for (const murid of daftarAkhir) {
      const hasilHapus = await apiJson(`/v1/murid/${murid.id}`, 'DELETE').catch(() => ({ status: 0 }))
      statusHapus.push(hasilHapus.status)
    }
    const sisa = await cariMurid(`smoke.impor.${TANDA}`).catch(() => [])
    cek(
      'pembersihan: murid uji terhapus dari server',
      daftarAkhir.length > 0 && statusHapus.every((s) => s === 204 || s === 200) && sisa.length === 0,
      `dihapus=${daftarAkhir.length} status=${statusHapus.join(',')} sisa=${sisa.length}`,
    )
    for (const berkas of [CSV_EXCEL, CSV_RESMI]) {
      try {
        unlinkSync(berkas)
      } catch {
        // Berkas uji sudah tidak ada — tidak ada yang perlu dibersihkan.
      }
    }

    await send('Target.closeTarget', { targetId })
    ws.close()

    const gagal = hasil.filter((h) => !h.lolos)
    console.log(`\nTotal: ${hasil.length - gagal.length}/${hasil.length} lulus · ${gagal.length} gagal`)
    process.exit(gagal.length === 0 ? 0 : 1)
  }
}

main().catch((e) => {
  console.error('smoke gagal:', e.message)
  process.exit(1)
})
