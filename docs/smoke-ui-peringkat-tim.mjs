// Smoke papan peringkat MODE TIM lewat browser sungguhan (Chrome DevTools
// Protocol) — satu kasus nyata dari ujung ke ujung, seperti pasangan
// `smoke-ui-peringkat.mjs` yang menguji mode individu.
//
// yang dijalankan: guru menyiapkan ulangan dan membagi muridnya jadi dua tim,
// lalu MENYALAKAN mode tim; satu murid dari setiap tim mengerjakan ulangan itu
// lewat layarnya sendiri; guru membuka papan peringkat dan murid melihat
// halaman peringkatnya.
//
// Yang dibuktikan:
//
// 1. yang diperingkat adalah TIM, bukan anak: satu baris per tim walau dua
//    anggotanya memakai akun masing-masing, lengkap dengan nama anggotanya;
// 2. aturan N% teratas berlaku untuk tim juga (2 tim dengan 40% → 1 baris), dan
//    bahasa di layar murid ikut berubah ("nomor peringkat timmu", "skor timmu");
// 3. bonus penyemangat TIDAK berlaku di papan tim: yang tampil adalah nilai
//    kelompok apa adanya (saklarnya boleh menyala, tetapi bukan untuk kelompok),
//    dan tetap tidak ada satu pun kata "dibantu" di layar murid.
//
// Harness ini MANDIRI: tag, empat soal, kuis, dua tim, dan empat akun muridnya
// dibuat di awal lalu dihapus di akhir (kuis dihapus lebih dulu karena `teams`,
// `team_members`, dan `attempts` meng-cascade dari kuis).
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }

const KUNCI = 'B'
const SALAH = 'A'
const SOAL_UJI = [1, 2, 3, 4].map((nomor) => ({
  teks: `SMOKE-T: berapa hasil dari ${nomor} + ${nomor}?`,
  opsi: [
    { id: 'A', teks: String(nomor) },
    { id: 'B', teks: String(nomor * 2) },
    { id: 'C', teks: String(nomor * 3) },
  ],
  kunci: KUNCI,
  skor: 5,
}))

/**
 * Empat murid uji untuk dua tim (Merah = A+B, Biru = C+D).
 *
 * Satu anak per tim yang benar-benar mengerjakan — mode tim memakai SATU attempt
 * bersama, jadi mengerjakan dari akun kedua akan menyentuh attempt yang sama.
 */
const MURID_UJI = ['A', 'B', 'C', 'D'].map((huruf) => ({ huruf, nama: `SMOKE-T ${huruf}` }))
const TIM = [
  { nama: 'SMOKE-T Merah', huruf: ['A', 'B'], pengerja: 'A', benar: 4 },
  { nama: 'SMOKE-T Biru', huruf: ['C', 'D'], pengerja: 'C', benar: 1 },
]

const SANDI_MURID = 'Passw0rd!Aman'
const CAP = Date.now().toString(36)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alat bantu di sisi halaman (disuntik ulang setiap navigasi). */
const ALAT = `window.__alat = {
  teksMain() { return (document.querySelector('main')?.innerText ?? document.body.innerText).replace(/\\s+/g, ' ') },
  hitung(sel) { return document.querySelectorAll(sel).length },
  klik(teks) {
    const el = [...document.querySelectorAll('button, a')].find((x) => (x.textContent ?? '').includes(teks))
    if (!el) return false
    el.click()
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

  const tunggu = async (ekspresi, batas = 12000) => {
    const mulai = Date.now()
    while (Date.now() - mulai < batas) {
      if (await evalJs(`Boolean(${ekspresi})`)) return true
      await sleep(250)
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

  const gantiAkun = async (akun) => {
    await apiJson('/v1/auth/keluar', 'POST')
    await buka('/masuk')
    return masuk(akun)
  }

  /** Setel satu aturan untuk KUIS UJI ini, lalu baca kembali resolusinya. */
  const atur = async (kunci, nilai) => {
    const simpan = await apiJson('/v1/pengaturan', 'PUT', {
      lingkup: 'kuis', lingkup_id: idKuisUji, kunci, nilai,
    })
    const baca = await apiJson(`/v1/pengaturan?kuis_id=${idKuisUji}`)

    return { status: simpan.status, isi: baca.isi }
  }

  const mulai = new Date(Date.now() - 60_000).toISOString()
  const selesai = new Date(Date.now() + 3_600_000).toISOString()

  /** @type {number[]} */ const idSoalUji = []
  /** @type {Array<{ id: number, email: string, nama: string, huruf: string }>} */ const akunMurid = []
  let idKuisUji = 0
  let idTagUji = 0
  let slugKuis = ''

  const bersihkan = async () => {
    await apiJson('/v1/auth/keluar', 'POST')
    await masuk(AKUN_GURU)

    let status = 0
    if (idKuisUji > 0) status = (await apiJson(`/v1/kuis/${idKuisUji}`, 'DELETE')).status

    let muridTerhapus = 0
    for (const satu of akunMurid) {
      const hapus = await apiJson(`/v1/murid/${satu.id}`, 'DELETE')
      if (hapus.status === 200) muridTerhapus += 1
      else status = hapus.status
    }

    for (const idSoal of idSoalUji) {
      const hapus = await apiJson(`/v1/soal/${idSoal}`, 'DELETE')
      if (hapus.status !== 200) status = hapus.status
    }
    if (idTagUji > 0) {
      const hapus = await apiJson(`/v1/tag/${idTagUji}`, 'DELETE')
      if (hapus.status !== 200) status = hapus.status
    }

    return { status, muridTerhapus, sisa: `kuis ${idKuisUji} · soal ${idSoalUji.join(',')} · tag ${idTagUji}` }
  }

  try {
    // ---------- 1. Guru menyiapkan ulangan + dua tim ----------
    await buka('/masuk')
    catat('guru masuk', (await masuk(AKUN_GURU)).status === 200)

    const daftarMapel = await apiJson('/v1/mapel')
    const daftarKelas = await apiJson('/v1/kelas')
    const mapel = (daftarMapel.isi?.data ?? daftarMapel.isi ?? [])[0]
    const kelas = (daftarKelas.isi?.data ?? daftarKelas.isi ?? [])[0]
    if (!mapel || !kelas) throw new Error('mapel/kelas tidak ada di DB dev — jalankan seeder')

    const buatTag = await apiJson('/v1/tag', 'POST', {
      nama: `SMOKE-T Tim ${CAP}`,
      deskripsi: 'Tema sementara untuk smoke peringkat mode tim.',
    })
    if (buatTag.status !== 201) throw new Error(`gagal membuat tag: ${buatTag.status}`)
    idTagUji = buatTag.isi.id

    for (const satu of SOAL_UJI) {
      const dibuat = await apiJson('/v1/soal', 'POST', {
        subject_id: mapel.id,
        tag_id: idTagUji,
        tipe: 'pilihan_ganda',
        konten: { teks: satu.teks, opsi: satu.opsi },
        kunci: { jawaban: satu.kunci },
        skor: satu.skor,
        aktif: true,
      })
      if (dibuat.status !== 201) throw new Error(`gagal membuat soal: ${dibuat.status}`)
      idSoalUji.push(dibuat.isi.id)
    }

    for (const satu of MURID_UJI) {
      const email = `smoke.t${satu.huruf.toLowerCase()}.${CAP}@sekolah.test`
      const dibuat = await apiJson('/v1/murid', 'POST', {
        nama: satu.nama,
        email,
        class_id: kelas.id,
        kata_sandi: SANDI_MURID,
      })
      if (dibuat.status !== 201) throw new Error(`gagal membuat murid ${satu.huruf}: ${dibuat.status} ${JSON.stringify(dibuat.isi)}`)
      akunMurid.push({ id: dibuat.isi.id, email, nama: satu.nama, huruf: satu.huruf })
    }
    catat('guru menyiapkan empat murid + soal bertema', akunMurid.length === 4 && idSoalUji.length === 4, akunMurid.map((m) => m.huruf).join(','))

    const buatKuis = await apiJson('/v1/kuis', 'POST', {
      judul: `SMOKE-T Ulangan Tim ${CAP}`,
      deskripsi: 'Kasus nyata mode tim: dua tim, satu papan.',
      subject_id: mapel.id,
      class_id: kelas.id,
      durasi_menit: 30,
      mulai_at: mulai,
      selesai_at: selesai,
      acak_soal: false,
      acak_opsi: false,
    })
    if (buatKuis.status !== 201) throw new Error(`gagal membuat kuis: ${buatKuis.status}`)
    idKuisUji = buatKuis.isi.id
    slugKuis = buatKuis.isi.slug ?? String(idKuisUji)

    // Tim disusun guru satu per satu (bukan "bagi otomatis"), supaya anggota tiap
    // tim pasti akun uji yang bisa dimasuki harness ini.
    const timTersimpan = []
    for (const satu of TIM) {
      const anggota = satu.huruf.map((huruf) => akunMurid.find((m) => m.huruf === huruf).id)
      const dibuat = await apiJson(`/v1/kuis/${idKuisUji}/tim`, 'POST', { nama: satu.nama, murid: anggota })
      if (dibuat.status !== 200) throw new Error(`gagal membuat tim ${satu.nama}: ${dibuat.status} ${JSON.stringify(dibuat.isi)}`)
      timTersimpan.push(dibuat.isi?.tim)
    }

    const susun = await apiJson(`/v1/kuis/${idKuisUji}/soal`, 'PUT', { soal: idSoalUji })
    const terbit = await apiJson(`/v1/kuis/${idKuisUji}/publikasi`, 'POST')
    catat(
      'guru menyusun dua tim lalu menerbitkan ulangannya',
      timTersimpan.length === 2 &&
        timTersimpan.every((satu) => (satu?.anggota ?? []).length >= 2) &&
        susun.status === 200 &&
        terbit.status === 200,
      timTersimpan.map((satu) => `${satu?.nama}=${(satu?.anggota ?? []).length}`).join(' · '),
    )

    await atur('mode_tim', true)
    await atur('ranking', true)
    await atur('peringkat_terbuka_persen', 40)
    await atur('bonus_semangat', true)
    await atur('bonus_semangat_bawah_persen', 60)
    const bonusMaks = await atur('bonus_semangat_maks_persen', 25)
    catat(
      'guru menyalakan mode tim, peringkat (40% teratas), dan bonus penyemangat',
      bonusMaks.isi?.pengaturan?.mode_tim?.nilai === true &&
        bonusMaks.isi?.pengaturan?.peringkat_terbuka_persen?.nilai === 40 &&
        bonusMaks.isi?.pengaturan?.bonus_semangat?.nilai === true,
      `mode tim: ${bonusMaks.isi?.pengaturan?.mode_tim?.nilai} · sumber ${bonusMaks.isi?.pengaturan?.mode_tim?.sumber}`,
    )

    /**
     * Satu murid mengerjakan ulangan tim dari layarnya sendiri.
     * @param {{ email: string, nama: string, huruf: string }} murid
     * @param {number} benar
     */
    const kerjakanLewatLayar = async (murid, benar) => {
      await gantiAkun({ email: murid.email, password: SANDI_MURID })

      const timSaya = await apiJson(`/v1/kuis/${idKuisUji}/tim-saya`)
      await buka(`/kuis/${slugKuis}`)
      const adaTombol = await tunggu(`(document.body.innerText || '').includes('Kerjakan sekarang')`, 15000)
      const diklik = await evalJs(`__alat.klik('Kerjakan sekarang')`)
      const soalMuncul = await tunggu(`document.querySelector('.soal-opsi input[type="radio"]') !== null`, 15000)
      const teksLayarKerja = await evalJs(`__alat.teksMain()`)

      for (let nomor = 1; nomor <= SOAL_UJI.length; nomor++) {
        const pilih = nomor <= benar ? KUNCI : SALAH
        await evalJs(`(() => {
          const opsi = document.querySelector('.soal-opsi input[type="radio"][value="${pilih}"]')
          if (!opsi) return false
          opsi.click()
          return true
        })()`)
        await sleep(800)
        const terakhir = nomor === SOAL_UJI.length
        await evalJs(`__alat.klik(${terakhir ? "'Periksa & kumpulkan'" : "'Selanjutnya'"})`)
        await sleep(terakhir ? 400 : 900)
      }

      await sleep(1200)
      await evalJs(`(() => {
        const tombol = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'Kumpulkan')
        if (!tombol) return false
        tombol.click()
        return true
      })()`)
      const terkumpul = await tunggu(
        `(document.body.innerText || '').toLowerCase().includes('sudah dikumpulkan')`,
        20000,
      )

      const layarHasil = await evalJs(`__alat.teksMain()`)
      const cocok = /Skor\s*(\d+)\s*\/\s*(\d+)/.exec(layarHasil)

      return {
        huruf: murid.huruf,
        tim: timSaya.isi?.tim?.nama ?? null,
        anggota: (timSaya.isi?.tim?.anggota ?? []).length,
        modeTim: timSaya.isi?.mode_tim === true,
        buka: adaTombol && diklik === true && soalMuncul,
        layarKerja: teksLayarKerja.slice(0, 90),
        terkumpul,
        skor: cocok === null ? null : Number(cocok[1]),
        maksimal: cocok === null ? null : Number(cocok[2]),
        teksHasil: layarHasil.slice(0, 110),
      }
    }

    // ---------- 2. Satu murid dari tiap tim mengerjakan lewat layarnya ----------
    const dikerjakan = []
    for (const satu of TIM) {
      const pengerja = akunMurid.find((m) => m.huruf === satu.pengerja)
      const jalannya = await kerjakanLewatLayar(pengerja, satu.benar)
      dikerjakan.push({ ...jalannya, benar: satu.benar, timDiharapkan: satu.nama })

      catat(
        `${pengerja.nama} (${satu.nama}) mengerjakan lewat layarnya sendiri (${satu.benar}/4 benar → ${satu.benar * 5} poin)`,
        jalannya.buka &&
          jalannya.modeTim === true &&
          jalannya.tim === satu.nama &&
          jalannya.anggota >= 2 &&
          jalannya.terkumpul &&
          jalannya.skor === satu.benar * 5,
        `tim ${jalannya.tim} · ${jalannya.anggota} anggota · skor ${jalannya.skor}/${jalannya.maksimal} · ${jalannya.teksHasil}`,
      )
    }

    // ---------- 3. Guru: papan TIM ----------
    await gantiAkun(AKUN_GURU)

    const papan = await apiJson(`/v1/kuis/${idKuisUji}/ranking?top=20`)
    const baris = Object.fromEntries((papan.isi?.peringkat ?? []).map((satu) => [satu.nama, satu]))
    const merah = baris['SMOKE-T Merah']
    const biru = baris['SMOKE-T Biru']

    catat(
      'papan mode tim: satu baris per TIM (bukan per anak), termasuk anggotanya',
      papan.isi?.mode_tim === true &&
        papan.isi?.total === 2 &&
        merah?.murid_id === null &&
        merah?.tim_id !== null &&
        (merah?.anggota ?? []).length === 2 &&
        biru?.murid_id === null &&
        (biru?.anggota ?? []).length === 2,
      `total ${papan.isi?.total} · Merah ${(merah?.anggota ?? []).join('+')} ${merah?.skor} · Biru ${(biru?.anggota ?? []).join('+')} ${biru?.skor}`,
    )

    catat(
      'aturan 40% teratas berlaku untuk tim juga (2 tim → 1 baris terbuka)',
      papan.isi?.terbuka_persen === 40 && papan.isi?.terbuka_jumlah === 1,
      `${papan.isi?.terbuka_persen}% → ${papan.isi?.terbuka_jumlah} baris`,
    )

    // Bonus penyemangat terbatas pada papan INDIVIDU. Saklarnya tetap menyala di
    // kuis ini (diperiksa di langkah 1), jadi kalau baris tim sampai ditambal,
    // pemeriksaan di bawah pasti merah. Tim yang nilainya jauh di bawah ambang
    // pun harus tetap terbaca apa adanya.
    catat(
      'bonus penyemangat tidak menyentuh papan tim — angka tim dibiarkan apa adanya',
      papan.isi?.bonus_aktif === false &&
        biru?.berbantuan === false &&
        biru?.bonus === 0 &&
        biru?.skor === 5 &&
        biru?.skor_tampil === 5 &&
        biru?.persen_tampil === biru?.persen &&
        merah?.berbantuan === false &&
        merah?.skor === 20,
      `bonus_aktif ${papan.isi?.bonus_aktif} · Biru ${biru?.skor}/${biru?.skor_tampil} (berbantuan ${biru?.berbantuan}) · Merah ${merah?.skor}`,
    )

    await buka(`/peringkat/${idKuisUji}`)
    const papanGuru = await evalJs(`__alat.teksMain()`)
    catat(
      'layar guru menulis papan ini sebagai papan tim',
      papanGuru.includes('Peringkat tim ·') &&
        papanGuru.startsWith('Peringkat tim') &&
        papanGuru.includes('SMOKE-T Merah') &&
        papanGuru.includes('SMOKE-T Biru'),
      papanGuru.slice(0, 90),
    )

    const selCatatan = await evalJs(`__alat.hitung('td[data-label="Catatan guru"]')`)
    const klikProyektor = await evalJs(`__alat.klik('Mode proyektor')`)
    await sleep(800)
    const selCatatanProyektor = await evalJs(`__alat.hitung('td[data-label="Catatan guru"]')`)
    const papanProyektor = await evalJs(`__alat.teksMain()`)
    catat(
      'mode proyektor tetap tersedia dan bersih dari jejak bonus di papan tim',
      selCatatan === 2 && klikProyektor === true && selCatatanProyektor === 0 && !papanProyektor.includes('dibantu'),
      `${selCatatan} sel catatan → ${selCatatanProyektor} setelah proyektor`,
    )

    // ---------- 4. Yang dilihat murid ----------
    // C: tim Biru (peringkat 2, di luar 1 baris yang dibuka) — bahasanya harus
    // bicara soal TIM, dan angka tampilannya tidak boleh membocorkan bonus.
    const c = akunMurid.find((m) => m.huruf === 'C')
    await gantiAkun({ email: c.email, password: SANDI_MURID })
    await buka(`/peringkat/${idKuisUji}`)
    const layarC = await evalJs(`__alat.teksMain()`)
    catat(
      'murid tim yang kalah membaca nilai timnya apa adanya (5 / 20) tanpa jejak bonus',
      layarC.includes('Nomor peringkat timmu belum dibuka') &&
        layarC.includes('1 tim teratas') &&
        layarC.includes('Skor timmu:') &&
        layarC.includes('5 / 20 (25%)') &&
        !layarC.includes('dibantu') &&
        !layarC.includes('Mode proyektor'),
      layarC.slice(0, 150),
    )

    // A: tim Merah (peringkat 1) — nomornya dibuka, barisnya menyala.
    const a = akunMurid.find((m) => m.huruf === 'A')
    await gantiAkun({ email: a.email, password: SANDI_MURID })
    await buka(`/peringkat/${idKuisUji}`)
    const layarA = await evalJs(`__alat.teksMain()`)
    const sorotA = await evalJs(`__alat.hitung('tr.sorot-hangat')`)
    catat(
      'murid tim juara melihat nomor timnya + barisnya tersorot',
      layarA.includes('Timmu di peringkat') && layarA.includes('(kamu)') && sorotA === 1 && !layarA.includes('dibantu'),
      `baris disorot ${sorotA} · ${layarA.slice(0, 110)}`,
    )

    // Anggota tim kedua (B dan D) melihat papan yang sama, bukan baris sendiri.
    const b = akunMurid.find((m) => m.huruf === 'B')
    await gantiAkun({ email: b.email, password: SANDI_MURID })
    const timB = await apiJson(`/v1/kuis/${idKuisUji}/tim-saya`)
    await buka(`/peringkat/${idKuisUji}`)
    const layarB = await evalJs(`__alat.teksMain()`)
    const sorotB = await evalJs(`__alat.hitung('tr.sorot-hangat')`)
    catat(
      'anggota kedua tim yang sama ikut melihat baris timnya sendiri',
      timB.isi?.tim?.nama === 'SMOKE-T Merah' &&
        layarB.includes('Timmu di peringkat') &&
        sorotB === 1,
      `tim ${timB.isi?.tim?.nama} · baris disorot ${sorotB}`,
    )
  } finally {
    // ---------- 5. Bersih-bersih ----------
    const beres = await bersihkan()
    const sisaKuis = idKuisUji > 0 ? await apiJson(`/v1/kuis/${idKuisUji}`) : { status: 404 }
    const akunSisa = akunMurid.length > 0 ? await apiJson('/v1/murid?per_page=100') : { isi: null }
    const emailSisa = (akunSisa.isi?.data ?? []).filter((satu) => String(satu.email ?? '').includes(CAP))
    catat(
      'ulangan tim, soal, tag, dan empat akun murid uji ikut terhapus',
      beres.status === 200 &&
        beres.muridTerhapus === akunMurid.length &&
        (sisaKuis.status === 404 || sisaKuis.status === 403) &&
        emailSisa.length === 0,
      `${beres.sisa} · murid terhapus ${beres.muridTerhapus}/${akunMurid.length} · baca ulang kuis ${sisaKuis.status}`,
    )
  }

  await apiJson('/v1/auth/keluar', 'POST')
  await send('Target.closeTarget', { targetId })
  ws.close()

  const gagal = hasil.filter((satu) => !satu.lolos)
  console.log('')
  console.log(`smoke peringkat tim (kasus nyata): ${hasil.length - gagal.length}/${hasil.length} lulus`)
  process.exit(gagal.length === 0 ? 0 : 1)
}

main().catch((galat) => {
  console.error('smoke gagal:', galat.message)
  process.exit(1)
})
