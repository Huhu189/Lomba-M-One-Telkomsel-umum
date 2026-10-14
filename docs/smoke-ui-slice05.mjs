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
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness guru
// memakai akun guru sungguhan (guru1@sekolah.test) — bukan akun admin seperti dulu.
// Jalur kepala sekolah diuji terpisah di `docs/smoke-ui-admin.mjs`.
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }
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
  klik(teks) {
    const tombol = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(teks))
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

  /**
   * Setel satu saklar pengaturan untuk KUIS UJI ini.
   *
   * Sejak 14 Oktober 2026 lapis **sekolah/kelas** tidak lagi bisa diubah siapa
   * pun lewat API (lihat `PengaturanPolicy`): satu guru tidak boleh memutuskan
   * untuk seluruh sekolah (K-05), dan kepala sekolah tidak menyusun ulangan.
   * Kontrol yang nyata ada di lapis **kuis** milik guru pemiliknya (S-05) — dan
   * itulah yang dipakai guru dari panel setelan di halaman kuisnya.
   */
  const atur = async (kunci, nilai) => {
    const simpan = await apiJson('/v1/pengaturan', 'PUT', {
      lingkup: 'kuis', lingkup_id: idKuisUji, kunci, nilai,
    })

    // Balasan `PUT` me-resolusi pengaturan dari PARAMETER kueri (`kuis_id`), bukan
    // dari `lingkup` di badannya — tanpa `kuis_id` ia menjawab nilai lapis
    // sekolah, dan pemeriksaan di bawah akan melihat nilai yang salah. Jadi yang
    // dibaca di sini adalah GET untuk kuis uji itu sendiri: sekaligus bukti
    // nilainya benar-benar tersimpan dan teresolusi lewat lapis kuis.
    const baca = await apiJson(`/v1/pengaturan?kuis_id=${idKuisUji}`)

    return { status: simpan.status, isi: baca.isi }
  }

  const mulai = new Date(Date.now() - 60_000).toISOString()
  const selesai = new Date(Date.now() + 3_600_000).toISOString()

  /** @type {number[]} */ const idSoalUji = []
  let idKuisUji = 0
  let idTagUji = 0

  /**
   * Hapus data uji (saat lulus maupun saat gagal).
   *
   * Pengaturan tidak perlu dipulihkan lagi: saklarnya kini menempel pada kuis
   * uji di lapis kuis, jadi ikut hilang bersama kuisnya. Dulu (saat lapis
   * sekolah masih bisa diubah) harness ini wajib memulihkan nilai sekolah karena
   * perubahan itu mengikat seluruh sekolah.
   */
  const bersihkan = async () => {
    await apiJson('/v1/auth/keluar', 'POST')
    await masuk(AKUN_GURU)

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

    // ---------- 4b. Aturan baru: keterbukaan N% teratas + bonus penyemangat ----------
    catat(
      'respons peringkat membawa aturan keterbukaan, dan guru melihat seluruh papan',
      peringkatApi.isi?.guru === true &&
        peringkatApi.isi?.terbuka_persen === 30 &&
        peringkatApi.isi?.terbuka_jumlah === 1 &&
        peringkatApi.isi?.bonus_aktif === false,
      `${peringkatApi.isi?.terbuka_persen}% → ${peringkatApi.isi?.terbuka_jumlah} baris · guru ${peringkatApi.isi?.guru}`,
    )

    // Bonus penyemangat dinyalakan dengan ambang atas sengaja (100%) supaya
    // murid uji — yang skornya separuh — pasti masuk kriteria tanpa perlu
    // menambah murid kedua di harness ini.
    await atur('bonus_semangat', true)
    await atur('bonus_semangat_bawah_persen', 100)
    const peringkatBonus = await apiJson(`/v1/kuis/${idKuisUji}/ranking?top=5`)
    const barisBonus = (peringkatBonus.isi?.peringkat ?? []).find((p) => p.murid_id === muridId)
    catat(
      'bonus menaikkan angka tampilan, sedangkan skor asli di baris itu tidak berubah',
      peringkatBonus.isi?.bonus_aktif === true &&
        barisBonus?.berbantuan === true &&
        barisBonus.bonus > 0 &&
        barisBonus.skor === SOAL_UJI[0].skor &&
        barisBonus.skor_tampil > barisBonus.skor,
      `asli ${barisBonus?.skor} → tampil ${barisBonus?.skor_tampil} (bonus ${barisBonus?.bonus})`,
    )

    await buka(`/peringkat/${idKuisUji}`)
    const papanGuru = await evalJs(`__alat.teksMain()`)
    // Tiap bagian diperiksa sendiri-sendiri supaya kegagalan berkata bagian
    // mana yang hilang — bukan sekadar "teksnya tidak cocok".
    const papanPunyaAturan = papanGuru.includes('Murid hanya melihat')
    const papanPunyaTanda = papanGuru.includes('dibantu')
    const papanPunyaAsli = papanGuru.includes('peringkat asli')
    // Kolomnya dihitung dari `data-label` tiap sel, bukan dari judul di <thead>:
    // di lebar jendela yang sempit kepala tabel disembunyikan CSS, sehingga
    // teksnya memang tidak ada di innerText walaupun kolomnya lengkap.
    const kolomCatatanGuru = await evalJs(`__alat.hitung('td[data-label="Catatan guru"]')`)
    catat(
      'papan guru menjelaskan aturan terbuka dan menandai baris yang dibantu',
      papanPunyaAturan && papanPunyaTanda && papanPunyaAsli && kolomCatatanGuru >= 1,
      `aturan ${papanPunyaAturan} · tanda ${papanPunyaTanda} · asli ${papanPunyaAsli} · sel catatan ${kolomCatatanGuru}`,
    )

    catat(
      'mode proyektor bisa dinyalakan dari papan guru',
      (await evalJs(`__alat.klik('Mode proyektor')`)) === true,
    )
    await sleep(700)
    const papanProyektor = await evalJs(`__alat.teksMain()`)
    const selCatatanProyektor = await evalJs(`__alat.hitung('td[data-label="Catatan guru"]')`)
    catat(
      'papan yang diproyeksikan bersih dari jejak bonus',
      papanProyektor.includes('Keluar mode proyektor') &&
        selCatatanProyektor === 0 &&
        !papanProyektor.includes('dibantu') &&
        !papanProyektor.includes('peringkat asli'),
      `sel catatan ${selCatatanProyektor} · ${papanProyektor.slice(0, 90)}`,
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

    // Janji "diam-diam": murid membaca angkanya, bukan kejujuran di baliknya.
    // Halaman murid TIDAK boleh memuat kata "dibantu", kolom catatan guru,
    // tombol mode proyektor, atau nama kunci apa pun yang membocorkan bonus.
    const selCatatanMurid = await evalJs(`__alat.hitung('td[data-label="Catatan guru"]')`)
    catat(
      'murid tidak melihat satu pun jejak bonus di papan peringkatnya',
      !peringkatNyala.includes('dibantu') &&
        selCatatanMurid === 0 &&
        !peringkatNyala.includes('Mode proyektor') &&
        !peringkatNyala.includes('bonus') &&
        peringkatNyala.includes('murid teratas'),
      `sel catatan ${selCatatanMurid} · ${peringkatNyala.slice(0, 90)}`,
    )

    const peringkatMuridApi = await apiJson(`/v1/kuis/${idKuisUji}/ranking`)
    const barisMuridApi = (peringkatMuridApi.isi?.peringkat ?? []).find((p) => p.murid_id === muridId)
    catat(
      'respons untuk murid tidak memuat jejak bonus sama sekali',
      barisMuridApi !== undefined &&
        barisMuridApi.berbantuan === undefined &&
        barisMuridApi.bonus === undefined &&
        barisMuridApi.skor_tampil === undefined &&
        barisMuridApi.peringkat_asli === undefined,
      `kunci yang terlihat: ${Object.keys(barisMuridApi ?? {}).join(', ')}`,
    )
  } finally {
    // ---------- 6. Bersih-bersih ----------
    const beres = await bersihkan()
    const sisaKuis = idKuisUji > 0 ? await apiJson(`/v1/kuis/${idKuisUji}`) : { status: 404 }
    catat(
      'ulangan, soal, tag, dan saklar pengaturan uji ikut terhapus',
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
