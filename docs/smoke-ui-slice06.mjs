// Smoke slice 06 lewat browser sungguhan (Chrome DevTools Protocol):
// empat tipe soal baru bisa disusun guru, dikerjakan murid dengan kendali yang
// sesuai, dinilai mesin (uraian tanpa kata kunci cocok → perlu ditinjau), lalu
// dikoreksi guru lewat token konfirmasi sekali pakai.
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }
const ALASAN = 'Jawaban benar secara konsep walau katanya belum lengkap'
const TANDA_SOAL = 'SMOKE-06'

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

  const masuk = async (akun) =>
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

  // ---------- 1. Guru menyiapkan soal bertingkat ----------
  await buka('/masuk')
  catat('login guru lewat API', (await masuk(AKUN_GURU)).status === 200)

  const retryBuka = await atur('retry', true)
  await atur('batas_percobaan', 99)
  catat('guru menyalakan retry supaya murid bisa mengerjakan berkali-kali', retryBuka.status === 200)

  const daftarGuru = await apiJson('/v1/kuis')
  const kuis = (daftarGuru.isi ?? []).find((k) => (k.jumlah_soal ?? 0) > 0)
  if (!kuis) throw new Error('tidak ada kuis terbit dengan soal di DB dev')

  const detailGuru = await apiJson(`/v1/kuis/${kuis.id}`)
  const dataGuru = detailGuru.isi
  const soalIdsAwal = (dataGuru.soal ?? []).map((s) => s.id)

  // Pakai ulang soal smoke yang sudah ada supaya skrip aman dijalankan berulang.
  const halamanSoal = await apiJson('/v1/soal')
  const soalTersimpan = halamanSoal.isi?.data ?? halamanSoal.isi ?? []

  for (const soal of cetakSoal) {
    const sudahAda = soalTersimpan.find((s) => s.tipe === soal.tipe && s.konten?.teks === soal.teks)

    if (sudahAda) {
      soal.id = sudahAda.id
      soal.baru = false
      continue
    }

    const simpan = await apiJson('/v1/soal', 'POST', {
      subject_id: dataGuru.subject_id,
      tipe: soal.tipe,
      konten: soal.konten,
      kunci: soal.kunci,
      skor: soal.skor,
      aktif: true,
    })
    soal.id = simpan.isi?.id
    soal.baru = simpan.status === 201
  }

  catat(
    'guru menyimpan empat tipe soal baru di bank soal',
    cetakSoal.every((s) => Number.isInteger(s.id)),
    cetakSoal.map((s) => `${s.tipe}#${s.id}${s.baru === false ? '(ada)' : ''}`).join(' '),
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
  // Kuis harus dilonggarkan dulu: susunan soal tidak bisa diubah saat berjalan.
  const nantiMulai = new Date(Date.now() + 2 * 3_600_000).toISOString()
  const nantiSelesai = new Date(Date.now() + 3 * 3_600_000).toISOString()
  const jadwalNanti = {
    judul: dataGuru.judul,
    deskripsi: dataGuru.deskripsi,
    subject_id: dataGuru.subject_id,
    class_id: dataGuru.class_id,
    durasi_menit: dataGuru.durasi_menit,
    mulai_at: nantiMulai,
    selesai_at: nantiSelesai,
    acak_soal: false,
    acak_opsi: dataGuru.acak_opsi,
  }
  await apiJson(`/v1/kuis/${kuis.id}`, 'PUT', jadwalNanti)

  const gabung = [...new Set([...soalIdsAwal, ...cetakSoal.map((s) => s.id)])]
  const susun = await apiJson(`/v1/kuis/${kuis.id}/soal`, 'PUT', { soal: gabung })
  catat(
    'kuis digabung dengan soal bertingkat',
    susun.status === 200 && Number(susun.isi?.jumlah_soal) === gabung.length,
    `jumlah soal ${susun.isi?.jumlah_soal} (${soalIdsAwal.length} lama + ${cetakSoal.length} baru)`,
  )

  const jadwal = await apiJson(`/v1/kuis/${kuis.id}`, 'PUT', {
    ...jadwalNanti,
    mulai_at: new Date(Date.now() - 60_000).toISOString(),
    selesai_at: new Date(Date.now() + 3_600_000).toISOString(),
  })
  catat('kuis dijadwalkan sedang berjalan', jadwal.status === 200, `status ${jadwal.status}`)

  await buka(`/kuis/${kuis.id}`)
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

  await buka(`/kerjakan/${kuis.id}`)
  const kendali = await evalJs(
    `({ teks: __alat.hitung('input[type="text"]'), area: __alat.hitung('textarea'), pilih: __alat.hitung('select') })`,
  )
  const teksKerjakan = await evalJs(`__alat.teksMain()`)
  catat(
    'layar kerja murid memakai kendali yang tepat untuk empat tipe baru',
    kendali.teks >= 1 &&
      kendali.area >= 1 &&
      kendali.pilih >= 4 &&
      ['Isian singkat', 'Uraian', 'Letak kata', 'Hubung kata'].every((t) => teksKerjakan.includes(t)),
    `input ${kendali.teks} · textarea ${kendali.area} · select ${kendali.pilih}`,
  )

  const mulaiApi = await apiJson(`/v1/kuis/${kuis.id}/mulai`, 'POST')
  const attempt = mulaiApi.isi
  if (!attempt?.id) throw new Error('mulai kuis tidak mengembalikan attempt')

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
  await buka(`/kerjakan/${kuis.id}`)
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
  const baris = (id) => rincian.find((s) => s.question_id === id) ?? {}

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

  const antrean = await apiJson(`/v1/kuis/${kuis.id}/koreksi`)
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

  await buka(`/kuis/${kuis.id}/koreksi`)
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

  const antreanAkhir = await apiJson(`/v1/kuis/${kuis.id}/koreksi`)
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

  await keluar()
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
