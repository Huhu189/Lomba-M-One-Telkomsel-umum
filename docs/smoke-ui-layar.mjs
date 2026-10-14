// Smoke layar kelas (slice 10) lewat browser sungguhan (Chrome DevTools
// Protocol) — DUA peramban sekaligus: guru mengendalikan, perangkat murid
// mengikuti.
//
// Halaman /kuis/:id/layar dan panel di layar pengerjaan murid belum pernah
// dijalankan di peramban sungguhan sebelum 13 Oktober 2026, padahal justru
// pasangan inilah inti fiturnya: satu perangkat mengubah, perangkat lain
// menyusul tanpa memuat ulang halaman. Yang dibuktikan harness ini:
//
// 1. Saklar `layar_guru` yang dimatikan diucapkan terus terang ("Layar guru
//    sedang dimatikan") dan benar-benar mengunci pemilih mode + tombol simpan.
// 2. Mode yang butuh bahan menolak disimpan tanpa bahannya: "Sorot satu soal"
//    tanpa soal terpilih mematikan tombol simpan DAN menjelaskan sebabnya di
//    layar ("Pilih dulu soal yang mau disorot.") — bukan ditolak server.
// 3. Murid menerima pengumuman guru, lalu sorotan soal (isi soalnya ikut),
//    lalu kembali ke tampilan ulangan biasa saat guru mengosongkan layar —
//    semuanya tanpa memuat ulang halaman.
// 4. Murid hanya boleh MEMBACA keadaan layar; server menolak PUT-nya.
//
// Dua konteks peramban dipakai (dua profil cookie terpisah) supaya sesi guru dan
// murid tidak saling menendang.
//
// Harness ini MANDIRI: soal, kuis, dan attempt ujinya dibuat sendiri lalu
// dihapus di blok `finally` (kunci `layar_guru` yang diubah di tengah jalan
// dikembalikan ke keadaan semula).
//
// Prasyarat: backend 8000, vite 5173, realtime 4000, Chrome :9333
// (dijalankan oleh `docs/jalankan-smoke-ui.sh layar`).
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness guru
// memakai akun guru sungguhan (guru1@sekolah.test) — bukan akun admin seperti dulu.
// Jalur kepala sekolah diuji terpisah di `docs/smoke-ui-admin.mjs`.
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }

const TANDA = String(Date.now()).slice(-6)
const JUDUL_KUIS = `Smoke layar ${TANDA}`
const TEKS_SOAL = `SMOKE-LAYAR ${TANDA}: berapa hasil dari 6 + 7?`
const JUDUL_PENGUMUMAN = `Waktu tersisa 10 menit ${TANDA}`
const ISI_PENGUMUMAN = 'Nomor 5 salah baca: yang diminta keliling, bukan luas.'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alat bantu yang disuntik ke setiap halaman (dipakai guru & murid). */
const ALAT = `window.__alat = {
  halaman() { return (document.querySelector('main')?.innerText ?? '').replace(/\\s+/g, ' ').trim() },
  teks(sel) { return document.querySelector(sel)?.textContent?.replace(/\\s+/g, ' ').trim() ?? '' },
  nilai(sel) { return document.querySelector(sel)?.value ?? null },
  mati(sel) { return document.querySelector(sel)?.disabled ?? null },
  toast() { return [...document.querySelectorAll('.toast-item')].map((t) => (t.innerText ?? '').replace(/\\s+/g, ' ')).join(' | ') },
  klik(teks) {
    const tombol = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(teks))
    if (!tombol) return false
    tombol.click()
    return true
  },
  tombolMati(teks) {
    const tombol = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(teks))
    return tombol ? tombol.disabled : null
  },
  ketik(sel, teks) {
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
  /** Apa yang dilihat murid di layar pengerjaannya (panel layar guru). */
  panelMurid() {
    const sorot = document.querySelector('section[aria-label="Soal yang disorot guru"]')
    const halaman = (document.querySelector('main')?.innerText ?? '').replace(/\\s+/g, ' ')
    return {
      sorot: sorot ? (sorot.innerText ?? '').replace(/\\s+/g, ' ').trim() : null,
      adaPengumuman: halaman.includes('Dari gurumu · pembaruan'),
      halaman: halaman.slice(0, 200),
    }
  },
}`

const hasil = []
function cek(nama, lolos, detail = '') {
  hasil.push({ nama, lolos: Boolean(lolos) })
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
  // Batas waktu per perintah CDP: tanpa ini, Chrome yang berhenti menjawab
  // membuat proses Node keluar diam-diam dengan kode 0 (harness tampak lulus).
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

  /** Satu konteks = satu profil cookie (guru dan murid tidak saling menendang). */
  async function pasang(browserContextId) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId })
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
      await sleep(2800)
    }

    const tunggu = async (ekspresi, batas = 40_000) => {
      const mulai = Date.now()
      while (Date.now() - mulai < batas) {
        if (await evalJs(ekspresi)) return true
        await sleep(500)
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
      // Halaman aplikasi dibuka lebih dulu: apiJson memakai URL relatif.
      await buka('/masuk')
      let jawab = await apiJson('/v1/auth/masuk', 'POST', akun)
      for (let coba = 0; coba < 3 && jawab?.status === 429; coba++) {
        console.log('   (batas masuk per menit tercapai, menunggu 20 detik…)')
        await sleep(20_000)
        jawab = await apiJson('/v1/auth/masuk', 'POST', akun)
      }
      return jawab
    }

    return { targetId, sessionId, evalJs, buka, tunggu, apiJson, masuk }
  }

  const { browserContextId: ctxGuru } = await send('Target.createBrowserContext')
  const { browserContextId: ctxMurid } = await send('Target.createBrowserContext')

  let kuisId = null
  let soalId = null
  /** Nilai `layar_guru` sebelum harness menyentuhnya — dikembalikan di `finally`. */
  let layarSebelumnya = null

  try {
    const guru = await pasang(ctxGuru)
    const masukGuru = await guru.masuk(AKUN_GURU)
    cek('guru masuk · guru1@sekolah.test', masukGuru?.status === 200, `status ${masukGuru?.status}`)

    // ---------- Persiapan: soal + kuis kelas murid uji ----------
    const daftarMurid = await guru.apiJson('/v1/murid?per_page=100')
    const semuaMurid = Array.isArray(daftarMurid.isi) ? daftarMurid.isi : (daftarMurid.isi?.data ?? [])
    const muridUji = semuaMurid.find((satu) => satu.email === AKUN_MURID.email)
    const kelasId = muridUji?.class_id ?? null
    const daftarMapel = await guru.apiJson('/v1/mapel')
    const mapelId = (daftarMapel.isi ?? []).find((satu) => satu.nama === 'Matematika')?.id ?? null
    cek('murid uji & mapel Matematika ada di DB dev', kelasId !== null && mapelId !== null, `kelas=${kelasId} mapel=${mapelId}`)
    if (kelasId === null || mapelId === null) throw new Error('murid uji / mapel tidak ada — jalankan seeder DB dev')

    const buatSoal = await guru.apiJson('/v1/soal', 'POST', {
      subject_id: mapelId,
      tipe: 'pilihan_ganda',
      konten: {
        teks: TEKS_SOAL,
        opsi: [
          { id: 'A', teks: '12' },
          { id: 'B', teks: '13' },
          { id: 'C', teks: '14' },
        ],
      },
      kunci: { jawaban: 'B' },
      skor: 5,
      aktif: true,
    })
    soalId = buatSoal.isi?.id ?? null
    cek('soal uji dibuat', buatSoal.status === 201 && soalId !== null, `status=${buatSoal.status}`)

    const buatKuis = await guru.apiJson('/v1/kuis', 'POST', {
      judul: JUDUL_KUIS,
      deskripsi: 'Ulangan sementara untuk menguji layar kelas.',
      subject_id: mapelId,
      class_id: kelasId,
      durasi_menit: 30,
      mulai_at: new Date(Date.now() - 60_000).toISOString(),
      selesai_at: new Date(Date.now() + 3_600_000).toISOString(),
      acak_soal: false,
      acak_opsi: false,
    })
    kuisId = buatKuis.isi?.id ?? null
    if (kuisId === null) throw new Error(`gagal membuat kuis uji: ${buatKuis.status}`)
    await guru.apiJson(`/v1/kuis/${kuisId}/soal`, 'PUT', { soal: [soalId] })
    const terbit = await guru.apiJson(`/v1/kuis/${kuisId}/publikasi`, 'POST')
    cek(
      'kuis uji terbit & sedang berjalan (satu soal)',
      terbit.status === 200 && terbit.isi?.sedang_berjalan === true,
      `kuis=${kuisId} soal=${soalId} status=${terbit.status}`,
    )

    // Kunci `layar_guru` MATI secara bawaan di kode, jadi keadaannya dibaca
    // dulu untuk dikembalikan nanti — lalu dimatikan untuk menguji pagarnya.
    const sebelum = await guru.apiJson(`/v1/pengaturan?kuis_id=${kuisId}`)
    layarSebelumnya = sebelum.isi?.pengaturan?.layar_guru?.nilai ?? null
    const matikan = await guru.apiJson('/v1/pengaturan', 'PUT', {
      lingkup: 'kuis',
      lingkup_id: kuisId,
      kunci: 'layar_guru',
      nilai: false,
    })
    cek('saklar layar_guru bisa dimatikan untuk kuis ini', matikan.status === 200, `status=${matikan.status}`)

    // ---------- 1. Layar guru selama saklarnya mati ----------
    await guru.buka(`/kuis/${kuisId}/layar`)
    const mati = await guru.evalJs(`({
      judul: __alat.teks('h1'),
      isi: __alat.halaman(),
      modeMati: __alat.mati('#mode-layar'),
      simpanMati: __alat.tombolMati('Tampilkan di perangkat murid'),
      lencana: __alat.halaman().includes('Polling 5 detik') || __alat.halaman().includes('Langsung (SSE)'),
    })`)
    cek('halaman Layar kelas terbuka untuk guru', mati.judul.startsWith('Layar kelas ·') && mati.judul.includes(JUDUL_KUIS), mati.judul)
    cek(
      'layar yang dimatikan dikatakan terus terang',
      mati.isi.includes('Layar guru sedang dimatikan') && mati.isi.includes('murid tidak menerima apa pun'),
      mati.isi.slice(0, 160),
    )
    cek(
      'pemilih mode & tombol simpan terkunci selama saklar layar mati',
      mati.modeMati === true && mati.simpanMati === true,
      `mode=${mati.modeMati} simpan=${mati.simpanMati}`,
    )
    cek('halaman menyebut jalur data yang sedang dipakainya', mati.lencana === true, '')

    // ---------- 2. Nyalakan saklarnya ----------
    const nyalakan = await guru.apiJson('/v1/pengaturan', 'PUT', {
      lingkup: 'kuis',
      lingkup_id: kuisId,
      kunci: 'layar_guru',
      nilai: true,
    })
    cek('saklar layar guru bisa dinyalakan lagi', nyalakan.status === 200, `status=${nyalakan.status}`)
    await guru.buka(`/kuis/${kuisId}/layar`)
    const hidup = await guru.evalJs(`({ isi: __alat.halaman(), modeMati: __alat.mati('#mode-layar') })`)
    cek(
      'setelah dinyalakan: peringatan hilang & pemilih mode hidup',
      !hidup.isi.includes('Layar guru sedang dimatikan') && hidup.modeMati === false,
      `modeMati=${hidup.modeMati}`,
    )

    // ---------- 3. Mode yang butuh bahan tidak bisa disimpan tanpa bahannya ----------
    await guru.evalJs(`__alat.pilih('#mode-layar', 'soal')`)
    await sleep(700)
    const tanpaSoal = await guru.evalJs(`({
      simpanMati: __alat.tombolMati('Tampilkan di perangkat murid'),
      isi: __alat.halaman(),
      adaPemilihSoal: Boolean(document.querySelector('#soal-layar')),
    })`)
    cek('mode "Sorot satu soal" menampilkan pemilih soal', tanpaSoal.adaPemilihSoal === true, '')
    cek(
      'tanpa soal terpilih: tombol simpan mati & sebabnya dijelaskan di layar',
      tanpaSoal.simpanMati === true && tanpaSoal.isi.includes('Pilih dulu soal yang mau disorot.'),
      `simpan=${tanpaSoal.simpanMati}`,
    )

    // ---------- 4. Guru mengirim pengumuman ----------
    await guru.evalJs(`__alat.pilih('#mode-layar', 'pengumuman')`)
    await sleep(700)
    await guru.evalJs(`__alat.ketik('#judul-layar', ${JSON.stringify(JUDUL_PENGUMUMAN)})`)
    await guru.evalJs(`__alat.ketik('#isi-layar', ${JSON.stringify(ISI_PENGUMUMAN)})`)
    await sleep(600)
    cek('pengumuman yang terisi menyalakan tombol simpan', (await guru.evalJs(`__alat.tombolMati('Tampilkan di perangkat murid')`)) === false)
    await guru.evalJs(`__alat.klik('Tampilkan di perangkat murid')`)
    cek(
      'penyiaran pengumuman dilaporkan ke guru',
      await guru.tunggu(`__alat.toast().includes('Layar kelas diperbarui (Pengumuman singkat)')`, 20_000),
      await guru.evalJs(`__alat.toast()`),
    )
    await sleep(1500)
    const setelahSiaran = await guru.evalJs(`__alat.halaman()`)
    cek(
      'pratinjau guru menampilkan pengumuman yang sedang tayang',
      setelahSiaran.includes('Yang dilihat murid') && setelahSiaran.includes(JUDUL_PENGUMUMAN) && setelahSiaran.includes(ISI_PENGUMUMAN),
      setelahSiaran.slice(-200),
    )

    // ---------- 5. Murid mengikuti tanpa memuat ulang halaman ----------
    const murid = await pasang(ctxMurid)
    const masukMurid = await murid.masuk(AKUN_MURID)
    cek('murid masuk di konteks terpisah · smoke.murid@sekolah.test', masukMurid?.status === 200, `status ${masukMurid?.status}`)

    await murid.apiJson(`/v1/kuis/${kuisId}/mulai`, 'POST')
    await murid.buka(`/kerjakan/${kuisId}`)
    cek(
      'murid bisa masuk ke layar pengerjaan & melihat soalnya',
      await murid.tunggu(`__alat.halaman().includes(${JSON.stringify(TEKS_SOAL)})`, 40_000),
      (await murid.evalJs(`__alat.panelMurid().halaman`)).slice(0, 120),
    )

    cek(
      'murid menerima pengumuman guru di layar ulangannya',
      await murid.tunggu(`__alat.panelMurid().adaPengumuman && __alat.panelMurid().halaman.includes(${JSON.stringify(JUDUL_PENGUMUMAN)})`, 40_000),
      (await murid.evalJs(`__alat.panelMurid()`)).halaman.slice(0, 160),
    )
    cek(
      'panel murid menyebut dari siapa & pembaruan ke berapa',
      (await murid.evalJs(`__alat.panelMurid().halaman.includes('Dari gurumu · pembaruan')`)) === true,
      '',
    )

    // ---------- 6. Guru menyorot satu soal ----------
    // Pemilih soal baru ada setelah modenya "Sorot satu soal", jadi mode dipilih
    // lebih dulu, baru pilihan soal dibaca dari pemilihnya.
    await guru.evalJs(`__alat.pilih('#mode-layar', 'soal')`)
    await sleep(700)
    const soalTerpilih = await guru.evalJs(`(function () {
      const el = document.querySelector('#soal-layar')
      if (!el) return null
      return [...el.options].map((o) => o.value).find((v) => v !== '') ?? null
    })()`)
    cek('pemilih soal menawarkan soal milik kuis ini', soalTerpilih !== null, `soal=${soalTerpilih}`)
    await guru.evalJs(`__alat.pilih('#soal-layar', ${JSON.stringify(String(soalTerpilih))})`)
    await sleep(700)
    await guru.evalJs(`__alat.klik('Tampilkan di perangkat murid')`)
    cek(
      'penyiaran sorotan soal dilaporkan ke guru',
      await guru.tunggu(`__alat.toast().includes('Layar kelas diperbarui (Sorot satu soal)')`, 20_000),
      `nilai=${soalTerpilih} toast=${await guru.evalJs(`__alat.toast()`)}`,
    )

    cek(
      'murid menerima sorotan soal tanpa memuat ulang',
      await murid.tunggu(`(__alat.panelMurid().sorot ?? '').includes('Guru menyorot soal nomor')`, 40_000),
      `sorot=${(await murid.evalJs(`__alat.panelMurid().sorot ?? '(panel tidak ada)'`)).slice(0, 140)}`,
    )
    cek(
      'isi soal yang disorot benar-benar sampai ke perangkat murid',
      ((await murid.evalJs(`__alat.panelMurid().sorot ?? ''`)) || '').includes(TEKS_SOAL),
      '',
    )
    cek(
      'sorotan itu tidak mengunci pekerjaan murid (soalnya tetap di layar)',
      (await murid.evalJs(`__alat.halaman().includes(${JSON.stringify(TEKS_SOAL)})`)) === true,
      '',
    )
    cek(
      'panel sorotan tidak membocorkan kunci jawaban',
      (await murid.evalJs(`!__alat.panelMurid().halaman.includes('Kunci jawaban')`)) === true,
      '',
    )

    // ---------- 7. Guru mengosongkan layar: murid kembali seperti biasa ----------
    await guru.buka(`/kuis/${kuisId}/layar`)
    await guru.evalJs(`__alat.klik('Kosongkan layar')`)
    await sleep(800)
    const dikosongkan = await guru.evalJs(`({
      mode: __alat.nilai('#mode-layar'),
      judul: __alat.nilai('#judul-layar'),
      isi: __alat.nilai('#isi-layar'),
      simpanMati: __alat.tombolMati('Tampilkan di perangkat murid'),
    })`)
    cek(
      '"Kosongkan layar" mengembalikan form ke keadaan kosong dan tetap bisa disiarkan',
      dikosongkan.mode === 'kosong' && dikosongkan.judul === '' && dikosongkan.isi === '' && dikosongkan.simpanMati === false,
      `mode=${dikosongkan.mode} simpan=${dikosongkan.simpanMati}`,
    )
    await guru.evalJs(`__alat.klik('Tampilkan di perangkat murid')`)
    cek(
      'pengosongan disiarkan ke guru',
      await guru.tunggu(`__alat.toast().includes('Layar kelas diperbarui (Kosong')`, 20_000),
      await guru.evalJs(`__alat.toast()`),
    )
    cek(
      'murid kembali ke tampilan ulangan biasa (panel hilang)',
      await murid.tunggu(`__alat.panelMurid().sorot === null && !__alat.panelMurid().adaPengumuman`, 40_000),
      (await murid.evalJs(`__alat.panelMurid().halaman`)).slice(0, 140),
    )

    // ---------- 8. Murid tidak boleh mengubah layar kelas ----------
    const muridCobaSimpan = await murid.apiJson(`/v1/kuis/${kuisId}/layar`, 'PUT', {
      mode: 'pengumuman',
      judul: 'Murid tidak boleh',
      isi: null,
      question_id: null,
    })
    cek('server menolak murid yang mencoba mengubah layar kelas', muridCobaSimpan.status === 403, `status=${muridCobaSimpan.status}`)
    const muridBaca = await murid.apiJson(`/v1/kuis/${kuisId}/layar`)
    cek(
      'murid hanya boleh MEMBACA keadaan layar (tanpa bahan pengendali)',
      muridBaca.status === 200 && muridBaca.isi?.daftar_soal === undefined && muridBaca.isi?.daftar_mode === undefined,
      `status=${muridBaca.status}`,
    )
  } catch (galat) {
    cek('alur layar kelas selesai tanpa galat tak terduga', false, galat?.message ?? String(galat))
  } finally {
    // ---------- Pembersihan ----------
    try {
      const guru = await pasang(ctxGuru)
      await guru.masuk(AKUN_GURU)
      if (kuisId !== null) {
        const kembali = await guru.apiJson('/v1/pengaturan', 'PUT', {
          lingkup: 'kuis',
          lingkup_id: kuisId,
          kunci: 'layar_guru',
          nilai: typeof layarSebelumnya === 'boolean' ? layarSebelumnya : true,
        })
        cek('pembersihan: saklar layar guru dikembalikan ke nilai semula', kembali.status === 200, `nilai=${layarSebelumnya}`)

        // Kuis dihapus lebih dulu: attempt + jawaban murid ikut terhapus.
        const hapusKuis = await guru.apiJson(`/v1/kuis/${kuisId}`, 'DELETE')
        cek('pembersihan: kuis uji (beserta attempt-nya) terhapus', hapusKuis.status === 200 || hapusKuis.status === 204, `status=${hapusKuis.status}`)
      }
      if (soalId !== null) {
        const hapusSoal = await guru.apiJson(`/v1/soal/${soalId}`, 'DELETE')
        cek('pembersihan: soal uji terhapus', hapusSoal.status === 200 || hapusSoal.status === 204, `status=${hapusSoal.status}`)
      }
    } catch (galat) {
      cek('pembersihan selesai tanpa galat', false, galat?.message ?? String(galat))
    }

    await send('Target.disposeBrowserContext', { browserContextId: ctxMurid }).catch(() => {})
    await send('Target.disposeBrowserContext', { browserContextId: ctxGuru }).catch(() => {})
    ws.close()

    const gagal = hasil.filter((satu) => !satu.lolos)
    console.log(`\nTotal: ${hasil.length - gagal.length}/${hasil.length} lulus · ${gagal.length} gagal`)
    process.exit(gagal.length === 0 ? 0 : 1)
  }
}

main().catch((e) => {
  console.error('smoke gagal:', e.message)
  process.exit(1)
})
