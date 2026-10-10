// Smoke slice 06 lewat browser sungguhan (Chrome DevTools Protocol):
// empat tipe soal baru bisa disusun guru, dikerjakan murid dengan kendali yang
// sesuai, dinilai mesin (uraian tanpa kata kunci cocok → perlu ditinjau), lalu
// dikoreksi guru lewat token konfirmasi sekali pakai.
//
// Harness ini MANDIRI: ulangan + empat soal ujinya dibuat di awal (kelas murid
// uji sendiri), pengaturan yang diubah dipulihkan lagi, dan seluruh data uji
// dihapus di akhir — jadi bisa dijalankan berulang tanpa sisa data lama.
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }
const ALASAN = 'Jawaban benar secara konsep walau katanya belum lengkap'
const TANDA_SOAL = 'SMOKE-06'

/** Label tipe seperti tampil di layar (dipakai memeriksa kendali per tipe). */
const LABEL_TIPE = {
  isian_singkat: 'Isian singkat',
  uraian: 'Uraian',
  letak_kata: 'Letak kata',
  hubung_kata: 'Hubung kata',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alat bantu di sisi halaman (disuntik ulang setiap navigasi). */
const ALAT = `window.__alat = {
  ada(teks) { return (document.querySelector('main')?.innerText ?? '').includes(teks) },
  teksMain() { return document.querySelector('main')?.innerText?.replace(/\\s+/g, ' ') ?? '' },
  hitung(sel) { return document.querySelectorAll(sel).length },
  nilai(sel) { return document.querySelector(sel)?.value ?? null },
  setNilai(sel, teks) {
    const el = document.querySelector(sel)
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set
    setter.call(el, teks)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  },
  klik(teks) {
    const tombol = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(teks))
    if (!tombol) return false
    tombol.click()
    return true
  },
  kartuSoal() { return document.querySelector('section.kartu-ulangan') },
  // Papan desain 4: satu soal per layar, jadi soal dibuka lewat navigator kisi.
  tungguKartu(teks, batasMs) {
    return new Promise((selesai) => {
      const mulai = Date.now()
      const cek = () => {
        const isi = document.querySelector('section.kartu-ulangan')?.innerText ?? ''
        if (isi.includes(teks) || Date.now() - mulai > batasMs) return selesai(isi.includes(teks))
        setTimeout(cek, 100)
      }
      cek()
    })
  },
  async bukaSoal(teks) {
    if (await window.__alat.tungguKartu(teks, 600)) return true
    const semua = [...document.querySelectorAll('button[aria-label^="Soal "]')]
    const unik = [...new Map(semua.map((t) => [t.getAttribute('aria-label'), t])).values()]
    for (const tombol of unik) {
      tombol.click()
      if (await window.__alat.tungguKartu(teks, 500)) return true
    }
    return false
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

/** Empat soal baru yang mau diuji; id baru terisi setelah tersimpan. */
const cetakSoal = [
  {
    tipe: 'isian_singkat',
    teks: `${TANDA_SOAL} isian: berapa hasil 4 + 5?`,
    konten: { teks: `${TANDA_SOAL} isian: berapa hasil 4 + 5?`, petunjuk: 'Tulis angka atau katanya.' },
    kunci: { jawaban_baku: ['9'], sinonim: [['sembilan']], ambang: 0.8 },
    skor: 4,
  },
  {
    tipe: 'uraian',
    teks: `${TANDA_SOAL} uraian: jelaskan cara menjumlahkan 4 + 5.`,
    konten: { teks: `${TANDA_SOAL} uraian: jelaskan cara menjumlahkan 4 + 5.` },
    kunci: {
      kata_kunci: [
        { teks: 'jumlah', bobot: 1 },
        { teks: 'hasil', bobot: 1 },
      ],
      ambang_lulus: 0.6,
    },
    skor: 6,
  },
  {
    tipe: 'letak_kata',
    teks: `${TANDA_SOAL} letak kata: letakkan kata pada posisi yang tepat.`,
    konten: {
      teks: `${TANDA_SOAL} letak kata: letakkan kata pada posisi yang tepat.`,
      kata: [
        { id: 'W1', teks: 'kucing' },
        { id: 'W2', teks: 'berlari' },
      ],
      posisi: [
        { id: 'P1', teks: 'Subjek' },
        { id: 'P2', teks: 'Predikat' },
      ],
    },
    kunci: { penempatan: { W1: 'P1', W2: 'P2' } },
    skor: 4,
  },
  {
    tipe: 'hubung_kata',
    teks: `${TANDA_SOAL} hubung kata: hubungkan kata dengan pasangannya.`,
    konten: {
      teks: `${TANDA_SOAL} hubung kata: hubungkan kata dengan pasangannya.`,
      kiri: [
        { id: 'K1', teks: 'besar' },
        { id: 'K2', teks: 'panas' },
      ],
      kanan: [
        { id: 'N1', teks: 'kecil' },
        { id: 'N2', teks: 'dingin' },
      ],
    },
    kunci: { sambungan: { K1: 'N1', K2: 'N2' } },
    skor: 4,
  },
]

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
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.confirm = () => true' }, sessionId)

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

  const tunggu = async (ekspresi, batas = 10000) => {
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
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
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
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
      const res = await fetch('/api${jalur}', {
        method: '${metode}',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: ${muatan === null ? 'null' : `JSON.stringify(${JSON.stringify(muatan)})`},
      })
      return { status: res.status, isi: await res.json().catch(() => null) }
    })()`)

  const keluar = () => apiJson('/v1/auth/keluar', 'POST')
  const atur = (kunci, nilai) => apiJson('/v1/pengaturan', 'PUT', { lingkup: 'sekolah', kunci, nilai })

  const mulai = new Date(Date.now() - 60_000).toISOString()
  const selesai = new Date(Date.now() + 3_600_000).toISOString()

  /** @type {number[]} */ const idSoalUji = []
  let idKuisUji = 0
  /** @type {Record<string, boolean|number>} */ let pengaturanAwal = {}

  /** Pulihkan pengaturan + hapus data uji (saat lulus maupun saat gagal). */
  const bersihkan = async () => {
    await keluar()
    await masuk(AKUN_GURU)

    for (const [kunci, nilai] of Object.entries(pengaturanAwal)) {
      if (nilai !== undefined && nilai !== null) await atur(kunci, nilai)
    }

    let status = 0
    if (idKuisUji > 0) status = (await apiJson(`/v1/kuis/${idKuisUji}`, 'DELETE')).status
    for (const idSoal of idSoalUji) {
      const hapus = await apiJson(`/v1/soal/${idSoal}`, 'DELETE')
      if (hapus.status !== 200) status = hapus.status
    }

    return { status, sisa: `kuis ${idKuisUji} · soal ${idSoalUji.join(',')}` }
  }

  // ---------- 1. Guru menyiapkan soal bertingkat ----------
  await buka('/masuk')
  catat('login guru lewat API', (await masuk(AKUN_GURU)).status === 200)

  const pengaturanSekarang = await apiJson('/v1/pengaturan')
  pengaturanAwal = {
    retry: pengaturanSekarang.isi?.pengaturan?.retry?.nilai,
    batas_percobaan: pengaturanSekarang.isi?.pengaturan?.batas_percobaan?.nilai,
  }

  const daftarMurid = await apiJson('/v1/murid?per_page=100')
  const muridUji = (daftarMurid.isi?.data ?? []).find((satu) => satu.email === AKUN_MURID.email)
  const daftarMapel = await apiJson('/v1/mapel')
  const mapelId = (daftarMapel.isi ?? []).find((satu) => satu.nama === 'Matematika')?.id
  if (!muridUji || !mapelId) throw new Error('murid uji atau mapel Matematika tidak ada di DB dev — jalankan seeder')

  const retryBuka = await atur('retry', true)
  await atur('batas_percobaan', 99)
  catat('guru menyalakan retry supaya murid bisa mengerjakan berkali-kali', retryBuka.status === 200)

  try {
    for (const soal of cetakSoal) {
      const simpan = await apiJson('/v1/soal', 'POST', {
        subject_id: mapelId,
        tipe: soal.tipe,
        konten: soal.konten,
        kunci: soal.kunci,
        skor: soal.skor,
        aktif: true,
      })
      if (simpan.status !== 201) throw new Error(`gagal membuat soal ${soal.tipe}: ${simpan.status}`)
      soal.id = simpan.isi.id
      idSoalUji.push(simpan.isi.id)
    }

    catat(
      'guru menyimpan empat tipe soal baru di bank soal',
      cetakSoal.every((s) => Number.isInteger(s.id)),
      cetakSoal.map((s) => `${s.tipe}#${s.id}`).join(' '),
    )

    // Soal tersimpan harus terbaca kembali apa adanya (konten + kunci per tipe).
    const bacaKembali = {}
    for (const soal of cetakSoal) {
      const satu = await apiJson(`/v1/soal/${soal.id}`)
      bacaKembali[soal.tipe] = satu.isi
    }
    catat(
      'kunci tiap tipe baru tersimpan utuh di server',
      bacaKembali.isian_singkat?.kunci?.jawaban_baku?.[0] === '9' &&
        bacaKembali.uraian?.kunci?.kata_kunci?.length === 2 &&
        bacaKembali.letak_kata?.kunci?.penempatan?.W1 === 'P1' &&
        bacaKembali.hubung_kata?.kunci?.sambungan?.K2 === 'N2',
      `isian ${bacaKembali.isian_singkat?.kunci?.jawaban_baku?.length} baku · uraian ${bacaKembali.uraian?.kunci?.kata_kunci?.length} kata kunci`,
    )

    // ---------- 1b. Susun kuis dan jadwalkan berjalan ----------
    const buatKuis = await apiJson('/v1/kuis', 'POST', {
      judul: 'SMOKE-06 Ulangan Tipe Baru',
      deskripsi: 'Ulangan sementara untuk smoke empat tipe soal baru.',
      subject_id: mapelId,
      class_id: muridUji.class_id,
      durasi_menit: 20,
      mulai_at: mulai,
      selesai_at: selesai,
      acak_soal: false,
      acak_opsi: false,
    })
    if (buatKuis.status !== 201) throw new Error(`gagal membuat kuis uji: ${buatKuis.status}`)
    idKuisUji = buatKuis.isi.id

    const susun = await apiJson(`/v1/kuis/${idKuisUji}/soal`, 'PUT', { soal: idSoalUji })
    const terbit = await apiJson(`/v1/kuis/${idKuisUji}/publikasi`, 'POST')
    catat(
      'kuis disusun dari empat tipe baru lalu diterbitkan',
      susun.status === 200 && Number(susun.isi?.jumlah_soal) === cetakSoal.length && terbit.status === 200,
      `kuis ${idKuisUji} · jumlah soal ${susun.isi?.jumlah_soal}`,
    )

    await buka(`/kuis/${idKuisUji}`)
    const detailTeks = await evalJs(`__alat.teksMain()`)
    catat(
      'detail kuis menandai empat tipe baru dan menyediakan tombol koreksi',
      ['Isian singkat', 'Uraian', 'Letak kata', 'Hubung kata', 'Koreksi manual'].every((t) => detailTeks.includes(t)),
      detailTeks.slice(0, 90),
    )

    // ---------- 2. Murid mengerjakan ----------
    await keluar()
    await buka('/masuk')
    catat('login murid lewat API', (await masuk(AKUN_MURID)).status === 200)

    await buka(`/kerjakan/${idKuisUji}`)

    // Papan desain 4: satu soal per layar. Tiap tipe diperiksa dengan membuka
    // soalnya lewat navigator, bukan menghitung seluruh kendali sekaligus.
    const kendaliPerTipe = {}
    for (const soal of cetakSoal) {
      const kartuDibuka = await evalJs(`__alat.bukaSoal(${JSON.stringify(soal.teks)})`)
      const kendali = await evalJs(
        `({
          teks: __alat.hitung('section.kartu-ulangan input[type="text"]'),
          area: __alat.hitung('section.kartu-ulangan textarea'),
          pilih: __alat.hitung('section.kartu-ulangan select'),
          label: __alat.teksMain().includes(${JSON.stringify(LABEL_TIPE[soal.tipe])}),
        })`,
      )
      // Kata-kata & kolom letak kata diambil apa adanya supaya soal yang tampil
      // kosong (daftar tidak ikut terkirim server) langsung ketahuan.
      const cuplikan = await evalJs(`(__alat.kartuSoal()?.innerText ?? '(tanpa kartu)').slice(0, 600)`)
      kendaliPerTipe[soal.tipe] = { ...kendali, kartuDibuka, cuplikan }
    }

    catat(
      'layar kerja murid memakai kendali yang tepat untuk empat tipe baru',
      cetakSoal.every((s) => kendaliPerTipe[s.tipe].kartuDibuka === true) &&
        cetakSoal.every((s) => kendaliPerTipe[s.tipe].label === true) &&
        kendaliPerTipe.isian_singkat.teks === 1 &&
        kendaliPerTipe.uraian.area === 1 &&
        kendaliPerTipe.letak_kata.pilih === 2 &&
        kendaliPerTipe.hubung_kata.pilih === 2 &&
        // Kata & kolom letak kata benar-benar sampai ke perangkat murid
        // (payload soal pernah kehilangan daftar ini → soal tampil kosong).
        ['kucing', 'berlari', 'Subjek', 'Predikat'].every((t) => kendaliPerTipe.letak_kata.cuplikan.includes(t)) &&
        ['besar', 'panas'].every((t) => kendaliPerTipe.hubung_kata.cuplikan.includes(t)),
      cetakSoal.map((s) => `${s.tipe}: teks ${kendaliPerTipe[s.tipe].teks} area ${kendaliPerTipe[s.tipe].area} pilih ${kendaliPerTipe[s.tipe].pilih}`).join(' · '),
    )

    const mulaiApi = await apiJson(`/v1/kuis/${idKuisUji}/mulai`, 'POST')
    const attempt = mulaiApi.isi
    if (!attempt?.id) throw new Error(`mulai kuis tidak mengembalikan attempt: ${mulaiApi.status} ${JSON.stringify(mulaiApi.isi)}`)

    const soalTeks = Object.fromEntries(cetakSoal.map((s) => [s.tipe, s]))

    // Jawaban murid: isian lewat sinonim, uraian tanpa kata kunci yang cocok,
    // letak kata benar, hubung kata tertukar.
    const jawabanMurid = [
      { question_id: soalTeks.isian_singkat.id, jawaban: 'sembilan' },
      { question_id: soalTeks.uraian.id, jawaban: 'tidak tahu' },
      { question_id: soalTeks.letak_kata.id, jawaban: { W1: 'P1', W2: 'P2' } },
      { question_id: soalTeks.hubung_kata.id, jawaban: { K1: 'N2', K2: 'N1' } },
    ]

    const statusJawab = []
    for (const satu of jawabanMurid) {
      const kirim = await apiJson(`/v1/attempt/${attempt.id}/jawab`, 'POST', {
        question_id: satu.question_id,
        jawaban: satu.jawaban,
      })
      statusJawab.push(kirim.status)
    }
    catat(
      'jawaban berbentuk peta (letak & hubung kata) diterima server',
      statusJawab.every((s) => s === 200 || s === 201),
      statusJawab.join('/'),
    )

    // Muat ulang layar kerja: jawaban uraian harus muncul kembali di kotak teks.
    await buka(`/kerjakan/${idKuisUji}`)
    await evalJs(`__alat.bukaSoal(${JSON.stringify(soalTeks.uraian.teks)})`)
    const kembaliDiKotak = await evalJs(
      `__alat.nilai('textarea[name="attempt-${attempt.id}-soal-${soalTeks.uraian.id}"]')`,
    )
    catat(
      'jawaban uraian murid terisi kembali di kotak teks',
      kembaliDiKotak === 'tidak tahu',
      `nilai ${JSON.stringify(kembaliDiKotak)}`,
    )

    const kumpul = await apiJson(`/v1/attempt/${attempt.id}/kumpulkan`, 'POST', {
      idempotency_key: `smoke-06-${attempt.id}`,
    })
    catat('attempt murid terkumpul', kumpul.status === 200, `status ${kumpul.status}`)

    const hasilAttempt = await apiJson(`/v1/attempt/${attempt.id}/hasil`)
    const rincian = hasilAttempt.isi?.per_soal ?? []
    const baris = (soalId) => rincian.find((s) => s.question_id === soalId) ?? {}

    catat(
      'isian singkat dinilai benar lewat sinonim',
      baris(soalTeks.isian_singkat.id).benar === true && Number(baris(soalTeks.isian_singkat.id).skor) === 4,
      `skor ${baris(soalTeks.isian_singkat.id).skor}`,
    )
    catat(
      'letak kata & hubung kata dinilai otomatis seperti soal objektif',
      Number(baris(soalTeks.letak_kata.id).skor) === 4 && Number(baris(soalTeks.hubung_kata.id).skor) === 0,
      `letak ${baris(soalTeks.letak_kata.id).skor} · hubung ${baris(soalTeks.hubung_kata.id).skor}`,
    )
    catat(
      'uraian yang belum cocok kata kuncinya ditandai perlu ditinjau, bukan dihukum nol',
      baris(soalTeks.uraian.id).status === 'perlu_tinjau' && baris(soalTeks.uraian.id).benar === null,
      `status ${baris(soalTeks.uraian.id).status}`,
    )

    const skorSebelumKoreksi = Number(hasilAttempt.isi?.skor ?? 0)

    // ---------- 3. Guru membuka antrean koreksi ----------
    await keluar()
    await buka('/masuk')
    await masuk(AKUN_GURU)

    const antrean = await apiJson(`/v1/kuis/${idKuisUji}/koreksi`)
    const itemUraian = (antrean.isi?.item ?? []).find(
      (s) => s.attempt_id === attempt.id && s.question_id === soalTeks.uraian.id,
    )
    catat(
      'antrean koreksi memuat baris uraian murid beserta kuncinya',
      itemUraian !== undefined &&
        itemUraian.status === 'perlu_tinjau' &&
        itemUraian.tipe === 'uraian' &&
        itemUraian.kunci?.kata_kunci?.length === 2 &&
        antrean.isi?.alasan_min === 10,
      `jumlah ${antrean.isi?.jumlah} · alasan_min ${antrean.isi?.alasan_min}`,
    )

    await buka(`/kuis/${idKuisUji}/koreksi`)
    const halamanKoreksi = await evalJs(`__alat.teksMain()`)
    catat(
      'halaman koreksi guru tampil dengan form ber-token',
      halamanKoreksi.includes('Koreksi manual') &&
        halamanKoreksi.includes('Minta token konfirmasi') &&
        halamanKoreksi.includes('Simpan koreksi') &&
        halamanKoreksi.includes(`skor ${itemUraian?.skor_sekarang} / ${itemUraian?.skor_maksimal}`),
      halamanKoreksi.slice(0, 90),
    )

    // Koreksi lewat UI: isi skor + alasan, minta token, lalu simpan.
    const skorBaru = Number(itemUraian?.skor_maksimal ?? 6)
    await evalJs(
      `__alat.setNilai('#skor-${attempt.id}-${soalTeks.uraian.id}', '${skorBaru}') &&
       __alat.setNilai('#alasan-${attempt.id}-${soalTeks.uraian.id}', ${JSON.stringify(ALASAN)})`,
    )
    await evalJs(`__alat.klik('Minta token konfirmasi')`)
    catat(
      'UI menerbitkan token konfirmasi setelah alasan diisi',
      await tunggu(`__alat.ada('Token konfirmasi aktif sampai')`),
    )

    await evalJs(`__alat.klik('Simpan koreksi')`)
    catat(
      'UI menyimpan koreksi lalu menyegarkan antrean (baris itu hilang)',
      await tunggu(`!__alat.ada('${TANDA_SOAL} uraian')`),
    )

    const setelahUi = await apiJson(`/v1/attempt/${attempt.id}/hasil`)
    const skorUraianUi = (setelahUi.isi?.per_soal ?? []).find((s) => s.question_id === soalTeks.uraian.id)
    catat(
      'nilai uraian naik lewat koreksi guru di UI',
      Number(skorUraianUi?.skor) === skorBaru && skorUraianUi?.status === 'dinilai',
      `skor ${skorUraianUi?.skor} / ${skorBaru} · status ${skorUraianUi?.status}`,
    )

    // ---------- 4. Penjaga token di sisi API ----------
    const alasanPendek = await apiJson(`/v1/attempt/${attempt.id}/koreksi/token`, 'POST', {
      question_id: soalTeks.uraian.id,
      alasan: 'pendek',
    })
    catat(
      'token koreksi menolak alasan yang terlalu pendek',
      alasanPendek.status === 422,
      `status ${alasanPendek.status}`,
    )

    const tokenTerbitApi = await apiJson(`/v1/attempt/${attempt.id}/koreksi/token`, 'POST', {
      question_id: soalTeks.uraian.id,
      alasan: ALASAN,
    })
    catat(
      'token konfirmasi berumur pendek (300 detik)',
      tokenTerbitApi.status === 200 &&
        tokenTerbitApi.isi?.ttl_detik === 300 &&
        typeof tokenTerbitApi.isi?.token === 'string',
      `ttl ${tokenTerbitApi.isi?.ttl_detik}`,
    )

    const tokenPalsu = await apiJson(`/v1/attempt/${attempt.id}/koreksi`, 'POST', {
      question_id: soalTeks.uraian.id,
      skor: 1,
      alasan: ALASAN,
      token: 'token-palsu',
    })
    catat('koreksi dengan token palsu ditolak', tokenPalsu.status === 422, `status ${tokenPalsu.status}`)

    const tokenSungguhan = tokenTerbitApi.isi?.token
    const koreksiKedua = await apiJson(`/v1/attempt/${attempt.id}/koreksi`, 'POST', {
      question_id: soalTeks.uraian.id,
      skor: 5,
      alasan: ALASAN,
      token: tokenSungguhan,
    })
    const totalUI = Number(setelahUi.isi?.skor ?? 0)
    catat(
      'koreksi kedua dengan token asli tersimpan dan menghitung ulang total attempt',
      koreksiKedua.status === 200 &&
        Number(koreksiKedua.isi?.skor_soal) === 5 &&
        Number(koreksiKedua.isi?.total_skor) === totalUI - skorBaru + 5 &&
        koreksiKedua.isi?.status === 'dinilai',
      `skor soal ${koreksiKedua.isi?.skor_soal} · total ${koreksiKedua.isi?.total_skor} (sebelumnya ${totalUI})`,
    )

    const tokenDipakaiUlang = await apiJson(`/v1/attempt/${attempt.id}/koreksi`, 'POST', {
      question_id: soalTeks.uraian.id,
      skor: 6,
      alasan: ALASAN,
      token: tokenSungguhan,
    })
    catat(
      'token sekali pakai tidak bisa dipakai dua kali',
      tokenDipakaiUlang.status === 422,
      `status ${tokenDipakaiUlang.status}`,
    )

    const antreanAkhir = await apiJson(`/v1/kuis/${idKuisUji}/koreksi`)
    const masihAntre = (antreanAkhir.isi?.item ?? []).some(
      (s) => s.attempt_id === attempt.id && s.question_id === soalTeks.uraian.id,
    )
    catat(
      'soal yang sudah dikoreksi keluar dari antrean',
      masihAntre === false && (antreanAkhir.isi?.jumlah ?? 1) < (antrean.isi?.jumlah ?? 0) + 1,
      `jumlah antrean ${antrean.isi?.jumlah} → ${antreanAkhir.isi?.jumlah}`,
    )

    catat(
      'skor total attempt masih di atas skor sebelum koreksi',
      Number(koreksiKedua.isi?.total_skor) > skorSebelumKoreksi,
      `${skorSebelumKoreksi} → ${koreksiKedua.isi?.total_skor}`,
    )
  } finally {
    // ---------- 5. Bersih-bersih ----------
    const beres = await bersihkan()
    const sisaKuis = idKuisUji > 0 ? await apiJson(`/v1/kuis/${idKuisUji}`) : { status: 404 }
    catat(
      'ulangan & soal uji dihapus + pengaturan dipulihkan',
      beres.status === 200 && (sisaKuis.status === 404 || sisaKuis.status === 403),
      `${beres.sisa} · baca ulang kuis ${sisaKuis.status}`,
    )
  }

  await keluar()
  // Tab yang dibuat harness ini ditutup supaya target Chrome tidak menumpuk
  // saat smoke dijalankan berulang.
  await send('Target.closeTarget', { targetId })
  ws.close()

  const gagal = hasil.filter((satu) => !satu.lolos)
  console.log('')
  console.log(`smoke slice 06: ${hasil.length - gagal.length}/${hasil.length} lulus`)
  process.exit(gagal.length === 0 ? 0 : 1)
}

main().catch((galat) => {
  console.error('smoke gagal:', galat.message)
  process.exit(1)
})
