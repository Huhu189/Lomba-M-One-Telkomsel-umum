/**
 * Skema form + validasi kelengkapan soal di sisi klien.
 *
 * Aturan di bawah mencerminkan registry backend (PenanganPilihanGanda,
 * PenanganBenarSalah, PenanganMenjodohkan, PenanganMengurutkan, PenanganLetakKata,
 * PenanganHubungKata, PenanganIsianSingkat, PenanganUraian) supaya guru melihat
 * pesan jelas sebelum menabrak 422 dari server.
 */
import { z } from 'zod'
import {
  TIPE,
  AMBANG_BAWAAN_ISIAN,
  AMBANG_BAWAAN_URAIAN,
  MIN_OPSI,
  MAKS_OPSI,
  MIN_ITEM,
  MAKS_MATEMATIKA,
  MIN_OPSI_KOMPLEKS,
  MAKS_OPSI_KOMPLEKS,
  MIN_PERNYATAAN,
  MAKS_PERNYATAAN,
  MIN_GAMBAR,
  MAKS_GAMBAR,
  MIN_HURUF,
  MAKS_HURUF,
  MAKS_PETUNJUK,
  MAKS_LUBANG,
  MAKS_ITEM_KLASIFIKASI,
  MIN_KOTAK,
  MAKS_KOTAK,
  MAKS_SEL,
  MAKS_RENTANG_GARIS,
  MAKS_AREA_HOTSPOT,
  MAKS_BUTIR_RUBRIK,
  MAKS_SISI_SILANG,
  MAKS_PETUNJUK_SILANG,
  MIN_HURUF_SILANG,
  TIPE_TANPA_TEKS,
  barisSilang,
  kodeSilang,
  nomorLubangDariTeks,
  selDariPetunjuk,
  selSilangDariGrid,
  petaJawabanDariRekaman,
  urutanDariItem,
  urutanDariItemGambar,
} from './tipeSoal.js'

/** Tag: nama 2–80 (unik per sekolah di server), deskripsi opsional. */
export const skemaTagForm = z.object({
  nama: z.string().trim().min(2, 'Nama tag minimal 2 karakter.').max(80, 'Nama tag maksimal 80 karakter.'),
  deskripsi: z.string().trim().max(255, 'Deskripsi maksimal 255 karakter.').optional(),
})

/** Kuis: judul, mapel, kelas, durasi, dan jadwal opsional. */
export const skemaKuisForm = z
  .object({
    judul: z.string().trim().min(3, 'Judul minimal 3 karakter.').max(150, 'Judul maksimal 150 karakter.'),
    deskripsi: z.string().trim().max(1000, 'Deskripsi maksimal 1000 karakter.').optional(),
    subject_id: z.string().trim().min(1, 'Pilih mapel.'),
    class_id: z.string().trim().min(1, 'Pilih kelas.'),
    durasi_menit: z
      .string()
      .trim()
      .regex(/^\d+$/, 'Durasi harus berupa angka menit.')
      .refine((nilai) => Number(nilai) >= 1 && Number(nilai) <= 300, 'Durasi 1 sampai 300 menit.'),
    mulai_at: z.string().trim(),
    selesai_at: z.string().trim(),
    acak_soal: z.boolean(),
    acak_opsi: z.boolean(),
  })
  .refine(
    (data) =>
      data.mulai_at === '' ||
      data.selesai_at === '' ||
      new Date(data.selesai_at).getTime() > new Date(data.mulai_at).getTime(),
    { message: 'Jadwal selesai wajib setelah jadwal mulai.', path: ['selesai_at'] },
  )

/**
 * @typedef {z.infer<typeof skemaTagForm>} DataTagForm
 * @typedef {z.infer<typeof skemaKuisForm>} DataKuisForm
 */

/**
 * Cek kelengkapan soal objektif sebelum dikirim ke server.
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]} daftar pesan galat (kosong berarti siap kirim)
 */
export function validasiSoal(state) {
  const galat = []

  if (state.subject_id === '') galat.push('Pilih mapel dulu.')

  if (state.teks.trim() === '' && !TIPE_TANPA_TEKS.includes(state.tipe)) {
    galat.push('Isi soal wajib diisi.')
  }
  if (state.matematika.trim().length > MAKS_MATEMATIKA) {
    galat.push(`Template MathML maksimal ${MAKS_MATEMATIKA} karakter.`)
  }

  if (!skorWajar(state.skor)) galat.push('Skor harus angka 1 sampai 100.')

  if (state.tipe === TIPE.pilihanGanda) galat.push(...validasiPilihanGanda(state))
  if (state.tipe === TIPE.menjodohkan) galat.push(...validasiMenjodohkan(state))
  if (state.tipe === TIPE.mengurutkan) galat.push(...validasiMengurutkan(state))
  if (state.tipe === TIPE.hubungKata) galat.push(...validasiHubungKata(state))
  if (state.tipe === TIPE.letakKata) galat.push(...validasiLetakKata(state))
  if (state.tipe === TIPE.isianSingkat) galat.push(...validasiIsianSingkat(state))
  if (state.tipe === TIPE.uraian) galat.push(...validasiUraian(state))
  if (state.tipe === TIPE.pilihanGandaKompleks) galat.push(...validasiPilihanGandaKompleks(state))
  if (state.tipe === TIPE.benarSalahMajemuk) galat.push(...validasiBenarSalahMajemuk(state))
  if (state.tipe === TIPE.isianAngka) galat.push(...validasiIsianAngka(state))
  if (state.tipe === TIPE.pilihanGambar) galat.push(...validasiPilihanGambar(state))
  if (state.tipe === TIPE.urutGambar) galat.push(...validasiUrutGambar(state))
  if (state.tipe === TIPE.susunHuruf) galat.push(...validasiSusunHuruf(state))
  if (state.tipe === TIPE.isianRumpang) galat.push(...validasiIsianRumpang(state))
  if (state.tipe === TIPE.klasifikasi) galat.push(...validasiKlasifikasi(state))
  if (state.tipe === TIPE.tabelIsian) galat.push(...validasiTabelIsian(state))
  if (state.tipe === TIPE.garisBilangan) galat.push(...validasiGarisBilangan(state))
  if (state.tipe === TIPE.hotspotGambar) galat.push(...validasiHotspotGambar(state))
  if (state.tipe === TIPE.bacaJam) galat.push(...validasiBacaJam(state))
  if (state.tipe === TIPE.tugasUnggah) galat.push(...validasiTugasUnggah(state))
  if (state.tipe === TIPE.tekaSilangMini) galat.push(...validasiTekaSilangMini(state))

  return galat
}

/** Skema Zod kunci tipe gelombang 2. */
export const skemaIsianRumpangKunci = z
  .object({ lubang: z.record(z.string(), z.array(z.string().min(1)).min(1)) })
  .strict()

export const skemaKlasifikasiKunci = z.object({ peta: z.record(z.string(), z.string().min(1)) }).strict()

export const skemaTabelIsianKunci = z.object({ sel: z.record(z.string(), z.array(z.string().min(1)).min(1)) }).strict()

export const skemaGarisBilanganKunci = z
  .object({ nilai: z.number(), toleransi: z.number().min(0, 'Toleransi tidak boleh negatif.') })
  .strict()

/** Skema Zod kunci tipe gelombang 3. */
export const skemaHotspotGambarKunci = z
  .object({ area_benar: z.array(z.string().min(1)).min(1, 'Pilih minimal satu area benar.') })
  .strict()

export const skemaBacaJamKunci = z
  .object({
    jam: z.number().int().min(0, 'Jam 0 sampai 11.').max(11, 'Jam 0 sampai 11.'),
    menit: z.number().int().min(0, 'Menit 0 sampai 59.').max(59, 'Menit 0 sampai 59.'),
  })
  .strict()

export const skemaTugasUnggahKunci = z
  .object({
    rubrik: z
      .array(
        z.object({
          butir: z.string().min(1, 'Setiap butir rubrik wajib diisi.'),
          poin: z.number().positive('Poin rubrik wajib lebih dari 0.'),
        }),
      )
      .min(1, 'Rubrik wajib punya minimal satu butir.'),
  })
  .strict()

export const skemaTekaSilangMiniKunci = z
  .object({ sel: z.record(z.string(), z.string().regex(/^[a-zA-Z]$/, 'Kunci sel wajib satu huruf.')) })
  .strict()

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiIsianRumpang(state) {
  const galat = []
  const nomor = nomorLubangDariTeks(state.teks)

  if (nomor.length === 0) {
    galat.push('Isian rumpang wajib memuat penanda {{1}}, {{2}}, … pada isi soal.')
  } else if (nomor.join(',') !== nomor.map((_, indeks) => indeks + 1).join(',')) {
    galat.push('Penanda isian rumpang wajib berurutan mulai dari {{1}} tanpa lompatan.')
  } else if (nomor.length > MAKS_LUBANG) {
    galat.push(`Isian rumpang maksimal ${MAKS_LUBANG} lubang.`)
  }

  const peta = petaJawabanDariRekaman(state.lubang)

  for (const satu of nomor) {
    if ((peta[String(satu)] ?? []).length === 0) {
      galat.push(`Lubang {{${satu}}} wajib punya minimal satu jawaban diterima.`)
    }
  }

  const hasil = skemaIsianRumpangKunci.safeParse({ lubang: peta })
  if (!hasil.success) galat.push('Setiap lubang wajib punya daftar jawaban diterima.')

  return [...new Set(galat)]
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiKlasifikasi(state) {
  const galat = []

  if (state.itemKlasifikasi.length < MIN_ITEM) galat.push(`Klasifikasi wajib punya minimal ${MIN_ITEM} item.`)
  if (state.itemKlasifikasi.length > MAKS_ITEM_KLASIFIKASI) {
    galat.push(`Klasifikasi maksimal ${MAKS_ITEM_KLASIFIKASI} item.`)
  }
  if (state.kotak.length < MIN_KOTAK) galat.push(`Klasifikasi wajib punya minimal ${MIN_KOTAK} kotak.`)
  if (state.kotak.length > MAKS_KOTAK) galat.push(`Klasifikasi maksimal ${MAKS_KOTAK} kotak.`)

  if (state.itemKlasifikasi.some((satu) => satu.teks.trim() === '')) {
    galat.push('Setiap item wajib punya teks.')
  }
  if (state.kotak.some((satu) => satu.teks.trim() === '')) galat.push('Setiap kotak wajib punya label.')

  const idItem = state.itemKlasifikasi.map((satu) => satu.id)
  const idKotak = state.kotak.map((satu) => satu.id)

  if (new Set(idItem).size !== idItem.length) galat.push('Id item tidak boleh duplikat.')
  if (new Set(idKotak).size !== idKotak.length) galat.push('Id kotak tidak boleh duplikat.')

  const peta = state.petaKlasifikasi

  for (const satu of state.itemKlasifikasi) {
    const kotak = peta[satu.id] ?? ''
    if (kotak === '') galat.push('Setiap item wajib punya kotak di kunci.')
    else if (!idKotak.includes(kotak)) galat.push('Ada item yang menunjuk kotak tak dikenal.')
  }

  const hasil = skemaKlasifikasiKunci.safeParse({ peta })
  if (!hasil.success) galat.push('Kunci klasifikasi belum lengkap.')

  return [...new Set(galat)]
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiTabelIsian(state) {
  const galat = []

  const kolom = state.kolom
    .split(',')
    .map((satu) => satu.trim())
    .filter((satu) => satu !== '')

  if (kolom.length === 0) galat.push('Tabel isian wajib punya minimal satu nama kolom.')
  if (state.barisTabel.length === 0) galat.push('Tabel isian wajib punya minimal satu baris.')

  /** @type {string[]} */
  const kode = []

  for (const baris of state.barisTabel) {
    if (baris.sel.length === 0) {
      galat.push('Setiap baris wajib punya minimal satu sel.')
      continue
    }

    for (const sel of baris.sel) {
      if (sel.kode.trim() === '') galat.push('Setiap sel wajib punya kode.')
      kode.push(sel.kode)
    }
  }

  if (kode.length > MAKS_SEL) galat.push(`Tabel isian maksimal ${MAKS_SEL} sel.`)
  if (new Set(kode).size !== kode.length) galat.push('Kode sel tidak boleh duplikat.')

  // Hanya sel kosong yang dinilai, jadi hanya sel itu yang wajib punya kunci.
  const selKosong = state.barisTabel.flatMap((baris) =>
    baris.sel.filter((sel) => sel.teks.trim() === '').map((sel) => sel.kode),
  )

  for (const satu of selKosong) {
    const jawaban = state.kunciSel[satu] ?? ''
    if (jawaban.trim() === '') galat.push(`Sel ${satu} wajib punya minimal satu jawaban diterima.`)
  }

  const hasil = skemaTabelIsianKunci.safeParse({ sel: petaJawabanDariRekaman(state.kunciSel) })
  if (!hasil.success) galat.push('Setiap sel kosong wajib punya daftar jawaban diterima.')

  return [...new Set(galat)]
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiGarisBilangan(state) {
  const galat = []
  const min = Number(state.garisMin)
  const max = Number(state.garisMax)
  const langkah = Number(state.garisLangkah)

  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(langkah)) {
    galat.push('Garis bilangan wajib punya angka min, max, dan langkah.')
    return galat
  }

  if (max <= min) galat.push('Nilai max wajib lebih besar dari min.')
  if (langkah <= 0) galat.push('Langkah wajib lebih besar dari 0.')
  if (max - min > MAKS_RENTANG_GARIS) galat.push(`Rentang maksimal ${MAKS_RENTANG_GARIS}.`)

  const nilai = Number(state.garisNilai)
  const toleransi = Number(state.garisToleransi || 0)

  const hasil = skemaGarisBilanganKunci.safeParse({ nilai, toleransi })
  if (!hasil.success) galat.push('Kunci garis bilangan wajib angka dengan toleransi tidak negatif.')
  else if (Number.isFinite(min) && Number.isFinite(max) && (nilai < min || nilai > max)) {
    galat.push('Nilai kunci wajib berada di antara min dan max.')
  }

  return [...new Set(galat)]
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiHotspotGambar(state) {
  const galat = []

  if (state.media.trim() === '') {
    galat.push('Hotspot gambar wajib punya alamat gambar (isi bidang Media).')
  }

  const area = state.areaHotspot

  if (area.length === 0) galat.push('Hotspot gambar wajib punya minimal satu area.')
  if (area.length > MAKS_AREA_HOTSPOT) galat.push(`Hotspot gambar maksimal ${MAKS_AREA_HOTSPOT} area.`)

  const id = area.map((satu) => satu.id)
  if (new Set(id).size !== id.length) galat.push('Id area tidak boleh duplikat.')

  for (const satu of area) {
    const angka = [Number(satu.x), Number(satu.y), Number(satu.w), Number(satu.h)]
    const wajar = angka.every((nilai) => Number.isFinite(nilai) && nilai >= 0 && nilai <= 100)

    if (!wajar || angka[2] <= 0 || angka[3] <= 0) {
      galat.push('Setiap area wajib punya x, y, w, h angka 0–100 dengan lebar/tinggi lebih dari 0.')
      break
    }
  }

  if (area.some((satu) => Number(satu.x) + Number(satu.w) > 100 || Number(satu.y) + Number(satu.h) > 100)) {
    galat.push('Area tidak boleh keluar dari gambar (x + w dan y + h maksimal 100).')
  }

  if (state.benarHotspot.length === 0) galat.push('Tandai minimal satu area sebagai kunci jawaban.')
  else if (state.benarHotspot.some((satu) => !id.includes(satu))) {
    galat.push('Ada area kunci yang tidak dikenal.')
  }

  const hasil = skemaHotspotGambarKunci.safeParse({ area_benar: state.benarHotspot })
  if (!hasil.success) galat.push('Kunci hotspot gambar belum lengkap.')

  return [...new Set(galat)]
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiBacaJam(state) {
  const galat = []
  const jam = Number(state.jamJam)
  const menit = Number(state.jamMenit)

  const hasil = skemaBacaJamKunci.safeParse({ jam, menit })

  if (!hasil.success || !Number.isInteger(jam) || !Number.isInteger(menit)) {
    galat.push('Kunci baca jam wajib jam 0–11 dan menit 0–59 (bilangan bulat).')
  }

  return galat
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiTugasUnggah(state) {
  const galat = []

  if (state.jenisBerkas.trim() === '') {
    galat.push('Tugas unggah wajib menyebut jenis berkas yang boleh diunggah.')
  } else if (state.jenisBerkas.trim().length > 120) {
    galat.push('Jenis berkas maksimal 120 karakter.')
  }

  if (state.rubrik.length === 0) galat.push('Tugas unggah wajib punya minimal satu butir rubrik.')
  if (state.rubrik.length > MAKS_BUTIR_RUBRIK) {
    galat.push(`Rubrik maksimal ${MAKS_BUTIR_RUBRIK} butir.`)
  }

  if (state.rubrik.some((satu) => satu.butir.trim() === '')) {
    galat.push('Setiap butir rubrik wajib diisi.')
  }

  if (state.rubrik.some((satu) => !(Number(satu.poin) > 0))) {
    galat.push('Poin setiap butir rubrik wajib lebih dari 0.')
  }

  const hasil = skemaTugasUnggahKunci.safeParse({
    rubrik: state.rubrik.map((satu) => ({ butir: satu.butir.trim(), poin: Number(satu.poin) })),
  })
  if (!hasil.success) galat.push('Rubrik tugas unggah belum lengkap.')

  return [...new Set(galat)]
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiTekaSilangMini(state) {
  const galat = []
  const baris = barisSilang(state.gridSilang)

  if (baris.length < 2) galat.push('Teka silang wajib punya minimal 2 baris.')
  if (baris.length > MAKS_SISI_SILANG) galat.push(`Teka silang maksimal ${MAKS_SISI_SILANG} baris.`)

  const lebar = baris[0]?.length ?? 0

  if (lebar < 2) galat.push('Teka silang wajib punya minimal 2 kolom.')
  if (lebar > MAKS_SISI_SILANG) galat.push(`Teka silang maksimal ${MAKS_SISI_SILANG} kolom.`)
  if (baris.some((satu) => satu.length !== lebar)) galat.push('Setiap baris teka silang wajib sama panjang.')
  if (baris.some((satu) => /[^a-zA-Z#.]/.test(satu))) {
    galat.push('Kotak teka silang hanya boleh huruf jawaban, # (kotak hitam), atau . (belum diisi).')
  }

  if (baris.every((satu) => [...satu].every((kotak) => kotak === '#'))) {
    galat.push('Teka silang wajib punya minimal satu kotak yang diisi murid.')
  }

  if (baris.some((satu) => /[.]/.test(satu))) {
    galat.push('Setiap kotak yang diisi murid wajib punya huruf jawaban (ganti titik dengan huruf).')
  }

  const kodeKosong = new Set()
  baris.forEach((satu, r) => {
    ;[...satu].forEach((kotak, c) => {
      if (kotak !== '#') kodeKosong.add(kodeSilang(r, c))
    })
  })

  const huruf = selSilangDariGrid(state.gridSilang)

  for (const kode of kodeKosong) {
    if (huruf[kode] === undefined) galat.push('Setiap kotak yang diisi murid wajib punya huruf jawaban.')
  }

  /** @type {{ mendatar: number[], menurun: number[] }} */
  const nomor = { mendatar: [], menurun: [] }

  for (const petunjuk of state.petunjukSilang) {
    const arah = petunjuk.arah === 'menurun' ? 'menurun' : 'mendatar'
    const nomorBulat = Number(petunjuk.nomor)
    const panjang = Number(petunjuk.panjang)

    if (!Number.isInteger(nomorBulat) || nomorBulat < 1) {
      galat.push(`Setiap petunjuk ${arah} wajib punya nomor bulat minimal 1.`)
    } else {
      nomor[arah].push(nomorBulat)
    }

    if (petunjuk.teks.trim() === '') galat.push(`Setiap petunjuk ${arah} wajib diisi teksnya.`)
    if (!Number.isInteger(panjang) || panjang < MIN_HURUF_SILANG) {
      galat.push(`Setiap petunjuk ${arah} wajib punya panjang minimal ${MIN_HURUF_SILANG} huruf.`)
      continue
    }

    const sel = selDariPetunjuk(petunjuk.mulai, panjang, arah)

    if (sel.length === 0) {
      galat.push(`Sel awal petunjuk ${arah} wajib ditulis "baris,kolom" (mis. 0,0).`)
      continue
    }

    for (const kode of sel) {
      const bagian = kode.split(',')
      const r = Number(bagian[0])
      const c = Number(bagian[1])
      const isi = baris[r]?.[c]

      if (isi === undefined) {
        galat.push(`Petunjuk ${arah} keluar dari grid teka silang (${kode}).`)
        break
      }

      if (isi === '#') {
        galat.push(`Petunjuk ${arah} melewati kotak hitam (${kode}).`)
        break
      }
    }
  }

  /** @type {('mendatar'|'menurun')[]} */
  const arahPetunjuk = ['mendatar', 'menurun']

  for (const arah of arahPetunjuk) {
    const daftar = nomor[arah]
    if (new Set(daftar).size !== daftar.length) galat.push(`Nomor petunjuk ${arah} tidak boleh kembar.`)
    if (daftar.length > MAKS_PETUNJUK_SILANG) {
      galat.push(`Petunjuk ${arah} maksimal ${MAKS_PETUNJUK_SILANG} kata.`)
    }
  }

  const hasil = skemaTekaSilangMiniKunci.safeParse({ sel: huruf })
  if (!hasil.success) galat.push('Kunci teka silang wajib satu huruf per kotak.')

  return [...new Set(galat)]
}

/**
 * Skema Zod kunci tipe baru — lapisan struktur sebelum aturan silang-field di
 * bawah. Semua memakai `.strict()` supaya bidang asing tidak lolos ke server.
 */
export const skemaPilihanGandaKompleksKunci = z
  .object({ benar: z.array(z.string().min(1)).min(1, 'Pilih minimal satu kunci.') })
  .strict()
  .refine((data) => new Set(data.benar).size === data.benar.length, 'Id kunci tidak boleh duplikat.')

export const skemaBenarSalahMajemukKunci = z.object({ jawaban: z.record(z.string(), z.boolean()) }).strict()

export const skemaIsianAngkaKunci = z
  .object({ nilai: z.number(), toleransi: z.number().min(0, 'Toleransi tidak boleh negatif.') })
  .strict()

export const skemaPilihanGambarKunci = z.object({ benar: z.string().min(1) }).strict()

export const skemaUrutGambarKunci = z.object({ urutan: z.array(z.string().min(1)).min(MIN_GAMBAR) }).strict()

export const skemaSusunHurufKunci = z
  .object({
    kata: z
      .string()
      .trim()
      .min(MIN_HURUF, `Kata minimal ${MIN_HURUF} huruf.`)
      .max(MAKS_HURUF, `Kata maksimal ${MAKS_HURUF} huruf.`)
      .regex(/^\S+$/u, 'Kata tidak boleh memuat spasi.'),
  })
  .strict()

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiPilihanGandaKompleks(state) {
  const galat = []

  if (state.opsi.length < MIN_OPSI_KOMPLEKS) {
    galat.push(`Pilihan ganda kompleks wajib punya minimal ${MIN_OPSI_KOMPLEKS} opsi.`)
  }
  if (state.opsi.length > MAKS_OPSI_KOMPLEKS) {
    galat.push(`Pilihan ganda kompleks maksimal ${MAKS_OPSI_KOMPLEKS} opsi.`)
  }
  if (state.opsi.some((satu) => satu.teks.trim() === '')) galat.push('Setiap opsi wajib punya teks.')

  const id = state.opsi.map((satu) => satu.id)
  if (new Set(id).size !== id.length) galat.push('Id opsi tidak boleh duplikat.')

  const hasil = skemaPilihanGandaKompleksKunci.safeParse({ benar: state.benarKompleks })
  if (!hasil.success) {
    galat.push(...hasil.error.issues.map((satu) => satu.message))
  } else {
    if (!state.benarKompleks.every((satu) => id.includes(satu))) {
      galat.push('Ada kunci yang menunjuk opsi tak dikenal.')
    }
    if (state.opsi.length > 0 && state.benarKompleks.length >= state.opsi.length) {
      galat.push('Sisakan minimal satu opsi yang bukan kunci.')
    }
  }

  return [...new Set(galat)]
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiBenarSalahMajemuk(state) {
  const galat = []

  if (state.pernyataan.length < MIN_PERNYATAAN) {
    galat.push(`Benar/salah majemuk wajib punya minimal ${MIN_PERNYATAAN} pernyataan.`)
  }
  if (state.pernyataan.length > MAKS_PERNYATAAN) {
    galat.push(`Benar/salah majemuk maksimal ${MAKS_PERNYATAAN} pernyataan.`)
  }
  if (state.pernyataan.some((satu) => satu.teks.trim() === '')) {
    galat.push('Setiap pernyataan wajib punya teks.')
  }

  const id = state.pernyataan.map((satu) => satu.id)
  if (new Set(id).size !== id.length) galat.push('Id pernyataan tidak boleh duplikat.')

  const hasil = skemaBenarSalahMajemukKunci.safeParse({ jawaban: state.kunciPernyataan })
  if (!hasil.success) galat.push('Setiap pernyataan wajib punya kunci benar/salah.')

  return [...new Set(galat)]
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiIsianAngka(state) {
  const galat = []

  const nilai = Number(state.angkaNilai)
  const toleransi = Number(state.angkaToleransi || 0)

  const hasil = skemaIsianAngkaKunci.safeParse({ nilai, toleransi })
  if (!hasil.success) {
    galat.push('Kunci isian angka wajib angka dengan toleransi tidak negatif.')
  }

  if (state.satuan.trim().length > 20) galat.push('Satuan maksimal 20 karakter.')

  return galat
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiPilihanGambar(state) {
  const galat = []

  if (state.opsiGambar.length < MIN_GAMBAR) {
    galat.push(`Pilihan gambar wajib punya minimal ${MIN_GAMBAR} gambar.`)
  }
  if (state.opsiGambar.length > MAKS_GAMBAR) {
    galat.push(`Pilihan gambar maksimal ${MAKS_GAMBAR} gambar.`)
  }
  if (state.opsiGambar.some((satu) => satu.media.trim() === '')) {
    galat.push('Setiap gambar wajib punya alamat media.')
  }

  const id = state.opsiGambar.map((satu) => satu.id)
  if (new Set(id).size !== id.length) galat.push('Id gambar tidak boleh duplikat.')

  const hasil = skemaPilihanGambarKunci.safeParse({ benar: state.jawabanGambar })
  if (!hasil.success) galat.push('Tandai satu gambar sebagai kunci jawaban.')
  else if (!id.includes(state.jawabanGambar)) galat.push('Ada kunci yang menunjuk gambar tak dikenal.')

  return [...new Set(galat)]
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiUrutGambar(state) {
  const galat = []

  if (state.itemGambar.length < MIN_GAMBAR) {
    galat.push(`Urut gambar wajib punya minimal ${MIN_GAMBAR} gambar.`)
  }
  if (state.itemGambar.length > MAKS_GAMBAR) {
    galat.push(`Urut gambar maksimal ${MAKS_GAMBAR} gambar.`)
  }
  if (state.itemGambar.some((satu) => satu.media.trim() === '')) {
    galat.push('Setiap gambar wajib punya alamat media.')
  }

  const id = state.itemGambar.map((satu) => satu.id)
  if (new Set(id).size !== id.length) galat.push('Id gambar tidak boleh duplikat.')

  const posisi = state.itemGambar.map((satu) => Number(satu.posisi))
  const wajar = posisi.every((satu) => Number.isInteger(satu) && satu >= 1 && satu <= state.itemGambar.length)
  const unik = new Set(posisi).size === posisi.length

  if (!wajar || !unik) galat.push('Isi nomor urut benar untuk setiap gambar (1 sampai jumlah gambar, tanpa angka kembar).')

  const hasil = skemaUrutGambarKunci.safeParse({ urutan: urutanDariItemGambar(state.itemGambar) })
  if (!hasil.success) galat.push('Kunci urutan gambar belum lengkap.')

  return [...new Set(galat)]
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiSusunHuruf(state) {
  const galat = []

  if (state.petunjuk.trim() === '') galat.push('Susun huruf wajib punya petunjuk.')
  if (state.petunjuk.trim().length > MAKS_PETUNJUK) {
    galat.push(`Petunjuk maksimal ${MAKS_PETUNJUK} karakter.`)
  }

  const hasil = skemaSusunHurufKunci.safeParse({ kata: state.kataSusun })
  if (!hasil.success) {
    galat.push(hasil.error.issues[0]?.message ?? 'Kata susun huruf belum valid.')
  }

  return galat
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiPilihanGanda(state) {
  const galat = []

  if (state.opsi.length < MIN_OPSI) galat.push(`Pilihan ganda wajib punya minimal ${MIN_OPSI} opsi.`)
  if (state.opsi.length > MAKS_OPSI) galat.push(`Pilihan ganda maksimal ${MAKS_OPSI} opsi.`)
  if (state.opsi.some((satu) => satu.teks.trim() === '')) galat.push('Setiap opsi wajib punya teks.')

  const id = state.opsi.map((satu) => satu.id)
  if (new Set(id).size !== id.length) galat.push('Id opsi tidak boleh duplikat.')
  if (!id.includes(state.jawaban)) galat.push('Tandai satu opsi sebagai kunci jawaban.')

  return galat
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiMenjodohkan(state) {
  return validasiPasangan(state, 'Menjodohkan', state.pasangan)
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiHubungKata(state) {
  return validasiPasangan(state, 'Hubung kata', state.sambungan)
}

/**
 * Aturan bersama menjodohkan & hubung kata (beda hanya nama kunci pemetaan).
 * @param {import('./tipeSoal.js').StateSoal} state
 * @param {string} jenis
 * @param {Record<string, string>} peta
 * @returns {string[]}
 */
function validasiPasangan(state, jenis, peta) {
  const galat = []

  if (state.kiri.length < MIN_ITEM || state.kanan.length < MIN_ITEM) {
    galat.push(`${jenis} wajib punya minimal ${MIN_ITEM} pasangan kiri dan kanan.`)
  }

  if (state.kiri.some((satu) => satu.teks.trim() === '')) galat.push('Setiap item kiri wajib punya teks.')
  if (state.kanan.some((satu) => satu.teks.trim() === '')) galat.push('Setiap item kanan wajib punya teks.')

  const idKanan = state.kanan.map((satu) => satu.id)

  for (const satu of state.kiri) {
    const pasangan = peta[satu.id] ?? ''
    if (pasangan === '') galat.push('Setiap item kiri wajib punya pasangan di kunci.')
    else if (!idKanan.includes(pasangan)) galat.push('Ada pasangan yang menunjuk item kanan tak dikenal.')
  }

  return [...new Set(galat)]
}

/**
 * Letak kata: minimal dua kata & dua posisi, id unik, dan setiap kata punya
 * posisi di kunci.
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiLetakKata(state) {
  const galat = []

  if (state.kata.length < MIN_ITEM || state.posisi.length < MIN_ITEM) {
    galat.push(`Letak kata wajib punya minimal ${MIN_ITEM} kata dan ${MIN_ITEM} posisi.`)
  }

  if (state.kata.some((satu) => satu.teks.trim() === '')) galat.push('Setiap kata wajib punya teks.')
  if (state.posisi.some((satu) => satu.teks.trim() === '')) galat.push('Setiap posisi wajib punya teks.')

  const idKata = state.kata.map((satu) => satu.id)
  const idPosisi = state.posisi.map((satu) => satu.id)

  if (new Set(idKata).size !== idKata.length) galat.push('Id kata tidak boleh duplikat.')
  if (new Set(idPosisi).size !== idPosisi.length) galat.push('Id posisi tidak boleh duplikat.')

  for (const satu of state.kata) {
    const posisi = state.penempatan[satu.id] ?? ''
    if (posisi === '') galat.push('Setiap kata wajib punya posisi di kunci.')
    else if (!idPosisi.includes(posisi)) galat.push('Ada penempatan yang menunjuk posisi tak dikenal.')
  }

  return [...new Set(galat)]
}

/**
 * Isian singkat: wajib punya jawaban baku; ambang (bila diisi) 0–1.
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiIsianSingkat(state) {
  const galat = []

  if (state.jawabanBaku.length === 0) galat.push('Isian singkat wajib punya minimal satu jawaban baku.')
  if (state.jawabanBaku.some((satu) => satu.teks.trim() === '')) {
    galat.push('Setiap jawaban baku wajib berupa teks.')
  }

  if (!ambangWajar(state.ambang)) {
    galat.push(`Ambang kemiripan isian harus angka lebih dari 0 sampai 1 (bawaan ${AMBANG_BAWAAN_ISIAN}).`)
  }

  return galat
}

/**
 * Uraian: wajib punya kata kunci; bobot opsional tetapi harus > 0 bila diisi.
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiUraian(state) {
  const galat = []

  if (state.kataKunci.length === 0) galat.push('Uraian wajib punya minimal satu kata kunci.')
  if (state.kataKunci.some((satu) => satu.teks.trim() === '')) {
    galat.push('Setiap kata kunci wajib punya teks.')
  }

  for (const satu of state.kataKunci) {
    if (satu.bobot.trim() === '') continue
    const bobot = Number(satu.bobot)
    if (!Number.isFinite(bobot) || bobot <= 0) {
      galat.push('Bobot kata kunci wajib bilangan lebih dari 0.')
      break
    }
  }

  if (!ambangWajar(state.ambangLulus)) {
    galat.push(`Ambang lulus uraian harus angka lebih dari 0 sampai 1 (bawaan ${AMBANG_BAWAAN_URAIAN}).`)
  }

  return galat
}

/**
 * Skor wajib bilangan bulat 1 sampai 100 (cermin aturan backend).
 * @param {string} nilai
 * @returns {boolean}
 */
function skorWajar(nilai) {
  const skor = Number(nilai)
  return Number.isInteger(skor) && skor >= 1 && skor <= 100
}

/**
 * Daftar periksa kelengkapan soal untuk guru (papan desain 11: kartu
 * "Kelengkapan"). Butirnya murni turunan dari validator di atas, jadi daftar ini
 * tidak pernah berbeda pendapat dengan `validasiSoal()` — kesetaraan itu dijaga
 * oleh tes di __tests__/sections/question/validasi.test.js.
 *
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {{ ok: boolean, teks: string }[]}
 */
export function kelengkapanSoal(state) {
  /** @type {{ ok: boolean, teks: string }[]} */
  const daftar = [
    { ok: state.subject_id !== '', teks: 'Mapel dipilih' },
    {
      ok: state.teks.trim() !== '' || TIPE_TANPA_TEKS.includes(state.tipe),
      teks: 'Isi soal terisi',
    },
  ]

  if (state.tipe === TIPE.pilihanGanda) {
    daftar.push({
      ok: validasiPilihanGanda(state).length === 0,
      teks: `Pilihan jawaban terisi (minimal ${MIN_OPSI}) dan satu kunci dipilih`,
    })
  }

  if (state.tipe === TIPE.benarSalah) {
    daftar.push({ ok: typeof state.benar === 'boolean', teks: 'Kunci benar atau salah dipilih' })
  }

  if (state.tipe === TIPE.menjodohkan) {
    daftar.push({
      ok: validasiPasangan(state, 'Menjodohkan', state.pasangan).length === 0,
      teks: 'Pasangan kiri dan kanan lengkap',
    })
  }

  if (state.tipe === TIPE.hubungKata) {
    daftar.push({
      ok: validasiPasangan(state, 'Hubung kata', state.sambungan).length === 0,
      teks: 'Sambungan kiri dan kanan lengkap',
    })
  }

  if (state.tipe === TIPE.mengurutkan) {
    daftar.push({
      ok: validasiMengurutkan(state).length === 0,
      teks: 'Nomor urut benar terisi untuk setiap item',
    })
  }

  if (state.tipe === TIPE.letakKata) {
    daftar.push({
      ok: validasiLetakKata(state).length === 0,
      teks: 'Setiap kata punya posisi di kunci',
    })
  }

  if (state.tipe === TIPE.isianSingkat) {
    daftar.push({
      ok: state.jawabanBaku.length > 0 && state.jawabanBaku.every((satu) => satu.teks.trim() !== ''),
      teks: 'Jawaban baku terisi',
    })
    daftar.push({ ok: ambangWajar(state.ambang), teks: 'Ambang kemiripan wajar (0 sampai 1)' })
  }

  if (state.tipe === TIPE.pilihanGandaKompleks) {
    daftar.push({
      ok: validasiPilihanGandaKompleks(state).length === 0,
      teks: `Pilihan terisi (minimal ${MIN_OPSI_KOMPLEKS}) dan kunci ditandai`,
    })
  }

  if (state.tipe === TIPE.benarSalahMajemuk) {
    daftar.push({
      ok: validasiBenarSalahMajemuk(state).length === 0,
      teks: 'Pernyataan dan kunci benar/salah lengkap',
    })
  }

  if (state.tipe === TIPE.isianAngka) {
    daftar.push({
      ok: validasiIsianAngka(state).length === 0,
      teks: 'Kunci angka dan toleransi terisi',
    })
  }

  if (state.tipe === TIPE.pilihanGambar) {
    daftar.push({
      ok: validasiPilihanGambar(state).length === 0,
      teks: `Gambar terisi (minimal ${MIN_GAMBAR}) dan satu kunci dipilih`,
    })
  }

  if (state.tipe === TIPE.urutGambar) {
    daftar.push({
      ok: validasiUrutGambar(state).length === 0,
      teks: 'Nomor urut benar terisi untuk setiap gambar',
    })
  }

  if (state.tipe === TIPE.susunHuruf) {
    daftar.push({
      ok: validasiSusunHuruf(state).length === 0,
      teks: `Petunjuk dan kata (${MIN_HURUF}–${MAKS_HURUF} huruf) terisi`,
    })
  }

  if (state.tipe === TIPE.isianRumpang) {
    daftar.push({
      ok: validasiIsianRumpang(state).length === 0,
      teks: 'Penanda {{1}}…{{n}} berurutan dan tiap lubang punya jawaban',
    })
  }

  if (state.tipe === TIPE.klasifikasi) {
    daftar.push({
      ok: validasiKlasifikasi(state).length === 0,
      teks: `Item (minimal ${MIN_ITEM}), kotak (minimal ${MIN_KOTAK}), dan kunci lengkap`,
    })
  }

  if (state.tipe === TIPE.tabelIsian) {
    daftar.push({
      ok: validasiTabelIsian(state).length === 0,
      teks: 'Kolom, baris, dan jawaban tiap sel kosong terisi',
    })
  }

  if (state.tipe === TIPE.garisBilangan) {
    daftar.push({
      ok: validasiGarisBilangan(state).length === 0,
      teks: 'Rentang, langkah, dan nilai kunci wajar',
    })
  }

  if (state.tipe === TIPE.hotspotGambar) {
    daftar.push({
      ok: validasiHotspotGambar(state).length === 0,
      teks: 'Gambar, area yang bisa diketuk, dan area kunci lengkap',
    })
  }

  if (state.tipe === TIPE.bacaJam) {
    daftar.push({
      ok: validasiBacaJam(state).length === 0,
      teks: 'Jam 0–11 dan menit 0–59 sudah diisi',
    })
  }

  if (state.tipe === TIPE.tugasUnggah) {
    daftar.push({
      ok: validasiTugasUnggah(state).length === 0,
      teks: 'Jenis berkas dan rubrik penilaian terisi',
    })
  }

  if (state.tipe === TIPE.tekaSilangMini) {
    daftar.push({
      ok: validasiTekaSilangMini(state).length === 0,
      teks: 'Grid, huruf jawaban, dan petunjuk teka silang lengkap',
    })
  }

  if (state.tipe === TIPE.uraian) {
    daftar.push({
      ok: state.kataKunci.length > 0 && state.kataKunci.every((satu) => satu.teks.trim() !== ''),
      teks: 'Kata kunci terisi',
    })
    daftar.push({
      ok: state.kataKunci.every(
        (satu) => satu.bobot.trim() === '' || Number(satu.bobot) > 0,
      ),
      teks: 'Bobot kata kunci wajar (kosong atau lebih dari 0)',
    })
    daftar.push({ ok: ambangWajar(state.ambangLulus), teks: 'Ambang lulus wajar (0 sampai 1)' })
  }

  daftar.push({ ok: skorWajar(state.skor), teks: 'Skor angka 1 sampai 100' })
  daftar.push({
    ok: state.matematika.trim().length <= MAKS_MATEMATIKA,
    teks: `Template MathML maksimal ${MAKS_MATEMATIKA} karakter`,
  })

  return daftar
}

/**
 * Semua butir kelengkapan terisi → editor boleh mengirim ke server.
 * @param {{ ok: boolean }[]} butir
 * @returns {boolean}
 */
export function siapSoal(butir) {
  return butir.every((satu) => satu.ok)
}

/**
 * Ambang kosong dianggap memakai bawaan; selain itu wajib angka (0, 1].
 * @param {string} nilai
 * @returns {boolean}
 */
function ambangWajar(nilai) {
  if (nilai.trim() === '') return true
  const angka = Number(nilai)
  return Number.isFinite(angka) && angka > 0 && angka <= 1
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiMengurutkan(state) {
  const galat = []

  if (state.item.length < MIN_ITEM) galat.push(`Mengurutkan wajib punya minimal ${MIN_ITEM} item.`)
  if (state.item.some((satu) => satu.teks.trim() === '')) galat.push('Setiap item wajib punya teks.')

  const posisi = state.item.map((satu) => Number(satu.posisi))
  const wajar = posisi.every((satu) => Number.isInteger(satu) && satu >= 1 && satu <= state.item.length)
  const unik = new Set(posisi).size === posisi.length

  if (!wajar || !unik) galat.push('Isi nomor urut benar untuk setiap item (1 sampai jumlah item, tanpa angka kembar).')

  return galat
}

/**
 * Susunan akhir mengurutkan untuk ditampilkan pada pratinjau.
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
export function pratinjauUrutan(state) {
  return urutanDariItem(state.item)
}
