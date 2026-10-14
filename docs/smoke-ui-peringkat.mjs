// Smoke peringkat lewat browser sungguhan (Chrome DevTools Protocol) — satu
// KASUS NYATA dari ujung ke ujung, bukan potongan pemeriksaan:
//
// seorang guru menyiapkan ulangan, LIMA murid mengerjakannya (satu di antaranya
// benar-benar menekan tombol di layarnya sendiri), lalu guru membuka papan
// peringkat kelasnya dan menyalakan mode proyektor.
//
// Yang dibuktikan:
//
// 1. nomor peringkat hanya dibuka untuk 40% teratas — dari lima peserta berarti
//    dua baris; murid di bawahnya diberi tahu bahwa nomornya belum dibuka dan
//    tetap melihat skornya sendiri;
// 2. dua murid terbawah (di bawah 60%) mendapat bonus penyemangat di papan,
//    sedangkan nilai aslinya di laporan tetap apa adanya;
// 3. "diam-diam" benar-benar diam: murid yang dibantu membaca angka tampilan
//    tanpa satu pun kata "dibantu", dan papan proyektor pun bersih dari jejak itu.
//
// Harness ini MANDIRI: tag, empat soal, kuis, dan lima akun muridnya dibuat di
// awal lalu dihapus di akhir (akun muridnya ikut terhapus), jadi basis data dev
// kembali seperti semula. Kuis dihapus SEBELUM akun murid karena `attempts`
// meng-cascade dari kuis — kalau urutannya dibalik, penghapusan murid akan
// ditolak foreign key.
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }

/** Empat soal pilihan ganda berkunci sama ('B'), masing-masing 5 poin. */
const KUNCI = 'B'
const SALAH = 'A'
const SOAL_UJI = [1, 2, 3, 4].map((nomor) => ({
  teks: `SMOKE-P: berapa hasil dari ${nomor} + ${nomor}?`,
  opsi: [
    { id: 'A', teks: String(nomor) },
    { id: 'B', teks: String(nomor * 2) },
    { id: 'C', teks: String(nomor * 3) },
  ],
  kunci: KUNCI,
  skor: 5,
}))

/**
 * Lima murid uji dan jumlah jawaban benar masing-masing.
 *
 * Sengaja bertingkat supaya aturan baru terlihat utuh: dua murid di 100% (yang
 * mengisi dua kursi 40% teratas), satu di 75%, lalu dua murid yang dibantu
 * bonus — 50% dan 25%. Median kelasnya 75%, jadi keduanya ditolong sampai 75%
 * dan 50% (yang terakhir kena batas tambahan 25%).
 */
const MURID_UJI = [
  { huruf: 'A', benar: 4, lewat: 'layar' },
  { huruf: 'B', benar: 4, lewat: 'api' },
  { huruf: 'C', benar: 3, lewat: 'api' },
  { huruf: 'D', benar: 2, lewat: 'api' },
  { huruf: 'E', benar: 1, lewat: 'api' },
]

/** Kata sandi akun murid uji (dibuat lewat halaman/endpoint guru). */
const SANDI_MURID = 'Passw0rd!Aman'

/** Cap waktu untuk email, supaya sisa jalan yang gagal tidak menabrak jalannya. */
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

  /**
   * Tunggu sampai ekspresi di halaman menjadi benar (maksimal `batas` ms).
   * Dipakai untuk alur yang diklik, bukan untuk halaman yang cukup dimuat saja.
   */
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

  const gantiAkun = async (akun) => {
    await apiJson('/v1/auth/keluar', 'POST')
    await buka('/masuk')
    return masuk(akun)
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

  /**
   * Setel satu aturan untuk KUIS UJI ini (lapis kuis milik guru pemiliknya).
   * Yang dibaca kembali adalah GET resolusi kuis itu — bukan balasan PUT, yang
   * me-resolusi dari parameter kueri.
   */
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
  /** @type {Array<{ id: number, email: string, nama: string, huruf: string, benar: number }>} */
  const akunMurid = []
  let idKuisUji = 0
  let idTagUji = 0
  let slugKuis = ''

  /**
   * Hapus seluruh data uji (dijalankan saat lulus maupun saat gagal).
   * Urutannya penting: kuis dulu (attempts ikut terhapus), baru akun muridnya.
   */
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
    // ---------- 1. Guru menyiapkan ulangan ----------
    await buka('/masuk')
    catat('guru masuk', (await masuk(AKUN_GURU)).status === 200)

    const daftarMapel = await apiJson('/v1/mapel')
    const daftarKelas = await apiJson('/v1/kelas')
    const mapel = (daftarMapel.isi?.data ?? daftarMapel.isi ?? [])[0]
    const kelas = (daftarKelas.isi?.data ?? daftarKelas.isi ?? [])[0]
    if (!mapel || !kelas) throw new Error('mapel/kelas tidak ada di DB dev — jalankan seeder')

    const buatTag = await apiJson('/v1/tag', 'POST', {
      nama: `SMOKE-P Peringkat ${CAP}`,
      deskripsi: 'Tema sementara untuk smoke kasus nyata peringkat.',
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
    catat('guru menyiapkan soal bertema', idSoalUji.length === SOAL_UJI.length && idTagUji > 0, `soal ${idSoalUji.join(',')}`)

    const buatKuis = await apiJson('/v1/kuis', 'POST', {
      judul: `SMOKE-P Ulangan Lima Murid ${CAP}`,
      deskripsi: 'Kasus nyata: lima murid, satu papan, bonus penyemangat.',
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

    const susun = await apiJson(`/v1/kuis/${idKuisUji}/soal`, 'PUT', { soal: idSoalUji })
    const terbit = await apiJson(`/v1/kuis/${idKuisUji}/publikasi`, 'POST')
    catat(
      'ulangan diterbitkan untuk kelas itu',
      susun.status === 200 && terbit.status === 200 && terbit.isi?.sedang_berjalan === true,
      `kuis ${idKuisUji} (${slugKuis}) · kelas ${kelas.nama}`,
    )

    // Lima akun murid dibuat guru seperti di halaman Murid — lengkap dengan
    // kata sandi, jadi tiap anak benar-benar bisa masuk sendiri.
    for (const satu of MURID_UJI) {
      const email = `smoke.p${satu.huruf.toLowerCase()}.${CAP}@sekolah.test`
      const dibuat = await apiJson('/v1/murid', 'POST', {
        nama: `SMOKE-P ${satu.huruf}`,
        email,
        class_id: kelas.id,
        kata_sandi: SANDI_MURID,
      })
      if (dibuat.status !== 201) throw new Error(`gagal membuat murid ${satu.huruf}: ${dibuat.status} ${JSON.stringify(dibuat.isi)}`)
      akunMurid.push({ id: dibuat.isi.id, email, nama: `SMOKE-P ${satu.huruf}`, huruf: satu.huruf, benar: satu.benar })
    }
    catat('guru membuat lima akun murid di kelas itu', akunMurid.length === 5, akunMurid.map((m) => m.huruf).join(','))

    // Aturan yang diuji: nomor hanya untuk 40% teratas, bonus untuk yang di
    // bawah 60% (tambahan maksimal 25%).
    await atur('ranking', true)
    await atur('peringkat_terbuka_persen', 40)
    await atur('bonus_semangat', true)
    const bonusBawah = await atur('bonus_semangat_bawah_persen', 60)
    const bonusMaks = await atur('bonus_semangat_maks_persen', 25)
    catat(
      'guru menyalakan peringkat (40% teratas) dan bonus penyemangat (bawah 60%, maks 25%)',
      bonusBawah.isi?.pengaturan?.peringkat_terbuka_persen?.nilai === 40 &&
        bonusMaks.isi?.pengaturan?.bonus_semangat?.nilai === true &&
        bonusMaks.isi?.pengaturan?.bonus_semangat_bawah_persen?.nilai === 60 &&
        bonusMaks.isi?.pengaturan?.bonus_semangat_maks_persen?.nilai === 25,
      `sumber peringkat: ${bonusMaks.isi?.pengaturan?.peringkat_terbuka_persen?.sumber}`,
    )

    // ---------- 2. Murid A mengerjakan LEWAT LAYARNYA ----------
    await gantiAkun({ email: akunMurid[0].email, password: SANDI_MURID })

    await buka(`/kuis/${slugKuis}`)
    const adaTombolKerjakan = await tunggu(`(document.body.innerText || '').includes('Kerjakan sekarang')`, 15000)
    const diklik = await evalJs(`__alat.klik('Kerjakan sekarang')`)
    const soalMuncul = await tunggu(`document.querySelector('.soal-opsi input[type="radio"]') !== null`, 15000)
    catat(
      'murid A membuka ulangannya dari halaman kuis lalu menekan “Kerjakan sekarang”',
      adaTombolKerjakan && diklik === true && soalMuncul,
      `tombol ${adaTombolKerjakan} · soal tampil ${soalMuncul}`,
    )

    let terjawab = 0
    for (let nomor = 1; nomor <= SOAL_UJI.length; nomor++) {
      const dipilih = await evalJs(
        `(() => {
          const opsi = document.querySelector('.soal-opsi input[type="radio"][value="${KUNCI}"]')
          if (!opsi) return false
          opsi.click()
          return true
        })()`,
      )
      if (dipilih) terjawab += 1
      await sleep(800)

      const terakhir = nomor === SOAL_UJI.length
      const lanjut = await evalJs(
        `__alat.klik(${terakhir ? "'Periksa & kumpulkan'" : "'Selanjutnya'"})`,
      )
      await sleep(terakhir ? 400 : 900)
      if (!lanjut) break
    }

    const dikonfirmasi = await evalJs(`(() => {
      const tombol = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'Kumpulkan')
      if (!tombol) return false
      tombol.click()
      return true
    })()`)
    // Dibandingkan tanpa huruf besar/kecil: di layar judulnya tercetak
    // “Sudah dikumpulkan”, dan `innerText` mengembalikan teks SESUDAH gaya CSS.
    const terkumpul = await tunggu(
      `(document.body.innerText || '').toLowerCase().includes('sudah dikumpulkan')`,
      20000,
    )

    catat(
      'murid A menjawab empat soal di layar dan mengumpulkannya',
      terjawab === SOAL_UJI.length && dikonfirmasi === true && terkumpul,
      `terjawab ${terjawab}/${SOAL_UJI.length} · kumpulkan ${dikonfirmasi} · selesai ${terkumpul}`,
    )

    // Setelah dikumpulkan, aplikasi langsung memindahkan murid ke halaman hasil
    // (ada pula tautan “Lihat hasil” di banner) — jadi yang diperiksa adalah
    // angkanya benar-benar terbaca, bukan tautan mana yang terklik.
    const diklikHasil = await evalJs(`__alat.klik('Lihat hasil')`)
    const hasilTerbaca = await tunggu(`/Skor\\s*20\\s*\\/\\s*20/.test(document.body.innerText || '')`, 15000)
    const layarHasil = await evalJs(`__alat.teksMain()`)
    catat(
      'murid A melihat hasilnya sendiri: skor 20 / 20 dari empat jawaban di layar',
      hasilTerbaca && /\b20\b/.test(layarHasil),
      `tautan hasil ${diklikHasil} · hasil terbaca ${hasilTerbaca} · ${layarHasil.slice(0, 110)}`,
    )

    // ---------- 3. Empat murid lain mengerjakan (jalur server yang sama) ----------
    const skorApi = []
    for (const satu of akunMurid.slice(1)) {
      await gantiAkun({ email: satu.email, password: SANDI_MURID })

      const mulaiAttempt = await apiJson(`/v1/kuis/${idKuisUji}/mulai`, 'POST')
      const attempt = mulaiAttempt.isi
      if (mulaiAttempt.status !== 201) throw new Error(`mulai gagal untuk ${satu.nama}: ${mulaiAttempt.status}`)

      for (const [indeks, soalId] of idSoalUji.entries()) {
        const jawaban = indeks < satu.benar ? KUNCI : SALAH
        const simpan = await apiJson(`/v1/attempt/${attempt.id}/jawab`, 'POST', {
          question_id: soalId,
          jawaban,
        })
        if (simpan.status !== 200) throw new Error(`jawab gagal untuk ${satu.nama}: ${simpan.status}`)
      }

      const kumpul = await apiJson(`/v1/attempt/${attempt.id}/kumpulkan`, 'POST', {
        idempotency_key: `smoke-p-${satu.huruf}-${CAP}`,
      })
      skorApi.push({ huruf: satu.huruf, status: kumpul.status, skor: kumpul.isi?.skor, maksimal: kumpul.isi?.skor_maksimal })
    }

    // Skor tiap murid harus persis sebanyak jawaban benarnya — tidak ada yang
    // tercampur dengan nilai anak lain.
    const skorBenar = skorApi.every((satu, indeks) => satu.skor === akunMurid[indeks + 1].benar * 5)
    catat(
      'empat murid lain mengumpulkan ulangan yang sama dengan skor masing-masing',
      skorApi.length === 4 && skorApi.every((satu) => satu.status === 200) && skorBenar,
      skorApi.map((s) => `${s.huruf}=${s.skor}/${s.maksimal}`).join(' · '),
    )

    // ---------- 4. Guru: papan peringkat kelas ----------
    await gantiAkun(AKUN_GURU)

    const papan = await apiJson(`/v1/kuis/${idKuisUji}/ranking?top=20`)
    const baris = Object.fromEntries((papan.isi?.peringkat ?? []).map((satu) => [satu.nama, satu]))
    const urutan = (papan.isi?.peringkat ?? []).map((satu) => `${satu.nama.replace('SMOKE-P ', '')}=${satu.persen}%`).join(' · ')

    catat(
      'papan berisi lima murid (skor dari layar murid A ikut terhitung) dan aturan 40% teratas berlaku',
      papan.isi?.guru === true &&
        papan.isi?.total === 5 &&
        papan.isi?.terbuka_jumlah === 2 &&
        papan.isi?.terbuka_persen === 40 &&
        baris['SMOKE-P A']?.skor === 20,
      `total ${papan.isi?.total} · terbuka ${papan.isi?.terbuka_jumlah} · A ${baris['SMOKE-P A']?.skor}/${baris['SMOKE-P A']?.skor_maksimal} · ${urutan}`,
    )

    const d = baris['SMOKE-P D']
    const e = baris['SMOKE-P E']
    catat(
      'bonus menolong dua murid terbawah sampai keluar dari separuh kelas terbawah',
      d?.berbantuan === true &&
        d.skor === 10 &&
        d.skor_tampil === 15 &&
        d.persen_tampil === 75 &&
        d.peringkat_asli === 4 &&
        e?.berbantuan === true &&
        e.skor === 5 &&
        e.skor_tampil === 10 &&
        e.persen_tampil === 50 &&
        e.peringkat_asli === 5,
      `D ${d?.skor}→${d?.skor_tampil} (#${d?.peringkat_asli}) · E ${e?.skor}→${e?.skor_tampil} (#${e?.peringkat_asli})`,
    )
    catat(
      'murid yang sudah di atas ambang tidak disentuh bonusnya',
      baris['SMOKE-P C']?.berbantuan === false && baris['SMOKE-P C']?.skor === 15 && baris['SMOKE-P C']?.bonus === 0,
      `C ${baris['SMOKE-P C']?.skor}/${baris['SMOKE-P C']?.skor_maksimal} · berbantuan ${baris['SMOKE-P C']?.berbantuan}`,
    )

    // Nilai resmi tidak ikut dibonus: laporan per tema tetap 2/4 untuk D.
    const laporan = await apiJson(`/v1/kuis/${idKuisUji}/laporan`)
    const barisLaporan = (laporan.isi?.murid ?? []).find((satu) => satu.nama === 'SMOKE-P D')
    const temaD = barisLaporan?.tema?.[0]
    catat(
      'laporan guru tetap memakai nilai asli (tanpa bonus)',
      laporan.status === 200 && temaD?.jumlah_benar === 2 && temaD?.jumlah_soal === 4 && temaD?.persen === 50,
      `D di laporan ${temaD?.jumlah_benar}/${temaD?.jumlah_soal} (${temaD?.persen}%)`,
    )

    // Papan yang dilihat guru di layarnya.
    await buka(`/peringkat/${idKuisUji}`)
    const papanGuru = await evalJs(`__alat.teksMain()`)
    const selCatatan = await evalJs(`__alat.hitung('td[data-label="Catatan guru"]')`)
    const selDibantu = await evalJs(
      `[...document.querySelectorAll('td[data-label="Catatan guru"]')].filter((td) => td.innerText.includes('dibantu')).length`,
    )
    catat(
      'papan guru menandai baris yang dibantu lengkap dengan nilai aslinya',
      selCatatan === 5 && selDibantu === 2 && papanGuru.includes('nilai asli 10 / 20') && papanGuru.includes('peringkat asli #4'),
      `${selCatatan} sel catatan · ${selDibantu} bertanda dibantu`,
    )

    const diklikProyektor = await evalJs(`__alat.klik('Mode proyektor')`)
    await sleep(800)
    const papanProyektor = await evalJs(`__alat.teksMain()`)
    const selCatatanProyektor = await evalJs(`__alat.hitung('td[data-label="Catatan guru"]')`)
    catat(
      'mode proyektor menampilkan papan yang sama dengan papan murid (tanpa jejak bonus)',
      diklikProyektor === true &&
        selCatatanProyektor === 0 &&
        !papanProyektor.includes('dibantu') &&
        papanProyektor.includes('15 / 20 (75%)'),
      `${selCatatanProyektor} sel catatan · ${papanProyektor.slice(0, 80)}`,
    )

    // ---------- 5. Yang dilihat murid ----------
    // E: paling bawah (25% asli) — di layarnya terbaca 50%, tanpa kata "dibantu".
    await gantiAkun({ email: akunMurid[4].email, password: SANDI_MURID })
    await buka(`/peringkat/${idKuisUji}`)
    const layarE = await evalJs(`__alat.teksMain()`)
    catat(
      'murid E membaca angka tampilannya (10 / 20, 50%) tanpa tahu ia dibantu',
      layarE.includes('Nomor peringkatmu belum dibuka') &&
        layarE.includes('10 / 20 (50%)') &&
        !layarE.includes('dibantu') &&
        !layarE.includes('Mode proyektor') &&
        (await evalJs(`__alat.hitung('td[data-label="Catatan guru"]')`)) === 0,
      layarE.slice(0, 130),
    )

    // D: juga dibantu (10 → 15 poin) dan juga di luar dua baris teratas.
    await gantiAkun({ email: akunMurid[3].email, password: SANDI_MURID })
    await buka(`/peringkat/${idKuisUji}`)
    const layarD = await evalJs(`__alat.teksMain()`)
    catat(
      'murid D (benar-benar 10/20) membaca 15 / 20 di papannya sendiri',
      layarD.includes('Nomor peringkatmu belum dibuka') && layarD.includes('15 / 20 (75%)') && !layarD.includes('dibantu'),
      layarD.slice(0, 130),
    )

    // A: peringkat 1 → nomornya dibuka, barisnya tersorot.
    await gantiAkun({ email: akunMurid[0].email, password: SANDI_MURID })
    await buka(`/peringkat/${idKuisUji}`)
    const layarA = await evalJs(`__alat.teksMain()`)
    const sorotA = await evalJs(`__alat.hitung('tr.sorot-hangat')`)
    catat(
      'murid A (peringkat 1) melihat nomornya sendiri dan barisnya tersorot',
      layarA.includes('Kamu di peringkat') && layarA.includes('(kamu)') && sorotA === 1 && !layarA.includes('dibantu'),
      `baris disorot ${sorotA} · ${layarA.slice(0, 100)}`,
    )

    // C: peringkat 3 (di luar 2 baris teratas) → nomornya tidak dibuka walau nilainya baik.
    await gantiAkun({ email: akunMurid[2].email, password: SANDI_MURID })
    await buka(`/peringkat/${idKuisUji}`)
    const layarC = await evalJs(`__alat.teksMain()`)
    catat(
      'murid C (peringkat 3, nilai 75%) tidak menerima nomor karena di luar 40% teratas',
      layarC.includes('Nomor peringkatmu belum dibuka') && layarC.includes('15 / 20 (75%)') && !layarC.includes('(kamu)'),
      layarC.slice(0, 130),
    )
  } finally {
    // ---------- 6. Bersih-bersih ----------
    const beres = await bersihkan()
    const sisaKuis = idKuisUji > 0 ? await apiJson(`/v1/kuis/${idKuisUji}`) : { status: 404 }
    const akunSisa = akunMurid.length > 0 ? await apiJson('/v1/murid?per_page=100') : { isi: null }
    const emailSisa = (akunSisa.isi?.data ?? []).filter((satu) => String(satu.email ?? '').includes(CAP))
    catat(
      'ulangan, soal, tag, dan lima akun murid uji ikut terhapus',
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
  console.log(`smoke peringkat (kasus nyata): ${hasil.length - gagal.length}/${hasil.length} lulus`)
  process.exit(gagal.length === 0 ? 0 : 1)
}

main().catch((galat) => {
  console.error('smoke gagal:', galat.message)
  process.exit(1)
})
