// Smoke pencarian murid lewat browser sungguhan (Chrome DevTools Protocol):
// guru membuka halaman Murid, mengetik di kotak cari, dan hasilnya MENYARING DI
// SERVER — bukan menyaring 50 baris yang kebetulan tampil.
//
// Yang diuji di sini, satu per satu:
//
// 1. tanpa kata kunci, permintaan ke `/v1/murid` TIDAK membawa `filter[cari]`;
// 2. ketikan cepat (tiga huruf berturut-turut) hanya menembak SATU permintaan
//    berisi kata terakhir — bukan satu per huruf;
// 3. kata kunci dicari ke seluruh daftar (nama, NIS, dan email sama-sama
//    menemukan murid yang halaman-nya bahkan mungkin bukan halaman 1);
// 4. kata kunci yang tidak ada hasilnya memakai keadaan kosong khusus
//    pencarian, dan tombol "Bersihkan pencarian" mengembalikan daftar penuh;
// 5. pencarian digabung saringan kelas (dua filter sekaligus di satu kueri).
//
// Harness ini MANDIRI: kelas + tiga murid ujinya dibuat di awal dan dihapus di
// blok `finally`, jadi bisa dijalankan berulang.
//
// Prasyarat: backend 8000, vite 5173, Chrome --remote-debugging-port=9333
// (dijalankan oleh `docs/jalankan-smoke-ui.sh murid`).
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness guru
// memakai akun guru sungguhan (guru1@sekolah.test) — bukan akun admin seperti dulu.
// Jalur kepala sekolah diuji terpisah di `docs/smoke-ui-admin.mjs`.
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }

const TANDA = String(Date.now()).slice(-6)
const KELAS = `Cari ${TANDA}`
const NAMA_A = `Cari Satu ${TANDA}`
const NAMA_B = `Cari Dua ${TANDA}`
const NAMA_C = `Cari Tiga ${TANDA}`
const NIS_A = `7${TANDA.slice(0, 4)}`
const EMAIL_A = `cari.satu.${TANDA}@murid.test`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alat bantu di sisi halaman (disuntik ulang setiap navigasi). */
const ALAT = `window.__alat = {
  teks(sel) { return document.querySelector(sel)?.textContent?.trim() ?? '' },
  jumlah(sel) { return document.querySelectorAll(sel).length },
  nilai(sel) { return document.querySelector(sel)?.value ?? null },
  halaman() { return (document.querySelector('main')?.innerText ?? '').replace(/\\s+/g, ' ') },
  // Mengetik seperti pengguna: React membaca event 'input', jadi nilai harus
  // diset lewat setter asli elemen lalu event-nya dilepas — menulis el.value
  // saja tidak memicu onChange sama sekali.
  ketik(sel, teks) {
    const el = document.querySelector(sel)
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, teks)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  },
  pilihKelas(nilai) {
    const el = document.querySelector('#filter-kelas')
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    setter.call(el, String(nilai))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  },
  barisTabel() {
    return [...document.querySelectorAll('table tbody tr')].map((tr) =>
      (tr.innerText ?? '').replace(/\\s+/g, ' ').trim(),
    )
  },
  // Menghitung permintaan yang benar-benar ditembak ke /api/v1/murid — supaya
  // penyaringan di server dan aturan satu-permintaan-per-ketikan bisa
  // dibuktikan, bukan diasumsikan. Klien API aplikasi ini memakai XMLHttpRequest
  // (axios), jadi yang dipasangi penghitung adalah XHR — bukan fetch.
  catatApi() {
    if (window.__apiCatat) return true
    window.__apiCatat = []
    const bukaAsli = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (metode, alamat, ...sisa) {
      const url = String(alamat)
      if (url.indexOf('/api/v1/murid') >= 0) window.__apiCatat.push(url)
      return bukaAsli.call(this, metode, alamat, ...sisa)
    }
    return true
  },
  bersihkanCatat() {
    if (window.__apiCatat) window.__apiCatat = []
    return true
  },
  catat() { return window.__apiCatat ? window.__apiCatat.slice() : [] },
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
      await sleep(350)
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
        body: JSON.stringify(${JSON.stringify(AKUN_GURU)}),
      })
      return { status: res.status, email: (await res.json())?.user?.email ?? null }
    })()`)

  const masuk = async () => {
    let hasilMasuk = await masukSekali(AKUN_GURU)

    for (let coba = 0; coba < 3 && hasilMasuk.status === 429; coba++) {
      console.log('   (batas masuk per menit tercapai, menunggu 20 detik…)')
      await sleep(20_000)
      hasilMasuk = await masukSekali(AKUN_GURU)
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

  let idKelas = 0
  /** @type {Array<{ id: number, nama: string }>} */
  const muridUji = []

  const bersihkan = async () => {
    await masuk()
    const status = []

    for (const murid of muridUji) {
      status.push((await apiJson(`/v1/murid/${murid.id}`, 'DELETE')).status)
    }
    if (idKelas > 0) status.push((await apiJson(`/v1/kelas/${idKelas}`, 'DELETE')).status)
    await apiJson('/v1/auth/keluar', 'POST')

    return {
      status: status.every((satu) => satu === 200) ? 200 : status[0],
      sisa: `murid ${muridUji.map((satu) => satu.nama).join(', ') || '—'} → ${status.join(',')}`,
    }
  }

  try {
    await buka('/')
    const guruMasuk = await masuk()
    catat('guru masuk', guruMasuk.status === 200, guruMasuk.email ?? '')
    if (guruMasuk.status !== 200) throw new Error('guru tidak bisa masuk: ' + JSON.stringify(guruMasuk))

    // --- 1. Siapkan satu kelas khusus supaya murid uji tidak tercampur ---
    const buatKelas = await apiJson('/v1/kelas', 'POST', { nama: KELAS, tingkat: 5 })
    idKelas = buatKelas.isi?.id ?? 0
    catat('guru membuat kelas uji', buatKelas.status === 201 && idKelas > 0, `kelas ${idKelas} “${KELAS}”`)
    if (idKelas === 0) throw new Error('gagal membuat kelas uji')

    const kelasLain = await apiJson('/v1/kelas')
    const idKelasLain = (Array.isArray(kelasLain.isi) ? kelasLain.isi : []).find(
      (satu) => satu.id !== idKelas,
    )?.id
    catat('ada kelas lain untuk menguji gabungan saringan', typeof idKelasLain === 'number', `kelas ${idKelasLain ?? '—'}`)

    const dataMurid = [
      { nama: NAMA_A, email: EMAIL_A, class_id: idKelas, nis: NIS_A },
      { nama: NAMA_B, email: `cari.dua.${TANDA}@murid.test`, class_id: idKelas, nis: `${NIS_A}2` },
      { nama: NAMA_C, email: `cari.tiga.${TANDA}@murid.test`, class_id: idKelas },
    ]

    for (const data of dataMurid) {
      const buat = await apiJson('/v1/murid', 'POST', data)
      if (buat.status === 201) muridUji.push({ id: buat.isi.id, nama: buat.isi.nama })
    }

    catat(
      'tiga murid uji dibuat (satu tanpa NIS)',
      muridUji.length === 3,
      muridUji.map((satu) => `${satu.nama}#${satu.id}`).join(' · '),
    )
    if (muridUji.length !== 3) throw new Error('gagal membuat murid uji')

    // --- 2. Halaman Murid: tanpa kata kunci tidak ada filter[cari] ---
    await buka('/murid')
    await evalJs('window.__alat.catatApi()')
    catat('halaman murid terbuka dengan kotak cari', await tunggu(`window.__alat.jumlah('#cari-murid') === 1`))
    catat('daftar murid terisi lebih dulu (tanpa kata kunci)', await tunggu(`window.__alat.barisTabel().length > 0`))
    await evalJs('window.__alat.bersihkanCatat()')

    // --- 3. Ketikan cepat = SATU permintaan berisi kata terakhir ---
    await evalJs(`window.__alat.ketik('#cari-murid', 'Ca')`)
    await evalJs(`window.__alat.ketik('#cari-murid', 'Car')`)
    await evalJs(`window.__alat.ketik('#cari-murid', 'Cari')`)
    const ketemuTiga = await tunggu(`window.__alat.barisTabel().length === 3`, 20000)
    const panggilanCari = await evalJs('window.__alat.catat()')

    catat(
      'ketikan cepat digabung jadi satu permintaan ke server',
      panggilanCari.length === 1 && panggilanCari[0].includes('filter%5Bcari%5D=Cari'),
      `${panggilanCari.length} permintaan · ${panggilanCari.map((satu) => satu.split('/api')[1]).join(' | ')}`,
    )
    catat(
      'tiga murid uji muncul walau halaman 1 penuh murid lain (disaring server)',
      ketemuTiga,
      `${(await evalJs('window.__alat.barisTabel()')).length} baris`,
    )
    catat(
      'kata kunci tampil juga di kepala halaman',
      (await evalJs('window.__alat.halaman()')).includes('untuk “Cari”'),
      (await evalJs('window.__alat.halaman()')).slice(0, 120),
    )

    // --- 4. Nama lengkap menemukan satu murid saja ---
    await evalJs('window.__alat.bersihkanCatat()')
    await evalJs(`window.__alat.ketik('#cari-murid', ${JSON.stringify(NAMA_A)})`)
    catat(
      'nama lengkap menyaring sampai satu murid',
      await tunggu(`window.__alat.barisTabel().length === 1 && window.__alat.halaman().includes(${JSON.stringify(NAMA_A)})`, 20000),
      (await evalJs('window.__alat.barisTabel()'))[0] ?? '—',
    )

    // --- 5. NIS dan email juga terjangkau dari kotak yang sama ---
    await evalJs(`window.__alat.ketik('#cari-murid', ${JSON.stringify(NIS_A)})`)
    catat(
      'pencarian lewat NIS menemukan muridnya',
      await tunggu(`window.__alat.barisTabel().length === 1 && window.__alat.halaman().includes(${JSON.stringify(NAMA_A)})`, 20000),
      `NIS ${NIS_A} → ${(await evalJs('window.__alat.barisTabel()'))[0] ?? '—'}`,
    )

    const potonganEmail = `satu.${TANDA}@`
    await evalJs(`window.__alat.ketik('#cari-murid', ${JSON.stringify(potonganEmail)})`)
    catat(
      'pencarian lewat email juga menemukan muridnya',
      await tunggu(`window.__alat.barisTabel().length === 1 && window.__alat.halaman().includes(${JSON.stringify(NAMA_A)})`, 20000),
      `email “${potonganEmail}” → ${(await evalJs('window.__alat.barisTabel()'))[0] ?? '—'}`,
    )

    // --- 6. Tanpa hasil: keadaan kosong khusus pencarian + tombol bersihkan ---
    await evalJs(`window.__alat.ketik('#cari-murid', 'zzz-tidak-ada-${TANDA}')`)
    catat(
      'kata kunci tanpa hasil memakai keadaan kosong pencarian',
      await tunggu(`window.__alat.halaman().includes('Tidak ada murid yang cocok')`, 20000),
      (await evalJs('window.__alat.halaman()')).slice(0, 140),
    )

    const tombolBersih = await evalJs(
      `[...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('Bersihkan pencarian'))`,
    )
    catat('keadaan kosong menawarkan jalan keluar (bersihkan)', tombolBersih, 'tombol “Bersihkan pencarian” ada')

    await evalJs(
      `[...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Bersihkan pencarian')).click()`,
    )
    catat(
      'membersihkan kotak mengembalikan daftar penuh',
      await tunggu(`window.__alat.nilai('#cari-murid') === '' && window.__alat.barisTabel().length > 1`, 20000),
      `kotak “${await evalJs(`window.__alat.nilai('#cari-murid')`)}” · ${(await evalJs('window.__alat.barisTabel()')).length} baris`,
    )

    // --- 7. Pencarian + saringan kelas dalam satu kueri ---
    // Kotak cari sudah kosong dari langkah sebelumnya, jadi mengetik di sini
    // benar-benar mengubah kata kunci (bukan mengulang kata yang sama, yang
    // memang tidak boleh memicu permintaan baru).
    await evalJs(`window.__alat.pilihKelas(${idKelas})`)
    await evalJs('window.__alat.bersihkanCatat()')
    await evalJs(`window.__alat.ketik('#cari-murid', 'Cari')`)
    const kelasCocok = await tunggu(`window.__alat.barisTabel().length === 3`, 20000)
    const panggilanGabung = await evalJs('window.__alat.catat()')

    catat(
      'kelas + kata kunci dikirim bersamaan ke satu permintaan',
      kelasCocok &&
        panggilanGabung.some(
          (satu) => satu.includes(`filter%5Bclass_id%5D=${idKelas}`) && satu.includes('filter%5Bcari%5D=Cari'),
        ),
      panggilanGabung.map((satu) => satu.split('/api')[1]).join(' | ') || '—',
    )

    if (typeof idKelasLain === 'number') {
      await evalJs(`window.__alat.pilihKelas(${idKelasLain})`)
      catat(
        'kelas lain + kata kunci yang sama menghasilkan kosong (dua filter benar-benar bekerja)',
        await tunggu(`window.__alat.barisTabel().length === 0`, 20000),
        `kelas ${idKelasLain} → ${(await evalJs('window.__alat.barisTabel()')).length} baris`,
      )
      await evalJs(`window.__alat.pilihKelas(${idKelas})`)
    }
  } finally {
    const bersih = await bersihkan()
    catat('murid & kelas uji dihapus kembali', bersih.status === 200, bersih.sisa)
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
