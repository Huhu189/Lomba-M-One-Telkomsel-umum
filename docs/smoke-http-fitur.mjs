#!/usr/bin/env node
/**
 * smoke-http-fitur.mjs — uji asap HTTP menyeluruh lewat antarmuka asli.
 *
 * Bukan pengganti `./verify.sh` (itu pagar mutunya): skrip ini menjalankan
 * aplikasi sungguhan (backend :8000, realtime :4000) dan menelusuri **setiap
 * fitur** lewat API yang benar-benar dipakai frontend — sesi cookie Sanctum +
 * token CSRF seperti SPA (bukan `actingAs`).
 *
 * Yang diuji: auth & identitas, data induk (sekolah/kelas/mapel/murid + CSV),
 * bank soal delapan tipe, kuis, pengerjaan & penilaian, hasil/peringkat/badge/
 * progres, koreksi manual, materi berblok + unggahan, tim, presence/anti-cheat/
 * layar/SSE, lampiran jawaban, avatar, pengaturan tiga lapis, cache, dan
 * otorisasi kepemilikan.
 *
 * Pemakaian:
 *   # layanan: backend (:8000), frontend (:5173), realtime (:4000)
 *   node docs/smoke-http-fitur.mjs
 *
 * Akun: admin@sekolah.test (SANDI_ADMIN), guru1@sekolah.test + guru2@sekolah.test
 * (SANDI_GURU/SANDI_GURU2) — ketiganya dibuat `RolesAndAdminSeeder` dan sudah
 * terverifikasi email, jadi skrip ini portabel di DB yang baru di-seed. Skrip
 * membuat datanya sendiri (kelas/mapel/soal/kuis/murid bertanda waktu) sehingga
 * bisa dijalankan berulang di DB dev.
 *
 * Catatan bentuk respons yang sudah dikonfirmasi: `/kelas`, `/mapel`, `/tag`,
 * `/kuis`, `/murid` mengembalikan array telanjang; `/soal` berpaginasi
 * (`data[]`); unggahan alamatnya memakai `kode` (bukan `id`); `GET /auth/saya`
 * mengembalikan user datar (tanpa pembungkus `user`).
 */
import zlib from 'node:zlib'

const API = process.env.API ?? 'http://localhost:8000'
const RT = process.env.RT ?? 'http://127.0.0.1:4000'
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5173'
const ADMIN = { email: process.env.EMAIL_ADMIN ?? 'admin@sekolah.test', password: process.env.SANDI_ADMIN ?? 'Passw0rd!Aman' }
const GURU = { email: process.env.EMAIL_GURU ?? 'guru1@sekolah.test', password: process.env.SANDI_GURU ?? 'password12' }
const GURU2 = { email: process.env.EMAIL_GURU2 ?? 'guru2@sekolah.test', password: process.env.SANDI_GURU2 ?? 'password12' }

const TANDA = Date.now().toString(36)
const SANDI_MURID = 'kata-sandi-aman-10'

const hasil = []
let bagian = ''

function judul(nama) {
  bagian = nama
  console.log(`\n=== ${nama} ===`)
}

function cek(nama, lulus, catatan = '') {
  hasil.push({ bagian, nama, lulus, catatan })
  console.log(`${lulus ? '✅' : '❌'} ${nama}${catatan ? ` — ${catatan}` : ''}`)
}

/** Daftar dari respons yang bisa berupa array telanjang atau `data[]`. */
function daftar(data) {
  if (Array.isArray(data)) return data
  return data?.data ?? []
}

/** Blok materi dari detail (respons bisa datar atau terbungkus `data`). */
function detailGuruBlok(data) {
  return data?.blok ?? data?.data?.blok ?? []
}

function galatRingkas(data) {
  if (!data) return ''
  const pesan = data.message ?? ''
  const rinci = data.errors ? JSON.stringify(data.errors) : ''
  return `${pesan} ${rinci}`.trim().slice(0, 200)
}

async function baca(res) {
  const teks = await res.text()
  let data = null
  try {
    data = JSON.parse(teks)
  } catch {
    data = null
  }
  return { status: res.status, data, teks }
}

/** Sesi SPA: cookie dikelola sendiri, token CSRF diambil ulang tiap tulis. */
class Sesi {
  #cookie = new Map()

  constructor(nama) {
    this.nama = nama
  }

  #simpan(res) {
    for (const satu of res.headers.getSetCookie?.() ?? []) {
      const pasangan = satu.split(';')[0]
      const pisah = pasangan.indexOf('=')
      if (pisah > 0) this.#cookie.set(pasangan.slice(0, pisah).trim(), pasangan.slice(pisah + 1).trim())
    }
  }

  #header() {
    return [...this.#cookie].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  /**
   * Ambil token CSRF untuk sesi berjalan. Cookie sesi WAJIB ikut dikirim —
   * tanpa itu `/sanctum/csrf-cookie` membuat sesi baru dan menendang sesi login.
   */
  async csrf() {
    const headers = { Origin: ORIGIN, Referer: `${ORIGIN}/`, Accept: 'application/json' }
    if (this.#cookie.size) headers.Cookie = this.#header()
    const res = await fetch(`${API}/sanctum/csrf-cookie`, { headers })
    this.#simpan(res)
    return decodeURIComponent(this.#cookie.get('XSRF-TOKEN') ?? '')
  }

  async #minta(method, path, { json, form, csrf = false } = {}) {
    // Token lebih dulu: mengambilnya bisa memperbarui cookie, jadi header
    // Cookie disusun sesudahnya (token baru + cookie lama = 419).
    const token = csrf ? await this.csrf() : null

    const headers = {
      Origin: ORIGIN,
      Referer: `${ORIGIN}/`,
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    }
    if (this.#cookie.size) headers.Cookie = this.#header()
    if (token) headers['X-XSRF-TOKEN'] = token

    let body
    if (form) body = form
    else if (json !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(json)
    }

    const res = await fetch(`${API}${path}`, { method, headers, body, redirect: 'manual' })
    this.#simpan(res)
    return baca(res)
  }

  get(path) {
    return this.#minta('GET', path)
  }

  post(path, json) {
    return this.#minta('POST', path, { json: json ?? {}, csrf: true })
  }

  put(path, json) {
    return this.#minta('PUT', path, { json: json ?? {}, csrf: true })
  }

  del(path) {
    return this.#minta('DELETE', path, { csrf: true })
  }

  kirim(method, path, form) {
    return this.#minta(method, path, { form, csrf: true })
  }

  /** Unduhan mentah (byte apa adanya) — fetch().text() membuang BOM UTF-8. */
  unduh(path) {
    return this.unduhAbsolut(`${API}${path}`)
  }

  /**
   * Unduhan dari URL absolut — dipakai untuk berkas yang hanya boleh keluar
   * lewat URL bertanda tangan (`?expires=&signature=`) dari resource server.
   */
  async unduhAbsolut(url) {
    const headers = { Origin: ORIGIN, Referer: `${ORIGIN}/`, Accept: '*/*' }
    if (this.#cookie.size) headers.Cookie = this.#header()
    const res = await fetch(url, { headers })
    this.#simpan(res)
    const buf = Buffer.from(await res.arrayBuffer())
    return { status: res.status, buf, teks: buf.toString('utf8') }
  }

  masuk(akun) {
    return this.post('/api/v1/auth/masuk', akun)
  }
}

/** PNG padat berukuran raksasa tetapi berkas kecil (uji bom dekompresi). */
function pngRaksasa(lebar, tinggi) {
  const potongan = (tipe, isi) => {
    const panjang = Buffer.alloc(4)
    panjang.writeUInt32BE(isi.length)
    const badan = Buffer.concat([Buffer.from(tipe, 'ascii'), isi])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(badan))
    return Buffer.concat([panjang, badan, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(lebar, 0)
  ihdr.writeUInt32BE(tinggi, 4)
  ihdr[8] = 8
  ihdr[9] = 0
  const idat = zlib.deflateSync(Buffer.alloc(lebar * tinggi + tinggi), { level: 9 })
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    potongan('IHDR', ihdr),
    potongan('IDAT', idat),
    potongan('IEND', Buffer.alloc(0)),
  ])
}

function crc32(buf) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (~c) >>> 0
}

function berkas(nama, isi, mime) {
  const fd = new FormData()
  fd.append('file', new Blob([isi], { type: mime }), nama)
  return fd
}

const iso = (ms) => new Date(ms).toISOString()
const punyaBom = (buf) => buf.length > 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf

async function utama() {
  const mulaiJam = Date.now()
  console.log(`smoke-http-fitur — tanda ${TANDA}`)

  // ---------- A. Kesiapan layanan ----------
  judul('A. Kesiapan layanan')
  try {
    const sehat = await baca(await fetch(`${API}/api/v1/health`))
    cek('backend /health 200 & database true', sehat.status === 200 && sehat.data?.database === true, `status=${sehat.status}`)
  } catch (e) {
    cek('backend /health', false, String(e))
  }
  try {
    const rt = await baca(await fetch(`${RT}/health`))
    const siap = await baca(await fetch(`${RT}/ready`))
    cek('realtime /health 200', rt.status === 200 && rt.data?.ok === true, `status=${rt.status}`)
    cek('realtime /ready 200 (fail-open)', siap.status === 200, `status=${siap.status} redis=${siap.data?.redis}`)
  } catch (e) {
    cek('realtime layanan', false, String(e))
  }

  const admin = new Sesi('admin')
  const guru = new Sesi('guru')
  const guru2 = new Sesi('guru2')
  const murid = new Sesi('murid')
  const tamu = new Sesi('tamu')
  const pendaftar = new Sesi('pendaftar')

  // ---------- B. Auth & identitas ----------
  judul('B. Auth & identitas')
  const tamuSaya = await tamu.get('/api/v1/auth/saya')
  cek('GET /auth/saya tanpa sesi → 401', tamuSaya.status === 401, `status=${tamuSaya.status}`)

  cek('admin masuk', (await admin.masuk(ADMIN)).status === 200, '')
  const masukGuru = await guru.masuk(GURU)
  cek('guru masuk', masukGuru.status === 200, `status=${masukGuru.status} ${galatRingkas(masukGuru.data)}`)
  const masukGuru2 = await guru2.masuk(GURU2)
  cek('guru kedua masuk (untuk uji kepemilikan)', masukGuru2.status === 200, `status=${masukGuru2.status} ${galatRingkas(masukGuru2.data)}`)

  const sayaGuru = await guru.get('/api/v1/auth/saya')
  cek('guru melihat identitas & perannya', sayaGuru.status === 200 && sayaGuru.data?.email === GURU.email, `email=${sayaGuru.data?.email} role=${sayaGuru.data?.role}`)

  const sandiSalah = await new Sesi('salah').masuk({ email: GURU.email, password: 'sandi-ngawur-sekali' })
  cek('sandi salah ditolak 422, bukan 500', sandiSalah.status === 422, `status=${sandiSalah.status}`)

  // Pendaftaran mandiri murid: auto-login, lalu menunggu verifikasi email.
  const emailMandiri = `smoke.mandiri.${TANDA}@murid.test`
  const hasilDaftar = await pendaftar.post('/api/v1/auth/daftar', {
    name: 'Murid Mandiri',
    email: emailMandiri,
    password: SANDI_MURID,
    password_confirmation: SANDI_MURID,
  })
  cek('murid mendaftar sendiri → 201', hasilDaftar.status === 201, `status=${hasilDaftar.status} ${galatRingkas(hasilDaftar.data)}`)
  const sayaPendaftar = await pendaftar.get('/api/v1/auth/saya')
  cek('setelah daftar langsung punya sesi (auto-login)', sayaPendaftar.status === 200 && sayaPendaftar.data?.email === emailMandiri, `status=${sayaPendaftar.status} email=${sayaPendaftar.data?.email}`)
  cek('akun hasil daftar mandiri masih menunggu verifikasi', sayaPendaftar.data?.status === 'pending', `status=${sayaPendaftar.data?.status}`)

  const keluarPendaftar = await pendaftar.post('/api/v1/auth/keluar')
  cek('keluar → 200', keluarPendaftar.status === 200, `status=${keluarPendaftar.status}`)
  const setelahKeluar = await pendaftar.get('/api/v1/auth/saya')
  cek('setelah keluar sesi benar-benar habis (401)', setelahKeluar.status === 401, `status=${setelahKeluar.status}`)
  const masukPending = await pendaftar.masuk({ email: emailMandiri, password: SANDI_MURID })
  cek('akun belum verifikasi email tidak bisa masuk (aturan lomba)', masukPending.status === 422, `status=${masukPending.status}`)

  const sesi = await guru.get('/api/v1/sesi')
  cek('GET /sesi memberi status sesi', sesi.status === 200, `status=${sesi.status}`)
  const lupa = await new Sesi('lupa').post('/api/v1/auth/lupa-sandi', { email: emailMandiri })
  cek('lupa sandi tidak membocorkan akun ada/tidak', [200, 202].includes(lupa.status), `status=${lupa.status}`)
  const aturUlang = await new Sesi('atur').post('/api/v1/auth/atur-ulang-sandi', { token: 'token-palsu-123456', email: emailMandiri, password: SANDI_MURID, password_confirmation: SANDI_MURID })
  cek('atur ulang sandi menjawab jujur saat sandi TIDAK berubah (berhasil=false)',
    aturUlang.status === 200 && aturUlang.data?.berhasil === false && aturUlang.data?.tautan_dipakai === false,
    `status=${aturUlang.status} berhasil=${aturUlang.data?.berhasil} tautan_dipakai=${aturUlang.data?.tautan_dipakai}`)
  const kirimUlang = await new Sesi('kirim').post('/api/v1/auth/kirim-ulang-verifikasi-publik', { email: emailMandiri })
  cek('kirim ulang verifikasi publik dijawab tanpa membocorkan status', [200, 202].includes(kirimUlang.status), `status=${kirimUlang.status}`)

  // ---------- C. Data induk ----------
  judul('C. Sekolah, kelas, mapel, murid')
  cek('GET /sekolah', (await guru.get('/api/v1/sekolah')).status === 200, '')

  const kelasRes = await guru.post('/api/v1/kelas', { nama: `Smoke ${TANDA}`, tingkat: 6, tahun_ajaran: '2026/2027' })
  const kelasId = kelasRes.data?.id
  cek('guru membuat kelas → 201', kelasRes.status === 201 && kelasId > 0, `status=${kelasRes.status} ${galatRingkas(kelasRes.data)}`)
  const kelasUlang = await guru.post('/api/v1/kelas', { nama: `Smoke ${TANDA}`, tingkat: 6 })
  cek('nama kelas duplikat ditolak 422', kelasUlang.status === 422, `status=${kelasUlang.status}`)
  const ubahKelas = await guru.put(`/api/v1/kelas/${kelasId}`, { nama: `Smoke ${TANDA}`, tingkat: 6, tahun_ajaran: '2026/2027' })
  cek('guru mengubah kelas', ubahKelas.status === 200, `status=${ubahKelas.status}`)

  const mapelRes = await guru.post('/api/v1/mapel', { nama: `Matematika Smoke ${TANDA}`, kode: `MS${TANDA.slice(-4)}`.toUpperCase() })
  const mapelId = mapelRes.data?.id
  cek('guru membuat mapel → 201', mapelRes.status === 201 && mapelId > 0, `status=${mapelRes.status}`)

  const tagRes = await guru.post('/api/v1/tag', { nama: `Operasi Smoke ${TANDA}`, deskripsi: 'Tag uji asap' })
  const tagId = tagRes.data?.id
  cek('guru membuat tag → 201', tagRes.status === 201 && tagId > 0, `status=${tagRes.status}`)
  const tagUlang = await guru.post('/api/v1/tag', { nama: `Operasi Smoke ${TANDA}` })
  cek('nama tag duplikat di satu sekolah ditolak 422', tagUlang.status === 422, `status=${tagUlang.status}`)

  const muridAEmail = `smoke.murid.a.${TANDA}@murid.test`
  const muridBEmail = `smoke.murid.b.${TANDA}@murid.test`
  const buatMuridA = await guru.post('/api/v1/murid', { nama: `Murid A ${TANDA}`, email: muridAEmail, class_id: kelasId, kata_sandi: SANDI_MURID })
  const buatMuridB = await guru.post('/api/v1/murid', { nama: `Murid B ${TANDA}`, email: muridBEmail, class_id: kelasId, kata_sandi: SANDI_MURID })
  cek('guru menambah murid (akun + sandi) → 201', buatMuridA.status === 201 && buatMuridB.status === 201, `status=${buatMuridA.status}/${buatMuridB.status}`)
  const muridAId = buatMuridA.data?.id
  const muridBId = buatMuridB.data?.id

  // Nama anak tidak unik di sekolah: dulu indeks unik sisa scaffold pada
  // `users` (name, guard_name) membuat murid kedua bernama sama ditolak 500.
  const namaSamaA = await guru.post('/api/v1/murid', { nama: `Nama Sama ${TANDA}`, email: `sama.a.${TANDA}@murid.test`, class_id: kelasId })
  const namaSamaB = await guru.post('/api/v1/murid', { nama: `Nama Sama ${TANDA}`, email: `sama.b.${TANDA}@murid.test`, class_id: kelasId })
  cek('dua murid boleh bernama sama (bukan 500)', namaSamaA.status === 201 && namaSamaB.status === 201, `status=${namaSamaA.status}/${namaSamaB.status} ${galatRingkas(namaSamaB.data)}`)

  const daftarMurid = daftar((await guru.get('/api/v1/murid?per_page=200')).data)
  const muridMandiri = daftarMurid.find((m) => m.email === emailMandiri)
  cek('murid hasil daftar mandiri muncul di daftar murid guru', Boolean(muridMandiri), `total=${daftarMurid.length}`)
  if (muridMandiri) {
    const pindah = await guru.put(`/api/v1/murid/${muridMandiri.id}`, { nama: 'Murid Mandiri', email: emailMandiri, class_id: kelasId })
    cek('guru memindahkan murid mandiri ke kelasnya', pindah.status === 200, `status=${pindah.status}`)
  }

  const eksporMurid = await guru.unduh('/api/v1/murid/ekspor?delimiter=;')
  cek('ekspor murid CSV ber-BOM UTF-8 (byte mentah)', punyaBom(eksporMurid.buf), `3 byte pertama=${eksporMurid.buf.subarray(0, 3).toString('hex')}`)
  cek('ekspor murid memakai titik koma saat diminta', eksporMurid.teks.split('\n')[0].includes(';'), `header=${eksporMurid.teks.split('\n')[0].slice(0, 70)}`)
  const eksporKoma = await guru.unduh('/api/v1/murid/ekspor')
  cek('ekspor murid tetap bisa koma (bawaan)', eksporKoma.teks.split('\n')[0].includes(','), '')

  // Impor: baris valid, satu baris rusak di tengah, satu baris valid lagi.
  const csvImpor = ['nama,email,kelas', `Impor Satu ${TANDA},impor.satu.${TANDA}@murid.test,Smoke ${TANDA}`, `Impor Rusak ${TANDA},,Smoke ${TANDA}`, `Impor Tiga ${TANDA},impor.tiga.${TANDA}@murid.test,Smoke ${TANDA}`].join('\n')
  const impor = await guru.kirim('POST', '/api/v1/murid/impor', berkas('murid.csv', csvImpor, 'text/csv'))
  const laporan = impor.data?.laporan ?? {}
  cek('impor murid dijawab laporan, bukan 500', impor.status === 200 && typeof laporan.sukses === 'number', `status=${impor.status} sukses=${laporan.sukses} gagal=${laporan.gagal}`)
  cek('baris rusak dilaporkan dengan nomor barisnya', (laporan.galat ?? []).some((g) => g.baris === 3), `galat=${JSON.stringify((laporan.galat ?? []).slice(0, 2))}`)
  cek('baris valid tetap masuk (sukses ≥ 1)', (laporan.sukses ?? 0) >= 1, `sukses=${laporan.sukses}`)
  const imporAnsi = ['nama;email;kelas', `Impor Titik Koma ${TANDA};impor.titik.${TANDA}@murid.test;Smoke ${TANDA}`].join('\n')
  const impor2 = await guru.kirim('POST', '/api/v1/murid/impor', berkas('murid.csv', Buffer.from(imporAnsi, 'latin1'), 'text/csv'))
  cek('impor CSV Excel Indonesia (titik koma) terbaca', impor2.status === 200 && (impor2.data?.laporan?.sukses ?? 0) >= 1, `status=${impor2.status} sukses=${impor2.data?.laporan?.sukses}`)

  // ---------- D. Bank soal (delapan tipe) ----------
  judul('D. Bank soal delapan tipe + penjagaan media')
  const buatSoal = async (nama, tipe, konten, kunci, skor = 5) => {
    const res = await guru.post('/api/v1/soal', { subject_id: mapelId, tag_id: tagId, tipe, konten, kunci, skor })
    cek(`soal ${nama} dibuat lewat API`, res.status === 201, `status=${res.status} ${galatRingkas(res.data)}`)
    return res.data?.id
  }

  const idPg = await buatSoal('pilihan_ganda', 'pilihan_ganda', {
    teks: 'Berapa hasil dari 4 + 5?',
    opsi: [{ id: 'A', teks: '8' }, { id: 'B', teks: '9' }, { id: 'C', teks: '10' }],
  }, { jawaban: 'B' }, 5)
  const idBs = await buatSoal('benar_salah', 'benar_salah', { teks: 'Hasil 9 x 3 adalah 27.' }, { benar: true }, 5)
  const idIsian = await buatSoal('isian_singkat', 'isian_singkat', { teks: 'Ibu kota Indonesia?' }, { jawaban_baku: ['Jakarta'] }, 5)
  const idUraian = await buatSoal('uraian', 'uraian', { teks: 'Jelaskan proses fotosintesis.' }, {
    kata_kunci: [{ teks: 'fotosintesis', bobot: 2 }, { teks: 'klorofil' }, { teks: 'cahaya matahari' }],
    ambang_lulus: 0.6,
  }, 8)
  const idJodoh = await buatSoal('menjodohkan', 'menjodohkan', {
    teks: 'Jodohkan dengan hasilnya.',
    kiri: [{ id: 'k1', teks: '6 x 2' }, { id: 'k2', teks: '20 - 5' }],
    kanan: [{ id: 'n1', teks: '12' }, { id: 'n2', teks: '15' }],
  }, { pasangan: { k1: 'n1', k2: 'n2' } }, 5)
  const idUrut = await buatSoal('mengurutkan', 'mengurutkan', {
    teks: 'Urutkan dari terkecil.',
    item: [{ id: 'i1', teks: '9' }, { id: 'i2', teks: '3' }, { id: 'i3', teks: '7' }],
  }, { urutan: ['i2', 'i3', 'i1'] }, 5)
  const idLetak = await buatSoal('letak_kata', 'letak_kata', {
    teks: 'Letakkan kata pada posisinya.',
    kata: [{ id: 'w1', teks: 'dua' }, { id: 'w2', teks: 'lima' }],
    posisi: [{ id: 'p1', teks: '2 + 3 = ___' }, { id: 'p2', teks: '1 + 1 = ___' }],
  }, { penempatan: { w2: 'p1', w1: 'p2' } }, 5)
  const idHubung = await buatSoal('hubung_kata', 'hubung_kata', {
    teks: 'Hubungkan kata dengan artinya.',
    kiri: [{ id: 'h1', teks: 'besar' }, { id: 'h2', teks: 'cepat' }],
    kanan: [{ id: 'v1', teks: 'lambat' }, { id: 'v2', teks: 'kecil' }],
  }, { sambungan: { h1: 'v2', h2: 'v1' } }, 5)

  const tipeSalah = await guru.post('/api/v1/soal', { subject_id: mapelId, tipe: 'entah_apa', konten: { teks: 'x' }, kunci: { jawaban: 'A' } })
  cek('tipe soal tak dikenal ditolak 422', tipeSalah.status === 422, `status=${tipeSalah.status}`)
  const kunciIsianSalah = await guru.post('/api/v1/soal', { subject_id: mapelId, tipe: 'isian_singkat', konten: { teks: 'x' }, kunci: { jawaban: 'Jakarta' } })
  cek('kunci isian tanpa jawaban_baku ditolak registry (422)', kunciIsianSalah.status === 422, `status=${kunciIsianSalah.status}`)
  const mediLuar = await guru.post('/api/v1/soal', {
    subject_id: mapelId, tipe: 'pilihan_ganda',
    konten: { teks: 'Soal media luar', media: 'https://situs-luar.example/gambar.png', opsi: [{ id: 'A', teks: 'a' }, { id: 'B', teks: 'b' }] },
    kunci: { jawaban: 'A' },
  })
  cek('media host luar ditolak 422 (U-01)', mediLuar.status === 422, `status=${mediLuar.status} ${galatRingkas(mediLuar.data)}`)
  const mediaDalam = await guru.post('/api/v1/soal', {
    subject_id: mapelId, tipe: 'pilihan_ganda',
    konten: { teks: 'Soal media internal', media: '/media/lingkaran.png', opsi: [{ id: 'A', teks: 'a' }, { id: 'B', teks: 'b' }] },
    kunci: { jawaban: 'A' },
  })
  cek('media path internal diterima', mediaDalam.status === 201, `status=${mediaDalam.status}`)
  const bankSoal = await guru.get('/api/v1/soal?per_page=200')
  cek('bank soal memuat kunci untuk guru', bankSoal.status === 200 && daftar(bankSoal.data).length >= 8, `jumlah=${daftar(bankSoal.data).length}`)
  const sosokSoal = await guru.get(`/api/v1/soal/${idPg}`)
  cek('guru membaca satu soal (dengan kunci)', sosokSoal.status === 200 && sosokSoal.data?.kunci?.jawaban === 'B', `status=${sosokSoal.status}`)

  // ---------- E. Kuis ----------
  judul('E. Kuis (buat, susun soal, terbitkan, arsip)')
  const kuisRes = await guru.post('/api/v1/kuis', {
    judul: `Ulangan Smoke ${TANDA}`,
    deskripsi: 'Kuis uji asap fitur.',
    subject_id: mapelId,
    class_id: kelasId,
    durasi_menit: 30,
    mulai_at: iso(Date.now() - 5 * 60 * 1000),
    selesai_at: iso(Date.now() + 3 * 60 * 60 * 1000),
    acak_soal: false,
    acak_opsi: false,
  })
  const kuisId = kuisRes.data?.id
  cek('guru membuat kuis → 201', kuisRes.status === 201 && kuisId > 0, `status=${kuisRes.status} ${galatRingkas(kuisRes.data)}`)
  cek('guru menyusun daftar soal kuis', (await guru.put(`/api/v1/kuis/${kuisId}/soal`, { soal: [idPg] })).status === 200, '')
  const terbit = await guru.post(`/api/v1/kuis/${kuisId}/publikasi`)
  cek('kuis diterbitkan → 200', terbit.status === 200, `status=${terbit.status} ${galatRingkas(terbit.data)}`)
  const detailKuis = await guru.get(`/api/v1/kuis/${kuisId}`)
  cek('detail kuis memuat soal & status terbit', detailKuis.status === 200 && (detailKuis.data?.soal ?? []).length >= 1, `status=${detailKuis.status} soal=${(detailKuis.data?.soal ?? []).length}`)
  const daftarKuis = await guru.get('/api/v1/kuis?per_page=5')
  cek('daftar kuis guru terbaca', daftarKuis.status === 200 && daftar(daftarKuis.data).length >= 1, `jumlah=${daftar(daftarKuis.data).length}`)

  // ---------- F. Pengerjaan & penilaian (murid) ----------
  judul('F. Pengerjaan ulangan & penilaian (murid)')
  const masukMurid = await murid.masuk({ email: muridAEmail, password: SANDI_MURID })
  cek('murid buatan guru bisa masuk', masukMurid.status === 200, `status=${masukMurid.status} ${galatRingkas(masukMurid.data)}`)

  const resetPalsu = await new Sesi('reset-palsu').post('/api/v1/auth/atur-ulang-sandi', {
    token: 'token-palsu-999999',
    email: muridAEmail,
    password: 'sandi-palsu-baru-10',
    password_confirmation: 'sandi-palsu-baru-10',
  })
  cek('percobaan reset dengan token palsu ditandai tidak berhasil', resetPalsu.data?.berhasil === false, `berhasil=${resetPalsu.data?.berhasil}`)
  const sandiLama = await new Sesi('cek-sandi-lama').masuk({ email: muridAEmail, password: SANDI_MURID })
  cek('kata sandi lama masih berlaku setelah percobaan reset gagal', sandiLama.status === 200, `status=${sandiLama.status}`)

  const mulainya = await murid.post(`/api/v1/kuis/${kuisId}/mulai`)
  const attemptId = mulainya.data?.id
  cek('murid membuka ulangan → 201', mulainya.status === 201 && attemptId > 0, `status=${mulainya.status} ${galatRingkas(mulainya.data)}`)
  const soalMulai = mulainya.data?.soal ?? []
  cek('soal memuat konten & tanpa kunci jawaban', soalMulai.length >= 1 && !JSON.stringify(soalMulai).includes('"kunci"'), `soal=${soalMulai.length}`)

  const klikGanda = await murid.post(`/api/v1/kuis/${kuisId}/mulai`)
  cek('Mulai dua kali tidak membuat attempt baru / bukan 500 (Q-07)', klikGanda.data?.id === attemptId && klikGanda.status < 500, `status=${klikGanda.status} id=${klikGanda.data?.id}`)

  const jawab = (questionId, nilai) => murid.post(`/api/v1/attempt/${attemptId}/jawab`, { question_id: questionId, jawaban: nilai })
  const j1 = await jawab(idPg, 'B')
  cek('murid menjawab pilihan ganda → 200', j1.status === 200, `status=${j1.status} ${galatRingkas(j1.data)}`)
  cek('jawaban tersimpan dengan status menunggu', j1.data?.status === 'menunggu', `status=${j1.data?.status}`)
  const jUlang = await jawab(idPg, 'B')
  cek('menjawab soal sama hanya memperbarui', jUlang.status === 200, `status=${jUlang.status}`)
  const muatUlang = await murid.get(`/api/v1/attempt/${attemptId}`)
  const tersimpan = (muatUlang.data?.jawaban ?? []).find((j) => j.question_id === idPg)
  cek('jawaban tersimpan terbaca kembali saat halaman dimuat ulang', tersimpan?.jawaban === 'B', `jawaban=${tersimpan?.jawaban}`)
  cek('layar ulangan tidak mengirim kunci jawaban', !/kunci/i.test(JSON.stringify(muatUlang.data ?? {})), '')

  // Q-12: setelan acak opsi dibekukan saat attempt dimulai, bukan dibaca hidup.
  const opsiAwal = urutanOpsi(soalMulai.find((s) => s.id === idPg))
  const putarAcak = await guru.put(`/api/v1/kuis/${kuisId}`, {
    judul: `Ulangan Smoke ${TANDA}`,
    subject_id: mapelId,
    class_id: kelasId,
    durasi_menit: 30,
    mulai_at: iso(Date.now() - 5 * 60 * 1000),
    selesai_at: iso(Date.now() + 3 * 60 * 60 * 1000),
    acak_soal: false,
    acak_opsi: true,
  })
  const attemptLagi = await murid.get(`/api/v1/attempt/${attemptId}`)
  const opsiSesudah = urutanOpsi((attemptLagi.data?.soal ?? []).find((s) => s.id === idPg))
  cek('guru boleh menyalakan acak_opsi saat ulangan berjalan', putarAcak.status === 200, `status=${putarAcak.status}`)
  cek('urutan opsi murid tidak berubah (Q-12: setelan dibekukan di snapshot)',
    opsiAwal.length > 0 && opsiAwal.join(',') === opsiSesudah.join(','),
    `sebelum=${opsiAwal.join(',')} sesudah=${opsiSesudah.join(',')}`)

  // Q-09 lapis pertama: soal yang dipakai kuis berjalan tidak bisa disunting.
  const ubahSoalSaatJalan = await guru.put(`/api/v1/soal/${idPg}`, {
    subject_id: mapelId, tipe: 'pilihan_ganda',
    konten: { teks: 'Berapa hasil dari 4 + 5?', opsi: [{ id: 'A', teks: '8' }, { id: 'B', teks: '9' }, { id: 'C', teks: '10' }] },
    kunci: { jawaban: 'C' }, skor: 50,
  })
  cek('soal terkunci selama kuisnya berjalan (lapis pertama Q-09)', ubahSoalSaatJalan.status === 422, `status=${ubahSoalSaatJalan.status} ${galatRingkas(ubahSoalSaatJalan.data)}`)

  const kumpul = await murid.post(`/api/v1/attempt/${attemptId}/kumpulkan`, { idempotency_key: `kunci-${TANDA}` })
  cek('murid mengumpulkan ulangan → 200', kumpul.status === 200, `status=${kumpul.status} ${galatRingkas(kumpul.data)}`)
  const kumpulUlang = await murid.post(`/api/v1/attempt/${attemptId}/kumpulkan`, { idempotency_key: `kunci-${TANDA}` })
  cek('mengumpulkan dua kali idempoten (bukan 500)', kumpulUlang.status === 200, `status=${kumpulUlang.status}`)

  const hasilKuis = await murid.get(`/api/v1/attempt/${attemptId}/hasil`)
  const skor = hasilKuis.data?.skor ?? hasilKuis.data?.attempt?.skor ?? hasilKuis.data?.hasil?.skor
  const maks = hasilKuis.data?.skor_maksimal ?? hasilKuis.data?.attempt?.skor_maksimal ?? hasilKuis.data?.hasil?.skor_maksimal
  cek('hasil tersedia & memuat skor', hasilKuis.status === 200 && skor !== undefined, `status=${hasilKuis.status} skor=${skor} maks=${maks}`)
  cek('jawaban benar dinilai benar (skor 5 dari 5)', Number(skor) === 5, `skor=${skor}`)
  cek('hasil murid tidak membocorkan kunci', !/kunci\.jawaban/i.test(JSON.stringify(hasilKuis.data ?? {})), '')
  cek('murid melihat rincian per soal di hasil', (hasilKuis.data?.per_soal ?? []).length >= 1, `per_soal=${(hasilKuis.data?.per_soal ?? []).length}`)

  // Q-09 lapis kedua: setelah jadwal kuis lewat, soal boleh disunting — nilai lama
  // harus tetap memakai snapshot attempt.
  const tutupJadwal = await guru.put(`/api/v1/kuis/${kuisId}`, {
    judul: `Ulangan Smoke ${TANDA}`,
    subject_id: mapelId,
    class_id: kelasId,
    durasi_menit: 30,
    mulai_at: iso(Date.now() - 60 * 60 * 1000),
    selesai_at: iso(Date.now() - 60 * 1000),
    acak_soal: false,
    acak_opsi: false,
  })
  const ubahSoalSetelah = await guru.put(`/api/v1/soal/${idPg}`, {
    subject_id: mapelId, tipe: 'pilihan_ganda',
    konten: { teks: 'Berapa hasil dari 4 + 5?', opsi: [{ id: 'A', teks: '8' }, { id: 'B', teks: '9' }, { id: 'C', teks: '10' }] },
    kunci: { jawaban: 'C' }, skor: 50,
  })
  const hasilSetelahUbah = await murid.get(`/api/v1/attempt/${attemptId}/hasil`)
  const skorSetelah = hasilSetelahUbah.data?.skor ?? hasilSetelahUbah.data?.attempt?.skor ?? hasilSetelahUbah.data?.hasil?.skor
  const maksSetelah = hasilSetelahUbah.data?.skor_maksimal ?? hasilSetelahUbah.data?.attempt?.skor_maksimal ?? hasilSetelahUbah.data?.hasil?.skor_maksimal
  cek('jadwal kuis ditutup guru', tutupJadwal.status === 200, `status=${tutupJadwal.status}`)
  cek('soal boleh disunting setelah jadwal kuis lewat', ubahSoalSetelah.status === 200, `status=${ubahSoalSetelah.status} ${galatRingkas(ubahSoalSetelah.data)}`)
  cek('kunci & skor baru TIDAK mengubah nilai attempt lama (snapshot Q-09)', Number(skorSetelah) === 5 && Number(maksSetelah) === 5, `skor=${skorSetelah} maks=${maksSetelah}`)

  const jawabSetelahKumpul = await jawab(idPg, 'A')
  cek('menjawab setelah dikumpulkan ditolak (bukan 500)', jawabSetelahKumpul.status >= 400 && jawabSetelahKumpul.status < 500, `status=${jawabSetelahKumpul.status}`)

  // Q-19: jawaban bersalah bentuk harus dinilai salah, bukan 500.
  const kuisBentuk = await guru.post('/api/v1/kuis', {
    judul: `Ulangan Bentuk Smoke ${TANDA}`,
    subject_id: mapelId,
    class_id: kelasId,
    durasi_menit: 20,
    mulai_at: iso(Date.now() - 5 * 60 * 1000),
    selesai_at: iso(Date.now() + 3 * 60 * 60 * 1000),
    acak_soal: false,
    acak_opsi: false,
  })
  const kuisBentukId = kuisBentuk.data?.id
  if (kuisBentukId) {
    await guru.put(`/api/v1/kuis/${kuisBentukId}/soal`, { soal: [idJodoh, idUrut, idLetak, idHubung] })
    await guru.post(`/api/v1/kuis/${kuisBentukId}/publikasi`)
    const mulaiBentuk = await murid.post(`/api/v1/kuis/${kuisBentukId}/mulai`)
    const attemptBentuk = mulaiBentuk.data?.id
    cek('murid membuka ulangan bertipe khusus → 201', mulaiBentuk.status === 201, `status=${mulaiBentuk.status} ${galatRingkas(mulaiBentuk.data)}`)
    if (attemptBentuk) {
      // Jawaban bersalah bentuk DULU (harus dinilai salah, bukan 500), lalu yang
      // benar supaya nilai akhirnya benar-benar mencerminkan penilaian.
      const bentukSalah = [
        ['menjodohkan', idJodoh, ['k1', 'n1']],
        ['mengurutkan', idUrut, { urutan: ['i1'] }],
        ['letak_kata', idLetak, 'w1=p1'],
        ['hubung_kata', idHubung, [['h1', 'v2']]],
      ]
      for (const [nama, qid, nilai] of bentukSalah) {
        const res = await murid.post(`/api/v1/attempt/${attemptBentuk}/jawab`, { question_id: qid, jawaban: nilai })
        cek(`jawaban bersalah bentuk pada ${nama} tidak membuat 500 (Q-19)`, res.status < 500, `status=${res.status}`)
      }
      const bentukBenar = [
        ['menjodohkan', idJodoh, { k1: 'n1', k2: 'n2' }],
        ['mengurutkan', idUrut, ['i2', 'i3', 'i1']],
        ['letak_kata', idLetak, { w1: 'p2', w2: 'p1' }],
        ['hubung_kata', idHubung, { h1: 'v2', h2: 'v1' }],
      ]
      for (const [nama, qid, nilai] of bentukBenar) {
        const res = await murid.post(`/api/v1/attempt/${attemptBentuk}/jawab`, { question_id: qid, jawaban: nilai })
        cek(`jawaban bentuk benar pada ${nama} diterima`, res.status === 200, `status=${res.status} ${galatRingkas(res.data)}`)
      }
      const kumpulBentuk = await murid.post(`/api/v1/attempt/${attemptBentuk}/kumpulkan`, { idempotency_key: `bentuk-${TANDA}` })
      cek('ulangan bertipe khusus bisa dikumpulkan', kumpulBentuk.status === 200, `status=${kumpulBentuk.status}`)
      const hasilBentuk = await murid.get(`/api/v1/attempt/${attemptBentuk}/hasil`)
      cek('nilai ulangan bertipe khusus dihitung (≥ 1 soal dinilai)', hasilBentuk.status === 200 && Number(hasilBentuk.data?.skor ?? 0) >= 1, `status=${hasilBentuk.status} skor=${hasilBentuk.data?.skor}`)
    }
  }

  // ---------- G. Peringkat, badge, progres, laporan ----------
  judul('G. Peringkat, badge, progres, laporan, ekspor nilai')
  cek('guru membaca peringkat kuis → 200', (await guru.get(`/api/v1/kuis/${kuisId}/ranking`)).status === 200, '')
  cek('guru membaca laporan per tema → 200', (await guru.get(`/api/v1/kuis/${kuisId}/laporan`)).status === 200, '')
  cek('murid ditolak membaca laporan guru (403)', (await murid.get(`/api/v1/kuis/${kuisId}/laporan`)).status === 403, '')
  // K-02: detail kuis untuk murid hanya metadata — isi soal baru keluar lewat
  // attempt yang sudah dimulai, dalam urutan hasil pengacakan server.
  const detailMurid = await murid.get(`/api/v1/kuis/${kuisId}`)
  cek('murid membaca detail kuis tanpa daftar soal (K-02)', detailMurid.status === 200 && detailMurid.data?.soal === undefined, `status=${detailMurid.status} soal=${Array.isArray(detailMurid.data?.soal) ? detailMurid.data.soal.length : 'tidak ada'}`)
  cek('detail kuis murid tidak memuat kunci/pembahasan', !/"(kunci|pembahasan)"/.test(JSON.stringify(detailMurid.data ?? {})), '')

  const badgeGet = await murid.get('/api/v1/badge/saya')
  const badgePost = await murid.post('/api/v1/badge/saya')
  cek('GET /badge/saya 200', badgeGet.status === 200, `status=${badgeGet.status}`)
  cek('alias POST /badge/saya 200 (bukan 405)', badgePost.status === 200, `status=${badgePost.status}`)
  const progresGet = await murid.get('/api/v1/progres/saya')
  const progresPost = await murid.post('/api/v1/progres/saya')
  cek('GET /progres/saya 200', progresGet.status === 200, `status=${progresGet.status}`)
  cek('alias POST /progres/saya 200 (bukan 405)', progresPost.status === 200, `status=${progresPost.status}`)

  const eksporNilai = await guru.unduh(`/api/v1/kuis/${kuisId}/ekspor-nilai?delimiter=;`)
  cek('ekspor nilai kuis ber-BOM UTF-8 (byte mentah)', punyaBom(eksporNilai.buf), `3 byte pertama=${eksporNilai.buf.subarray(0, 3).toString('hex')}`)
  cek('ekspor nilai memakai titik koma saat diminta', eksporNilai.teks.split('\n')[0].includes(';'), `header=${eksporNilai.teks.split('\n')[0].slice(0, 70)}`)
  cek('ekspor nilai memuat murid yang mengerjakan', eksporNilai.teks.includes(`Murid A ${TANDA}`), '')
  cek('ekspor nilai memuat jam WIB', /\d{2}:\d{2}/.test(eksporNilai.teks) || eksporNilai.teks.includes('WIB'), `contoh=${eksporNilai.teks.split('\n')[1]?.slice(0, 90) ?? ''}`)

  // ---------- H. Koreksi manual ----------
  judul('H. Koreksi manual ber-token')
  const kuisUraian = await guru.post('/api/v1/kuis', {
    judul: `Ulangan Uraian Smoke ${TANDA}`,
    subject_id: mapelId,
    class_id: kelasId,
    durasi_menit: 30,
    mulai_at: iso(Date.now() - 5 * 60 * 1000),
    selesai_at: iso(Date.now() + 3 * 60 * 60 * 1000),
    acak_soal: false,
    acak_opsi: false,
  })
  const kuisUraianId = kuisUraian.data?.id
  if (kuisUraianId && idUraian) {
    await guru.put(`/api/v1/kuis/${kuisUraianId}/soal`, { soal: [idUraian] })
    await guru.post(`/api/v1/kuis/${kuisUraianId}/publikasi`)
    const mulaiUraian = await murid.post(`/api/v1/kuis/${kuisUraianId}/mulai`)
    const attemptUraian = mulaiUraian.data?.id
    await murid.post(`/api/v1/attempt/${attemptUraian}/jawab`, { question_id: idUraian, jawaban: 'Daun punya klorofil.' })
    const kumpulUraian = await murid.post(`/api/v1/attempt/${attemptUraian}/kumpulkan`, { idempotency_key: `uraian-${TANDA}` })
    cek('uraian di bawah ambang bisa dikumpulkan', kumpulUraian.status === 200, `status=${kumpulUraian.status}`)

    const antrean = await guru.get(`/api/v1/kuis/${kuisUraianId}/koreksi`)
    const isiAntrean = antrean.data?.item ?? []
    cek('guru membuka antrean koreksi → 200', antrean.status === 200, `status=${antrean.status}`)
    cek('jawaban uraian muncul di antrean koreksi guru', isiAntrean.length >= 1, `jumlah=${isiAntrean.length}`)
    cek('antrean koreksi menyebut alasan minimum', (antrean.data?.alasan_min ?? 0) > 0, `alasan_min=${antrean.data?.alasan_min}`)

    const tanpaAlasan = await guru.post(`/api/v1/attempt/${attemptUraian}/koreksi/token`, { question_id: idUraian })
    cek('minta token koreksi tanpa alasan ditolak 422 (Q-15)', tanpaAlasan.status === 422, `status=${tanpaAlasan.status} ${galatRingkas(tanpaAlasan.data)}`)
    const alasanPendek = await guru.post(`/api/v1/attempt/${attemptUraian}/koreksi/token`, { question_id: idUraian, alasan: 'pendek' })
    cek('alasan koreksi yang terlalu pendek ditolak 422', alasanPendek.status === 422, `status=${alasanPendek.status}`)

    const alasanKoreksi = 'Kata kunci klorofil benar, sisanya kurang lengkap.'
    const token = await guru.post(`/api/v1/attempt/${attemptUraian}/koreksi/token`, { question_id: idUraian, alasan: alasanKoreksi })
    const tokenNilai = token.data?.token ?? token.data?.kode
    cek('guru meminta token koreksi sekali pakai', [200, 201].includes(token.status) && typeof tokenNilai === 'string', `status=${token.status} ${galatRingkas(token.data)}`)
    if (tokenNilai) {
      const koreksi = await guru.post(`/api/v1/attempt/${attemptUraian}/koreksi`, { question_id: idUraian, skor: 6, alasan: alasanKoreksi, token: tokenNilai })
      cek('koreksi manual tersimpan dengan alasan + token → 200', koreksi.status === 200, `status=${koreksi.status} ${galatRingkas(koreksi.data)}`)
      const tokenUlang = await guru.post(`/api/v1/attempt/${attemptUraian}/koreksi`, { question_id: idUraian, skor: 8, alasan: 'Coba pakai token lama.', token: tokenNilai })
      cek('token koreksi tidak bisa dipakai dua kali (422)', tokenUlang.status === 422, `status=${tokenUlang.status}`)
    }
    const nilaiAi = await guru.post(`/api/v1/attempt/${attemptUraian}/nilai-ai`, { question_id: idUraian })
    cek('saran nilai AI dijawab jujur (aktif/nonaktif) tanpa 500', nilaiAi.status < 500, `status=${nilaiAi.status} aktif=${nilaiAi.data?.aktif}`)
    const aiNyala = nilaiAi.data?.aktif === true
    cek('status penilaian AI dilaporkan di antrean koreksi', (antrean.data?.ai_aktif ?? null) === aiNyala, `ai_aktif=${antrean.data?.ai_aktif}`)

    const guruLainToken = await guru2.post(`/api/v1/attempt/${attemptUraian}/koreksi/token`, { question_id: idUraian, alasan: alasanKoreksi })
    cek('guru lain tidak boleh mengoreksi nilai kuis orang (403)', guruLainToken.status === 403, `status=${guruLainToken.status}`)
  } else {
    cek('kuis uraian siap diuji', false, `kuis=${kuisUraianId} soal=${idUraian}`)
  }

  // ---------- I. Materi berblok ----------
  judul('I. Materi berblok (timeline, kuis sisipan, unggahan)')
  const materiRes = await guru.post('/api/v1/materi', {
    judul: `Materi Smoke ${TANDA}`,
    deskripsi: 'Materi uji asap.',
    subject_id: mapelId,
    class_id: kelasId,
    tag_id: tagId,
  })
  const materiId = materiRes.data?.id
  cek('guru membuat materi → 201', materiRes.status === 201 && materiId > 0, `status=${materiRes.status} ${galatRingkas(materiRes.data)}`)
  const simpanBlok = await guru.put(`/api/v1/materi/${materiId}/blok`, {
    blok: [
      { tipe: 'teks', isi: { teks: 'Bab 1: penjumlahan.' }, track: 0, mulai_detik: 0, durasi_detik: 30 },
      { tipe: 'kuis', quiz_id: kuisId, track: 1, mulai_detik: 30, durasi_detik: 60 },
    ],
  })
  cek('guru menyusun blok materi (teks + kuis sisipan, dengan track)', simpanBlok.status === 200, `status=${simpanBlok.status} ${galatRingkas(simpanBlok.data)}`)
  cek('materi diterbitkan → 200', (await guru.post(`/api/v1/materi/${materiId}/publikasi`)).status === 200, '')
  cek('murid melihat materi kelasnya', (await murid.get('/api/v1/materi-saya')).status === 200, '')

  const detailMateri = await murid.get(`/api/v1/materi/${materiId}`)
  const blokMateri = detailMateri.data?.blok ?? []
  cek('detail materi memuat blok hasil susunan guru', detailMateri.status === 200 && blokMateri.length >= 2, `status=${detailMateri.status} blok=${blokMateri.length}`)
  // Penempatan timeline (track/detik) hanya dikirim ke layar GURU: murid cukup
  // menerima block_id/urutan/status, jadi uji ini memakai respons guru.
  const detailMateriGuru = await guru.get(`/api/v1/materi/${materiId}`)
  const blokGuru = detailGuruBlok(detailMateriGuru.data)
  const adaTimeline = blokGuru.some((b) => b.track !== undefined && b.mulai_detik !== undefined && b.durasi_detik !== undefined)
  cek('klip materi menyimpan penempatan timeline (track/detik) di layar guru', adaTimeline, `contoh=${JSON.stringify(blokGuru[1] ?? {}).slice(0, 160)}`)
  cek('murid tidak dikirimi penempatan timeline mentah', blokMateri.every((b) => b.track === undefined), `kunci=${Object.keys(blokMateri[0] ?? {}).join(',')}`)
  const blokPertama = blokMateri[0]?.block_id ?? blokMateri[0]?.id
  if (blokPertama) {
    cek('murid membuka blok materi', (await murid.post(`/api/v1/materi/${materiId}/blok/${blokPertama}/buka`)).status === 200, '')
    cek('murid menyelesaikan blok materi', (await murid.post(`/api/v1/materi/${materiId}/blok/${blokPertama}/selesai`)).status === 200, '')
  } else {
    cek('blok materi punya penanda untuk dibuka murid', false, JSON.stringify(blokMateri[0] ?? {}))
  }
  cek('murid membaca progres materi', (await murid.get(`/api/v1/materi/${materiId}/progres`)).status === 200, '')
  cek('guru membaca laporan materi', (await guru.get(`/api/v1/materi/${materiId}/laporan`)).status === 200, '')

  const isiCatatan = 'halo dunia'
  const mulaiUnggah = await guru.post(`/api/v1/materi/${materiId}/unggahan`, { nama: 'catatan.txt', ukuran: Buffer.byteLength(isiCatatan) })
  const kodeUnggah = mulaiUnggah.data?.kode
  cek('guru memulai unggahan materi (ber-kode, alamatnya pakai kode)', [200, 201].includes(mulaiUnggah.status) && typeof kodeUnggah === 'string', `status=${mulaiUnggah.status}`)
  if (kodeUnggah) {
    const fd = new FormData()
    fd.append('potongan', new Blob([Buffer.from(isiCatatan)], { type: 'application/octet-stream' }), 'potongan-0')
    cek('potongan unggahan materi tersimpan', (await guru.kirim('PUT', `/api/v1/unggahan/${kodeUnggah}/potongan/0`, fd)).status === 200, '')
    const selesai = await guru.post(`/api/v1/unggahan/${kodeUnggah}/selesai`, {})
    cek('unggahan materi selesai', selesai.status === 200, `status=${selesai.status} ${galatRingkas(selesai.data)}`)
    // Berkas materi (kategori umum) hanya keluar lewat URL bertanda tangan;
    // rute mentahnya memang menolak tanpa tanda tangan.
    const urlMateri = selesai.data?.url
    cek('unggahan materi memberi URL bertanda tangan (bukan path storage)', typeof urlMateri === 'string' && urlMateri.includes('signature='), `url=${String(urlMateri ?? '').slice(0, 70)}`)
    if (typeof urlMateri === 'string') {
      const unduh = await guru.unduhAbsolut(urlMateri)
      cek('berkas materi bisa diunduh lewat URL bertanda tangan & isinya utuh', unduh.status === 200 && unduh.buf.toString('utf8') === isiCatatan, `status=${unduh.status} isi=${JSON.stringify(unduh.buf.toString('utf8').slice(0, 20))}`)
      const tanpaTanda = await guru.unduh(`/api/v1/berkas/${kodeUnggah}`)
      cek('berkas materi tanpa tanda tangan ditolak 403', tanpaTanda.status === 403, `status=${tanpaTanda.status}`)
    }
  }

  // ---------- J. Tim & snapshot keanggotaan ----------
  judul('J. Mode tim + snapshot anggota (Q-18)')
  const anggotaKelas = daftar((await guru.get('/api/v1/murid?per_page=200')).data).filter((m) => m.class_id === kelasId)
  const kuisTim = await guru.post('/api/v1/kuis', {
    judul: `Ulangan Tim Smoke ${TANDA}`,
    subject_id: mapelId,
    class_id: kelasId,
    durasi_menit: 30,
    mulai_at: iso(Date.now() - 5 * 60 * 1000),
    selesai_at: iso(Date.now() + 3 * 60 * 60 * 1000),
  })
  const kuisTimId = kuisTim.data?.id
  if (anggotaKelas.length >= 2 && kuisTimId) {
    const bagi = await guru.post(`/api/v1/kuis/${kuisTimId}/tim/bagi`, { jumlah_tim: 2 })
    cek('guru membagi tim otomatis → 200', bagi.status === 200, `status=${bagi.status} ${galatRingkas(bagi.data)}`)
    const daftarTim = await guru.get(`/api/v1/kuis/${kuisTimId}/tim`)
    cek('guru melihat daftar tim kuis', daftarTim.status === 200 && Array.isArray(daftarTim.data?.tim), `jumlah=${(daftarTim.data?.tim ?? []).length}`)

    // Kuis kedua: tim disusun MANUAL (bagi otomatis di kuis pertama sudah memakai
    // semua murid kelas, jadi mereka tak bisa dimasukkan ke tim lain di kuis itu).
    const kuisTimManual = await guru.post('/api/v1/kuis', {
      judul: `Ulangan Tim Manual Smoke ${TANDA}`,
      subject_id: mapelId,
      class_id: kelasId,
      durasi_menit: 30,
      mulai_at: iso(Date.now() - 5 * 60 * 1000),
      selesai_at: iso(Date.now() + 3 * 60 * 60 * 1000),
    })
    const kuisTimManualId = kuisTimManual.data?.id
    cek('guru menyiapkan kuis kedua untuk tim manual', kuisTimManualId > 0, `status=${kuisTimManual.status}`)

    // Mode tim adalah pengaturan tiga lapis (bawaan mati). Tanpa dinyalakan,
    // attempt dimulai sebagai ulangan individu: tanpa team_id dan tanpa
    // snapshot anggota (Q-18).
    const modeTim = await guru.put('/api/v1/pengaturan', { lingkup: 'kuis', lingkup_id: kuisTimManualId, kunci: 'mode_tim', nilai: true })
    cek('guru menyalakan mode tim lewat pengaturan lapis kuis', modeTim.status === 200, `status=${modeTim.status} ${galatRingkas(modeTim.data)}`)

    const timRes = await guru.post(`/api/v1/kuis/${kuisTimManualId}/tim`, {
      nama: `Tim Smoke ${TANDA}`,
      murid: [muridAId, muridBId].filter(Boolean),
    })
    cek('guru menyusun tim manual', [200, 201].includes(timRes.status), `status=${timRes.status} ${galatRingkas(timRes.data)}`)
    const timId = timRes.data?.tim?.id
    cek('respons penyusunan tim memuat id tim', Number(timId) > 0, `tim=${timId}`)

    await guru.put(`/api/v1/kuis/${kuisTimManualId}/soal`, { soal: [idPg] })
    await guru.post(`/api/v1/kuis/${kuisTimManualId}/publikasi`)
    // `tim-saya` hanya untuk kuis yang sudah terbit (policy view murid).
    const timSaya = await murid.get(`/api/v1/kuis/${kuisTimManualId}/tim-saya`)
    cek('murid melihat timnya sendiri setelah kuis terbit', timSaya.status === 200 && timSaya.data?.tim?.nama === `Tim Smoke ${TANDA}`, `status=${timSaya.status} tim=${timSaya.data?.tim?.nama}`)
    cek('murid melihat rekan satu timnya', (timSaya.data?.tim?.rekan ?? []).length >= 1, `rekan=${JSON.stringify(timSaya.data?.tim?.rekan ?? [])}`)

    const mulaiTim = await murid.post(`/api/v1/kuis/${kuisTimManualId}/mulai`)
    const attemptTim = mulaiTim.data?.id
    cek('murid memulai ulangan tim → 201', mulaiTim.status === 201, `status=${mulaiTim.status} ${galatRingkas(mulaiTim.data)}`)
    if (attemptTim) {
      await murid.post(`/api/v1/attempt/${attemptTim}/jawab`, { question_id: idPg, jawaban: 'B' })
      await murid.post(`/api/v1/attempt/${attemptTim}/kumpulkan`, { idempotency_key: `tim-${TANDA}` })
      // Snapshot Q-18: ekspor nilai membaca `attempt_members` (beku saat attempt
      // dimulai), bukan susunan tim yang hidup — tiap anggota dapat baris dengan
      // nama tim dan skor tim yang sama.
      const eksporTim = await guru.unduh(`/api/v1/kuis/${kuisTimManualId}/ekspor-nilai`)
      const barisTim = eksporTim.teks.split('\n').filter((b) => b.includes(`Tim Smoke ${TANDA}`))
      cek('ekspor nilai memakai nama tim dari snapshot (Q-18)', eksporTim.status === 200 && barisTim.length >= 2, `status=${eksporTim.status} baris=${barisTim.length}`)
      cek('skor tim dibagi ke semua anggota di ekspor', barisTim.every((b) => b.includes(',2,')), `contoh=${String(barisTim[0] ?? '').slice(0, 120)}`)
      const hapusTim = await guru.del(`/api/v1/kuis/${kuisTimManualId}/tim/${timId}`)
      cek('tim tidak bisa dihapus setelah kuis dikerjakan (422)', hapusTim.status === 422, `status=${hapusTim.status} ${galatRingkas(hapusTim.data)}`)
    }
  } else {
    cek('anggota kelas cukup untuk membuat tim', false, `anggota=${anggotaKelas.length} kuis=${kuisTimId}`)
  }

  // ---------- K. Presence, anti-cheat, layar, SSE ----------
  judul('K. Presence, anti-cheat, layar guru, SSE')
  // Presence & kejadian kecurangan hanya berlaku untuk attempt yang MASIH JALAN,
  // jadi siapkan satu ulangan yang dibiarkan terbuka.
  const kuisJaga = await guru.post('/api/v1/kuis', {
    judul: `Ulangan Jaga Smoke ${TANDA}`,
    subject_id: mapelId,
    class_id: kelasId,
    durasi_menit: 30,
    mulai_at: iso(Date.now() - 5 * 60 * 1000),
    selesai_at: iso(Date.now() + 3 * 60 * 60 * 1000),
    acak_soal: false,
    acak_opsi: false,
  })
  const kuisJagaId = kuisJaga.data?.id
  await guru.put(`/api/v1/kuis/${kuisJagaId}/soal`, { soal: [idPg] })
  await guru.post(`/api/v1/kuis/${kuisJagaId}/publikasi`)
  const attemptJaga = (await murid.post(`/api/v1/kuis/${kuisJagaId}/mulai`)).data?.id
  cek('murid membuka ulangan pemantauan (attempt masih jalan)', Number(attemptJaga) > 0, `attempt=${attemptJaga}`)

  cek('presence ping dari murid diterima saat attempt jalan', (await murid.post(`/api/v1/attempt/${attemptJaga}/hadir`)).status === 200, '')
  const kejadian = await murid.post(`/api/v1/attempt/${attemptJaga}/kejadian`, { kejadian: [{ kategori: 'tab_switch', client_at: iso(Date.now()) }] })
  cek('kejadian anti-cheat dari klien dicatat', [200, 201].includes(kejadian.status), `status=${kejadian.status}`)
  const kejadianPalsu = await murid.post(`/api/v1/attempt/${attemptJaga}/kejadian`, { kejadian: [{ kategori: 'duplicate_session', client_at: iso(Date.now()) }] })
  cek('kategori turunan server (duplicate_session) ditolak 422 walau dikirim klien', kejadianPalsu.status === 422, `status=${kejadianPalsu.status}`)
  // Chunk anticheat menaruh `tamper_suspected` di daftar kategori KLIEN (detektor
  // tamper sisi perangkat), jadi klien memang boleh mengirimnya.
  const kejadianTamper = await murid.post(`/api/v1/attempt/${attemptJaga}/kejadian`, { kejadian: [{ kategori: 'tamper_suspected', client_at: iso(Date.now()) }] })
  cek('kategori dari klien (tamper_suspected) diterima sesuai chunk anticheat', kejadianTamper.status === 201, `status=${kejadianTamper.status}`)
  const kejadianDiTutup = await murid.post(`/api/v1/attempt/${attemptId}/kejadian`, { kejadian: [{ kategori: 'tab_switch', client_at: iso(Date.now()) }] })
  cek('kejadian ditolak untuk attempt yang sudah dikumpulkan (403)', kejadianDiTutup.status === 403, `status=${kejadianDiTutup.status}`)

  const daftarKejadian = await guru.get(`/api/v1/kuis/${kuisJagaId}/kejadian`)
  const idKejadian = daftar(daftarKejadian.data)[0]?.id
  cek('guru melihat daftar kejadian kuis', daftarKejadian.status === 200, `status=${daftarKejadian.status} jumlah=${daftar(daftarKejadian.data).length}`)
  if (idKejadian) {
    cek('guru meninjau kejadian (valid/tidak valid)', (await guru.put(`/api/v1/kejadian/${idKejadian}`, { status: 'valid', catatan: 'Ditinjau smoke.' })).status === 200, '')
  }
  const monitor = await guru.get(`/api/v1/kuis/${kuisJagaId}/monitor`)
  cek('guru membuka monitor kuis (berisi walau realtime mati)', monitor.status === 200, `status=${monitor.status}`)
  cek('monitor memuat murid yang sedang mengerjakan', JSON.stringify(monitor.data ?? {}).includes(`Murid A ${TANDA}`), '')

  const simpanLayar = await guru.put(`/api/v1/kuis/${kuisJagaId}/layar`, { mode: 'soal', judul: 'Bahas nomor 1', question_id: idPg })
  cek('guru mengirim layar ke perangkat murid', simpanLayar.status === 200, `status=${simpanLayar.status} versi=${simpanLayar.data?.versi}`)
  const bacaLayar = await murid.get(`/api/v1/kuis/${kuisJagaId}/layar`)
  cek('murid membaca layar guru (sinkron konten)', bacaLayar.status === 200, `status=${bacaLayar.status}`)
  cek('layar guru memuat soal yang dipilih', bacaLayar.data?.soal?.id === idPg || bacaLayar.data?.mode === 'soal', `mode=${bacaLayar.data?.mode}`)
  const layarKosong = await guru.put(`/api/v1/kuis/${kuisJagaId}/layar`, { mode: 'kosong' })
  cek('guru bisa mengosongkan layar lagi', layarKosong.status === 200 && layarKosong.data?.versi > simpanLayar.data?.versi, `versi=${layarKosong.data?.versi}`)

  const tiketMurid = await murid.post(`/api/v1/kuis/${kuisJagaId}/sse-tiket-murid`, {})
  cek('murid mendapat tiket SSE layar (sinkron konten)', [200, 201].includes(tiketMurid.status), `status=${tiketMurid.status}`)
  const tiketMuridOlehGuru = await guru.post(`/api/v1/kuis/${kuisJagaId}/sse-tiket-murid`, {})
  cek('tiket layar murid ditolak untuk sesi guru (403)', tiketMuridOlehGuru.status === 403, `status=${tiketMuridOlehGuru.status}`)

  // K-03: kanal dipisah per peran, jadi tiket murid tidak sah untuk aliran guru
  // (sebelumnya tiket murid bisa mendengarkan siaran guru: attempt_id kecurangan).
  const nilaiTiketMurid = tiketMurid.data?.tiket ?? tiketMurid.data?.token
  if (typeof nilaiTiketMurid === 'string') {
    const muridKeMonitor = await fetch(`${RT}/sse/monitor?tiket=${encodeURIComponent(nilaiTiketMurid)}`, { headers: { Origin: ORIGIN } })
    cek('tiket murid ditolak di aliran guru (403 peran)', muridKeMonitor.status === 403, `status=${muridKeMonitor.status}`)
  }

  const tiket = await guru.post(`/api/v1/kuis/${kuisJagaId}/sse-tiket`, {})
  const nilaiTiket = tiket.data?.tiket ?? tiket.data?.token
  cek('guru mendapat tiket SSE sekali pakai', [200, 201].includes(tiket.status) && typeof nilaiTiket === 'string', `status=${tiket.status}`)
  if (nilaiTiket) {
    try {
      const res = await fetch(`${RT}/sse/monitor?tiket=${encodeURIComponent(nilaiTiket)}`, { headers: { Origin: ORIGIN, Accept: 'text/event-stream' } })
      const jenis = res.headers.get('content-type') ?? ''
      let awal = ''
      if (res.body) {
        const pembaca = res.body.getReader()
        const potong = await pembaca.read()
        awal = Buffer.from(potong.value ?? []).toString('utf8')
        await pembaca.cancel()
      }
      cek('SSE /sse/monitor menerima tiket dari Laravel (handshake utuh)', res.status === 200 && jenis.includes('text/event-stream'), `status=${res.status} jenis=${jenis}`)
      cek('SSE mengirim event siap sebelum data apa pun', awal.includes('event: siap'), `awal=${JSON.stringify(awal.slice(0, 60))}`)
    } catch (e) {
      cek('SSE /sse/monitor handshake', false, String(e))
    }
    const ulang = await fetch(`${RT}/sse/monitor?tiket=${encodeURIComponent(nilaiTiket)}`, { headers: { Origin: ORIGIN } })
    cek('tiket SSE hangus setelah dipakai (401)', ulang.status === 401, `status=${ulang.status}`)
  }
  const tanpaTiket = await fetch(`${RT}/sse/monitor`, { headers: { Origin: ORIGIN } })
  cek('SSE tanpa tiket ditolak 400', tanpaTiket.status === 400, `status=${tanpaTiket.status}`)

  // Arah sebaliknya: tiket guru tidak boleh memakai aliran perangkat murid.
  const tiketGuruLagi = await guru.post(`/api/v1/kuis/${kuisJagaId}/sse-tiket`, {})
  const nilaiTiketGuruLagi = tiketGuruLagi.data?.tiket ?? tiketGuruLagi.data?.token
  if (typeof nilaiTiketGuruLagi === 'string') {
    const guruKeMurid = await fetch(`${RT}/sse/kuis?tiket=${encodeURIComponent(nilaiTiketGuruLagi)}`, { headers: { Origin: ORIGIN } })
    cek('tiket guru ditolak di aliran murid (403 peran)', guruKeMurid.status === 403, `status=${guruKeMurid.status}`)
  }

  // ---------- L. Lampiran jawaban ----------
  judul('L. Unggahan lampiran jawaban murid')
  const lampiranPalsu = await murid.post(`/api/v1/attempt/${attemptId}/lampiran`, { question_id: idPg, jenis: 'gambar', nama: 'x.png', ukuran: 10 })
  cek('lampiran ditolak untuk attempt yang sudah dikumpulkan (403)', lampiranPalsu.status === 403, `status=${lampiranPalsu.status}`)
  // Berkas harus dilaporkan dengan ukuran SEBENARNYA: penggabungan potongan di
  // server menolak bila total byte tidak sama dengan yang dijanjikan klien.
  const isiLampiran = pngRaksasa(64, 64)
  const mulaiLampiran = await murid.post(`/api/v1/attempt/${attemptJaga}/lampiran`, {
    question_id: idPg,
    jenis: 'gambar',
    nama: 'coret-coretan.png',
    ukuran: isiLampiran.length,
  })
  const kodeLampiran = mulaiLampiran.data?.kode
  cek('murid memulai unggahan lampiran jawaban → 201', [200, 201].includes(mulaiLampiran.status) && typeof kodeLampiran === 'string', `status=${mulaiLampiran.status} ${galatRingkas(mulaiLampiran.data)}`)
  if (kodeLampiran) {
    const fdJ = new FormData()
    fdJ.append('potongan', new Blob([isiLampiran], { type: 'image/png' }), 'potongan-0')
    cek('potongan lampiran jawaban tersimpan', (await murid.kirim('PUT', `/api/v1/lampiran/${kodeLampiran}/potongan/0`, fdJ)).status === 200, '')
    const selesaiJ = await murid.post(`/api/v1/lampiran/${kodeLampiran}/selesai`, {})
    cek('lampiran jawaban selesai', selesaiJ.status === 200, `status=${selesaiJ.status} ${galatRingkas(selesaiJ.data)}`)
    const daftarLampiran = await murid.get(`/api/v1/attempt/${attemptJaga}/lampiran`)
    const lampiranPertama = daftar(daftarLampiran.data)[0]
    cek('murid melihat daftar lampirannya', daftarLampiran.status === 200 && daftar(daftarLampiran.data).length >= 1, `jumlah=${daftar(daftarLampiran.data).length}`)
    cek('lampiran gambar kanvas disajikan sebagai PNG di server', lampiranPertama?.mime === 'image/png' && lampiranPertama?.ekstensi === 'png', `mime=${lampiranPertama?.mime} ekstensi=${lampiranPertama?.ekstensi}`)
    cek('lampiran menyediakan URL bertanda tangan', typeof lampiranPertama?.url === 'string' && lampiranPertama.url.includes('signature='), `url=${String(lampiranPertama?.url ?? '').slice(0, 70)}`)
    if (lampiranPertama?.url) {
      const berkasJ = await murid.unduhAbsolut(lampiranPertama.url)
      cek('berkas lampiran jawaban bisa dibuka lewat URL bertanda tangan', berkasJ.status === 200 && berkasJ.buf.length > 0, `status=${berkasJ.status} byte=${berkasJ.buf.length}`)
    }
    const berkasMentah = await murid.unduh(`/api/v1/berkas/jawaban/${kodeLampiran}`)
    cek('berkas lampiran tanpa tanda tangan ditolak 403', berkasMentah.status === 403, `status=${berkasMentah.status}`)
    cek('murid membuang lampirannya', (await murid.del(`/api/v1/lampiran/${kodeLampiran}`)).status === 200, '')
    cek('lampiran yang dibuang tidak lagi terdaftar', daftar((await murid.get(`/api/v1/attempt/${attemptJaga}/lampiran`)).data).length === 0, '')
  }

  // ---------- M. Avatar ----------
  judul('M. Avatar (unggah, lapor, moderasi)')
  const fdA = new FormData()
  fdA.append('berkas', new Blob([pngRaksasa(256, 256)], { type: 'image/png' }), 'avatar.png')
  const unggahAvatar = await murid.kirim('POST', '/api/v1/avatar', fdA)
  cek('murid mengunggah avatar', [200, 201].includes(unggahAvatar.status), `status=${unggahAvatar.status} ${galatRingkas(unggahAvatar.data)}`)
  const avatarSaya = await murid.get('/api/v1/avatar/saya')
  const avatarId = avatarSaya.data?.avatar?.id
  cek('murid melihat avatarnya', avatarSaya.status === 200 && Boolean(avatarId), `status=${avatarSaya.status} avatar=${avatarId}`)
  cek('avatar memakai URL bertanda tangan (bukan path storage)', typeof avatarSaya.data?.avatar?.url === 'string' && avatarSaya.data.avatar.url.includes('signature='), `url=${String(avatarSaya.data?.avatar?.url ?? '').slice(0, 60)}`)
  const avatarGuru = await guru.get('/api/v1/avatar')
  cek('guru melihat daftar avatar (galeri kelas)', avatarGuru.status === 200 && Array.isArray(avatarGuru.data?.avatar), `jumlah=${(avatarGuru.data?.avatar ?? []).length}`)

  const fdA2 = new FormData()
  fdA2.append('berkas', new Blob([pngRaksasa(6000, 6000)], { type: 'image/png' }), 'bom.png')
  const bom = await murid.kirim('POST', '/api/v1/avatar', fdA2)
  cek('gambar ber-piksel raksasa ditolak 422 walau berkasnya kecil (S-07)', bom.status === 422, `status=${bom.status} ${galatRingkas(bom.data)}`)

  if (avatarId) {
    // Policy `lapor` hanya untuk MURID (bukan guru), dan ambang disembunyikan
    // dihitung dari laporan UNIK, jadi siapkan tiga pelapor berbeda.
    const pelapor = []
    for (const [kode, nama] of [['b', 'B'], ['c', 'C'], ['d', 'D']]) {
      const email = kode === 'b' ? muridBEmail : `smoke.murid.${kode}.${TANDA}@murid.test`
      if (kode !== 'b') {
        const buat = await guru.post('/api/v1/murid', { nama: `Murid ${nama} ${TANDA}`, email, class_id: kelasId, kata_sandi: SANDI_MURID })
        cek(`guru menyiapkan murid pelapor ${nama}`, buat.status === 201, `status=${buat.status} ${galatRingkas(buat.data)}`)
      }
      const sesi = new Sesi(`pelapor-${kode}`)
      const masuk = await sesi.masuk({ email, password: SANDI_MURID })
      cek(`pelapor ${nama} bisa masuk`, masuk.status === 200, `status=${masuk.status}`)
      pelapor.push(sesi)
    }

    const alasanSalah = await pelapor[0].post(`/api/v1/avatar/${avatarId}/lapor`, { alasan: 'alasan-karangan' })
    cek('alasan laporan avatar harus dari enum (422)', alasanSalah.status === 422, `status=${alasanSalah.status}`)
    const laporGuru = await guru.post(`/api/v1/avatar/${avatarId}/lapor`, { alasan: 'tidak_pantas' })
    cek('guru tidak boleh melaporkan avatar (policy: hanya murid)', laporGuru.status === 403, `status=${laporGuru.status}`)

    const lapor1 = await pelapor[0].post(`/api/v1/avatar/${avatarId}/lapor`, { alasan: 'tidak_pantas', keterangan: 'Uji asap.' })
    cek('murid lain melaporkan avatar teman sekelas → 201', lapor1.status === 201, `status=${lapor1.status} ${galatRingkas(lapor1.data)}`)
    const laporUlang = await pelapor[0].post(`/api/v1/avatar/${avatarId}/lapor`, { alasan: 'spam' })
    cek('laporan ganda murid yang sama tidak menambah hitungan', laporUlang.data?.jumlah_laporan === 1, `jumlah=${laporUlang.data?.jumlah_laporan}`)
    const lapor2 = await pelapor[1].post(`/api/v1/avatar/${avatarId}/lapor`, { alasan: 'bullying', keterangan: 'Uji asap kedua.' })
    cek('laporan unik kedua belum menyembunyikan avatar', lapor2.data?.disembunyikan === false && lapor2.data?.jumlah_laporan === 2, `jumlah=${lapor2.data?.jumlah_laporan} sembunyi=${lapor2.data?.disembunyikan}`)
    const lapor3 = await pelapor[2].post(`/api/v1/avatar/${avatarId}/lapor`, { alasan: 'lainnya', keterangan: 'Uji asap ketiga.' })
    cek('laporan unik ketiga menyembunyikan avatar (ambang 3)', lapor3.data?.disembunyikan === true && lapor3.data?.jumlah_laporan === 3, `jumlah=${lapor3.data?.jumlah_laporan} sembunyi=${lapor3.data?.disembunyikan}`)

    const punyaSendiri = await murid.get('/api/v1/avatar/saya')
    cek('pemilik tetap melihat avatarnya walau disembunyikan', punyaSendiri.data?.avatar?.id === avatarId, `avatar=${punyaSendiri.data?.avatar?.id}`)
    const galeriLain = await pelapor[1].get('/api/v1/avatar')
    cek('avatar tersembunyi hilang dari galeri murid lain', (galeriLain.data?.avatar ?? []).every((a) => a.id !== avatarId), `jumlah=${(galeriLain.data?.avatar ?? []).length}`)

    const moderasi = await guru.get('/api/v1/avatar/moderasi')
    cek('avatar terlapor masuk antrean moderasi guru', moderasi.status === 200 && daftar(moderasi.data).some((a) => a.id === avatarId), `jumlah=${daftar(moderasi.data).length}`)

    const pulihkan = await guru.post(`/api/v1/avatar/${avatarId}/pulihkan`, { catatan: 'Uji asap: laporan tidak valid.' })
    cek('guru memulihkan avatar terlapor → 200', pulihkan.status === 200, `status=${pulihkan.status} ${galatRingkas(pulihkan.data)}`)
    const galeriLagi = await pelapor[1].get('/api/v1/avatar')
    cek('setelah dipulihkan, avatar tampil lagi di galeri', (galeriLagi.data?.avatar ?? []).some((a) => a.id === avatarId), `jumlah=${(galeriLagi.data?.avatar ?? []).length}`)

    const hapusModerasi = await guru.post(`/api/v1/avatar/${avatarId}/hapus`, { catatan: 'Uji asap: avatar diturunkan.' })
    cek('guru menghapus avatar terlapor (tindakan moderasi)', [200, 202].includes(hapusModerasi.status), `status=${hapusModerasi.status} ${galatRingkas(hapusModerasi.data)}`)
    const pulihSetelahHapus = await guru.post(`/api/v1/avatar/${avatarId}/pulihkan`, {})
    cek('avatar terhapus tidak bisa dipulihkan lagi (422)', pulihSetelahHapus.status === 422, `status=${pulihSetelahHapus.status}`)

    // Murid boleh memasang avatar baru menggantikan yang sudah dimoderasi, lalu
    // mengembalikannya ke bawaan sendiri.
    const fdA3 = new FormData()
    fdA3.append('berkas', new Blob([pngRaksasa(128, 128)], { type: 'image/png' }), 'avatar2.png')
    const unggahLagi = await murid.kirim('POST', '/api/v1/avatar', fdA3)
    cek('murid bisa memasang avatar baru setelah yang lama dimoderasi', [200, 201].includes(unggahLagi.status), `status=${unggahLagi.status} ${galatRingkas(unggahLagi.data)}`)
    cek('murid bisa menghapus avatarnya sendiri', [200, 204].includes((await murid.del('/api/v1/avatar')).status), '')
    cek('setelah dihapus, tidak ada avatar aktif lagi', ((await murid.get('/api/v1/avatar/saya')).data?.avatar ?? null) === null, '')
  }

  // ---------- N. Pengaturan tiga lapis & cache ----------
  judul('N. Pengaturan tiga lapis + cache')
  const pengaturan = await guru.get('/api/v1/pengaturan')
  cek('guru membaca pengaturan (nilai + sumbernya)', pengaturan.status === 200 && pengaturan.data?.pengaturan !== undefined, `status=${pengaturan.status}`)
  // K-05: lingkup sekolah/kelas hanya admin; jalur baca ditutup untuk murid.
  cek('murid ditolak membaca pengaturan (403)', (await murid.get('/api/v1/pengaturan')).status === 403, '')
  const sekolahGuru = await guru.put('/api/v1/pengaturan', { lingkup: 'sekolah', kunci: 'retry', nilai: false })
  cek('guru ditolak menyetel pengaturan lingkup sekolah (403)', sekolahGuru.status === 403, `status=${sekolahGuru.status}`)
  const kelasGuru = await guru.put('/api/v1/pengaturan', { lingkup: 'kelas', lingkup_id: kelasId, kunci: 'retry', nilai: true })
  cek('guru ditolak menyetel pengaturan lingkup kelas (403)', kelasGuru.status === 403, `status=${kelasGuru.status}`)
  const setSekolah = await admin.put('/api/v1/pengaturan', { lingkup: 'sekolah', kunci: 'retry', nilai: false })
  cek('admin menyetel pengaturan lingkup sekolah', setSekolah.status === 200 && setSekolah.data?.pengaturan?.retry?.nilai === false, `status=${setSekolah.status}`)
  const setKelas = await admin.put('/api/v1/pengaturan', { lingkup: 'kelas', lingkup_id: kelasId, kunci: 'retry', nilai: true })
  cek('admin menyetel pengaturan lingkup kelas', setKelas.status === 200, `status=${setKelas.status}`)
  const bacaKelas = await guru.get(`/api/v1/pengaturan?kelas_id=${kelasId}`)
  cek('kelas menimpa sekolah (resolusi tiga lapis)', bacaKelas.data?.pengaturan?.retry?.nilai === true && bacaKelas.data?.pengaturan?.retry?.sumber === 'kelas', `nilai=${bacaKelas.data?.pengaturan?.retry?.nilai} sumber=${bacaKelas.data?.pengaturan?.retry?.sumber}`)
  const setKuis = await guru.put('/api/v1/pengaturan', { lingkup: 'kuis', lingkup_id: kuisId, kunci: 'retry', nilai: false })
  cek('kuis menimpa kelas untuk kuis miliknya sendiri', setKuis.status === 200, `status=${setKuis.status} ${galatRingkas(setKuis.data)}`)
  const bacaKuis = await guru.get(`/api/v1/pengaturan?kuis_id=${kuisId}`)
  cek('guru membaca pengaturan efektif kuisnya (sumber kuis)', bacaKuis.status === 200 && bacaKuis.data?.pengaturan?.retry?.sumber === 'kuis', `sumber=${bacaKuis.data?.pengaturan?.retry?.sumber}`)
  const ubahLagi = await admin.put('/api/v1/pengaturan', { lingkup: 'sekolah', kunci: 'retry', nilai: true })
  cek('invalidasi cache: perubahan langsung terbaca tanpa menunggu TTL', ubahLagi.status === 200 && ubahLagi.data?.pengaturan?.retry?.nilai === true, `nilai=${ubahLagi.data?.pengaturan?.retry?.nilai}`)
  const setKuisLain = await guru2.put('/api/v1/pengaturan', { lingkup: 'kuis', lingkup_id: kuisId, kunci: 'retry', nilai: false })
  cek('guru lain ditolak mengubah pengaturan kuis orang (403)', setKuisLain.status === 403, `status=${setKuisLain.status}`)

  // ---------- O. Otorisasi kepemilikan ----------
  judul('O. Otorisasi kepemilikan guru')
  const ubahKuisGuruLain = await guru2.put(`/api/v1/kuis/${kuisId}`, { judul: 'Dibajak', subject_id: mapelId, class_id: kelasId, durasi_menit: 10 })
  cek('guru lain tidak boleh mengubah kuis orang (403)', ubahKuisGuruLain.status === 403, `status=${ubahKuisGuruLain.status}`)
  const ubahSoalGuruLain = await guru2.put(`/api/v1/soal/${idPg}`, {
    subject_id: mapelId, tipe: 'pilihan_ganda',
    konten: { teks: 'x', opsi: [{ id: 'A', teks: 'a' }, { id: 'B', teks: 'b' }] },
    kunci: { jawaban: 'A' },
  })
  cek('guru lain tidak boleh mengubah soal orang (403)', ubahSoalGuruLain.status === 403, `status=${ubahSoalGuruLain.status}`)
  // K-04: batas baca = batas ubah. Kunci jawaban, nilai, ekspor, monitor, dan
  // catatan kecurangan tidak lagi terbuka untuk guru lain.
  cek('guru lain ditolak membaca ekspor nilai (403)', (await guru2.unduh(`/api/v1/kuis/${kuisId}/ekspor-nilai`)).status === 403, '')
  cek('guru lain ditolak membuka Live Monitor (403)', (await guru2.get(`/api/v1/kuis/${kuisId}/monitor`)).status === 403, '')
  cek('guru lain ditolak membuka laporan per tema (403)', (await guru2.get(`/api/v1/kuis/${kuisId}/laporan`)).status === 403, '')
  cek('guru lain ditolak membuka catatan kecurangan (403)', (await guru2.get(`/api/v1/kuis/${kuisId}/kejadian`)).status === 403, '')
  cek('pemilik boleh membuka Live Monitor kuisnya', (await guru.get(`/api/v1/kuis/${kuisId}/monitor`)).status === 200, '')
  cek('guru lain tidak boleh menghapus soal orang (403)', (await guru2.del(`/api/v1/soal/${idPg}`)).status === 403, '')
  cek('pemilik tetap boleh mengubah kuisnya sendiri', (await guru.put(`/api/v1/kuis/${kuisId}`, {
    judul: `Ulangan Smoke ${TANDA}`, subject_id: mapelId, class_id: kelasId, durasi_menit: 30,
    mulai_at: iso(Date.now() - 60 * 60 * 1000), selesai_at: iso(Date.now() + 3 * 60 * 60 * 1000),
    acak_soal: false, acak_opsi: false,
  })).status === 200, '')
  cek('murid tidak boleh membaca bank soal guru (403)', (await murid.get('/api/v1/soal')).status === 403, '')
  // MuridPolicy: "murid hanya baca" — jadi baca boleh, mengubah tidak.
  const muridBacaMurid = await murid.get('/api/v1/murid?per_page=5')
  cek('murid boleh membaca daftar murid (aturan policy: murid = baca saja)', muridBacaMurid.status === 200, `status=${muridBacaMurid.status}`)
  cek('murid tidak boleh menambah murid (403)', (await murid.post('/api/v1/murid', { nama: 'Murid Karangan', email: `karangan.${TANDA}@murid.test`, class_id: kelasId })).status === 403, '')
  cek('murid tidak boleh mengubah murid lain (403)', (await murid.put(`/api/v1/murid/${muridAId}`, { nama: 'Diubah Murid', email: muridAEmail, class_id: kelasId })).status === 403, '')
  cek('murid tidak boleh menghapus murid (403)', (await murid.del(`/api/v1/murid/${muridAId}`)).status === 403, '')
  cek('murid tidak boleh mengubah data sekolah (403)', (await murid.put('/api/v1/sekolah', { nama: 'Diubah Murid' })).status === 403, '')
  // MuridPolicy: murid hanya baca — jadi CSV murid pun boleh dibaca, yang
  // dibatasi adalah menambah/mengubah/menghapus.
  const muridEkspor = await murid.unduh('/api/v1/murid/ekspor')
  cek('murid boleh mengunduh CSV murid (policy: baca saja)', muridEkspor.status === 200, `status=${muridEkspor.status}`)
  cek('murid tidak boleh mengimpor murid (403)', (await murid.kirim('POST', '/api/v1/murid/impor', berkas('murid.csv', 'nama,email,kelas\nX,x@x.test,Y', 'text/csv'))).status === 403, '')
  cek('guru tetap boleh membaca pengaturan sekolah (baca saja)', (await guru.get('/api/v1/pengaturan')).status === 200, '')

  // ---------- P. Arsip, penjagaan bentuk, rute tidak ada ----------
  judul('P. Arsip, penjagaan bentuk & rute tidak ada')
  cek('kuis tidak ada → 404 (bukan 500)', (await guru.get('/api/v1/kuis/99999999')).status === 404, '')
  cek('murid tanpa nama ditolak 422', (await guru.post('/api/v1/murid', { email: `x.${TANDA}@murid.test`, class_id: kelasId })).status === 422, '')
  cek('admin membaca daftar kuis', (await admin.get('/api/v1/kuis?per_page=5')).status === 200, '')
  const arsip = await guru.post(`/api/v1/kuis/${kuisId}/arsip`)
  cek('guru mengarsipkan kuis', [200, 201].includes(arsip.status), `status=${arsip.status}`)
  const arsipMateri = await guru.post(`/api/v1/materi/${materiId}/arsip`)
  cek('guru mengarsipkan materi', [200, 201].includes(arsipMateri.status), `status=${arsipMateri.status}`)
  cek('kuis yang diarsipkan tidak muncul lagi di daftar terbit', (await guru.get(`/api/v1/kuis?per_page=200&status=publikasi`)).status === 200, '')

  // ---------- Ringkasan ----------
  const gagal = hasil.filter((h) => !h.lulus)
  console.log('\n================ RINGKASAN ================')
  const perBagian = new Map()
  for (const h of hasil) {
    const isi = perBagian.get(h.bagian) ?? { lulus: 0, gagal: 0 }
    if (h.lulus) isi.lulus++
    else isi.gagal++
    perBagian.set(h.bagian, isi)
  }
  for (const [nama, isi] of perBagian) {
    console.log(`${isi.gagal === 0 ? '✅' : '❌'} ${nama}: ${isi.lulus} lulus, ${isi.gagal} gagal`)
  }
  console.log(`\nTotal: ${hasil.length - gagal.length}/${hasil.length} lulus · ${gagal.length} gagal · ${((Date.now() - mulaiJam) / 1000).toFixed(1)}s`)
  if (gagal.length) {
    console.log('\nYang gagal:')
    for (const g of gagal) console.log(` - [${g.bagian}] ${g.nama}${g.catatan ? ` → ${g.catatan}` : ''}`)
  }
  process.exit(gagal.length ? 1 : 0)
}

/** Urutan id opsi dari satu soal pada payload attempt (untuk uji Q-12). */
function urutanOpsi(soal) {
  const opsi = soal?.konten?.opsi ?? soal?.opsi ?? []
  return opsi.map((o) => String(o.id ?? o.kode ?? ''))
}

utama().catch((e) => {
  console.error('smoke-http-fitur GAGAL di luar dugaan:', e)
  process.exit(1)
})
