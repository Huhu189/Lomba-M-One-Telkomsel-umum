// Smoke pemutar materi (papan 12) lewat browser sungguhan (Chrome DevTools Protocol):
// guru menyusun materi bergaya video editor (rasio bingkai + timeline + kuis sisipan
// di dalam klip) → menerbitkannya → murid membuka materinya, memutar video, dan
// **kuis di dalam video muncul sendiri saat video mencapai detiknya**.
//
// Harness ini MANDIRI: soal + kuis + materi ujinya dibuat di awal (kelas murid uji
// sendiri) dan dihapus di akhir lewat blok `finally` — jadi bisa dijalankan berulang
// dan tidak menyentuh kuis/materi milik guru lain.
//
// Berkas video yang dipakai adalah unggahan yang SUDAH ada di basis data dev
// (`video/mp4`, 5,4 MB) — harness ini tidak mengunggah apa pun.
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
// Jalankan lewat `docs/jalankan-smoke-materi.sh` supaya ketiganya dihidupkan dan
// dimatikan otomatis.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }

/** Berkas video 5,4 MB yang sudah selesai diunggah di DB dev (mime video/mp4). */
const KODE_VIDEO = 'XZhNiQ6Q9FlH2IYEvN2dxS1IFnKYi36c'

/** Detik jatuh kuis di dalam video; harus di dalam jendela klip media (0–60). */
const DETIK_KUIS = 20

/**
 * Pemilih daftar bagian materi murid.
 *
 * Sejak tema perjalanan (A.34) halaman murid memuat DUA daftar `<ol>`: daftar pos
 * peta (`.jelajah-daftar`) dan daftar bagian materi. Pemilih `ol li` yang lama
 * ikut menghitung pos peta, sehingga harness membaca halaman yang salah. Yang ini
 * sengaja mengecualikan daftar pos.
 */
const SEL_DAFTAR_BAGIAN = 'ol.list-unstyled:not(.jelajah-daftar) > li'

/**
 * Teks penjelasan setelah kuis yang disimpan "guru" di harness ini (A.38).
 * Dipakai untuk membuktikan penjelasan muncul HANYA sesudah kuis dikumpulkan.
 */
const PENJELASAN_UJI = 'SMOKE-MATERI: 5 + 5 = 10 karena 5 ditambah 5.'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alat bantu di sisi halaman (disuntik ulang setiap navigasi). */
const ALAT = `window.__alat = {
  ada(teks) { return (document.querySelector('main')?.innerText ?? document.body.innerText ?? '').includes(teks) },
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

  const tunggu = async (ekspresi, batas = 15000) => {
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
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '')
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
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '')
      const res = await fetch('/api${jalur}', {
        method: '${metode}',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: ${muatan === null ? 'null' : `JSON.stringify(${JSON.stringify(muatan)})`},
      })
      return { status: res.status, isi: await res.json().catch(() => null) }
    })()`)

  const keluar = () => apiJson('/v1/auth/keluar', 'POST')

  let idMateri = 0
  let idKuisUji = 0
  /** @type {number[]} */
  const idSoalUji = []

  /** Hapus seluruh data uji (lulus maupun gagal) supaya harness bisa diulang. */
  const bersihkan = async () => {
    await keluar()
    await masuk(AKUN_GURU)

    let status = 0
    if (idMateri > 0) status = (await apiJson(`/v1/materi/${idMateri}`, 'DELETE')).status
    if (idKuisUji > 0) status = (await apiJson(`/v1/kuis/${idKuisUji}`, 'DELETE')).status
    for (const idSoal of idSoalUji) {
      const hapus = await apiJson(`/v1/soal/${idSoal}`, 'DELETE')
      if (hapus.status !== 200) status = hapus.status
    }

    return { status, sisa: `materi ${idMateri} · kuis ${idKuisUji} · soal ${idSoalUji.join(',')}` }
  }

  await buka('/')

  // --- 1. Guru menyiapkan kuis sisipan + materi bergaya video editor ---
  const guruMasuk = await masuk(AKUN_GURU)
  catat('guru masuk', guruMasuk.status === 200, guruMasuk.email ?? '')

  const daftarMurid = await apiJson('/v1/murid?per_page=100')
  const semuaMurid = Array.isArray(daftarMurid.isi) ? daftarMurid.isi : (daftarMurid.isi?.data ?? [])
  const muridUji = semuaMurid.find((satu) => satu.email === AKUN_MURID.email)
  const kelasId = muridUji?.class_id ?? null
  catat('murid uji ada di kelas yang diketahui', kelasId !== null, `kelas ${kelasId} · ${muridUji?.kelas_nama ?? '—'}`)
  if (kelasId === null) throw new Error('murid uji tidak ada di DB dev — jalankan seeder')

  const daftarMapel = await apiJson('/v1/mapel')
  const mapelId = (daftarMapel.isi ?? []).find((satu) => satu.nama === 'Matematika')?.id
  if (!mapelId) throw new Error('mapel Matematika tidak ada di DB dev')

  const mulai = new Date(Date.now() - 60_000).toISOString()
  const selesai = new Date(Date.now() + 45 * 60_000).toISOString()

  try {
    const buatSoal = await apiJson('/v1/soal', 'POST', {
      subject_id: mapelId,
      tipe: 'pilihan_ganda',
      konten: {
        teks: 'SMOKE-MATERI: berapa hasil dari 5 + 5?',
        opsi: [
          { id: 'A', teks: '9' },
          { id: 'B', teks: '10' },
        ],
      },
      kunci: { jawaban: 'B' },
      skor: 5,
      aktif: true,
    })
    if (buatSoal.status !== 201) throw new Error(`gagal membuat soal uji: ${buatSoal.status}`)
    idSoalUji.push(buatSoal.isi.id)

    const buatKuis = await apiJson('/v1/kuis', 'POST', {
      judul: 'SMOKE-MATERI Kuis Sisipan',
      deskripsi: 'Kuis sementara untuk smoke pemutar materi.',
      subject_id: mapelId,
      class_id: kelasId,
      durasi_menit: 30,
      mulai_at: mulai,
      selesai_at: selesai,
      acak_soal: false,
      acak_opsi: false,
    })
    if (buatKuis.status !== 201) throw new Error(`gagal membuat kuis uji: ${buatKuis.status}`)
    idKuisUji = buatKuis.isi.id

    await apiJson(`/v1/kuis/${idKuisUji}/soal`, 'PUT', { soal: idSoalUji })
    await apiJson(`/v1/kuis/${idKuisUji}/publikasi`, 'POST')

    const buatMateri = await apiJson('/v1/materi', 'POST', {
      judul: 'SMOKE-MATERI Pemutar Video',
      deskripsi: 'Materi sementara: kuis di dalam klip video.',
      subject_id: mapelId,
      class_id: kelasId,
    })
    if (buatMateri.status !== 201) throw new Error(`gagal membuat materi uji: ${buatMateri.status}`)
    idMateri = buatMateri.isi.id

    // --- 2. Sinkron blok: rasio bingkai + pengaturan tampilan + timeline ---
    const blok = [
      {
        tipe: 'media',
        wajib: true,
        isi: { unggahan_kode: KODE_VIDEO, keterangan: 'Klip smoke' },
        track: 0,
        mulai_detik: 0,
        durasi_detik: 60,
        tampilan: { fit: 'cover', fokus_x: 20, fokus_y: 80, zoom: 1.5 },
      },
      {
        tipe: 'kuis',
        wajib: true,
        quiz_id: idKuisUji,
        // Penjelasan opsional setelah kuis (A.38): teks saja, tanpa media.
        isi: { penjelasan: { teks: PENJELASAN_UJI, unggahan_kode: null } },
        track: 1,
        mulai_detik: DETIK_KUIS,
        durasi_detik: 10,
        tampilan: { mode: 'jeda', tata: 'vertikal' },
      },
      { tipe: 'teks', wajib: true, isi: { teks: 'Penutup.' }, track: 0, mulai_detik: 70, durasi_detik: 10 },
    ]

    const sinkron = await apiJson(`/v1/materi/${idMateri}/blok`, 'PUT', { rasio: '9:16', blok })

    catat(
      'guru menyimpan rasio bingkai + tampilan klip (dinormalkan server)',
      sinkron.status === 200 && sinkron.isi?.rasio === '9:16' && sinkron.isi?.blok?.[0]?.tampilan?.fit === 'cover' &&
        sinkron.isi?.blok?.[1]?.tampilan?.mode === 'jeda',
      `status ${sinkron.status} · rasio ${sinkron.isi?.rasio}`,
    )
    catat(
      'blok teks tidak punya pengaturan tampilan (diabaikan server)',
      sinkron.isi?.blok?.[2]?.tampilan === null,
      `tampilan ${JSON.stringify(sinkron.isi?.blok?.[2]?.tampilan)}`,
    )
    catat(
      'penjelasan setelah kuis tersimpan di blok kuis',
      sinkron.isi?.blok?.[1]?.penjelasan?.teks === PENJELASAN_UJI,
      `teks “${sinkron.isi?.blok?.[1]?.penjelasan?.teks ?? '—'}”`,
    )

    const terbit = await apiJson(`/v1/materi/${idMateri}/publikasi`, 'POST')
    catat('materi diterbitkan', terbit.status === 200, `status ${terbit.status}`)

    const idVideo = sinkron.isi.blok[0].block_id
    const idKuisBlok = sinkron.isi.blok[1].block_id
    const idTeks = sinkron.isi.blok[2].block_id

    // --- 3. Murid: urutan bagian mengikuti timeline + host_id kuis ---
    await keluar()
    const muridMasuk = await masuk(AKUN_MURID)
    catat('murid masuk', muridMasuk.status === 200, muridMasuk.email ?? '')

    const ringkasan = await apiJson(`/v1/materi/${idMateri}/progres`)
    const blokRingkas = ringkasan.isi?.blok ?? []
    const urutan = blokRingkas.map((satu) => satu.block_id)

    catat(
      'urutan bagian mengikuti timeline (bukan urutan simpan)',
      JSON.stringify(urutan) === JSON.stringify([idVideo, idKuisBlok, idTeks]),
      `urutan ${JSON.stringify(urutan)}`,
    )
    catat(
      'kuis di dalam video punya host_id = klip videonya; kuis tidak mengunci dirinya',
      blokRingkas[1]?.host_id === idVideo && blokRingkas[0]?.host_id === null && blokRingkas[1]?.boleh_dibuka === true,
      `host_id ${blokRingkas[1]?.host_id} · boleh_dibuka ${blokRingkas[1]?.boleh_dibuka}`,
    )
    catat(
      'bagian setelah video masih terkunci sampai video + kuisnya selesai',
      blokRingkas[2]?.boleh_dibuka === false,
      `boleh_dibuka ${blokRingkas[2]?.boleh_dibuka}`,
    )
    catat('rasio materi sampai ke murid', ringkasan.isi?.materi?.rasio === '9:16', `rasio ${ringkasan.isi?.materi?.rasio}`)

    // --- 4. Layar murid: buka materinya, buka klip video, jalankan kuis sisipan ---
    await buka('/materi')

    const adaMateri = await tunggu(`window.__alat.ada('SMOKE-MATERI Pemutar Video')`, 20000)
    catat('materi uji tampil di daftar materi murid', adaMateri)

    await evalJs(`window.__alat.klik('SMOKE-MATERI Pemutar Video')`)
    await tunggu(`document.querySelectorAll('${SEL_DAFTAR_BAGIAN}').length > 0`, 15000)

    const daftarBagian = await evalJs(
      `[...document.querySelectorAll('${SEL_DAFTAR_BAGIAN}')].map((li) => li.innerText.split('\\n').join(' ').trim())`,
    )
    catat(
      'kuis sisipan TIDAK dihitung sebagai bagian sendiri',
      daftarBagian.length === 2 && daftarBagian[0].includes('Bagian 1'),
      `bagian ${JSON.stringify(daftarBagian)}`,
    )

    await evalJs(
      `document.querySelectorAll('${SEL_DAFTAR_BAGIAN}')[0].querySelector('button')?.click(); true`,
    )
    const adaPemutar = await tunggu(`document.querySelectorAll('.pm-bingkai').length === 1`, 15000)
    catat('pemutar video memasang bingkai rasio terkunci', adaPemutar)

    const bingkai = await evalJs(`(() => {
      const b = document.querySelector('.pm-bingkai')
      const v = b?.querySelector('video')
      return {
        adaVideo: Boolean(v),
        rasio: b ? getComputedStyle(b).getPropertyValue('--r').trim() : null,
        adaSisipan: (document.body.innerText || '').includes('kuis di dalam video'),
        gaya: v ? v.getAttribute('style') : null,
      }
    })()`)
    catat(
      'bingkai memakai rasio 9:16 dari guru',
      Math.abs(Number(bingkai.rasio) - 9 / 16) < 0.001,
      `--r = ${bingkai.rasio}`,
    )
    catat(
      'pemutar memberi tahu ada kuis di dalam video',
      bingkai.adaVideo === true && bingkai.adaSisipan === true,
      `video ${bingkai.adaVideo} · keterangan ${bingkai.adaSisipan}`,
    )
    catat(
      'gaya media mengikuti pengaturan guru (cover + titik fokus 20%/80% + zoom 1.5)',
      typeof bingkai.gaya === 'string' &&
        bingkai.gaya.includes('object-fit: cover') &&
        bingkai.gaya.includes('20% 80%') &&
        bingkai.gaya.includes('scale(1.5)'),
      bingkai.gaya ?? '(tanpa gaya)',
    )

    // Tunggu video siap, lalu bawa ke detik kuis seperti menonton sungguhan.
    const videoSiap = await tunggu(`document.querySelector('.pm-bingkai video')?.readyState >= 1`, 25000)
    catat('berkas video termuat di pemutar', videoSiap)

    await evalJs(`(() => {
      const v = document.querySelector('.pm-bingkai video')
      v.currentTime = ${DETIK_KUIS + 1}
      v.dispatchEvent(new Event('timeupdate', { bubbles: true }))
      return v.currentTime
    })()`)

    const adaKuis = await tunggu(`document.querySelectorAll('.pm-kuis').length === 1`, 20000)
    catat('kuis di dalam video muncul sendiri saat video mencapai detiknya', adaKuis)

    const isiKuis = await evalJs(`(() => {
      const p = document.querySelector('.pm-kuis')
      const v = document.querySelector('.pm-bingkai video')
      return {
        teks: (p?.innerText ?? '').split('\\n').join(' ').slice(0, 220),
        adaSoal: (p?.innerText ?? '').includes('Soal 1'),
        dijeda: v ? v.paused : null,
      }
    })()`)
    catat('panel kuis memuat soal latihan dari bank soal', isiKuis.adaSoal === true, isiKuis.teks.slice(0, 120))
    catat('mode "jeda": video berhenti di titik kuis', isiKuis.dijeda === true, `paused = ${isiKuis.dijeda}`)

    // Penjelasan guru (opsional) harus MUNCUL hanya sesudah kuis dikumpulkan.
    catat(
      'penjelasan belum tampil sebelum kuis dikumpulkan',
      (await evalJs(`document.querySelectorAll('.pm-penjelasan').length`)) === 0,
    )
    await evalJs(`document.querySelector('.pm-kuis input[value="B"]').click(); true`)
    catat(
      'murid memilih jawaban kuis sisipan',
      await tunggu(`document.querySelector('.pm-kuis input[value="B"]').checked === true`),
    )
    catat('murid mengumpulkan latihan sisipan', await tunggu(`window.__alat.klik('Simpan jawaban & kumpulkan')`))

    const adaPenjelasan = await tunggu(
      `(document.querySelector('.pm-penjelasan')?.innerText ?? '').includes(${JSON.stringify(PENJELASAN_UJI)})`,
      20000,
    )
    const isiPenjelasan = await evalJs(
      `(document.querySelector('.pm-penjelasan')?.innerText ?? '').split('\\n').join(' ').slice(0, 160)`,
    )
    catat('penjelasan guru tampil setelah kuis selesai', adaPenjelasan, isiPenjelasan)

    // Server tetap penentu: video belum boleh ditutup sebelum kuis wajibnya selesai.
    const tutupVideo = await apiJson(`/v1/materi/${idMateri}/blok/${idVideo}/selesai`, 'POST')
    catat(
      'server menolak menutup video sebelum kuis wajibnya selesai',
      tutupVideo.status === 422,
      `status ${tutupVideo.status}`,
    )
  } finally {
    // --- 5. Bersih-bersih: materi + kuis + soal uji dihapus ---
    const beres = await bersihkan()
    const sisaMateri = idMateri > 0 ? await apiJson(`/v1/materi/${idMateri}`) : { status: 404 }
    catat(
      'materi, kuis, dan soal uji dihapus lagi',
      beres.status === 200 && (sisaMateri.status === 404 || sisaMateri.status === 403),
      `${beres.sisa} · baca ulang materi ${sisaMateri.status}`,
    )
  }

  await keluar()
  // Tab harness ditutup supaya target Chrome tidak menumpuk saat smoke diulang.
  await send('Target.closeTarget', { targetId })
  ws.close()

  const gagal = hasil.filter((satu) => !satu.lolos)
  console.log('')
  console.log(`smoke pemutar materi: ${hasil.length - gagal.length}/${hasil.length} lulus`)
  process.exit(gagal.length === 0 ? 0 : 1)
}

main().catch((galat) => {
  console.error('smoke gagal:', galat.message)
  process.exit(1)
})
