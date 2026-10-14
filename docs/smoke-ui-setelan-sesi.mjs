// Smoke UI setelan sesi + tautan siswa (Chrome DevTools Protocol) — putaran A.59.
//
// Yang diperiksa (semua di peramban sungguhan, lewat antarmuka yang dipakai guru
// dan murid):
//
//   1. **Tautan guru hidup untuk pengunjung tanpa sesi.** Membuka `/kuis` tanpa
//      sesi harus mendarat di halaman masuk **sambil membawa tujuan asal**
//      (`state.lanjut`), lalu setelah masuk lewat formulir, guru kembali ke
//      `/kuis` — bukan dibuang ke beranda.
//   2. **Tujuan asal itu juga bekerja untuk SISWA TAMU.** Inilah bagian
//      "kompatibel dengan mode tamu": dengan `izinkan_tamu` menyala, pengunjung
//      tanpa akun yang datang lewat tautan bisa memakai pintu tamu dan tetap
//      mendarat di halaman tujuan (diuji ke `/avatar` — halaman murid yang bukan
//      tujuan bawaan tamu, jadi pemeriksaannya tidak ambigu).
//   3. **Panel "Setelan sesi ini" di langkah 3** menampilkan apa yang benar-benar
//      menyala, termasuk saat ada proteksi dan izin tamu yang dinyalakan
//      sungguhan: angkanya dibandingkan dengan `GET /v1/pengaturan?kuis_id=` yang
//      dihitung ulang oleh modul aplikasi sendiri
//      (`sections/quiz/setelanSesi.js`), bukan oleh salinan aturan di harness.
//   4. **Tombol "Buat tautan siswa"** menghasilkan tautan `/kuis/<slug>` di dalam
//      aplikasi (bukan tautan bertoken/domain luar), dan tombol "Salin tautan"
//      benar-benar mengisi klip papan (diperiksa dengan membacanya kembali).
//      Yang dibandingkan adalah `tautanSiswa(slug, origin)` dari modul aplikasi
//      sendiri — bukan id angka, karena alamat kuis memakai slug acak sejak
//      slice "slug dipakai seluruh layar kuis".
//
// Data uji dibuat lalu dibersihkan sendiri: satu kuis draf sementara untuk panel
// langkah 3, dan satu kuis TERBIT kecil yang membuka pintu tamu (dihapus beserta
// soalnya di `finally`). Pintu tamu sengaja dibuka di **lapis kuis** — sejak
// 14 Oktober 2026 lapis sekolah/kelas tidak bisa diubah siapa pun lewat API
// (`PengaturanPolicy`), dan lapis kuis memang jalur yang dipakai guru. Yang tetap
// tertinggal hanyalah baris `settings` untuk kuis uji yang sudah dihapus — sama
// seperti peninggalan putaran-putaran sebelumnya (mis. kuis 158–194), dan tidak
// bisa terpakai lagi karena resolusi selalu lewat kuis → kelas → sekolah.
//
// Prasyarat: backend 8000 + vite 5173 (`./nyalakan-local.sh`) dan Chrome
// `--remote-debugging-port=9333`. Paling ringkas:
// `docs/jalankan-smoke-ui.sh setelan-sesi`.
import { fileURLToPath } from 'node:url'

const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness guru
// memakai akun guru sungguhan (guru1@sekolah.test) — bukan akun admin seperti dulu.
// Jalur kepala sekolah diuji terpisah di `docs/smoke-ui-admin.mjs`.
const AKUN = { email: 'guru1@sekolah.test', password: 'password12' }

// Diimpor dari modul aplikasi yang sama, supaya yang dibandingkan benar-benar
// logika produk (bukan salinan aturan di dalam harness).
const jalurModul = fileURLToPath(new URL('../frontend/src/sections/quiz/setelanSesi.js', import.meta.url))
const { ringkasSetelan, tautanSiswa } = await import(jalurModul)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const hasil = []
function cek(nama, lulus, catatan = '') {
  hasil.push({ nama, lulus })
  console.log(`${lulus ? '✅' : '❌'} ${nama}${catatan ? ` — ${catatan}` : ''}`)
}

async function main() {
  const ws = new WebSocket(
    await fetch(`${CDP}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl),
  )
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

  await send('Browser.grantPermissions', {
    origin: APP,
    permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
  })

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })

  const evalJs = async (expression) => {
    const r = await send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    )
    if (r.exceptionDetails) {
      throw new Error(
        'eval error: ' + (r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)),
      )
    }
    return r.result.value
  }

  const ke = async (jalur, tungguMs = 3000) => {
    await send('Page.navigate', { url: `${APP}${jalur}` }, sessionId)
    await sleep(tungguMs)
  }

  const kosongkanCookie = async () => {
    await send('Network.enable', {}, sessionId)
    await send('Network.clearBrowserCookies', {}, sessionId)
  }

  /** Klik elemen pertama yang tampak dan teksnya memuat frasa tertentu. */
  const klikTeks = async (teks, pilih = 'button, a') =>
    evalJs(`(() => {
      const cocok = [...document.querySelectorAll(${JSON.stringify(pilih)})]
        .filter((el) => el.offsetParent !== null)
        .find((el) => el.textContent.trim().toLowerCase().includes(${JSON.stringify(teks.toLowerCase())}))
      if (!cocok) return false
      cocok.click()
      return true
    })()`)

  /** Tulis nilai ke kolom isian seperti manusia (React membaca event input). */
  const tulis = async (arab, nilai) =>
    evalJs(`(() => {
      const el = document.querySelector(${JSON.stringify(arab)})
      if (!el) return false
      const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set
      setter.call(el, ${JSON.stringify(nilai)})
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`)

  const tokenCsrf = () =>
    evalJs(`(async () => {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
      const cookie = document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')) ?? ''
      return decodeURIComponent(cookie.split('=')[1] ?? '')
    })()`)

  /** Simpan satu pengaturan lewat API yang sama dengan halaman Pengaturan. */
  const simpanSetelan = async ({ lingkup, lingkupId = null, kunci, nilai }) => {
    const token = await tokenCsrf()

    return evalJs(`(async () => {
      const res = await fetch('/api/v1/pengaturan', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': ${JSON.stringify(token)} },
        body: JSON.stringify(${JSON.stringify({ lingkup, lingkup_id: lingkupId, kunci, nilai })}),
      })
      return res.status
    })()`).catch((e) => {
      console.error(`  (simpanSetelan ${lingkup}/${kunci} gagal: ${e.message})`)
      return 0
    })
  }

  /** Panggil API dari sesi peramban ini (dipakai menyiapkan data uji). */
  const apiGuru = async (jalur, metode = 'GET', muatan = null) => {
    const token = await tokenCsrf()

    return evalJs(`(async () => {
      const res = await fetch('/api${jalur}', {
        method: '${metode}', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': ${JSON.stringify(token)} },
        body: ${muatan === null ? 'null' : `JSON.stringify(${JSON.stringify(muatan)})`},
      })
      return { status: res.status, isi: await res.json().catch(() => null) }
    })()`)
  }

  const masukFormulir = async (email, sandi) => {
    await tulis('input[name="email"]', email)
    await tulis('input[name="password"]', sandi)
    await evalJs(`document.querySelector('form').requestSubmit()`)
    await sleep(3500)
  }

  let idKuis = 0
  let slugKuis = ''
  let kuisTamuId = 0
  let soalTamuId = 0

  /**
   * Siapkan satu kuis TERBIT yang membuka pintu tamu.
   *
   * Formulir "masuk sebagai siswa tamu" tampil bila lapis sekolah menyala ATAU
   * ada kuis terbit yang membukanya (`TamuService::tersedia`). Sejak 14 Oktober
   * 2026 lapis sekolah/kelas tidak bisa diubah siapa pun lewat API
   * (`PengaturanPolicy`) — satu guru tidak memutuskan untuk seluruh sekolah —
   * jadi jalur yang dipakai di sini adalah jalur yang memang dipakai guru:
   * membuka pintu pada kuis miliknya sendiri.
   *
   * @returns {Promise<number>} id kuis (0 bila gagal disiapkan)
   */
  const siapkanKuisTamu = async () => {
    const mapel = await apiGuru('/v1/mapel')
    const kelas = await apiGuru('/v1/kelas')
    const mapelId = (Array.isArray(mapel.isi) ? mapel.isi : (mapel.isi?.data ?? []))[0]?.id
    const kelasId = (Array.isArray(kelas.isi) ? kelas.isi : (kelas.isi?.data ?? []))[0]?.id
    if (!mapelId || !kelasId) return 0

    const soal = await apiGuru('/v1/soal', 'POST', {
      subject_id: mapelId,
      tipe: 'pilihan_ganda',
      konten: {
        teks: 'Soal pintu tamu (smoke setelan sesi).',
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

    const kuis = await apiGuru('/v1/kuis', 'POST', {
      judul: `Pintu tamu uji ${Date.now()}`,
      subject_id: mapelId,
      class_id: kelasId,
      durasi_menit: 10,
      mulai_at: new Date(Date.now() - 60_000).toISOString(),
      selesai_at: new Date(Date.now() + 3_600_000).toISOString(),
    })
    if (kuis.status !== 201) return 0
    kuisTamuId = kuis.isi.id

    await apiGuru(`/v1/kuis/${kuisTamuId}/soal`, 'PUT', { soal: [soalTamuId] })
    const terbit = await apiGuru(`/v1/kuis/${kuisTamuId}/publikasi`, 'POST')
    if (terbit.status !== 200) return 0

    const pintu = await apiGuru('/v1/pengaturan', 'PUT', {
      lingkup: 'kuis', lingkup_id: kuisTamuId, kunci: 'izinkan_tamu', nilai: true,
    })

    return pintu.status === 200 ? kuisTamuId : 0
  }

  try {
    // ==== 1. Tanpa sesi: tujuan asal dibawa ke halaman masuk ===================
    await kosongkanCookie()
    await ke('/kuis')

    const tanpaSesi = await evalJs(`({ url: location.pathname, lanjut: history.state?.usr?.lanjut ?? null })`)
    cek('tanpa sesi: diarahkan ke halaman masuk', tanpaSesi.url === '/masuk', `path=${tanpaSesi.url}`)
    cek('tanpa sesi: tujuan asal dibawa (state.lanjut)', tanpaSesi.lanjut === '/kuis', `lanjut=${tanpaSesi.lanjut}`)

    // ==== 2. Masuk lewat formulir sungguhan: kembali ke tujuan asal ============
    await masukFormulir(AKUN.email, AKUN.password)
    const setelahMasuk = await evalJs(`location.pathname`)
    cek('setelah masuk: kembali ke halaman asal (/kuis)', setelahMasuk === '/kuis', `path=${setelahMasuk}`)

    // ==== 3. Kompatibel dengan mode tamu ======================================
    // Pintu tamu dibuka lewat kuis terbit milik guru ini (lihat siapkanKuisTamu).
    const kuisTamu = await siapkanKuisTamu()
    cek(
      'pintu tamu dibuka lewat satu kuis terbit milik guru',
      kuisTamu > 0,
      kuisTamu > 0 ? `kuis ${kuisTamu}` : 'gagal menyiapkan kuis (mapel/kelas tidak ada di DB dev?)',
    )

    await kosongkanCookie()
    await ke('/avatar')
    const tamuMasuk = await evalJs(`({ url: location.pathname, lanjut: history.state?.usr?.lanjut ?? null })`)
    cek('tamu: diarahkan ke halaman masuk', tamuMasuk.url === '/masuk', `path=${tamuMasuk.url}`)

    const adaFormTamu = await evalJs(
      `document.querySelector('input[name="nama"]') !== null`,
    )
    cek('tamu: formulir "ikut sebagai siswa tamu" tampil', adaFormTamu === true)

    if (adaFormTamu) {
      await tulis('input[name="nama"]', `Tamu Uji ${Date.now() % 100000}`)
      // Sengaja memilih formulir TAMU (bukan formulir masuk yang muncul lebih
      // dulu di halaman) — kalau salah pilih, yang diuji jadi alur yang lain.
      await evalJs(`document.querySelector('section.auth-tamu form').requestSubmit()`)
      await sleep(4000)

      const setelahTamu = await evalJs(`location.pathname`)
      cek(
        'tamu: mendarat di tujuan tautan (/avatar), bukan tujuan bawaan tamu (/kuis)',
        setelahTamu === '/avatar',
        `path=${setelahTamu}`,
      )
    }

    // ==== 4. Kembali jadi guru untuk menguji panel langkah 3 ==================
    await kosongkanCookie()
    await ke('/masuk')
    await masukFormulir(AKUN.email, AKUN.password)
    cek('masuk ulang sebagai guru', (await evalJs(`location.pathname`)) !== '/masuk')

    const judul = `Uji setelan sesi ${Date.now()}`
    await ke('/kuis')
    await klikTeks('Buat kuis')
    await sleep(1200)
    await tulis('input[name="judul"]', judul)
    await evalJs(`document.querySelector('form').requestSubmit()`)
    await sleep(3000)

    const kuisBaru = await evalJs(`(async () => {
      const res = await fetch('/api/v1/kuis', { headers: { Accept: 'application/json' }, credentials: 'include' })
      const data = await res.json()
      const daftar = Array.isArray(data) ? data : (data.data ?? [])
      const cocok = daftar.find((satu) => String(satu.judul) === ${JSON.stringify(judul)})
      return cocok ? { id: Number(cocok.id), slug: String(cocok.slug ?? '') } : null
    })()`).catch(() => null)

    idKuis = kuisBaru?.id ?? 0
    slugKuis = kuisBaru?.slug ?? ''

    cek('draf uji tersimpan di server', idKuis > 0, `id=${idKuis}`)

    if (idKuis > 0) {
      // Nyalakan proteksi + izin tamu untuk kuis uji ini, supaya panel diuji pada
      // cabang yang paling mudah salah (bukan hanya keadaan "semua mati").
      const statusProteksi = await simpanSetelan({ lingkup: 'kuis', lingkupId: idKuis, kunci: 'anti_cheat', nilai: true })
      await simpanSetelan({ lingkup: 'kuis', lingkupId: idKuis, kunci: 'block_paste', nilai: true })
      await simpanSetelan({ lingkup: 'kuis', lingkupId: idKuis, kunci: 'block_tab_switch', nilai: true })
      await simpanSetelan({ lingkup: 'kuis', lingkupId: idKuis, kunci: 'izinkan_tamu', nilai: true })
      cek('setelan uji ditulis (anti-cheat + 2 proteksi + izin tamu)', statusProteksi === 200, `status=${statusProteksi}`)

      await ke('/kuis')
      await klikTeks('Ubah')
      await sleep(2500)

      // Sejak 14 Oktober 2026 editor kuis satu halaman: tidak ada lagi tombol
      // "Lanjut: susun soal" / "Lanjut: tinjau", dan ringkasan setelan sesi
      // sudah tampil begitu drafnya dikenal server (tanpa pindah bagian).
      const satuHalaman = await evalJs(`(() => ({
        bagian: ['1. Info dan jadwal', '2. Susun soal', '3. Tinjau dan publikasikan']
          .every((t) => [...document.querySelectorAll('h2')].some((h) => h.textContent.trim() === t)),
        adaTombolLanjut: [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Lanjut:')),
      }))()`)
      cek('editor kuis satu halaman (tiga bagian sekaligus, tanpa tombol "Lanjut:")', satuHalaman.bagian && satuHalaman.adaTombolLanjut === false, JSON.stringify(satuHalaman))

      await sleep(1500)

      const panelAwal = await evalJs(`(() => {
        const kepala = [...document.querySelectorAll('h3')]
          .find((h) => h.textContent.trim() === 'Setelan sesi ini')
        if (!kepala) return null
        const bagian = kepala.closest('section')
        return {
          baris: [...bagian.querySelectorAll('li.baris-ringkas')].map((li) => li.innerText.replace(/\\s+/g, ' ').trim()),
          adaTombolTautan: [...bagian.querySelectorAll('button')].some((b) => b.textContent.includes('Buat tautan siswa')),
        }
      })()`)

      cek('bagian 3: panel "Setelan sesi ini" tampil', panelAwal !== null)
      cek(
        'panel: tiga baris ringkas (proteksi · siswa tamu · aturan lain)',
        Array.isArray(panelAwal?.baris) && panelAwal.baris.length === 3,
        panelAwal ? `${panelAwal.baris.length} baris` : '(tanpa panel)',
      )
      cek('panel: tombol "Buat tautan siswa" ada', panelAwal?.adaTombolTautan === true)

      await klikTeks('Buat tautan siswa')
      await sleep(800)

      const kotak = await evalJs(
        `(() => { const el = document.querySelector('input[aria-label="Tautan untuk siswa"]'); return el ? el.value : null })()`,
      )
      const teksPanel = await evalJs(`(() => {
        const kepala = [...document.querySelectorAll('h3')].find((h) => h.textContent.trim() === 'Setelan sesi ini')
        return kepala ? kepala.closest('section').innerText.replace(/\\s+/g, ' ').trim() : ''
      })()`)

      cek(
        'tombol "Buat tautan siswa" memunculkan kotak tautan',
        typeof kotak === 'string' && kotak !== '',
        kotak ?? '(kosong)',
      )
      cek(
        'tautan = alamat aplikasi + /kuis/<slug>',
        kotak !== null && kotak === tautanSiswa(slugKuis, APP),
        `dapat=${kotak} · harap=${tautanSiswa(slugKuis, APP)}`,
      )

      const resolusi = await evalJs(`(async () => {
        const res = await fetch('/api/v1/pengaturan?kuis_id=${idKuis}', {
          headers: { Accept: 'application/json' }, credentials: 'include',
        })
        return { status: res.status, data: await res.json() }
      })()`).catch(() => ({ status: 0, data: null }))

      cek('resolusi pengaturan kuis terambil dari server', resolusi.status === 200, `status=${resolusi.status}`)

      const harap = ringkasSetelan(resolusi.data)

      cek(
        'panel: jumlah proteksi aktif sama dengan resolusi server',
        harap.proteksi.length > 0 && teksPanel.includes(`${harap.proteksi.length} proteksi aktif`),
        `server=${harap.proteksi.length} · induk=${harap.indukAktif}`,
      )
      cek(
        'panel: baris siswa tamu sama dengan resolusi server',
        harap.tamu.aktif ? /Siswa tamu boleh/.test(teksPanel) : /Siswa tamu tidak boleh/.test(teksPanel),
        `server tamu=${harap.tamu.aktif} · sumber=${harap.tamu.sumber}`,
      )
      cek(
        'panel: catatan draf + catatan pintu tamu muncul apa adanya',
        /masih draf/.test(teksPanel) && /setelah kuis diterbitkan/.test(teksPanel),
        teksPanel.includes('setelah kuis diterbitkan') ? 'dua catatan lengkap' : `teks=${teksPanel.slice(0, 140)}`,
      )

      await klikTeks('Salin tautan')
      await sleep(800)

      const klip = await evalJs(`navigator.clipboard.readText().catch(() => null)`)
      const toast = await evalJs(
        `[...document.querySelectorAll('[role="status"], .toast, .toast-isi')].map((el) => el.innerText).join(' | ')`,
      )

      cek(
        'tombol "Salin tautan" mengisi klip papan',
        klip === kotak || /disalin/i.test(toast),
        klip === kotak ? 'klip papan = tautan' : `klip=${klip === null ? 'tak terbaca' : klip} · toast=${toast.trim()}`,
      )
    }
  } finally {
    // ---- Bersih-bersih: kembalikan setelan, lalu hapus kuis uji ----
    if (idKuis > 0) {
      for (const kunci of ['anti_cheat', 'block_paste', 'block_tab_switch', 'izinkan_tamu']) {
        await simpanSetelan({ lingkup: 'kuis', lingkupId: idKuis, kunci, nilai: false })
      }

      const statusHapus = await evalJs(`(async () => {
        const token = await (async () => {
          await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
          const cookie = document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')) ?? ''
          return decodeURIComponent(cookie.split('=')[1] ?? '')
        })()
        const res = await fetch('/api/v1/kuis/${idKuis}', {
          method: 'DELETE', credentials: 'include',
          headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token },
        })
        return res.status
      })()`).catch(() => 0)

      cek('kuis uji dihapus kembali', statusHapus === 204 || statusHapus === 200, `status=${statusHapus}`)
    }

    // Pintu tamu uji ditutup dengan cara menghapus kuisnya: saklarnya menempel
    // pada kuis itu, jadi tidak ada kembali lagi keadaan sekolah yang perlu
    // dipulihkan — dan kuis terbit yang tertinggal akan terus membuat formulir
    // tamu tampil di halaman masuk sekolah ini.
    if (kuisTamuId > 0) {
      const hapusKuisTamu = await apiGuru(`/v1/kuis/${kuisTamuId}`, 'DELETE')
      cek(
        'kuis pintu tamu uji dihapus kembali',
        hapusKuisTamu.status === 204 || hapusKuisTamu.status === 200,
        `status=${hapusKuisTamu.status}`,
      )
    }

    if (soalTamuId > 0) {
      const hapusSoalTamu = await apiGuru(`/v1/soal/${soalTamuId}`, 'DELETE')
      cek('soal pintu tamu uji dihapus kembali', hapusSoalTamu.status === 200, `status=${hapusSoalTamu.status}`)
    }

    ws.close()
  }

  const gagal = hasil.filter((satu) => !satu.lulus).length
  console.log(`\nTotal: ${hasil.length - gagal}/${hasil.length} lulus · ${gagal} gagal`)
  process.exit(gagal === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('GAGAL:', e.message)
  process.exit(1)
})
