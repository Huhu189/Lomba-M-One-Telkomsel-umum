// Smoke UI penyusun soal lewat GRID di browser sungguhan (CDP).
//
// Sejak 14 Oktober 2026 bentuk soal tidak lagi diketik sebagai teks penyusun:
// nama kolom tabel bukan lagi teks berkoma, grid teka silang bukan lagi
// 'kucing\n#n#i#t', dan sinonim uraian bukan lagi baris 'kata = alias'. Harness
// ini menjalankan jalur yang dipakai guru di editor soal yang sama dengan bank
// soal (di dalam kuis, seperti `smoke-ui-kuis-manual.mjs`) lalu memeriksa
// **apa yang benar-benar tersimpan di server** — bukan hanya tampilan layar:
//
//   1. Tabel isian: grid tampil (kepala kolom + sel), kolom/baris bisa
//      ditambah & dihapus, dan `konten.kolom`, `konten.baris`, `kunci.sel`
//      yang tersimpan sama dengan yang diisi di grid;
//   2. sel kosong berisi kunci jawaban, sel berisi teks tidak dinilai;
//   3. Teka silang mini: huruf diketik di kotak, kotak bisa dijadikan kotak
//      hitam lalu dikembalikan, dan `konten.grid` + `kunci.sel` cocok;
//   4. Uraian: sinonim disusun sebagai baris kata + alias dan tersimpan sebagai
//      peta `kunci.sinonim` (spasi di dalam kata tidak dimakan).
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
// Kuis + soal uji dihapus lagi di akhir supaya basis data dev tidak menumpuk.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness
// guru memakai akun guru sungguhan (guru1@sekolah.test).
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }
const JUDUL_UJI = `Uji grid soal ${Date.now()}`

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
  klikLabel(label) {
    const el = document.querySelector('button[aria-label="' + label + '"]')
    if (!el) throw new Error('tombol tanpa label: ' + label)
    el.click()
    return true
  },
  klikTeks(teks) {
    const el = [...document.querySelectorAll('button, a')].find((b) => b.textContent.trim().includes(teks))
    if (!el) throw new Error('tombol tidak ada: ' + teks)
    el.click()
    return true
  },
  jenis(label) {
    const rinci = document.querySelector('details.pemilih-jenis')
    if (!rinci) throw new Error('pemilih jenis tidak ada')
    rinci.open = true
    const chip = [...document.querySelectorAll('.petak-tipe-tombol')].find((b) => b.textContent.includes(label))
    if (!chip) throw new Error('jenis tidak ada: ' + label)
    chip.click()
    return true
  },
  hitung(sel) { return document.querySelectorAll(sel).length },
  ada(teks) { return (document.querySelector('main')?.innerText ?? '').includes(teks) },
  harga(sel) {
    const el = document.querySelector(sel)
    if (!el) throw new Error('elemen tidak ada: ' + sel)
    return el.value
  },
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

  /**
   * Soal yang baru tersimpan, dibaca dari bank soal lewat penanda teks + tipe.
   *
   * Dibaca dari bank soal (bukan dari susunan kuis) karena soal langsung
   * tersimpan di bank dan baru menempel ke kuis saat "Simpan susunan" ditekan —
   * jadi cara ini menguji yang tercatat di server tepat setelah Simpan.
   * @param {string} tipe
   */
  const soalTersimpan = (tipe) =>
    evalJs(
      `fetch('/api/v1/soal?per_page=1&q=' + encodeURIComponent('uji grid') + '&filter[tipe]=${tipe}', { credentials: 'include', headers: { Accept: 'application/json' } })
        .then((r) => r.json())
        .then((d) => (d.data ?? [])[0] ?? null)`,
    )

  let kuis = null

  try {
    await buka('/masuk')
    const masuk = await apiJson('/auth/masuk', 'POST', { email: AKUN_GURU.email, password: AKUN_GURU.password })
    catat('login guru', masuk.status === 200, `status ${masuk.status}`)

    // ---------- Kuis wadah + editor soal ----------
    await buka('/kuis')
    await evalJs(`__alat.klikTeks('Buat kuis')`)
    await sleep(800)
    await evalJs(`__alat.isi('#kuis-judul', '${JUDUL_UJI}')`)
    await evalJs(`document.querySelector('form button[type="submit"]').click()`)
    await sleep(2600)

    kuis = await evalJs(
      `fetch('/api/v1/kuis', { credentials: 'include', headers: { Accept: 'application/json' } }).then((r) => r.json()).then((d) => d.find((k) => k.judul === '${JUDUL_UJI}') ?? null)`,
    )
    catat('kuis uji dibuat', kuis !== null, kuis === null ? 'kuis tidak ditemukan' : `id=${kuis.id}`)

    await evalJs(`__alat.klikTeks('Buat soal baru')`)
    await sleep(900)

    const mapel = await evalJs(
      `fetch('/api/v1/mapel', { credentials: 'include', headers: { Accept: 'application/json' } }).then((r) => r.json()).then((d) => d[0] ?? null)`,
    )
    await evalJs(`__alat.isi('#soal-mapel', '${mapel.id}')`)

    // ---------- 1. Tabel isian lewat grid ----------
    await evalJs(`__alat.jenis('Tabel isian')`)
    await sleep(600)

    const gridTabel = await evalJs(`({
      kepala: __alat.hitung('input[aria-label^="Nama kolom"]'),
      sel: __alat.hitung('input[aria-label^="Teks baris"]'),
      kunci: __alat.hitung('input[aria-label^="Jawaban diterima baris"]'),
      teksMentah: document.querySelector('#tabel-kolom') !== null,
      namaKolom1: __alat.harga('[aria-label="Nama kolom 1"]'),
    })`)
    catat(
      'tabel disusun sebagai grid: kepala kolom & sel tampil, tanpa isian teks berkoma',
      gridTabel.kepala === 2 && gridTabel.sel === 2 && gridTabel.kunci === 2 && !gridTabel.teksMentah,
      `kepala=${gridTabel.kepala} sel=${gridTabel.sel} kunci=${gridTabel.kunci} nama kolom 1="${gridTabel.namaKolom1}"`,
    )
    catat('kepala kolom bawaan sudah bernama (tabel tanpa nama kolom ditolak server)', gridTabel.namaKolom1 === 'Soal', gridTabel.namaKolom1)

    await evalJs(`__alat.isi('#soal-teks', 'Isi tabel hasil perkalian (uji grid).')`)
    await evalJs(`__alat.isi('[aria-label="Nama kolom 1"]', 'Soal')`)
    await evalJs(`__alat.isi('[aria-label="Nama kolom 2"]', 'Jawaban')`)
    await evalJs(`__alat.isi('[aria-label="Teks baris 1 kolom 1"]', '3 x 4')`)
    await evalJs(`__alat.isi('[aria-label="Jawaban diterima baris 1 kolom 2"]', '12, dua belas')`)
    await sleep(300)

    catat(
      'sel kosong punya kunci jawaban, sel berisi teks tidak: ditandai di selnya',
      (await evalJs(`__alat.hitung('td.tabel-editor-sel.perlu-kunci')`)) === 0,
      `sisa sel perlu kunci=${await evalJs(`__alat.hitung('td.tabel-editor-sel.perlu-kunci')`)}`,
    )

    // Tambah kolom & baris lewat tombol, lalu kembalikan ke bentuk 2 × 1.
    await evalJs(`__alat.klikTeks('Tambah kolom')`)
    await sleep(300)
    await evalJs(`__alat.klikTeks('Tambah baris')`)
    await sleep(300)
    const setelahTambah = await evalJs(`({
      kepala: __alat.hitung('input[aria-label^="Nama kolom"]'),
      selBaris2: __alat.hitung('input[aria-label^="Teks baris 2"]'),
    })`)
    catat(
      'tombol "Tambah kolom"/"Tambah baris" memperluas grid (bukan menambah teks)',
      setelahTambah.kepala === 3 && setelahTambah.selBaris2 === 3,
      `kepala=${setelahTambah.kepala} sel baris 2=${setelahTambah.selBaris2}`,
    )

    await evalJs(`__alat.klikLabel('Hapus kolom 3')`)
    await sleep(300)
    await evalJs(`__alat.klikLabel('Hapus baris 2')`)
    await sleep(300)
    const setelahHapus = await evalJs(`({
      kepala: __alat.hitung('input[aria-label^="Nama kolom"]'),
      baris: __alat.hitung('input[aria-label^="Teks baris"]'),
      namaKolom1: __alat.harga('[aria-label="Nama kolom 1"]'),
    })`)
    catat(
      'tombol hapus kolom/baris mengembalikan grid ke 2 × 1',
      setelahHapus.kepala === 2 && setelahHapus.baris === 2 && setelahHapus.namaKolom1 === 'Soal',
      `kepala=${setelahHapus.kepala} sel=${setelahHapus.baris}`,
    )

    // Pratinjau memakai renderer murid: sel r1c2 harus tampil sebagai kotak isian.
    // Diperiksa SEBELUM menyimpan — sesudah simpan formulirnya sudah kosong lagi.
    const pratinjauTabel = await evalJs(`__alat.hitung('.tabel-isian input[aria-label^="Isian r1c2"]')`)
    catat('pratinjau murid memakai renderer yang sama: sel r1c2 jadi kotak isian', pratinjauTabel === 1, `${pratinjauTabel} kotak`)

    await evalJs(`__alat.klikTeks('Simpan soal')`)
    await sleep(2600)
    catat('editor melaporkan soal tabel masuk susunan kuis', await evalJs(`__alat.ada('Sudah ditambahkan 1 soal')`))

    const tabel = await soalTersimpan('tabel_isian')
    catat(
      'tabel tersimpan: kolom, baris, dan kunci sel sama dengan yang diisi di grid',
      tabel !== null &&
        JSON.stringify(tabel.konten.kolom) === JSON.stringify(['Soal', 'Jawaban']) &&
        tabel.konten.baris?.[0]?.sel?.length === 2 &&
        tabel.konten.baris[0].sel[0].teks === '3 x 4' &&
        tabel.konten.baris[0].sel[1]?.teks === undefined &&
        JSON.stringify(tabel.kunci.sel?.r1c2) === JSON.stringify(['12', 'dua belas']),
      tabel === null ? 'soal tidak tersimpan' : JSON.stringify({ kolom: tabel.konten.kolom, baris: tabel.konten.baris, kunci: tabel.kunci }),
    )

    // ---------- 2. Teka silang mini lewat grid ----------
    await evalJs(`__alat.jenis('Teka silang mini')`)
    await sleep(600)
    // Editor mengosongkan formulir setelah simpan — mapelnya dipilih ulang di
    // sini supaya yang diuji tipe soalnya, bukan ingatan formulir.
    await evalJs(`__alat.isi('#soal-mapel', '${mapel.id}')`)

    const gridSilang = await evalJs(`({
      kotak: __alat.hitung('input[aria-label^="Huruf jawaban baris"]'),
      teksMentah: document.querySelector('#silang-grid') !== null,
    })`)
    catat(
      'teka silang digambar sebagai kotak yang bisa diketik, tanpa isian teks grid',
      gridSilang.kotak === 9 && !gridSilang.teksMentah,
      `kotak=${gridSilang.kotak}`,
    )

    // Bentuk tombol hapus (14 Oktober 2026, "tempat sampahnya sangat amat
    // jelek"). Yang diukur mesin, bukan selera: gutter-nya setinggi kotak (dulu
    // tombol 48 px bertumpuk dengan nomor sehingga barisnya melar) dan tombolnya
    // benar-benar tanpa isi warna saat diam — bukan kotak merah.
    const bentukHapus = await evalJs(`(() => {
      const sel = document.querySelector('.silang-editor td.silang-editor-sel')
      const nomor = document.querySelector('.silang-editor th.silang-editor-nomor')
      const tombolBaris = document.querySelector('.silang-editor th.silang-editor-nomor button[aria-label^="Hapus baris"]')
      const tombolKolom = [...document.querySelectorAll('.silang-editor tfoot button')]
      const gayaBaris = tombolBaris ? getComputedStyle(tombolBaris) : null
      const gayaKolom = tombolKolom.length ? getComputedStyle(tombolKolom[0]) : null
      return {
        tinggiSel: Math.round(sel ? sel.getBoundingClientRect().height : 0),
        tinggiGutter: Math.round(nomor ? nomor.getBoundingClientRect().height : 0),
        isiBaris: gayaBaris ? gayaBaris.backgroundColor : '',
        isiKolom: gayaKolom ? gayaKolom.backgroundColor : '',
        jumlahBaris: document.querySelectorAll('.silang-editor button[aria-label^="Hapus baris"]').length,
        jumlahKolom: tombolKolom.length,
        labelKaki: (document.querySelector('.silang-editor tfoot')?.textContent ?? '').includes('Hapus kolom'),
      }
    })()`)
    const tanpaIsi = (warna) => warna === 'rgba(0, 0, 0, 0)' || warna === 'transparent'
    catat(
      'gutter teka silang setinggi kotaknya: nomor + tombol hapus duduk satu baris',
      bentukHapus.tinggiSel > 0 && Math.abs(bentukHapus.tinggiGutter - bentukHapus.tinggiSel) <= 2,
      `sel=${bentukHapus.tinggiSel}px gutter=${bentukHapus.tinggiGutter}px`,
    )
    catat(
      'tombol hapus berbentuk hantu: tanpa isi warna saat diam (bukan kotak merah)',
      bentukHapus.isiBaris !== '' && tanpaIsi(bentukHapus.isiBaris) && tanpaIsi(bentukHapus.isiKolom),
      `baris=${bentukHapus.isiBaris} kolom=${bentukHapus.isiKolom}`,
    )
    catat(
      'hapus tiap baris & kolom tetap tersedia, kaki tabel berlabel "Hapus kolom"',
      bentukHapus.jumlahBaris === 3 && bentukHapus.jumlahKolom === 3 && bentukHapus.labelKaki,
      `baris=${bentukHapus.jumlahBaris} kolom=${bentukHapus.jumlahKolom} label=${bentukHapus.labelKaki}`,
    )

    // Kotak hitam: dibuat lewat tombol ■ lalu dikembalikan.
    await evalJs(`__alat.klikLabel('Jadikan kotak hitam baris 3 kolom 3')`)
    await sleep(250)
    const jadiHitam = await evalJs(`({
      hitam: __alat.hitung('button[aria-label^="Kotak hitam baris 3 kolom 3"]'),
      hilang: document.querySelector('[aria-label="Huruf jawaban baris 3 kolom 3"]') === null,
    })`)
    await evalJs(`__alat.klikLabel('Kotak hitam baris 3 kolom 3 — kembalikan jadi kotak huruf')`)
    await sleep(250)
    const kembali = await evalJs(`document.querySelector('[aria-label="Huruf jawaban baris 3 kolom 3"]') !== null`)
    catat(
      'kotak bisa dijadikan kotak hitam lalu dikembalikan jadi kotak huruf',
      jadiHitam.hitam === 1 && jadiHitam.hilang && kembali === true,
      `hitam=${jadiHitam.hitam} kembali=${kembali}`,
    )

    await evalJs(`__alat.isi('#soal-teks', 'Isi teka silang berikut (uji grid).')`)
    const huruf = ['k', 'u', 'c', 'i', 'n', 'g', 'm', 'a', 'u']
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        await evalJs(`__alat.isi('[aria-label="Huruf jawaban baris ${r + 1} kolom ${c + 1}"]', '${huruf[r * 3 + c]}')`)
      }
    }
    await evalJs(`__alat.isi('[aria-label="Teks petunjuk mendatar 1"]', 'hewan yang mengeong')`)
    await sleep(300)

    await evalJs(`__alat.klikTeks('Simpan soal')`)
    await sleep(2600)
    catat('editor melaporkan soal teka silang masuk susunan kuis', await evalJs(`__alat.ada('Sudah ditambahkan 2 soal')`))

    const silang = await soalTersimpan('teka_silang_mini')
    catat(
      'teka silang tersimpan: bentuk kotak di konten dan huruf jawaban di kunci',
      silang !== null &&
        JSON.stringify(silang.konten.grid) === JSON.stringify([
          ['', '', ''],
          ['', '', ''],
          ['', '', ''],
        ]) &&
        silang.konten.mendatar?.[0]?.teks === 'hewan yang mengeong' &&
        JSON.stringify(silang.konten.mendatar?.[0]?.sel) === JSON.stringify(['0,0', '0,1', '0,2']) &&
        silang.kunci.sel?.['2,2'] === 'u' &&
        Object.keys(silang.kunci.sel ?? {}).length === 9,
      silang === null ? 'soal tidak tersimpan' : JSON.stringify({ grid: silang.konten.grid, kunci: silang.kunci.sel }),
    )

    // ---------- 3. Sinonim uraian lewat baris ----------
    await evalJs(`__alat.jenis('Uraian')`)
    await sleep(600)
    await evalJs(`__alat.isi('#soal-mapel', '${mapel.id}')`)

    catat('sinonim uraian disusun sebagai baris, tanpa isian "kata = alias"', (await evalJs(`document.querySelector('#soal-sinonim-uraian') === null`)) === true)

    // ---------- 3b. Teknik koreksi (14 Oktober 2026) ----------
    // Guru memilih cara mengoreksi; pilihannya ikut ke `kunci` dan hanya dikirim
    // bila BUKAN bawaan jenis soalnya.
    const teknikAwal = await evalJs(`({
      jumlah: __alat.hitung('input[name="teknik-koreksi"]'),
      terpilih: document.querySelector('input[name="teknik-koreksi"]:checked')?.value ?? '',
      adaOtomatisKunciPasti: document.querySelector('#teknik-otomatis') !== null,
    })`)
    catat(
      'uraian menawarkan dua teknik: otomatis (teks) sebagai bawaan, dan manual',
      teknikAwal.jumlah === 2 && teknikAwal.terpilih === 'otomatis_teks' && !teknikAwal.adaOtomatisKunciPasti,
      `jumlah=${teknikAwal.jumlah} terpilih=${teknikAwal.terpilih}`,
    )

    await evalJs(`__alat.klikTeks('Tambah sinonim')`)
    await sleep(300)
    await evalJs(`__alat.isi('#soal-teks', 'Jelaskan proses fotosintesis (uji grid).')`)
    await evalJs(`__alat.isi('[aria-label="Kata kunci 1"]', 'fotosintesis')`)
    await evalJs(`__alat.isi('[aria-label="Kata kunci sinonim 1"]', 'fotosintesis')`)
    await evalJs(`__alat.isi('[aria-label="Sinonim kata kunci 1"]', 'rambut getar, silia')`)
    // Guru memilih menilai sendiri soal uraian ini (bukan bawaan "otomatis teks").
    await evalJs(`__alat.klik('#teknik-manual')`)
    await sleep(300)

    await evalJs(`__alat.klikTeks('Simpan soal')`)
    await sleep(2600)
    catat('editor melaporkan soal uraian masuk susunan kuis', await evalJs(`__alat.ada('Sudah ditambahkan 3 soal')`))

    const uraian = await soalTersimpan('uraian')
    catat(
      'sinonim tersimpan sebagai peta kata → alias (spasi di dalam kata utuh)',
      uraian !== null && JSON.stringify(uraian.kunci.sinonim?.fotosintesis) === JSON.stringify(['rambut getar', 'silia']),
      uraian === null ? 'soal tidak tersimpan' : JSON.stringify(uraian.kunci.sinonim),
    )
    catat(
      'pilihan "Manual (guru)" tersimpan di kunci soal (guru yang menilai)',
      uraian !== null && uraian.kunci.teknik_koreksi === 'manual',
      uraian === null ? 'soal tidak tersimpan' : `kunci.teknik_koreksi=${uraian.kunci.teknik_koreksi}`,
    )
    catat(
      'soal yang memakai bawaan tidak menambah bidang teknik ke kunci',
      silang !== null && silang.kunci.teknik_koreksi === undefined,
      silang === null ? 'soal tidak tersimpan' : `kunci=${JSON.stringify(Object.keys(silang.kunci))}`,
    )

    // ---------- 4. Ketiga soal dipakai kuis: susunan disimpan ----------
    await evalJs(`__alat.klikTeks('Kembali ke susunan')`)
    await sleep(1400)
    await evalJs(`__alat.klikTeks('Simpan susunan')`)
    await sleep(2600)

    const susunan = await evalJs(
      `fetch('/api/v1/kuis/${kuis.id}', { credentials: 'include', headers: { Accept: 'application/json' } })
        .then((r) => r.json())
        .then((k) => ({ jumlah: k.jumlah_soal, tipe: (k.soal ?? []).map((s) => s.tipe).sort() }))`,
    )
    catat(
      'susunan kuis menyimpan ketiga soal yang disusun lewat grid',
      susunan.jumlah === 3 && JSON.stringify(susunan.tipe) === JSON.stringify(['tabel_isian', 'teka_silang_mini', 'uraian']),
      JSON.stringify(susunan),
    )
    // ---------- 5. Ukuran ponsel: grid menggulir di dalam bungkusnya ----------
    // Grid lebar tidak boleh menggeser SELURUH halaman (standar 44 px/tanpa
    // gulir mendatar di 390 px): yang bergulir hanya bungkus gridnya.
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, sessionId)
    await evalJs(`__alat.klikTeks('Buat soal baru')`)
    await sleep(1200)

    // ---------- Mengurutkan & menjodohkan: pembuatan visual (14 Okt 2026) ----------
    // Pemilik produk: "menjodohkan layout-nya sangat jelek dan gak berurutan dan
    // sudah dipakai … buat pengurutan urutan dll langsung visual gak perlu ketik
    // lagi". Diukur di 390 px sekaligus: papan barunya tidak boleh menggeser
    // halaman.
    await evalJs(`__alat.jenis('Mengurutkan')`)
    await sleep(600)
    const urutAwal = await evalJs(`({
      adaNomor: document.querySelector('[aria-label^="Nomor urut item"]') !== null,
      baris: document.querySelectorAll('.baris-urut').length,
      pertama: document.querySelector('input[aria-label^="Teks item"]')?.getAttribute('aria-label') ?? '',
    })`)
    await evalJs(`__alat.klikLabel('Naikkan item I2 ke atas')`)
    await sleep(300)
    const urutSetelah = await evalJs(`({
      pertama: document.querySelector('input[aria-label^="Teks item"]')?.getAttribute('aria-label') ?? '',
      nomorBaris: (document.querySelector('.baris-urut .kotak-huruf')?.textContent ?? '').trim(),
      geser: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
    })`)
    catat(
      'mengurutkan: urutan dipindah dengan ▲/▼, tidak ada nomor urut yang diketik',
      urutAwal.adaNomor === false &&
        urutAwal.baris === 2 &&
        urutAwal.pertama === 'Teks item I1' &&
        urutSetelah.pertama === 'Teks item I2' &&
        urutSetelah.nomorBaris === '1' &&
        urutSetelah.geser <= 1,
      `tanpa kotak nomor=${!urutAwal.adaNomor} baris=${urutAwal.baris} "${urutAwal.pertama}"→"${urutSetelah.pertama}" nomor baris=${urutSetelah.nomorBaris} geser=${urutSetelah.geser}px`,
    )

    await evalJs(`__alat.jenis('Menjodohkan')`)
    await sleep(600)
    const jodoh = await evalJs(`(() => {
      const opsi = [...document.querySelectorAll('[aria-label="Pasangan kiri K2"] option')]
      const n1 = opsi.find((o) => o.value === 'N1')
      return {
        papan: document.querySelectorAll('.papan-jodoh').length,
        baris: document.querySelectorAll('.baris-jodoh').length,
        tersambung: document.querySelector('[data-jodoh-tersambung]')?.getAttribute('data-jodoh-tersambung') ?? '',
        n1Mati: n1 ? n1.disabled : false,
        sebutan: n1 ? n1.textContent.trim() : '',
        geser: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
      }
    })()`)
    catat(
      'menjodohkan: penyambung pindah ke papan sendiri, urut, dan terhitung',
      jodoh.papan === 1 && jodoh.baris === 2 && jodoh.tersambung === '2' && jodoh.geser <= 1,
      `papan=${jodoh.papan} baris=${jodoh.baris} tersambung=${jodoh.tersambung} geser=${jodoh.geser}px`,
    )
    catat(
      'item kanan yang sudah dipakai dimatikan dengan sebabnya tertulis',
      jodoh.n1Mati === true && jodoh.sebutan.includes('sudah dipakai K1'),
      `N1 mati=${jodoh.n1Mati} · "${jodoh.sebutan}"`,
    )

    await evalJs(`__alat.isi('[aria-label="Pasangan kiri K1"]', '')`)
    await sleep(300)
    catat(
      'melepas pasangan menghitung ulang “tersambung” dan menyebut yang belum',
      (await evalJs(`document.querySelector('[data-jodoh-tersambung]')?.getAttribute('data-jodoh-tersambung')`)) === '1' &&
        (await evalJs(`__alat.ada('Masih ada 1 item kiri yang belum dipasangkan.')`)),
      `tersambung=${await evalJs(`document.querySelector('[data-jodoh-tersambung]')?.getAttribute('data-jodoh-tersambung')`)}`,
    )

    await evalJs(`__alat.jenis('Tabel isian')`)
    await sleep(600)
    // Grid selebar mungkin: inilah kasus yang tadinya menggeser SELURUH halaman
    // (terukur 196 px di 3 kolom, sampai 548 px di 9 kolom sebelum perbaikan).
    for (let kolom = 3; kolom <= 9; kolom += 1) {
      await evalJs(`__alat.klikTeks('Tambah kolom')`)
      await sleep(120)
    }

    const ponselTabel = await evalJs(`({
      geser: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
      gulirBungkus: (function () {
        const b = document.querySelector('.tabel-editor-bungkus')
        return b ? getComputedStyle(b).overflowX : null
      })(),
      lebarGrid: Math.round(document.querySelector('.tabel-editor')?.getBoundingClientRect().width ?? 0),
    })`)
    catat(
      'ponsel 390 px · grid tabel 9 kolom menggulir di dalam bungkusnya, halaman tidak bergeser',
      ponselTabel.geser <= 1 && ponselTabel.gulirBungkus === 'auto',
      `geser halaman=${ponselTabel.geser} px · bungkus=${ponselTabel.gulirBungkus} · lebar grid=${ponselTabel.lebarGrid} px`,
    )

    await evalJs(`__alat.jenis('Teka silang mini')`)
    await sleep(600)
    for (let kolom = 4; kolom <= 12; kolom += 1) {
      await evalJs(`__alat.klikTeks('Tambah kolom')`)
      await sleep(120)
    }
    const ponselSilang = await evalJs(`({
      geser: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
      gulirBungkus: (function () {
        const b = document.querySelector('.silang-editor-bungkus')
        return b ? getComputedStyle(b).overflowX : null
      })(),
    })`)
    catat(
      'ponsel 390 px · grid teka silang 12 kolom menggulir di dalam bungkusnya, halaman tidak bergeser',
      ponselSilang.geser <= 1 && ponselSilang.gulirBungkus === 'auto',
      `geser halaman=${ponselSilang.geser} px · bungkus=${ponselSilang.gulirBungkus}`,
    )

    await send('Emulation.clearDeviceMetricsOverride', {}, sessionId)
  } finally {
    // ---------- Bersih-bersih: buang soal-soal uji lalu kuisnya ----------
    // Soalnya dicari lewat penanda teks, bukan lewat susunan kuis: soal yang
    // gagal menempel ke kuis tetap harus dibuang supaya bank soal dev bersih.
    const bersih = await evalJs(`(async () => {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
      const hapus = (jalur) =>
        fetch('/api/v1' + jalur, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token } }).then((r) => r.status)

      const bank = await fetch('/api/v1/soal?per_page=100&q=' + encodeURIComponent('uji grid'), { credentials: 'include', headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] }))

      let soal = 0
      for (const satu of bank.data ?? []) {
        await hapus('/soal/' + satu.id)
        soal += 1
      }

      const k = await fetch('/api/v1/kuis', { credentials: 'include', headers: { Accept: 'application/json' } }).then((r) => r.json()).catch(() => [])
      const uji = k.find((satu) => satu.judul === '${JUDUL_UJI}')
      const kuis = uji ? await hapus('/kuis/' + uji.id) : 'tidak ada'

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
