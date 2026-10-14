// Smoke UI alur "susun kuis tanpa bank soal" lewat browser sungguhan (CDP).
//
// Yang diperiksa — langsung pada alur yang dipakai guru:
//   1. kuis draf bisa dibuat hanya dengan judul (mapel/kelas/durasi tidak wajib),
//   2. langkah 2 menawarkan tombol "Buat soal baru" (bank soal tidak wajib),
//   3. soal baru ditulis di editor yang sama dengan bank soal lalu langsung masuk
//      susunan kuis,
//   4. mapel soal baru diwarisi kuisnya sehingga langkah 3 tidak menyisakan
//      butir "Mapel dipilih" yang belum lengkap,
//   5. editor tidak terkunci pada satu soal: setelah menyimpan, formulirnya tetap
//      terbuka dan kosong lagi untuk soal berikutnya,
//   6. pemilih jenis soal tetap berada di bawah formulir penulisan soal.
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
// Kuis + soal uji dihapus lagi di akhir supaya basis data dev tidak menumpuk.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness guru
// memakai akun guru sungguhan (guru1@sekolah.test) — bukan akun admin seperti dulu.
// Jalur kepala sekolah diuji terpisah di `docs/smoke-ui-admin.mjs`.
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }
const JUDUL_UJI = `Uji kuis cepat ${Date.now()}`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alat bantu di sisi halaman (disuntik ulang setiap navigasi). */
const ALAT = `window.__alat = {
  isi(sel, nilai) {
    const el = document.querySelector(sel)
    if (!el) throw new Error('elemen tidak ada: ' + sel)
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, nilai)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  },
  klik(sel) {
    const el = document.querySelector(sel)
    if (!el) throw new Error('elemen tidak ada: ' + sel)
    el.click()
    return true
  },
  klikTeks(teks) {
    const el = [...document.querySelectorAll('button, a')].find((b) => b.textContent.trim().includes(teks))
    if (!el) throw new Error('tombol tidak ada: ' + teks)
    el.click()
    return true
  },
  ada(teks) { return (document.querySelector('main')?.innerText ?? '').includes(teks) },
  main() { return document.querySelector('main')?.innerText?.replace(/\\\\s+/g, ' ') ?? '' },
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

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)
    if (r.exceptionDetails) {
      throw new Error('eval error: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails))
    }
    return r.result.value
  }

  const buka = async (jalur) => {
    await send('Page.navigate', { url: APP + jalur }, sessionId)
    await sleep(3500)
    await evalJs(ALAT)
  }

  const apiJson = async (jalur, metode, isi) =>
    evalJs(`(async () => {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
      const res = await fetch('/api/v1${jalur}', {
        method: '${metode}',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: ${isi === undefined ? 'undefined' : JSON.stringify(JSON.stringify(isi))},
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    })()`)

  try {
    await buka('/masuk')
    const masuk = await apiJson('/auth/masuk', 'POST', { email: AKUN_GURU.email, password: AKUN_GURU.password })
    catat('login guru', masuk.status === 200, `status ${masuk.status}`)

    // ---------- 1. Buat draf hanya dengan judul ----------
    await buka('/kuis')
    await evalJs(`__alat.klikTeks('Buat kuis')`)
    await sleep(800)
    await evalJs(`__alat.isi('#kuis-judul', '${JUDUL_UJI}')`)
    await evalJs(`document.querySelector('form button[type="submit"]').click()`)
    await sleep(2600)

    const langkahDua = await evalJs(`__alat.main()`)
    catat(
      'draf kuis dibuat hanya dengan judul (mapel/kelas/durasi tidak wajib)',
      langkahDua.includes('Susunan kuis') && langkahDua.includes('Bank soal'),
      langkahDua.slice(0, 120),
    )

    const kuis = await evalJs(
      `fetch('/api/v1/kuis', { credentials: 'include', headers: { Accept: 'application/json' } }).then((r) => r.json()).then((d) => d.find((k) => k.judul === '${JUDUL_UJI}') ?? null)`,
    )
    catat(
      'server menyimpan draf tanpa mapel/kelas',
      kuis !== null && kuis.subject_id === null && kuis.class_id === null,
      kuis === null ? 'kuis tidak ditemukan' : `subject_id=${kuis.subject_id} class_id=${kuis.class_id}`,
    )

    // ---------- 2. Soal ditulis langsung di bagian 2 ----------
    catat('bagian 2 menawarkan "Buat soal baru"', await evalJs(`__alat.ada('Buat soal baru')`))

    await evalJs(`__alat.klikTeks('Buat soal baru')`)
    await sleep(900)
    const editorTerbuka = await evalJs(
      `__alat.ada('2. Tulis soalnya') && document.querySelector('#soal-teks') !== null`,
    )
    catat('editor soal terbuka di dalam kuis (tanpa halaman bank soal)', editorTerbuka)

    const mapel = await evalJs(
      `fetch('/api/v1/mapel', { credentials: 'include', headers: { Accept: 'application/json' } }).then((r) => r.json()).then((d) => d[0] ?? null)`,
    )
    await evalJs(`__alat.isi('#soal-mapel', '${mapel.id}')`)
    await evalJs(`__alat.isi('#soal-teks', 'Berapa hasil 2 + 3?')`)
    // Pilihan jawaban hanya punya aria-label (tanpa id), jadi diisi langsung.
    const jumlahOpsi = await evalJs(`(function () {
      const opsi = [...document.querySelectorAll('input[aria-label^="Teks opsi"]')]
      const isi = (el, nilai) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, nilai)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      if (opsi[0]) isi(opsi[0], '5')
      if (opsi[1]) isi(opsi[1], '6')
      return opsi.length
    })()`)
    catat('pilihan jawaban terisi', jumlahOpsi >= 2, `${jumlahOpsi} opsi`)

    await sleep(400)
    await evalJs(`__alat.klikTeks('Simpan soal')`)
    await sleep(2600)

    // Editor sengaja TIDAK menutup setelah satu soal: guru biasanya menulis
    // beberapa soal berurutan, jadi jurus "keluar otomatis" itu yang diuji di sini.
    const setelahSimpan = await evalJs(`__alat.main()`)
    catat(
      'setelah simpan, editor tetap terbuka untuk soal berikutnya',
      setelahSimpan.includes('Soal baru untuk kuis ini') &&
        setelahSimpan.includes('Sudah ditambahkan 1 soal'),
      setelahSimpan.slice(0, 160),
    )
    catat(
      'formulir kosong lagi untuk soal berikutnya',
      await evalJs(`document.querySelector('#soal-teks').value === ''`),
    )

    // Kebijakan 12 Oktober 2026: jenis soal dipilih DULU (langkah 1), bukan di
    // bawah formulir — begitu tipe dipilih, isian di bawahnya hanya yang khusus
    // tipe itu ("spesifik per soal, jangan dipaksa semua dalam isian").
    const jenisDiAtas = await evalJs(`(function () {
      const jenis = document.querySelector('#soal-judul-1')?.closest('section')
      const tulis = document.querySelector('#soal-teks')?.closest('section')
      if (!jenis || !tulis) return null
      return !!(jenis.compareDocumentPosition(tulis) & Node.DOCUMENT_POSITION_FOLLOWING)
    })()`)
    catat('pemilih jenis soal ada di ATAS formulir (pilih tipe dulu)', jenisDiAtas === true)

    // Kesimpulan kunci wajib berada di BAWAH soal, bukan hanya tersebar di radio
    // tiap opsi (permintaan pemilik produk, 12 Oktober 2026).
    const kunciDiBawah = await evalJs(`(function () {
      const ringkas = document.querySelector('.ringkas-kunci-soal')
      const tulis = document.querySelector('#soal-teks')
      if (!ringkas || !tulis) return null
      return !!(tulis.compareDocumentPosition(ringkas) & Node.DOCUMENT_POSITION_FOLLOWING)
    })()`)
    catat('kunci jawaban dirangkum di bawah soal', kunciDiBawah === true)

    await evalJs(`__alat.klikTeks('Kembali ke susunan')`)
    await sleep(1200)
    const susunan = await evalJs(`__alat.main()`)
    catat(
      'soal baru langsung masuk susunan kuis',
      susunan.includes('1 soal') && susunan.includes('Berapa hasil 2 + 3?'),
      susunan.slice(0, 160),
    )

    // Hasil akhir susunan (total soal + poin) wajib berada di BAWAH daftar soal
    // (12 Oktober 2026), bukan di kepala panel atau menempel di tiap baris.
    const totalDiBawah = await evalJs(`(function () {
      const total = document.querySelector('.ringkas-susunan-akhir')
      const daftar = document.querySelector('.ringkas-susunan-akhir')?.closest('div')?.querySelector('ol')
      if (!total || !daftar) return null
      const urut = !!(daftar.compareDocumentPosition(total) & Node.DOCUMENT_POSITION_FOLLOWING)
      return urut && total.textContent.includes('1 soal')
    })()`)
    catat('total susunan (soal · poin) ada di bawah daftar soal', totalDiBawah === true)

    const kuisSetelahSoal = await evalJs(
      `fetch('/api/v1/kuis/${kuis.id}', { credentials: 'include', headers: { Accept: 'application/json' } }).then((r) => r.json()).then((k) => ({ subject_id: k.subject_id }))`,
    )
    catat(
      'mapel soal baru diwarisi kuisnya otomatis',
      kuisSetelahSoal.subject_id === mapel.id,
      `subject_id=${kuisSetelahSoal.subject_id} (dipilih ${mapel.id})`,
    )

    // ---------- 3. Bagian 3 menyimpan susunan + mengenali mapel lengkap ----------
    //
    // Sejak 14 Oktober 2026 ketiga bagian tampil sekaligus: susunan disimpan
    // oleh tombolnya sendiri ("Simpan susunan"), bukan oleh tombol pindah
    // bagian "Lanjut: tinjau" yang sudah tidak ada.
    await evalJs(`__alat.klikTeks('Simpan susunan')`)
    await sleep(2400)
    const tinjau = await evalJs(`__alat.main()`)
    catat(
      'bagian 3: butir mapel & soal sudah lengkap, kelas masih boleh menyusul',
      tinjau.includes('3. Tinjau dan publikasikan') &&
        tinjau.includes('Mapel dipilih') &&
        tinjau.includes('Minimal satu soal dipilih') &&
        !tinjau.includes('Judul terisi (minimal 3 huruf)Belum'),
      tinjau.slice(0, 160),
    )

    const tersimpan = await evalJs(
      `fetch('/api/v1/kuis/${kuis.id}', { credentials: 'include', headers: { Accept: 'application/json' } }).then((r) => r.json()).then((k) => ({ soal: k.jumlah_soal, mapel: k.subject_id }))`,
    )
    catat(
      'susunan soal tersimpan di server lewat tombol "Simpan susunan"',
      tersimpan.soal === 1 && tersimpan.mapel === mapel.id,
      `soal=${tersimpan.soal} mapel=${tersimpan.mapel}`,
    )
  } finally {
    // ---------- Bersih-bersih: buang kuis + soal uji ----------
    const bersih = await evalJs(`(async () => {
      const k = await fetch('/api/v1/kuis', { credentials: 'include', headers: { Accept: 'application/json' } }).then((r) => r.json()).catch(() => [])
      const uji = k.find((satu) => satu.judul === '${JUDUL_UJI}')
      if (!uji) return { kuis: 'tidak ada' }

      const detail = await fetch('/api/v1/kuis/' + uji.id, { credentials: 'include', headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      const soalId = detail?.soal?.[0]?.id ?? null

      await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
      const hapus = (jalur) =>
        fetch('/api/v1' + jalur, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token } }).then((r) => r.status)

      const kuis = await hapus('/kuis/' + uji.id)
      const soal = soalId === null ? 'tanpa soal' : await hapus('/soal/' + soalId)

      return { kuis, soal }
    })()`)
    console.log('   (bersih-bersih:', JSON.stringify(bersih), ')')

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
