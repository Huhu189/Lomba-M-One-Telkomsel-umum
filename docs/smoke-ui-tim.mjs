// Smoke halaman Kelola tim kuis (mode kelompok, slice 09-C) lewat browser
// sungguhan (Chrome DevTools Protocol).
//
// Halaman /kuis/:id/tim adalah satu-satunya layar guru untuk menyusun tim, dan
// sampai 13 Oktober 2026 ia **tidak pernah** diuji di peramban sama sekali.
// Yang dibuktikan harness ini:
//
// 1. Susunan tim benar-benar tersimpan di server: dibagi otomatis, halaman
//    dimuat ulang, dan jumlah anggotanya tetap sama.
// 2. Tim yang belum dinyalakan **dikatakan apa adanya** ("Mode tim belum
//    dinyalakan", karena susunan tersimpan tetapi kuis baru berjalan sebagai tim
//    setelah kuncinya dibuka di Pengaturan) — bukan diam-diam tidak berefek.
// 3. "Bagi otomatis" menggantikan SUSUNAN LAMA (bukan menambah), "Hapus tim"
//    menghapus satu tim, dan "Bagi otomatis"/"Buat tim baru" tidak ditawarkan
//    setelah ada attempt (dibuktikan lewat tombol yang mati).
// 4. Murid yang sudah masuk tim melihat timnya dari endpoint murid (`tim-saya`),
//    termasuk nama anggota — data yang dipakai layar peringkat mode tim.
//
// Temuan yang ikut dicatat harness ini (bukan diklaim hijau): `ambilTimSaya()`
// di `sections/attempt/tim.js` **tidak dipanggil halaman mana pun** — satu-satunya
// tempat nama tim muncul di layar murid adalah halaman Peringkat setelah timnya
// mengumpulkan ulangan. Harness ini karena itu membuktikan datanya lewat API
// murid, dan tidak berpura-pura ada layar tim murid.
//
// Harness ini MANDIRI: kelas, murid, dan kuis ujinya dibuat lewat API lalu
// dihapus lagi di blok `finally`, dan tidak menyentuh data bernama lain.
//
// Prasyarat: backend 8000, vite 5173, Chrome --remote-debugging-port=9333
// (dijalankan oleh `docs/jalankan-smoke-ui.sh tim`).
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }

const TANDA = String(Date.now()).slice(-6)
const KELAS_UJI = '5A'
const JUDUL_KUIS = `Smoke tim ${TANDA}`
const NAMA_TIM = `Tim Merah ${TANDA}`
const MURID_BARU = [1, 2, 3].map((n) => ({
  nama: `Smoke Tim ${TANDA} ${n}`,
  email: `smoke.tim.${TANDA}.${n}@sekolah.test`,
  class_id: null,
}))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alat bantu di sisi halaman (disuntik ulang setiap navigasi). */
const ALAT = `window.__alat = {
  teks(sel) { return document.querySelector(sel)?.textContent?.replace(/\\s+/g, ' ').trim() ?? '' },
  halaman() { return (document.querySelector('main')?.innerText ?? '').replace(/\\s+/g, ' ').trim() },
  toast() { return [...document.querySelectorAll('.toast-item')].map((t) => (t.innerText ?? '').replace(/\\s+/g, ' ')).join(' | ') },
  tim() {
    return [...document.querySelectorAll('section[aria-label^="Tim "]')].map((s) => ({
      nama: s.getAttribute('aria-label').replace(/^Tim /, ''),
      // Jumlah anggota dibaca dari lencana "N anggota" di kartu tim itu.
      anggota: Number(/(\\d+) anggota/.exec(s.innerText ?? '')?.[1] ?? 0),
      isi: (s.innerText ?? '').replace(/\\s+/g, ' ').trim(),
    }))
  },
  tombolDenganTeks(teks) {
    return [...document.querySelectorAll('button')].filter((b) => (b.textContent ?? '').trim() === teks)
  },
  klik(teks) {
    const tombol = this.tombolDenganTeks(teks)[0]
    if (!tombol) return false
    tombol.click()
    return true
  },
  /** Menyalakan/mematikan kotak centang anggota lewat labelnya (nama murid). */
  centang(label) {
    const kotak = [...document.querySelectorAll('input[id^="anggota-"]')].find((inp) => {
      const lab = document.querySelector('label[for="' + inp.id + '"]')
      return (lab?.textContent ?? '').includes(label)
    })
    if (!kotak) return false
    if (!kotak.checked) kotak.click()
    return true
  },
  ketik(sel, teks) {
    const el = document.querySelector(sel)
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, teks)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  },
  jumlahKotakCentang() { return document.querySelectorAll('input[id^="anggota-"]').length },
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
  // Perintah CDP diberi batas waktu: kalau Chrome berhenti menjawab (target
  // mati), janji yang menggantung membuat proses Node keluar DIAM-DIAM dengan
  // kode 0 — harness tampak "lulus" padahal pemeriksaan terakhirnya belum
  // pernah dijalankan. Dengan batas waktu, keadaan itu jadi kegagalan terbaca.
  const send = (method, params = {}, sessionId) =>
    new Promise((res, rej) => {
      const myId = ++id
      const jam = setTimeout(() => {
        pending.delete(myId)
        rej(new Error(`CDP ${method} tidak menjawab dalam 20 detik`))
      }, 20_000)
      pending.set(myId, {
        res: (nilai) => {
          clearTimeout(jam)
          res(nilai)
        },
        rej: (galat) => {
          clearTimeout(jam)
          rej(galat)
        },
      })
      ws.send(JSON.stringify({ id: myId, method, params, sessionId }))
    })

  ws.addEventListener('close', () => console.log('   (CDP tertutup di tengah jalan)'))

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

  const masuk = async (akun) => {
    let jawab = await apiJson('/v1/auth/masuk', 'POST', akun)
    for (let coba = 0; coba < 3 && jawab?.status === 429; coba++) {
      console.log('   (batas masuk per menit tercapai, menunggu 20 detik…)')
      await sleep(20_000)
      jawab = await apiJson('/v1/auth/masuk', 'POST', akun)
    }
    return jawab
  }

  let kelasId = null
  let kuisId = null
  let muridDibuat = []

  try {
    await buka('/masuk')
    const guru = await masuk(AKUN_GURU)
    cek('guru masuk · admin@sekolah.test', guru?.status === 200, `status ${guru?.status}`)

    // ---------- Persiapan: kelas, murid uji, kuis mode tim ----------
    const daftarKelas = await apiJson('/v1/kelas')
    // `/v1/kelas` mengembalikan array langsung (tanpa pembungkus `data`), bukan
    // daftar berhalaman seperti `/v1/murid`.
    const semuaKelas = Array.isArray(daftarKelas.isi) ? daftarKelas.isi : (daftarKelas.isi?.data ?? [])
    kelasId = semuaKelas.find((k) => k.nama === KELAS_UJI)?.id ?? null
    cek(`kelas ${KELAS_UJI} ditemukan untuk uji`, kelasId !== null, `id=${kelasId}`)

    for (const murid of MURID_BARU) {
      const dibuat = await apiJson('/v1/murid', 'POST', { ...murid, class_id: kelasId })
      if (dibuat.status === 201 || dibuat.status === 200) muridDibuat.push(dibuat.isi?.data ?? dibuat.isi)
    }
    cek('tiga murid uji dibuat di kelas itu', muridDibuat.length === 3, `${muridDibuat.length} murid`)

    // Mapel + jadwal diisi sejak awal supaya kuis ujinya bisa benar-benar
    // DITERBITKAN nanti (murid tidak bisa melihat kuis draf — policy menolaknya).
    const daftarMapel = await apiJson('/v1/mapel')
    const mapelId = (Array.isArray(daftarMapel.isi) ? daftarMapel.isi : (daftarMapel.isi?.data ?? []))[0]?.id ?? null
    const mulaiAt = new Date(Date.now() - 60_000).toISOString()
    const selesaiAt = new Date(Date.now() + 3_600_000).toISOString()

    const kuis = await apiJson('/v1/kuis', 'POST', {
      judul: JUDUL_KUIS,
      class_id: kelasId,
      subject_id: mapelId,
      durasi_menit: 30,
      mulai_at: mulaiAt,
      selesai_at: selesaiAt,
    })
    kuisId = kuis.isi?.data?.id ?? kuis.isi?.id ?? null
    cek('kuis uji dibuat (satu kelas + mapel + jadwal)', kuisId !== null && mapelId !== null, `id=${kuisId} · mapel=${mapelId} · status=${kuis.status}`)

    // Jumlah murid kelas ini dibaca dari endpoint yang sama dengan yang dipakai
    // halaman (bukan dari kotak centang — kotak centang baru ada setelah form tim
    // dibuka, jadi menghitungnya di halaman kosong selalu 0).
    const dataTim = await apiJson(`/v1/kuis/${kuisId}/tim`)
    const jumlahMuridKelas = (dataTim.isi?.murid_kelas ?? []).length
    cek('murid kelas ini terbaca server (1 murid asli + 3 murid uji)', jumlahMuridKelas >= 4, `${jumlahMuridKelas} murid`)

    // ---------- 1. Halaman kelola tim ----------
    await buka(`/kuis/${kuisId}/tim`)
    const awal = await evalJs(`({
      judul: __alat.teks('h1'),
      isi: __alat.halaman(),
      kotakJumlah: Boolean(document.querySelector('#jumlah-tim')),
      nilaiSaran: document.querySelector('#jumlah-tim')?.placeholder ?? null,
      tim: __alat.tim(),
    })`)
    cek('halaman Kelola tim terbuka dengan judul kuisnya', awal.judul.startsWith('Kelola tim ·') && awal.judul.includes(JUDUL_KUIS), awal.judul)
    cek(
      'halaman menyebut jumlah murid kelas ini apa adanya',
      awal.isi.includes(`${jumlahMuridKelas} murid di kelas ini`),
      awal.isi.slice(0, 140),
    )
    cek('tanpa tim: halaman mengatakannya apa adanya', awal.isi.includes('Belum ada tim'), '')
    cek(
      'mode tim yang belum dinyalakan dikatakan terus terang',
      awal.isi.includes('Mode tim belum dinyalakan') && awal.isi.includes('Susunan tim di bawah sudah tersimpan'),
      '',
    )
    cek(
      '"Bagi otomatis" tersedia dan menyarankan jumlah tim yang masuk akal',
      awal.kotakJumlah && Number(awal.nilaiSaran) >= 2,
      `saran=${awal.nilaiSaran}`,
    )

    // ---------- 2. Bagi otomatis ----------
    // Jumlahnya diketik sendiri seperti guru mengetiknya (kotak "jadi berapa
    // tim?"), supaya jumlah tim yang diperiksa tidak bergantung saran otomatis.
    await evalJs(`__alat.ketik('#jumlah-tim', '2')`)
    await sleep(300)
    await evalJs(`__alat.klik('Bagi otomatis')`)
    cek('bagi otomatis melaporkan jumlah timnya', await tunggu(`__alat.toast().includes('tim dibagi otomatis')`, 15000), await evalJs(`__alat.toast()`))
    await sleep(1200)
    const setelahBagi = await evalJs(`({ tim: __alat.tim(), isi: __alat.halaman() })`)
    cek('dua tim muncul dengan anggotanya', setelahBagi.tim.length === 2, `${setelahBagi.tim.length} tim: ${setelahBagi.tim.map((t) => t.nama).join(', ')}`)
    cek(
      'seluruh murid kelas terbagi ke tim-tim itu',
      jumlahMuridKelas > 0 &&
        setelahBagi.tim.reduce((jumlah, t) => jumlah + t.anggota, 0) === jumlahMuridKelas &&
        setelahBagi.tim.every((t) => t.anggota >= 2),
      setelahBagi.tim.map((t) => `${t.nama}=${t.anggota}`).join(' · ') + ` dari ${jumlahMuridKelas} murid`,
    )
    cek('tidak ada lagi murid tanpa tim setelah dibagi', !setelahBagi.isi.includes('Belum masuk tim'), '')

    // ---------- 3. Murid melihat timnya (data yang dipakai layar peringkat) ----------
    // Kuis harus TERBIT dulu: kuis draf memang tidak boleh dibuka murid (policy),
    // jadi tanpa langkah ini yang terukur hanyalah 403.
    const soalBank = await apiJson('/v1/soal?page=1')
    const soalId = (soalBank.isi?.data ?? [])[0]?.id ?? null
    const dipasang = soalId !== null ? await apiJson(`/v1/kuis/${kuisId}/soal`, 'PUT', { soal: [soalId] }) : { status: 0 }
    cek('satu soal bank soal dipasang ke kuis uji', soalId !== null && dipasang.status === 200, `soal=${soalId} status=${dipasang.status}`)
    const terbit = await apiJson(`/v1/kuis/${kuisId}/publikasi`, 'POST')
    cek('kuis uji diterbitkan supaya bisa dilihat murid', terbit.status === 200, `status=${terbit.status}`)

    const muridMasuk = await masuk(AKUN_MURID)
    cek('murid uji bisa masuk · smoke.murid@sekolah.test', muridMasuk?.status === 200, `status ${muridMasuk?.status}`)
    const timSaya = await apiJson(`/v1/kuis/${kuisId}/tim-saya`)
    cek(
      'murid melihat nama tim & anggotanya setelah dibagi otomatis',
      timSaya.status === 200 &&
        timSaya.isi?.mode_tim === false &&
        typeof timSaya.isi?.tim?.nama === 'string' &&
        (timSaya.isi?.tim?.anggota ?? []).length >= 2,
      `status=${timSaya.status} · tim=${timSaya.isi?.tim?.nama ?? 'null'} · ${timSaya.isi?.tim?.jumlah_anggota ?? 0} anggota`,
    )

    // Kembali sebagai guru untuk sisa pemeriksaan.
    const guruLagi = await masuk(AKUN_GURU)
    cek('kembali masuk sebagai guru', guruLagi?.status === 200, `status ${guruLagi?.status}`)

    // ---------- 4. Susunan bertahan setelah halaman dimuat ulang ----------
    await buka(`/kuis/${kuisId}/tim`)
    const ulang = await evalJs(`({ tim: __alat.tim(), isi: __alat.halaman() })`)
    cek(
      'susunan tim tersimpan di server (sama setelah dimuat ulang)',
      ulang.tim.length === 2 && ulang.tim.map((t) => t.isi).join('|') === setelahBagi.tim.map((t) => t.isi).join('|'),
      ulang.tim.map((t) => t.nama).join(', '),
    )

    // ---------- 5. Hapus satu tim ----------
    const namaHapus = ulang.tim[0]?.nama ?? ''
    const diklikHapus = await evalJs(`(function () {
      const kartu = document.querySelector('section[aria-label^="Tim "]')
      if (!kartu) return false
      const tombol = [...kartu.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('Hapus tim'))
      if (!tombol) return false
      tombol.click()
      return true
    })()`)
    cek('tombol "Hapus tim" ada di kartu tim', diklikHapus === true, '')
    cek('hapus tim melaporkan hasilnya', await tunggu(`__alat.toast().includes('Tim dihapus')`, 15000), await evalJs(`__alat.toast()`))
    await sleep(1200)
    const setelahHapus = await evalJs(`({ tim: __alat.tim(), isi: __alat.halaman() })`)
    cek('satu tim hilang, satu tinggal', setelahHapus.tim.length === 1 && !setelahHapus.tim.some((t) => t.nama === namaHapus), `${setelahHapus.tim.length} tim`)
    cek(
      'murid dari tim yang dihapus dilaporkan belum bertim',
      setelahHapus.isi.includes('Belum masuk tim:') && setelahHapus.isi.includes('Smoke Tim'),
      setelahHapus.isi.slice(-160),
    )

    // ---------- 6. Buat tim satu per satu ----------
    await evalJs(`__alat.klik('Buat tim baru')`)
    await sleep(500)
    await evalJs(`__alat.ketik('#nama-tim-baru', ${JSON.stringify(NAMA_TIM)})`)
    const dicentang = await evalJs(`(function () {
      // Kotak milik murid yang sudah masuk tim LAIN dikunci (disabled); yang bisa
      // dicentang adalah murid yang belum bertim.
      const kotak = [...document.querySelectorAll('input[id^="anggota-baru-"]')].filter((i) => !i.disabled)
      kotak.slice(0, 2).forEach((i) => i.click())
      return kotak.filter((i) => i.checked).length
    })()`)
    cek('anggota tim bisa dipilih dari murid yang belum bertim', dicentang === 2, `${dicentang} anggota dicentang`)
    await evalJs(`__alat.klik('Buat tim')`)
    cek('pembuatan tim dilaporkan beserta jumlah anggotanya', await tunggu(`__alat.toast().includes('tersimpan (2 anggota)')`, 15000), await evalJs(`__alat.toast()`))
    await sleep(1200)
    const setelahBuat = await evalJs(`({ tim: __alat.tim(), isi: __alat.halaman() })`)
    cek(
      'tim baru tampil dengan nama & anggotanya',
      setelahBuat.tim.some((t) => t.nama === NAMA_TIM && t.anggota === 2),
      setelahBuat.tim.map((t) => `${t.nama}=${t.anggota}`).join(' · '),
    )

    // ---------- 7. Kunci mode tim: banner hilang setelah dinyalakan ----------
    const nyalakan = await apiJson('/v1/pengaturan', 'PUT', {
      lingkup: 'kuis',
      lingkup_id: kuisId,
      kunci: 'mode_tim',
      nilai: true,
    })
    cek('mode tim bisa dinyalakan untuk kuis ini', nyalakan.status === 200, `status=${nyalakan.status}`)

    console.log('   (membuka ulang halaman tim setelah mode tim dinyalakan…)')
    await buka(`/kuis/${kuisId}/tim`)
    const setelahNyalakan = await evalJs(`__alat.halaman()`)
    cek(
      'peringatan "Mode tim belum dinyalakan" hilang setelah kuncinya dibuka',
      !setelahNyalakan.includes('Mode tim belum dinyalakan'),
      setelahNyalakan.slice(0, 120),
    )
  } catch (galat) {
    cek('alur kelola tim selesai tanpa galat tak terduga', false, galat?.message ?? String(galat))
  } finally {
    // ---------- Pembersihan ----------
    const hapusKuis = kuisId !== null ? await apiJson(`/v1/kuis/${kuisId}`, 'DELETE').catch(() => ({ status: 0 })) : { status: 0 }
    cek('pembersihan: kuis uji terhapus', kuisId === null || hapusKuis.status === 200 || hapusKuis.status === 204, `status=${hapusKuis.status}`)

    // Dibersihkan dengan awalan TANPA tanda putaran: sisa murid uji dari jalan
    // harness yang gagal di tengah juga ikut terbuang, jadi kelas 5A tidak
    // menumpuk murid bernama "Smoke Tim …" dari jalan-jalan sebelumnya.
    const cariMurid = async () => (await apiJson('/v1/murid?filter[cari]=smoke.tim.&per_page=100')).isi?.data ?? []
    const daftar = await cariMurid().catch(() => [])
    const status = []
    for (const murid of daftar) {
      status.push((await apiJson(`/v1/murid/${murid.id}`, 'DELETE').catch(() => ({ status: 0 }))).status)
    }
    const sisa = await cariMurid().catch(() => [])
    cek(
      'pembersihan: murid uji (termasuk sisa jalan sebelumnya) terhapus',
      status.every((s) => s === 200 || s === 204) && sisa.length === 0,
      `dihapus=${daftar.length} status=${status.join(',')} sisa=${sisa.length}`,
    )

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
