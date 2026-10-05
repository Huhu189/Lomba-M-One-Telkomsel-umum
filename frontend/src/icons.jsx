/**
 * icons.jsx — kumpulan ikon SVG buatan sendiri (chunk theme).
 * Gaya konsisten: viewBox 24x24, garis 2px, warna mengikuti currentColor.
 */

/**
 * Opsi umum semua ikon.
 * @typedef {{ size?: number, label?: string, className?: string }} PropsIkon
 */

/**
 * Kerangka SVG dasar untuk semua ikon.
 * @param {{ size?: number, label?: string, className?: string, children: import('react').ReactNode }} props
 * @returns {import('react').JSX.Element}
 */
function KerangkaIkon({ size = 20, label = '', className = '', children }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </svg>
  )
}

/** Ikon centang (status benar). @param {PropsIkon} props */
export function IkonCentang(props) {
  return (
    <KerangkaIkon {...props}>
      <path d="M20 6 9 17l-5-5" />
    </KerangkaIkon>
  )
}

/** Ikon silang (status salah / tutup). @param {PropsIkon} props */
export function IkonSilang(props) {
  return (
    <KerangkaIkon {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </KerangkaIkon>
  )
}

/** Ikon peringatan segitiga. @param {PropsIkon} props */
export function IkonPeringatan(props) {
  return (
    <KerangkaIkon {...props}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </KerangkaIkon>
  )
}

/** Ikon informasi. @param {PropsIkon} props */
export function IkonInfo(props) {
  return (
    <KerangkaIkon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </KerangkaIkon>
  )
}

/** Ikon buku (materi/bank soal). @param {PropsIkon} props */
export function IkonBuku(props) {
  return (
    <KerangkaIkon {...props}>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </KerangkaIkon>
  )
}

/** Ikon jam (deadline/riwayat). @param {PropsIkon} props */
export function IkonJam(props) {
  return (
    <KerangkaIkon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </KerangkaIkon>
  )
}

/** Ikon pengguna (murid/guru). @param {PropsIkon} props */
export function IkonPengguna(props) {
  return (
    <KerangkaIkon {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </KerangkaIkon>
  )
}

/** Ikon perisai (keamanan/anti-cheat). @param {PropsIkon} props */
export function IkonPerisai(props) {
  return (
    <KerangkaIkon {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </KerangkaIkon>
  )
}

/** Ikon mata (lihat). @param {PropsIkon} props */
export function IkonMata(props) {
  return (
    <KerangkaIkon {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </KerangkaIkon>
  )
}

/** Ikon mata tertutup (sembunyikan). @param {PropsIkon} props */
export function IkonMataTertutup(props) {
  return (
    <KerangkaIkon {...props}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="m2 2 20 20" />
    </KerangkaIkon>
  )
}

/** Ikon matahari (mode terang). @param {PropsIkon} props */
export function IkonMatahari(props) {
  return (
    <KerangkaIkon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </KerangkaIkon>
  )
}

/** Ikon bulan (mode gelap). @param {PropsIkon} props */
export function IkonBulan(props) {
  return (
    <KerangkaIkon {...props}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </KerangkaIkon>
  )
}

/** Ikon kirim (submit jawaban). @param {PropsIkon} props */
export function IkonKirim(props) {
  return (
    <KerangkaIkon {...props}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </KerangkaIkon>
  )
}

/** Ikon muat ulang (retry). @param {PropsIkon} props */
export function IkonMuatUlang(props) {
  return (
    <KerangkaIkon {...props}>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </KerangkaIkon>
  )
}

/** Ikon daftar (bank soal/kuis). @param {PropsIkon} props */
export function IkonDaftar(props) {
  return (
    <KerangkaIkon {...props}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </KerangkaIkon>
  )
}

/** Ikon surat (email / verifikasi). @param {PropsIkon} props */
export function IkonSurat(props) {
  return (
    <KerangkaIkon {...props}>
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="m22 7-9.03 5.7a2 2 0 0 1-1.94 0L2 7" />
    </KerangkaIkon>
  )
}

/** Ikon gembok (kata sandi). @param {PropsIkon} props */
export function IkonKunci(props) {
  return (
    <KerangkaIkon {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </KerangkaIkon>
  )
}

/** Ikon keluar (logout). @param {PropsIkon} props */
export function IkonKeluar(props) {
  return (
    <KerangkaIkon {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </KerangkaIkon>
  )
}

/** Ikon bintang (nilai / penghargaan). @param {PropsIkon} props */
export function IkonBintang(props) {
  return (
    <KerangkaIkon {...props}>
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01Z" />
    </KerangkaIkon>
  )
}

/** Ikon panah kiri (kembali). @param {PropsIkon} props */
export function IkonPanahKiri(props) {
  return (
    <KerangkaIkon {...props}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </KerangkaIkon>
  )
}

/** Peta nama ikon untuk demo dan pemakaian dinamis. */
export const daftarIkon = {
  centang: IkonCentang,
  silang: IkonSilang,
  peringatan: IkonPeringatan,
  info: IkonInfo,
  buku: IkonBuku,
  jam: IkonJam,
  pengguna: IkonPengguna,
  perisai: IkonPerisai,
  mata: IkonMata,
  mataTertutup: IkonMataTertutup,
  matahari: IkonMatahari,
  bulan: IkonBulan,
  kirim: IkonKirim,
  muatUlang: IkonMuatUlang,
  daftar: IkonDaftar,
  surat: IkonSurat,
  kunci: IkonKunci,
  keluar: IkonKeluar,
  bintang: IkonBintang,
  panahKiri: IkonPanahKiri,
}
