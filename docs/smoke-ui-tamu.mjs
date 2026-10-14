// Smoke mode tamu lewat browser sungguhan (Chrome DevTools Protocol).
//
// Yang dibuktikan di sini hanya bisa dibuktikan dari sisi peramban: formulir tamu
// yang benar-benar dirender, kode perangkat yang benar-benar disimpan
// `localStorage`, dan aturan "tamu yang menekan Keluar membuang kode perangkatnya"
// (supaya komputer yang dipakai bergantian tidak mewariskan akun).
//
// Prasyarat: backend 8000, vite 5173, realtime 4000, Chrome --remote-debugging-port=9333
// (jalankan lewat `docs/jalankan-smoke-ui.sh tamu`).
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness guru
// memakai akun guru sungguhan (guru1@sekolah.test) — bukan akun admin seperti dulu.
// Jalur kepala sekolah diuji terpisah di `docs/smoke-ui-admin.mjs`.
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }
const KUNCI_PERANGKAT = 'ulangan:perangkat-tamu'
const NAMA_TAMU = 'Tamu Smoke Perangkat'
const NOMOR_HP_SALAH = 'bukan-perangkat-123456'

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
  klikTeks(teks) {
    const el = [...document.querySelectorAll('button, a')].find((b) => b.textContent.trim().includes(teks))
    if (!el) throw new Error('tombol tidak ada: ' + teks)
    el.click()
    return true
  },
  isiTamu(nama) {
    const form = document.querySelector('section.auth-tamu form')
    if (!form) throw new Error('formulir tamu tidak ada')
    const el = form.querySelector('input#nama-input') ?? form.querySelector('input')
    if (!el) throw new Error('kolom nama tamu tidak ada')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, nama)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    form.requestSubmit()
    return true
  },
  kode() { return window.localStorage.getItem('${KUNCI_PERANGKAT}') },
  teksTamu() {
    const bagian = document.querySelector('section.auth-tamu')
    return bagian ? bagian.innerText.replace(/\\\\s+/g, ' ') : null
  },
  /**
   * Pintu tamu muncul SEBELUM kolom email di halaman masuk?
   * Dihitung dari urutan dokumen (bukan urutan CSS), karena yang dibaca anak
   * adalah urutan yang sama dengan pembaca layar & tombol Tab.
   */
  tamuDiAtasAkun() {
    const tamu = document.querySelector('section.auth-tamu')
    const email = document.querySelector('input[type="email"]')
    if (!tamu || !email) return null
    return Boolean(tamu.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING)
  },
  /** Formulir akun sekolah dilipat (details tertutup) di halaman masuk tautan? */
  akunTerlipat() {
    const lipat = [...document.querySelectorAll('details')].find((d) => d.querySelector('input[type="password"]'))
    return lipat ? lipat.open === false : null
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
  /** Id kuis/soal pintu tamu uji — dihapus kembali di bagian bersih-bersih. */
  let kuisTamuId = 0
  let soalTamuId = 0

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

  /** Siapa yang sedang masuk menurut server (dipakai untuk membandingkan id tamu). */
  const saya = async () => {
    const r = await evalJs(
      `fetch('/api/v1/auth/saya', { credentials: 'include', headers: { Accept: 'application/json' } })
        .then((x) => x.json()).then((d) => ({ id: d.id ?? null, isTamu: d.isTamu ?? false, nama: d.name ?? null }))`,
    )

    return r
  }

  const masuk = async (akun) => {
    for (let coba = 0; coba < 3; coba++) {
      const r = await evalJs(`(async () => {
        await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
        const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
        const res = await fetch('/api/v1/auth/masuk', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
          body: JSON.stringify(${JSON.stringify(akun)}),
        })
        return { status: res.status }
      })()`)

      if (r.status !== 429) return r

      console.log('   (batas masuk per menit tercapai, menunggu 20 detik…)')
      await sleep(20_000)
    }

    return { status: 429 }
  }

  /**
   * Siapkan satu kuis TERBIT yang membuka pintu tamu untuk guru ini.
   *
   * Formulir "masuk sebagai siswa tamu" hanya tampil bila ada kuis terbit yang
   * membuka pintunya (atau lapis sekolah menyala — dan lapis itu tidak bisa
   * diubah siapa pun lewat API sejak 14 Oktober 2026, lihat `PengaturanPolicy`).
   *
   * @returns {Promise<number>} id kuis (0 bila gagal disiapkan)
   */
  const siapkanKuisTamu = async () => {
    const mapel = await apiJson('/v1/mapel')
    const kelas = await apiJson('/v1/kelas')
    const mapelId = (Array.isArray(mapel.isi) ? mapel.isi : (mapel.isi?.data ?? []))[0]?.id
    const kelasId = (Array.isArray(kelas.isi) ? kelas.isi : (kelas.isi?.data ?? []))[0]?.id
    if (!mapelId || !kelasId) return 0

    const soal = await apiJson('/v1/soal', 'POST', {
      subject_id: mapelId,
      tipe: 'pilihan_ganda',
      konten: {
        teks: 'Soal pintu tamu (smoke mode tamu).',
        opsi: [
          { id: 'a', teks: 'A' },
          { id: 'b', teks: 'B' },
        ],
      },
      kunci: { jawaban: 'a' },
      skor: 1,
    })
    if (soal.status !== 201) return 0
    soalTamuId = soal.isi.id

    const kuis = await apiJson('/v1/kuis', 'POST', {
      judul: `Pintu tamu uji ${Date.now()}`,
      subject_id: mapelId,
      class_id: kelasId,
      durasi_menit: 10,
      mulai_at: new Date(Date.now() - 60_000).toISOString(),
      selesai_at: new Date(Date.now() + 3_600_000).toISOString(),
    })
    if (kuis.status !== 201) return 0
    kuisTamuId = kuis.isi.id

    await apiJson(`/v1/kuis/${kuisTamuId}/soal`, 'PUT', { soal: [soalTamuId] })
    const terbit = await apiJson(`/v1/kuis/${kuisTamuId}/publikasi`, 'POST')
    if (terbit.status !== 200) return 0

    const pintu = await apiJson('/v1/pengaturan', 'PUT', {
      lingkup: 'kuis', lingkup_id: kuisTamuId, kunci: 'izinkan_tamu', nilai: true,
    })

    return pintu.status === 200 ? kuisTamuId : 0
  }

  // ---------- 0. Guru membuka pintu tamu lewat satu kuis terbit miliknya ----------
  //
  // Dulu di sini ada `PUT /v1/pengaturan` lingkup SEKOLAH oleh admin. Sejak
  // 14 Oktober 2026 lapis sekolah/kelas tidak bisa diubah siapa pun lewat API
  // (`PengaturanPolicy`), jadi pintunya dibuka di lapis KUIS — jalur yang memang
  // dipakai guru: `TamuService::tersedia()` menyala begitu ada kuis terbit yang
  // membuka pintunya.
  await buka('/masuk')
  const masukGuru = await masuk(AKUN_GURU)
  catat('login guru lewat API', masukGuru.status === 200, `status ${masukGuru.status}`)

  // Pintu tamu harus TERTUTUP sebelum kita membukanya sendiri. Kalau tidak, ada
  // kuis terbit yang tertinggal dari jalan sebelumnya dan pemeriksaan terakhir
  // ("mode tamu kembali mati") akan gagal karena sisa itu — bukan karena
  // bersih-bersih run ini. Dulu guru yang gagal menghapus kuisnya meninggalkan
  // kuis terbit permanen; `KuisService::hapus()` juga tidak membuang baris
  // `settings` kuis yang dihapus, jadi keadaan awal ini memang perlu diperiksa.
  const infoTamuAwal = await apiJson('/v1/tamu')
  catat(
    'pintu tamu tertutup sebelum diuji (tidak ada kuis terbit sisa)',
    infoTamuAwal.isi?.diizinkan === false,
    infoTamuAwal.isi?.diizinkan === false
      ? 'diizinkan=false'
      : 'diizinkan=true — ada kuis TERBIT yang masih membuka mode tamu (sisa jalan gagal?). '
        + 'Tutup/hapus kuis itu dulu, atau pemeriksaan pembersihan di bawah akan ikut merah.',
  )

  const kuisTamu = await siapkanKuisTamu()
  const infoTamu = await apiJson('/v1/tamu')
  catat(
    'guru membuka pintu tamu lewat satu kuis terbit',
    kuisTamu > 0 && infoTamu.isi?.diizinkan === true,
    kuisTamu > 0 ? `kuis ${kuisTamu} · diizinkan=${infoTamu.isi?.diizinkan}` : 'gagal menyiapkan kuis (mapel/kelas tidak ada di DB dev?)',
  )

  await apiJson('/v1/auth/keluar', 'POST')
  await evalJs(`window.localStorage.removeItem('${KUNCI_PERANGKAT}'); true`)

  // ---------- 1. Formulir tamu tampil di halaman masuk ----------
  await buka('/masuk')
  const teksForm = await evalJs(`__alat.teksTamu()`)

  catat(
    'formulir "ikut sebagai siswa tamu" tampil dan menjelaskan perangkatnya',
    typeof teksForm === 'string' &&
      teksForm.includes('siswa tamu') &&
      teksForm.includes('perangkat yang sama'),
    (teksForm ?? '(tidak ada)').slice(0, 120),
  )

  // ---------- 2. Masuk sebagai tamu lewat formulir: kode perangkat tersimpan ----------
  await evalJs(`__alat.isiTamu(${JSON.stringify(NAMA_TAMU)})`)
  await sleep(3500)

  const kodePertama = await evalJs(`__alat.kode()`)
  const tamuPertama = await saya()

  catat(
    'tamu masuk lewat formulir dan dapat kode perangkat unik',
    tamuPertama.isTamu === true && tamuPertama.nama === NAMA_TAMU && typeof kodePertama === 'string' && kodePertama.length >= 8,
    `id=${tamuPertama.id} · kode=${(kodePertama ?? '(kosong)').slice(0, 12)}…`,
  )

  // ---------- 3. Halaman dimuat ulang: identitas perangkat tetap ----------
  await buka('/')
  const setelahMuatUlang = await saya()
  const kodeSetelahMuatUlang = await evalJs(`__alat.kode()`)

  catat(
    'muat ulang halaman: akun dan kode perangkat tidak berubah',
    setelahMuatUlang.id === tamuPertama.id && kodeSetelahMuatUlang === kodePertama,
    `id=${setelahMuatUlang.id}`,
  )

  // ---------- 4. Tekan Keluar: kode perangkat dibuang (komputer dipakai bergantian) ----------
  await evalJs(`__alat.klikTeks('Keluar')`)
  await sleep(3000)

  const kodeSetelahKeluar = await evalJs(`__alat.kode()`)
  catat('tamu menekan Keluar: kode perangkat dibuang', kodeSetelahKeluar === null, `kode=${kodeSetelahKeluar}`)

  // ---------- 5. Nama yang sama setelah Keluar = anak berbeda, bukan akun warisan ----------
  await evalJs(`__alat.isiTamu(${JSON.stringify(NAMA_TAMU)})`)
  await sleep(3500)

  const tamuKedua = await saya()
  const kodeKedua = await evalJs(`__alat.kode()`)

  catat(
    'nama sama di perangkat yang sudah dikosongkan: akun BARU (tidak mewarisi)',
    tamuKedua.isTamu === true && tamuKedua.id !== tamuPertama.id && typeof kodeKedua === 'string' && kodeKedua !== kodePertama,
    `id pertama=${tamuPertama.id} · id kedua=${tamuKedua.id}`,
  )

  // ---------- 6. Kode ngawur tidak dipakai sebagai identitas ----------
  await evalJs(`window.localStorage.setItem('${KUNCI_PERANGKAT}', ${JSON.stringify(NOMOR_HP_SALAH)}); true`)
  const kodeNgawur = await evalJs(
    `fetch('/api/v1/auth/tamu', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json',
        'X-XSRF-TOKEN': decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1] ?? '') },
      body: JSON.stringify({ nama: 'Tamu Kode Ngawur', kode_perangkat: 'spasi tidak boleh' }),
    }).then((r) => r.status)`,
  )

  catat('kode perangkat bentuk aneh ditolak validasi (422)', kodeNgawur === 422, `status ${kodeNgawur}`)

  // ---------- 7. Tautan ulangan yang dibagikan: tamu dulu, akun menyusul ----------
  //
  // Anak yang membuka tautan guru umumnya tidak punya akun. Sebelum perbaikan
  // 14 Oktober 2026 ia mendarat di kolom email/kata sandi lebih dulu, dan pintu
  // tamu hanya muncul sebagai tautan "Atau …" di bagian bawah — jadi anak merasa
  // dipaksa masuk. Sekarang, bila datang dari `/kuis/…`, pintu tamu tampil di
  // atas dan formulir akun dilipat.
  await apiJson('/v1/auth/keluar', 'POST')
  await evalJs(`window.localStorage.removeItem('${KUNCI_PERANGKAT}'); true`)

  await buka(`/kuis/${kuisTamu}`)
  const jalurTamu = await evalJs('window.location.pathname')
  const teksTautan = await evalJs(`__alat.teksTamu()`)

  catat(
    'buka tautan ulangan tanpa sesi: diantar ke halaman masuk',
    jalurTamu === '/masuk',
    `jalur=${jalurTamu}`,
  )

  catat(
    'datang dari tautan ulangan: pintu tamu tampil lebih dulu (judul "Ikut ulangan")',
    typeof teksTautan === 'string' && teksTautan.includes('Ikut ulangan sebagai siswa tamu'),
    (teksTautan ?? '(tidak ada)').slice(0, 120),
  )

  catat(
    'pintu tamu berada di ATAS kolom email (bukan lagi "atau" di bawah)',
    (await evalJs('__alat.tamuDiAtasAkun()')) === true,
  )

  catat(
    'formulir akun sekolah dilipat, tidak menyambut anak dengan kata sandi',
    (await evalJs('__alat.akunTerlipat()')) === true,
  )

  await evalJs(`__alat.isiTamu(${JSON.stringify(`${NAMA_TAMU} Tautan`)})`)
  await sleep(3500)

  const jalurSetelahTamu = await evalJs('window.location.pathname')
  const tamuTautan = await saya()

  catat(
    'tulis nama di pintu tamu: dikembalikan ke kuis yang dibuka, tanpa akun',
    jalurSetelahTamu === `/kuis/${kuisTamu}` && tamuTautan.isTamu === true,
    `jalur=${jalurSetelahTamu} · id=${tamuTautan.id}`,
  )

  // ---------- Bersih-bersih ----------
  // Pintu tamunya ditutup dengan menghapus kuisnya: saklarnya menempel pada kuis
  // itu, dan kuis terbit yang tertinggal akan terus menyalakan mode tamu di
  // sekolah ini.
  await apiJson('/v1/auth/keluar', 'POST')
  await buka('/masuk')
  await masuk(AKUN_GURU)

  const hapusKuis = kuisTamuId > 0 ? await apiJson(`/v1/kuis/${kuisTamuId}`, 'DELETE') : { status: 0 }
  const hapusSoal = soalTamuId > 0 ? await apiJson(`/v1/soal/${soalTamuId}`, 'DELETE') : { status: 0 }
  const infoTamuAkhir = await apiJson('/v1/tamu')
  catat(
    'kuis pintu tamu dihapus sehingga mode tamu kembali mati',
    (hapusKuis.status === 204 || hapusKuis.status === 200) &&
      hapusSoal.status === 200 &&
      infoTamuAkhir.isi?.diizinkan === false,
    `kuis=${hapusKuis.status} soal=${hapusSoal.status} · diizinkan=${infoTamuAkhir.isi?.diizinkan}`,
  )

  await apiJson('/v1/auth/keluar', 'POST')
  await send('Target.closeTarget', { targetId })
  ws.close()

  const gagal = hasil.filter((satu) => !satu.lolos)
  console.log('')
  console.log(`smoke tamu: ${hasil.length - gagal.length}/${hasil.length} lulus`)
  process.exit(gagal.length === 0 ? 0 : 1)
}

main().catch((galat) => {
  console.error('smoke gagal:', galat.message)
  process.exit(1)
})
