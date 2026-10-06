/**
 * Pembantu tampilan kuis: label status (relatif terhadap jadwal) dan format
 * jadwal berbahasa Indonesia lewat Intl (tanpa impor lokal dayjs yang
 * membuat checkJs menelusuri berkas tanpa tipe).
 */
const FORMAT_JADWAL = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Label status yang dibaca murid. Status server hanya draf/publikasi/arsip,
 * sedangkan murid perlu tahu apakah kuisnya belum mulai atau sudah lewat.
 * @param {{
 *   status: string,
 *   sedang_berjalan: boolean,
 *   mulai_at: string|null,
 *   selesai_at: string|null,
 * }} kuis
 * @returns {{ label: string, jenis: 'sukses'|'info'|'peringatan'|'lembut' }}
 */
export function statusTampilan(kuis) {
  if (kuis.status !== 'publikasi') {
    return { label: kuis.status === 'arsip' ? 'Diarsipkan' : 'Draf', jenis: 'lembut' }
  }

  if (kuis.sedang_berjalan) return { label: 'Sedang berjalan', jenis: 'sukses' }

  if (kuis.mulai_at !== null && new Date(kuis.mulai_at).getTime() > Date.now()) {
    return { label: 'Belum dimulai', jenis: 'info' }
  }

  return { label: 'Selesai', jenis: 'peringatan' }
}

/**
 * Format jadwal dari server (ISO) menjadi "6 Okt 2026, 10.00".
 * @param {string|null} iso
 * @returns {string}
 */
export function formatJadwal(iso) {
  return iso === null ? '—' : FORMAT_JADWAL.format(new Date(iso))
}

/**
 * ISO dari server → nilai <input type="datetime-local"> (waktu lokal browser).
 * @param {string|null} iso
 * @returns {string}
 */
export function keLokal(iso) {
  if (iso === null) return ''

  const waktu = new Date(iso)
  /** @param {number} angka */
  const duaDigit = (angka) => String(angka).padStart(2, '0')

  return (
    [waktu.getFullYear(), duaDigit(waktu.getMonth() + 1), duaDigit(waktu.getDate())].join('-') +
    `T${duaDigit(waktu.getHours())}:${duaDigit(waktu.getMinutes())}`
  )
}

/**
 * Nilai <input type="datetime-local"> (waktu lokal browser) → ISO UTC untuk server.
 *
 * Tanpa konversi ini jadwal akan bergeser sebesar offset zona waktu: server
 * menyimpan waktu dalam UTC, sedangkan isi input adalah waktu lokal murid/guru,
 * sehingga kuis tampak "belum dimulai" atau "sudah berakhir" pada jam yang salah.
 * @param {string} lokal
 * @returns {string|null}
 */
export function keIso(lokal) {
  if (lokal === '') return null

  const waktu = new Date(lokal)

  return Number.isNaN(waktu.getTime()) ? null : waktu.toISOString()
}

/**
 * Durasi dalam menit → "45 menit" atau "1 jam 15 menit".
 * @param {number} menit
 * @returns {string}
 */
export function formatDurasi(menit) {
  if (menit < 60) return `${menit} menit`
  const jam = Math.floor(menit / 60)
  const sisa = menit % 60
  return sisa === 0 ? `${jam} jam` : `${jam} jam ${sisa} menit`
}
