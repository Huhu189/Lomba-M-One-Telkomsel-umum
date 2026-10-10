// Smoke slice 05 lewat browser sungguhan (Chrome DevTools Protocol):
// skor asli tetap utuh setelah retry, peringkat hanya memakai skor asli dan
// mengikuti saklar pengaturan, laporan per tema hanya untuk guru, serta halaman
// lencana dan progres tema tampil untuk murid.
//
// Harness ini MANDIRI: ulangan + soal + tag ujinya dibuat di awal (kelas murid
// uji sendiri, jadi tidak bergantung kuis sisa smoke lain), pengaturan yang
// diubah dipulihkan lagi, dan seluruh data uji dihapus di akhir.
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }

/** Tag tema untuk soal uji (dipakai laporan tema & remedial). */
const NAMA_TAG = 'SMOKE-05 Operasi Hitung'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Soal uji yang dibuat harness ini (kunci diketahui pasti). */
const SOAL_UJI = [
  {
    teks: 'SMOKE-05: berapa hasil dari 6 + 7?',
    opsi: [
      { id: 'A', teks: '12' },
      { id: 'B', teks: '13' },
      { id: 'C', teks: '14' },
    ],
    kunci: 'B',
    skor: 5,
  },
  {
    teks: 'SMOKE-05: berapa hasil dari 8 + 9?',
    opsi: [
      { id: 'A', teks: '16' },
      { id: 'B', teks: '17' },
      { id: 'C', teks: '18' },
    ],
    kunci: 'B',
    skor: 5,
  },
]

/** Alat bantu di sisi halaman (disuntik ulang setiap navigasi). */
const ALAT = `window.__alat = {
  ada(teks) { return (document.querySelector('main')?.innerText ?? '').includes(teks) },
  teksMain() { return document.querySelector('main')?.innerText?.replace(/\\s+/g, ' ') ?? '' },
  hitung(sel) { return document.querySelectorAll(sel).length },
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

  const atur = (kunci, nilai) => apiJson('/v1/pengaturan', 'PUT', { lingkup: 'sekolah', kunci, nilai })

  const mulai = new Date(Date.now() - 60_000).toISOString()
  const selesai = new Date(Date.now() + 3_600_000).toISOString()

  /** @type {number[]} */ const idSoalUji = []
  let idKuisUji = 0
  let idTagUji = 0
  /** @type {Record<string, boolean|number>} */ let pengaturanAwal = {}

  /** Pulihkan pengaturan + hapus data uji (saat lulus maupun saat gagal). */
  const bersihkan = async () => {
    await apiJson('/v1/auth/keluar', 'POST')
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
    if (idTagUji > 0) {
      const hapus = await apiJson(`/v1/tag/${idTagUji}`, 'DELETE')
      if (hapus.status !== 200) status = hapus.status
    }

    return { status, sisa: `kuis ${idKuisUji} · soal ${idSoalUji.join(',')} · tag ${idTagUji}` }
  }

  // ---------- 1. Guru menyiapkan ulangan uji ----------
  await buka('/masuk')
  catat('login guru lewat API', (await masuk(AKUN_GURU)).status === 200)

  const pengaturanSekarang = await apiJson('/v1/pengaturan')
  pengaturanAwal = {
    retry: pengaturanSekarang.isi?.pengaturan?.retry?.nilai,
    batas_percobaan: pengaturanSekarang.isi?.pengaturan?.batas_percobaan?.nilai,
    ranking: pengaturanSekarang.isi?.pengaturan?.ranking?.nilai,
  }

  const daftarMurid = await apiJson('/v1/murid?per_page=100')
  const muridUji = (daftarMurid.isi?.data ?? []).find((satu) => satu.email === AKUN_MURID.email)
  const daftarMapel = await apiJson('/v1/mapel')
  const mapelId = (daftarMapel.isi ?? []).find((satu) => satu.nama === 'Matematika')?.id
  if (!muridUji || !mapelId) throw new Error('murid uji atau mapel Matematika tidak ada di DB dev — jalankan seeder')

  const buatTag = await apiJson('/v1/tag', 'POST', {
    nama: NAMA_TAG,
    deskripsi: 'Tema sementara untuk smoke peringkat & laporan.',
  })
  if (buatTag.status !== 201) throw new Error(`gagal membuat tag uji: ${buatTag.status}`)
  idTagUji = buatTag.isi.id

  for (const satu of SOAL_UJI) {
    const dibuat = await apiJson('/v1/soal', 'POST', {
      subject_id: mapelId,
      tag_id: idTagUji,
      tipe: 'pilihan_ganda',
      konten: { teks: satu.teks, opsi: satu.opsi },
      kunci: { jawaban: satu.kunci },
      skor: satu.skor,
      aktif: true,
    })
    if (dibuat.status !== 201) throw new Error(`gagal membuat soal uji: ${dibuat.status}`)
    idSoalUji.push(dibuat.isi.id)
  }
  catat(
    'guru membuat tag + dua soal pilihan ganda bertema',
    idSoalUji.length === 2 && idTagUji > 0,
    `tag ${idTagUji} · soal ${idSoalUji.join(',')}`,
  )

  try {
    const buatKuis = await apiJson('/v1/kuis', 'POST', {
      judul: 'SMOKE-05 Ulangan Peringkat',
      deskripsi: 'Ulangan sementara untuk smoke peringkat, retry, dan laporan tema.',
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
      'guru menyusun soal lalu menerbitkan ulangan uji',
      susun.status === 200 && terbit.status === 200 && terbit.isi?.sedang_berjalan === true,
      `kuis ${idKuisUji} untuk ${muridUji.kelas_nama}`,
    )

    const retryBuka = await atur('retry', true)
    await atur('batas_percobaan', 5)
    const rankingMati = await atur('ranking', false)
    catat(
      'guru menyalakan retry dan mematikan ranking',
      retryBuka.status === 200 && rankingMati.isi?.pengaturan?.ranking?.nilai === false,
      `ranking ${rankingMati.isi?.pengaturan?.ranking?.nilai}`,
    )

    // ---------- 2. Murid: skor asli + retry ----------
    await apiJson('/v1/auth/keluar', 'POST')
    await buka('/masuk')
    catat('login murid lewat API', (await masuk(AKUN_MURID)).status === 200)

    // Identitas murid diambil dari endpoint progres (bukan urutan daftar kelas).
    const profilSaya = await apiJson('/v1/progres/saya')
    const muridId = profilSaya.isi?.murid_id
    if (!muridId) throw new Error('progres murid tidak mengembalikan murid_id')

    // Percobaan pertama (asli): satu soal benar → skor asli 5 dari 10.
    const mulaiAsli = await apiJson(`/v1/kuis/${idKuisUji}/mulai`, 'POST')
    const attemptAsli = mulaiAsli.isi
    await apiJson(`/v1/attempt/${attemptAsli.id}/jawab`, 'POST', {
      question_id: idSoalUji[0],
      jawaban: SOAL_UJI[0].kunci,
    })
    const kumpulAsli = await apiJson(`/v1/attempt/${attemptAsli.id}/kumpulkan`, 'POST', {
      idempotency_key: 'smoke-05-asli',
    })
    catat(
      'percobaan pertama tersimpan sebagai skor asli',
      kumpulAsli.status === 200 &&
        kumpulAsli.isi?.skor === SOAL_UJI[0].skor &&
        kumpulAsli.isi?.asli === true &&
        attemptAsli.attempt_no === 1,
      `attempt ${attemptAsli.id} · skor ${kumpulAsli.isi?.skor}/${kumpulAsli.isi?.skor_maksimal}`,
    )

    // Percobaan kedua (ulangan ulang): dua soal benar → skor ulang 10, asli false.
    const mulaiUlang = await apiJson(`/v1/kuis/${idKuisUji}/mulai`, 'POST')
    const attemptUlang = mulaiUlang.isi
    for (const [indeks, satu] of SOAL_UJI.entries()) {
      await apiJson(`/v1/attempt/${attemptUlang.id}/jawab`, 'POST', {
        question_id: idSoalUji[indeks],
        jawaban: satu.kunci,
      })
    }
    const kumpulUlang = await apiJson(`/v1/attempt/${attemptUlang.id}/kumpulkan`, 'POST', {
      idempotency_key: 'smoke-05-ulang',
    })

    catat(
      'attempt ulangan berjalan dengan attempt_no > 1 dan asli false',
      attemptUlang.attempt_no === 2 && attemptUlang.asli === false,
      `attempt_no ${attemptUlang.attempt_no} · asli ${attemptUlang.asli}`,
    )
    catat(
      'skor ulang tercatat terpisah',
      kumpulUlang.status === 200 && kumpulUlang.isi?.skor === 10 && kumpulUlang.isi?.asli === false,
      `skor ulang ${kumpulUlang.isi?.skor}/${kumpulUlang.isi?.skor_maksimal}`,
    )

    // Peringkat saat saklar mati: murid tidak melihat isinya walau attempt asli ada.
    const mati = await apiJson(`/v1/kuis/${idKuisUji}/ranking`)
    catat(
      'murid tidak melihat peringkat saat saklar ranking mati',
      mati.status === 200 && mati.isi?.tampil === false && (mati.isi?.peringkat ?? []).length === 0 && mati.isi?.total === 1,
      `total ${mati.isi?.total} · tampil ${mati.isi?.tampil}`,
    )

    // Hasil murid memuat tautan peringkat & progres tema.
    await buka(`/hasil/${attemptUlang.id}`)
    const tautanHasil = await evalJs(`__alat.ada('Peringkat') && __alat.ada('Progres tema')`)
    catat('halaman hasil menautkan peringkat dan progres tema', tautanHasil)

    // ---------- 3. Halaman murid ----------
    await buka(`/peringkat/${idKuisUji}`)
    const peringkatMati = await evalJs(`__alat.teksMain()`)
    catat(
      'halaman peringkat memberi tahu ranking sedang dimatikan',
      peringkatMati.includes('Peringkat') && peringkatMati.includes('dimatikan guru'),
      peringkatMati.slice(0, 90),
    )

    await buka('/progres-tema')
    const progres = (await evalJs(`__alat.teksMain()`)).toLowerCase()
    catat(
      'halaman progres tema tampil dengan ambang dan remedial',
      progres.includes('progres tema') && progres.includes('latihan remedial') && progres.includes('paham ≥'),
      progres.slice(0, 90),
    )

    await buka('/badge')
    const badge = await evalJs(`__alat.teksMain()`)
    catat(
      'halaman lencana tampil per mapel',
      badge.includes('Lencana Saya') && badge.includes('nilai asli'),
      badge.slice(0, 90),
    )

    const progresApi = await apiJson('/v1/progres/saya')
    const tema = progresApi.isi?.tema ?? []
    const remedial = progresApi.isi?.remedial ?? {}
    catat(
      'API progres: tema berlabel tingkat dan remedial aktif tanpa kunci',
      tema.length > 0 &&
        tema.every((satu) => typeof satu.tingkat === 'string') &&
        remedial.diaktifkan === true &&
        !JSON.stringify(remedial.soal ?? []).toLowerCase().includes('kunci'),
      `tema ${tema.length} · soal remedial ${(remedial.soal ?? []).length}`,
    )

    // ---------- 4. Guru menyalakan ranking ----------
    await apiJson('/v1/auth/keluar', 'POST')
    await buka('/masuk')
    await masuk(AKUN_GURU)
    const rankingNyala = await atur('ranking', true)
    catat('guru menyalakan ranking', rankingNyala.isi?.pengaturan?.ranking?.nilai === true)

    // Skor asli tidak berubah walau ada skor ulang yang lebih tinggi.
    const laporan = await apiJson(`/v1/kuis/${idKuisUji}/laporan`)
    const barisMurid = (laporan.isi?.murid ?? []).find((m) => m.murid_id === muridId)
    const temaMurid = (barisMurid?.tema ?? []).find((t) => t.tag_nama === NAMA_TAG)
    const peringkatApi = await apiJson(`/v1/kuis/${idKuisUji}/ranking?top=5`)
    const barisAsli = (peringkatApi.isi?.peringkat ?? []).find((p) => p.murid_id === muridId)
    const attemptUlangDiPeringkat = (peringkatApi.isi?.peringkat ?? []).some((p) => p.attempt_id === attemptUlang.id)
    catat(
      'ranking memakai attempt asli, bukan attempt ulang',
      peringkatApi.isi?.tampil === true &&
        barisAsli !== undefined &&
        barisAsli.attempt_id === attemptAsli.id &&
        barisAsli.skor === SOAL_UJI[0].skor &&
        attemptUlangDiPeringkat === false &&
        peringkatApi.isi?.peringkat_saya === null,
      `peringkat attempt ${barisAsli?.attempt_id} (asli ${attemptAsli.id}) · retry attempt ${attemptUlang.id} · skor asli ${barisAsli?.skor}`,
    )
    catat(
      'laporan per tema tersedia untuk guru dengan ambang pengaturan',
      laporan.status === 200 &&
        laporan.isi?.ambang?.ambang_paham > 0 &&
        temaMurid !== undefined &&
        temaMurid.jumlah_soal === 2,
      `ambang ${laporan.isi?.ambang?.ambang_paham}% · tema ${temaMurid?.tag_nama} · tingkat ${temaMurid?.tingkat}`,
    )

    await buka(`/kuis/${idKuisUji}/laporan`)
    const halamanLaporan = await evalJs(`__alat.teksMain()`)
    catat(
      'halaman laporan tema tampil untuk guru',
      halamanLaporan.includes('Laporan Tema') && halamanLaporan.includes('hanya nilai asli'),
      halamanLaporan.slice(0, 90),
    )

    // ---------- 5. Murid melihat peringkat setelah saklar menyala ----------
    await apiJson('/v1/auth/keluar', 'POST')
    await buka('/masuk')
    await masuk(AKUN_MURID)

    await buka(`/peringkat/${idKuisUji}`)
    const peringkatNyala = await evalJs(`__alat.teksMain()`)
    const barisSendiri = await evalJs(`__alat.hitung('tr.sorot-hangat')`)
    catat(
      'halaman peringkat menampilkan tabel dan menyorot baris murid',
      peringkatNyala.includes('Peringkat') &&
        peringkatNyala.includes('(kamu)') &&
        peringkatNyala.includes('nilai asli') &&
        barisSendiri === 1,
      `baris disorot ${barisSendiri}`,
    )
  } finally {
    // ---------- 6. Bersih-bersih ----------
    const beres = await bersihkan()
    const sisaKuis = idKuisUji > 0 ? await apiJson(`/v1/kuis/${idKuisUji}`) : { status: 404 }
    catat(
      'ulangan, soal, dan tag uji dihapus + pengaturan dipulihkan',
      beres.status === 200 && (sisaKuis.status === 404 || sisaKuis.status === 403),
      `${beres.sisa} · baca ulang kuis ${sisaKuis.status}`,
    )
  }

  await apiJson('/v1/auth/keluar', 'POST')
  // Tab yang dibuat harness ini ditutup supaya target Chrome tidak menumpuk
  // saat smoke dijalankan berulang.
  await send('Target.closeTarget', { targetId })
  ws.close()

  const gagal = hasil.filter((satu) => !satu.lolos)
  console.log('')
  console.log(`smoke slice 05: ${hasil.length - gagal.length}/${hasil.length} lulus`)
  process.exit(gagal.length === 0 ? 0 : 1)
}

main().catch((galat) => {
  console.error('smoke gagal:', galat.message)
  process.exit(1)
})
