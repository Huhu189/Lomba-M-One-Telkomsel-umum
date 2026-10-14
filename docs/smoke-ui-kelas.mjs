// Smoke halaman Kelas lewat browser sungguhan (Chrome DevTools Protocol).
//
// Dua keluhan pemakaian yang dibuktikan di sini:
//
// 1. **Kelas yang namanya sudah dipakai.** Guru menekan "Simpan kelas" dengan
//    nama yang sudah ada (nama contoh di formulir dulu justru salah satunya) dan
//    jawabannya dulu cuma toast berbahasa Inggris. Sekarang sebabnya harus
//    terbaca DI BAWAH ISIAN nama, dan kelasnya tetap tidak terbuat (bukan
//    dibuat diam-diam). Sesudah nama diganti, kelasnya harus benar-benar
//    tersimpan.
// 2. **Permintaan saat jendela kembali difokuskan.** TanStack Query bawaannya
//    mengambilkan ulang setiap query aktif saat halaman kembali terlihat, jadi
//    perpindahan jendela mengirim beberapa permintaan dalam satu detik tanpa ada
//    data yang berubah. Harness ini mengubah visibilitas halaman
//    (frozen → active) dan menghitung permintaan `/api/v1/` yang lahir.
//
// Harness ini MANDIRI: kelas ujinya dibuat lalu dihapus di blok `finally`, dan
// tidak pernah menyentuh kelas bernama lain.
//
// Prasyarat: backend 8000, vite 5173, Chrome --remote-debugging-port=9333
// (dijalankan oleh `docs/jalankan-smoke-ui.sh kelas`).
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness guru
// memakai akun guru sungguhan (guru1@sekolah.test) — bukan akun admin seperti dulu.
// Jalur kepala sekolah diuji terpisah di `docs/smoke-ui-admin.mjs`.
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }

const TANDA = String(Date.now()).slice(-6)
const KELAS_UJI = `Smoke kelas ${TANDA}`
/** Nama kelas yang PASTI sudah ada di data bawaan (lihat MasterDataSeeder). */
const KELAS_TERPAKAI = '6A'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alat bantu di sisi halaman (disuntik ulang setiap navigasi). */
const ALAT = `window.__alat = {
  teks(sel) { return document.querySelector(sel)?.textContent?.replace(/\\s+/g, ' ').trim() ?? '' },
  jumlah(sel) { return document.querySelectorAll(sel).length },
  atribut(sel, nama) { return document.querySelector(sel)?.getAttribute(nama) ?? null },
  halaman() { return (document.querySelector('main')?.innerText ?? '').replace(/\\s+/g, ' ') },
  panel() { return (document.querySelector('dialog')?.innerText ?? '').replace(/\\s+/g, ' ') },
  panelTerbuka() { return document.querySelector('dialog')?.open === true },
  toast() { return [...document.querySelectorAll('.toast-item')].map((t) => (t.innerText ?? '').replace(/\\s+/g, ' ')).join(' | ') },
  klikTeks(teks) {
    const tombol = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(teks))
    if (!tombol) return false
    tombol.click()
    return true
  },
  // Mengetik seperti pengguna: React membaca event 'input', jadi nilainya harus
  // dipasang lewat setter asli elemen lalu event-nya dilepas.
  ketik(sel, teks) {
    const el = document.querySelector(sel)
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
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
  kirim() {
    const form = document.querySelector('dialog form')
    if (!form) return false
    form.requestSubmit()
    return true
  },
  barisTabel() {
    return [...document.querySelectorAll('table tbody tr')].map((tr) => (tr.innerText ?? '').replace(/\\s+/g, ' ').trim())
  },
  // Penghitung permintaan /api/v1/: klien API aplikasi memakai XMLHttpRequest
  // (axios), jadi yang dipasangi penghitung adalah XHR.
  catatApi() {
    if (window.__apiCatat) return true
    window.__apiCatat = []
    const bukaAsli = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (metode, alamat, ...sisa) {
      const url = String(alamat)
      if (url.indexOf('/api/v1/') >= 0) window.__apiCatat.push(metode + ' ' + url)
      return bukaAsli.call(this, metode, alamat, ...sisa)
    }
    return true
  },
  bersihkanCatat() { if (window.__apiCatat) window.__apiCatat = []; return true },
  catat() { return window.__apiCatat ? window.__apiCatat.slice() : [] },
  // Bukti bahwa perubahan visibilitas halaman benar-benar sampai ke halaman ini.
  pantauVisibilitas() {
    if (window.__visCatat) return true
    window.__visCatat = []
    window.addEventListener('visibilitychange', () => window.__visCatat.push(document.visibilityState))
    return true
  },
  catatVisibilitas() { return window.__visCatat ? window.__visCatat.slice() : [] },
  hitung(jalur) { return (window.__apiCatat ?? []).filter((satu) => satu.indexOf(jalur) >= 0).length },
  // Pindah jendela lalu kembali, seperti yang dilakukan peramban sungguhan:
  // halaman jadi 'hidden' (tab lain dilihat), lalu 'visible' lagi — masing-masing
  // disertai event visibilitychange yang didengarkan semua pihak.
  //
  // Dipakai menggantikan perintah CDP Page.setWebLifecycleState karena perintah
  // itu TIDAK memicu visibilitychange di sini (sudah dicoba: halaman melaporkan
  // "tidak ada event"), jadi tanpa simulasi ini uji "tidak ada permintaan"
  // hanya membuktikan bahwa tidak ada apa pun yang terjadi.
  pindahJendela() {
    const set = (nilai) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => nilai })
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => nilai === 'hidden' })
      window.dispatchEvent(new Event('visibilitychange'))
    }
    set('hidden')
    window.setTimeout(() => set('visible'), 400)
    return true
  },
}`

const hasil = []

/**
 * Alat dipasang sejak dokumen dibuat supaya penghitung permintaan sudah siap
 * sebelum skrip aplikasi berjalan — kalau dipasang sesudah halaman memuat,
 * permintaan terpenting (sesi) sudah lewat dan tidak terhitung.
 */
const ALAT_AWAL = `${ALAT}\nwindow.__alat.catatApi()`

function catat(nama, lolos, detail = '') {
  hasil.push({ nama, lolos })
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
  await send('Page.addScriptToEvaluateOnNewDocument', { source: ALAT_AWAL }, sessionId)

  const evalJs = async (expression) => {
    const r = await send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    )
    if (r.exceptionDetails) {
      throw new Error(
        'eval error: ' + (r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)),
      )
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

  const masuk = async () => {
    let hasilMasuk = await apiJson('/v1/auth/masuk', 'POST', AKUN_GURU).catch(() => null)

    // Jalur masuk di-throttle per akun+IP (5/menit): sabar dulu kalau kena.
    for (let coba = 0; coba < 3 && hasilMasuk?.status === 429; coba++) {
      console.log('   (batas masuk per menit tercapai, menunggu 20 detik…)')
      await sleep(20_000)
      hasilMasuk = await apiJson('/v1/auth/masuk', 'POST', AKUN_GURU)
    }

    return hasilMasuk
  }

  /** @type {number} */
  let idKelasUji = 0

  const daftarKelas = async () => {
    const jawab = await apiJson('/v1/kelas')
    return Array.isArray(jawab.isi) ? jawab.isi : []
  }

  const bersihkan = async () => {
    const status = []

    if (idKelasUji > 0) status.push((await apiJson(`/v1/kelas/${idKelasUji}`, 'DELETE')).status)
    await apiJson('/v1/auth/keluar', 'POST')

    return {
      status: status.every((satu) => satu === 200) ? 200 : (status[0] ?? 200),
      sisa: idKelasUji > 0 ? `kelas ${idKelasUji} dihapus (${status.join(',')})` : 'tidak ada kelas uji',
    }
  }

  try {
    await buka('/')
    const guruMasuk = await masuk()
    catat('guru masuk', guruMasuk?.status === 200, guruMasuk?.isi?.user?.email ?? `status ${guruMasuk?.status}`)
    if (guruMasuk?.status !== 200) throw new Error('guru tidak bisa masuk: ' + JSON.stringify(guruMasuk))

    const sebelum = await daftarKelas()
    catat('kelas bawaan ada (6A terpakai)', sebelum.some((satu) => satu.nama === KELAS_TERPAKAI), `${sebelum.length} kelas`)

    // --- 1. Halaman Kelas terbuka dengan nama contoh yang BELUM terpakai ---
    await buka('/kelas')
    catat('halaman kelas terbuka dengan daftar terisi', await tunggu(`window.__alat.barisTabel().length > 0`))

    const contoh = await evalJs(`window.__alat.atribut('#nama-kelas', 'placeholder')`)
    catat('nama contoh formulir bukan nama yang sudah ada', contoh === 'Contoh: 6C', `placeholder: ${contoh}`)

    // Satu muat halaman hanya boleh memeriksa sesi SEKALI: dulu React memanggil
    // efeknya dua kali saat pengembangan sehingga /v1/sesi dan /auth/saya
    // masing-masing dikirim dua kali dalam detik yang sama.
    const sesiSekali = await evalJs(`window.__alat.hitung('/v1/sesi')`)
    const sayaSekali = await evalJs(`window.__alat.hitung('/v1/auth/saya')`)
    catat(
      'satu muat halaman memeriksa sesi sekali saja',
      sesiSekali === 1 && sayaSekali === 1,
      `/v1/sesi ×${sesiSekali} · /v1/auth/saya ×${sayaSekali}`,
    )

    // --- 2. Nama yang sudah dipakai: sebabnya terbaca di bawah isian ---
    await evalJs(`window.__alat.klikTeks('Tambah kelas')`)
    await sleep(400)
    catat('panel tambah kelas terbuka', await evalJs('window.__alat.panelTerbuka()'))

    await evalJs(`window.__alat.ketik('#nama-kelas', ${JSON.stringify(KELAS_TERPAKAI)})`)
    await evalJs(`window.__alat.pilih('#tingkat-kelas', 6)`)
    await evalJs('window.__alat.kirim()')

    const sebabTampil = await tunggu(`window.__alat.panel().includes('sudah dipakai')`, 8000)
    catat('pesan "sudah dipakai" tampil di panel', sebabTampil, (await evalJs('window.__alat.panel()')).slice(0, 90))
    catat(
      'pesan tampil di bawah isian nama (bukan cuma toast)',
      await evalJs(`window.__alat.teks('dialog p.status-salah').includes('sudah dipakai')`),
      await evalJs(`window.__alat.teks('dialog p.status-salah')`),
    )
    catat('toast ikut menjelaskan sebabnya', (await evalJs('window.__alat.toast()')).includes('sudah dipakai'))

    const sesudahGagal = await daftarKelas()
    catat(
      'kelas bertabrakan TIDAK terbuat',
      sesudahGagal.length === sebelum.length,
      `${sebelum.length} → ${sesudahGagal.length}`,
    )

    // --- 3. Nama diganti: benar-benar tersimpan ---
    await evalJs(`window.__alat.ketik('#nama-kelas', ${JSON.stringify(KELAS_UJI)})`)
    await evalJs('window.__alat.kirim()')

    const tersimpan = await tunggu(
      `window.__alat.toast().includes('Kelas ditambahkan.') && window.__alat.halaman().includes(${JSON.stringify(KELAS_UJI)})`,
      12000,
    )
    catat('nama baru tersimpan dan muncul di daftar', tersimpan, `“${KELAS_UJI}”`)

    const sesudahSukses = await daftarKelas()
    idKelasUji = sesudahSukses.find((satu) => satu.nama === KELAS_UJI)?.id ?? 0
    catat('kelas tercatat di server', idKelasUji > 0, `id ${idKelasUji}`)
    catat('panel ditutup setelah berhasil', !(await evalJs('window.__alat.panelTerbuka()')))
    catat(
      'pesan lama tidak tertinggal',
      !(await evalJs(`window.__alat.panel().includes('sudah dipakai')`)),
    )

    // --- 4. Jendela kembali difokuskan: TIDAK ada permintaan baru ---
    await evalJs('window.__alat.catatApi()')
    await evalJs('window.__alat.pantauVisibilitas()')
    await evalJs('window.__alat.bersihkanCatat()')

    // Halaman disembunyikan lalu ditampilkan lagi — persis perpindahan jendela.
    await evalJs('window.__alat.pindahJendela()')
    await sleep(2600)

    const visibilitas = await evalJs('window.__alat.catatVisibilitas()')
    const permintaan = await evalJs('window.__alat.catat()')

    catat(
      'perubahan visibilitas benar-benar sampai ke halaman',
      visibilitas.includes('hidden') && visibilitas.includes('visible'),
      visibilitas.join(' → ') || '(tidak ada event)',
    )
    catat(
      'fokus jendela tidak menembak permintaan lagi',
      permintaan.length === 0,
      permintaan.length === 0 ? '0 permintaan' : permintaan.join(' ; '),
    )
  } finally {
    const bersih = await bersihkan()
    catat('kelas uji dihapus kembali', bersih.status === 200, bersih.sisa)
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
