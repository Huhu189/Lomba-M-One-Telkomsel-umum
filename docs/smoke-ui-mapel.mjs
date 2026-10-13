// Smoke halaman Mapel lewat browser sungguhan (Chrome DevTools Protocol).
//
// Halaman `/mapel` punya kembarannya (`/kelas`) yang sudah punya harness sendiri
// sejak lama, tetapi ia sendiri belum pernah dibuka di peramban: yang ada cuma
// uji backend (`SekolahTest`) dan `cdp` yang menuangkan isi halaman tanpa
// memeriksa apa pun. Justru itu berbahaya — dua halaman yang ditulis "dengan
// pola yang sama" bisa menyimpang tanpa ada yang menangkapnya.
//
// Yang dibuktikan harness ini:
//
// 1. Halaman terjangkau dari sidebar dan kepalanya menyebut jumlah mapel apa
//    adanya.
// 2. Isian yang salah ditolak **sebelum** dikirim: nama kosong, nama terlalu
//    pendek, dan kode dengan spasi — masing-masing pesannya terbaca tepat di
//    bawah isiannya, bukan cuma di toast.
// 3. **Nama mapel yang sudah dipakai** (kasus paling sering: guru mengetik
//    "Matematika" yang memang sudah ada) harus menjelaskan sebabnya dalam
//    bahasa Indonesia DI BAWAH ISIAN NAMA, dan mapelnya tetap tidak terbuat.
//    Standar ini sudah dipakai halaman Kelas; harness ini menuntut hal yang
//    sama dari Mapel.
// 4. Mapel baru benar-benar tersimpan, kodenya dinormalkan server jadi huruf
//    besar, bisa diubah, dan penghapusannya lewat dialog konfirmasi yang
//    menyebut dampaknya — dengan "Batal" yang benar-benar membatalkan.
// 5. Dua pagar halaman data induk yang sudah ada sejak halaman Kelas: satu muat
//    halaman memeriksa sesi SEKALI saja, dan jendela yang kembali difokuskan
//    tidak menembak permintaan baru.
//
// Harness ini MANDIRI: mapel ujinya dibuat lalu dihapus di blok `finally`, dan
// tidak pernah menyentuh mapel bernama lain.
//
// Prasyarat: backend 8000, vite 5173, Chrome --remote-debugging-port=9333
// (dijalankan oleh `docs/jalankan-smoke-ui.sh mapel`).
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }

const TANDA = String(Date.now()).slice(-6)
const MAPEL_UJI = `Smoke mapel ${TANDA}`
const MAPEL_UBAH = `Smoke mapel ubah ${TANDA}`
/** Nama mapel yang PASTI sudah ada di data bawaan (lihat BankSoalSeeder). */
const MAPEL_TERPAKAI = 'Matematika'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alat bantu di sisi halaman (disuntik ulang setiap navigasi). */
const ALAT = `window.__alat = {
  teks(sel) { return document.querySelector(sel)?.textContent?.replace(/\\s+/g, ' ').trim() ?? '' },
  atribut(sel, nama) { return document.querySelector(sel)?.getAttribute(nama) ?? null },
  halaman() { return (document.querySelector('main')?.innerText ?? '').replace(/\\s+/g, ' ') },
  // PanelForm & DialogKonfirmasi sama-sama <dialog>; yang dibaca selalu yang
  // sedang TERBUKA, bukan yang pertama di DOM.
  panel() { return (document.querySelector('dialog[open]')?.innerText ?? '').replace(/\\s+/g, ' ') },
  panelTerbuka() { return document.querySelector('dialog[open]')?.getAttribute('role') === 'dialog' },
  konfirmasi() {
    const d = document.querySelector('dialog[role="alertdialog"][open]')
    return d ? (d.innerText ?? '').replace(/\\s+/g, ' ') : ''
  },
  konfirmasiTerbuka() { return Boolean(document.querySelector('dialog[role="alertdialog"][open]')) },
  galatPanel() { return document.querySelector('dialog[open] p.status-salah')?.textContent?.trim() ?? '' },
  toast() { return [...document.querySelectorAll('.toast-item')].map((t) => (t.innerText ?? '').replace(/\\s+/g, ' ')).join(' | ') },
  klikTeks(teks) {
    const tombol = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(teks))
    if (!tombol) return false
    tombol.click()
    return true
  },
  klikLabel(awalan) {
    const tombol = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith(awalan))
    if (!tombol) return false
    tombol.click()
    return true
  },
  klikDialog(teks) {
    const d = document.querySelector('dialog[role="alertdialog"][open]')
    const tombol = d ? [...d.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(teks)) : null
    if (!tombol) return false
    tombol.click()
    return true
  },
  bukaMenu(teks) {
    const tautan = [...document.querySelectorAll('a')].find((a) => (a.textContent ?? '').trim() === teks)
    if (!tautan) return false
    tautan.click()
    return true
  },
  // Mengetik seperti pengguna: React membaca event 'input'.
  ketik(sel, teks) {
    const el = document.querySelector(sel)
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, teks)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  },
  nilai(sel) { return document.querySelector(sel)?.value ?? null },
  kirim() {
    const form = document.querySelector('dialog[open] form')
    if (!form) return false
    form.requestSubmit()
    return true
  },
  barisTabel() {
    return [...document.querySelectorAll('table tbody tr')].map((tr) => (tr.innerText ?? '').replace(/\\s+/g, ' ').trim())
  },
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
  hitung(jalur) { return (window.__apiCatat ?? []).filter((satu) => satu.indexOf(jalur) >= 0).length },
  pantauVisibilitas() {
    if (window.__visCatat) return true
    window.__visCatat = []
    window.addEventListener('visibilitychange', () => window.__visCatat.push(document.visibilityState))
    return true
  },
  catatVisibilitas() { return window.__visCatat ? window.__visCatat.slice() : [] },
  // Pindah jendela lalu kembali seperti peramban sungguhan: halaman 'hidden',
  // lalu 'visible' lagi — masing-masing disertai event visibilitychange.
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

/**
 * Penghitung permintaan dipasang sejak dokumen dibuat supaya pemeriksaan sesi
 * saat halaman memuat ikut terhitung.
 */
const ALAT_AWAL = `${ALAT}\nwindow.__alat.catatApi()`

const hasil = []

function catat(nama, lolos, detail = '') {
  hasil.push({ nama, lolos })
  console.log(`${lolos ? 'LULUS' : 'GAGAL'} · ${nama}${detail ? ' · ' + detail : ''}`)
}

async function main() {
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

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  await send('Page.enable', {}, sessionId)
  await send('Page.addScriptToEvaluateOnNewDocument', { source: ALAT_AWAL }, sessionId)

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

  const tunggu = async (ekspresi, batas = 15_000) => {
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

    // Jalur masuk di-throttle per akun+IP: sabar dulu kalau kena.
    for (let coba = 0; coba < 3 && hasilMasuk?.status === 429; coba++) {
      console.log('   (batas masuk per menit tercapai, menunggu 20 detik…)')
      await sleep(20_000)
      hasilMasuk = await apiJson('/v1/auth/masuk', 'POST', AKUN_GURU)
    }

    return hasilMasuk
  }

  /** @type {number} */
  let idMapelUji = 0

  const daftarMapel = async () => {
    const jawab = await apiJson('/v1/mapel')
    return Array.isArray(jawab.isi) ? jawab.isi : []
  }

  const bersihkan = async () => {
    let status = 200
    if (idMapelUji > 0) status = (await apiJson(`/v1/mapel/${idMapelUji}`, 'DELETE')).status
    await apiJson('/v1/auth/keluar', 'POST')
    return { status, sisa: idMapelUji > 0 ? `mapel ${idMapelUji} dihapus (${status})` : 'tidak ada mapel uji' }
  }

  try {
    await buka('/')
    const guruMasuk = await masuk()
    catat('guru masuk', guruMasuk?.status === 200, guruMasuk?.isi?.user?.email ?? `status ${guruMasuk?.status}`)
    if (guruMasuk?.status !== 200) throw new Error('guru tidak bisa masuk: ' + JSON.stringify(guruMasuk))

    const sebelum = await daftarMapel()
    catat(
      'mapel bawaan ada (acuan nama terpakai tersedia)',
      sebelum.some((satu) => satu.nama === MAPEL_TERPAKAI),
      `${sebelum.length} mapel`,
    )

    // --- 1. Halaman terjangkau dari sidebar ---
    await buka('/')
    catat('tautan Mapel ada di menu', await evalJs(`window.__alat.bukaMenu('Mapel')`))
    catat(
      'klik menu membawa ke halaman Mapel',
      await tunggu(`location.pathname === '/mapel'`),
      `pathname: ${await evalJs('location.pathname')}`,
    )
    catat(
      'kepala halaman menyebut jumlah mapel apa adanya',
      await tunggu(`window.__alat.halaman().includes(${JSON.stringify(`${sebelum.length} mata pelajaran aktif`)})`),
      (await evalJs('window.__alat.halaman()')).slice(0, 120),
    )

    // Satu muat halaman hanya boleh memeriksa sesi SEKALI (pagar halaman Kelas
    // yang sama: efek ganda saat pengembangan pernah mengirim tiap permintaan
    // dua kali dalam detik yang sama).
    const sesiSekali = await evalJs(`window.__alat.hitung('/v1/sesi')`)
    const sayaSekali = await evalJs(`window.__alat.hitung('/v1/auth/saya')`)
    catat(
      'satu muat halaman memeriksa sesi sekali saja',
      sesiSekali === 1 && sayaSekali === 1,
      `/v1/sesi ×${sesiSekali} · /v1/auth/saya ×${sayaSekali}`,
    )

    // --- 2. Isian salah ditolak sebelum dikirim, pesannya di bawah isiannya ---
    await evalJs(`window.__alat.klikTeks('Tambah mapel')`)
    await sleep(400)
    catat('panel tambah mapel terbuka', await evalJs('window.__alat.panelTerbuka()'), await evalJs(`window.__alat.teks('#judul-panel-form')`))

    await evalJs('window.__alat.kirim()')
    catat(
      'nama kosong ditolak dengan pesan di bawah isiannya',
      await tunggu(`window.__alat.galatPanel().includes('Nama mapel minimal 2 karakter.')`, 6000),
      await evalJs('window.__alat.galatPanel()'),
    )
    catat('panel tetap terbuka sesudah ditolak', await evalJs('window.__alat.panelTerbuka()'))

    await evalJs(`window.__alat.ketik('#nama-mapel', 'A')`)
    await evalJs('window.__alat.kirim()')
    catat(
      'nama satu huruf masih ditolak di klien',
      await tunggu(`window.__alat.galatPanel().includes('Nama mapel minimal 2 karakter.')`, 6000),
      await evalJs('window.__alat.galatPanel()'),
    )

    await evalJs(`window.__alat.ketik('#nama-mapel', 'Smoke Kode Salah')`)
    await evalJs(`window.__alat.ketik('#kode-mapel', 'MTK 1')`)
    await evalJs('window.__alat.kirim()')
    catat(
      'kode berspasi ditolak dengan sebabnya di bawah isian kode',
      await tunggu(`window.__alat.galatPanel().includes('Kode hanya huruf, angka, dan tanda hubung.')`, 6000),
      await evalJs('window.__alat.galatPanel()'),
    )

    // --- 3. Nama yang sudah dipakai: sebabnya terbaca di bawah isian nama ---
    await evalJs(`window.__alat.ketik('#kode-mapel', '')`)
    await evalJs(`window.__alat.ketik('#nama-mapel', ${JSON.stringify(MAPEL_TERPAKAI)})`)
    await evalJs('window.__alat.kirim()')

    catat(
      'nama yang sudah dipakai menjelaskan sebabnya di bawah isian nama',
      await tunggu(`window.__alat.galatPanel().includes('sudah dipakai')`, 8000),
      await evalJs('window.__alat.galatPanel()'),
    )
    catat('penjelasannya berbahasa Indonesia, bukan bawaan framework', await evalJs(`window.__alat.galatPanel().includes('Pakai nama lain')`))
    catat('toast ikut menjelaskan sebabnya', (await evalJs('window.__alat.toast()')).includes('sudah dipakai'))

    const sesudahGagal = await daftarMapel()
    catat(
      'mapel bertabrakan TIDAK terbuat',
      sesudahGagal.length === sebelum.length,
      `${sebelum.length} → ${sesudahGagal.length}`,
    )

    // --- 4. Nama & kode diganti: benar-benar tersimpan ---
    await evalJs(`window.__alat.ketik('#nama-mapel', ${JSON.stringify(MAPEL_UJI)})`)
    await evalJs(`window.__alat.ketik('#kode-mapel', 'sm${TANDA}')`)
    await evalJs('window.__alat.kirim()')

    catat(
      'mapel baru tersimpan dan muncul di daftar',
      await tunggu(`window.__alat.toast().includes('Mapel ditambahkan.') && window.__alat.halaman().includes(${JSON.stringify(MAPEL_UJI)})`, 12_000),
      `“${MAPEL_UJI}”`,
    )

    const sesudahSukses = await daftarMapel()
    const tersimpan = sesudahSukses.find((satu) => satu.nama === MAPEL_UJI)
    idMapelUji = tersimpan?.id ?? 0
    catat('mapel tercatat di server', idMapelUji > 0, `id ${idMapelUji}`)
    catat(
      'kode dinormalkan server jadi huruf besar',
      tersimpan?.kode === `SM${TANDA}`,
      `kode tersimpan: ${tersimpan?.kode ?? '—'}`,
    )
    catat('panel ditutup setelah berhasil', !(await evalJs('window.__alat.panelTerbuka()')))
    catat('pesan lama tidak tertinggal di panel', !(await evalJs(`window.__alat.panel().includes('sudah dipakai')`)))

    // --- 5. Ubah mapel ---
    catat('tombol ubah ada di baris mapel uji', await evalJs(`window.__alat.klikLabel('Ubah mapel ${MAPEL_UJI}')`))
    await sleep(500)
    catat(
      'panel ubah terisi nilai mapel yang dipilih',
      (await evalJs('window.__alat.panelTerbuka()')) &&
        (await evalJs(`window.__alat.teks('#judul-panel-form')`)) === 'Ubah mapel' &&
        (await evalJs(`window.__alat.nilai('#nama-mapel')`)) === MAPEL_UJI &&
        (await evalJs(`window.__alat.nilai('#kode-mapel')`)) === `SM${TANDA}`,
      `nama: ${await evalJs(`window.__alat.nilai('#nama-mapel')`)}`,
    )

    await evalJs(`window.__alat.ketik('#nama-mapel', ${JSON.stringify(MAPEL_UBAH)})`)
    await evalJs('window.__alat.kirim()')
    catat(
      'perubahan nama tersimpan & daftar ikut berubah',
      await tunggu(
        `window.__alat.toast().includes('Mapel diperbarui.') && window.__alat.halaman().includes(${JSON.stringify(MAPEL_UBAH)})`,
        12_000,
      ),
      `“${MAPEL_UBAH}”`,
    )
    const sesudahUbah = await daftarMapel()
    catat(
      'server menyimpan nama barunya, bukan menambah mapel kedua',
      sesudahUbah.some((satu) => satu.nama === MAPEL_UBAH) &&
        !sesudahUbah.some((satu) => satu.nama === MAPEL_UJI) &&
        sesudahUbah.length === sesudahSukses.length,
      `${sesudahSukses.length} → ${sesudahUbah.length} mapel`,
    )

    // --- 6. Hapus lewat dialog konfirmasi yang bisa dibatalkan ---
    catat('tombol hapus ada di baris mapel uji', await evalJs(`window.__alat.klikLabel('Hapus mapel ${MAPEL_UBAH}')`))
    await sleep(500)
    catat(
      'dialog konfirmasi menyebut nama mapel & dampaknya',
      (await evalJs('window.__alat.konfirmasiTerbuka()')) &&
        (await evalJs('window.__alat.konfirmasi()')).includes(`Hapus mapel ${MAPEL_UBAH}?`) &&
        (await evalJs('window.__alat.konfirmasi()')).includes('Kuis yang memakai mapel ini'),
      (await evalJs('window.__alat.konfirmasi()')).slice(0, 120),
    )

    await evalJs(`window.__alat.klikDialog('Batal')`)
    await sleep(600)
    const sesudahBatal = await daftarMapel()
    catat(
      '"Batal" benar-benar membatalkan',
      !(await evalJs('window.__alat.konfirmasiTerbuka()')) && sesudahBatal.some((satu) => satu.nama === MAPEL_UBAH),
      `${sesudahBatal.length} mapel`,
    )

    await evalJs(`window.__alat.klikLabel('Hapus mapel ${MAPEL_UBAH}')`)
    await sleep(500)
    await evalJs(`window.__alat.klikDialog('Hapus mapel')`)
    catat(
      'penghapusan dilaporkan dan mapelnya hilang dari daftar',
      await tunggu(`window.__alat.toast().includes('Mapel dihapus.') && !window.__alat.halaman().includes(${JSON.stringify(MAPEL_UBAH)})`, 12_000),
      await evalJs('window.__alat.toast()'),
    )
    const sesudahHapus = await daftarMapel()
    catat(
      'mapel benar-benar hilang di server',
      !sesudahHapus.some((satu) => satu.nama === MAPEL_UBAH) && sesudahHapus.length === sebelum.length,
      `${sesudahHapus.length} mapel`,
    )
    idMapelUji = 0

    // --- 7. Jendela kembali difokuskan: TIDAK ada permintaan baru ---
    await evalJs('window.__alat.catatApi()')
    await evalJs('window.__alat.pantauVisibilitas()')
    await evalJs('window.__alat.bersihkanCatat()')
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
  } catch (galat) {
    catat('alur halaman Mapel selesai tanpa galat tak terduga', false, galat?.message ?? String(galat))
  } finally {
    const bersih = await bersihkan().catch((galat) => ({ status: 0, sisa: galat?.message ?? 'galat' }))
    catat('mapel uji dibersihkan', bersih.status === 200 || bersih.status === 204, bersih.sisa)

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
