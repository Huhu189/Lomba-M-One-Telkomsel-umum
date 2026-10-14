/**
 * Halaman kelola akun sekolah (14 Okt 2026).
 *
 * Admin sekolah memperbaiki akun guru/murid dari sini: email yang salah ketik
 * saat impor, sandi yang lupa, atau akun yang perlu ditangguhkan sementara.
 *
 * Dua hal yang membuat halaman ini berbeda dari daftar murid biasa:
 * 1. **Dua langkah.** Perubahan disimpan lewat token konfirmasi sekali pakai
 *    yang diminta dengan alasan tertulis, jadi tiap perubahan bisa
 *    dipertanggungjawabkan (AGENT.md prinsip keamanan #6).
 * 2. **Sandi tidak pernah ditampilkan kembali.** Admin yang mengetiknya, jadi ia
 *    yang menyampaikannya ke murid/guru — halaman ini menegaskan itu di panelnya.
 *
 * Akun admin lain dan akun sendiri sengaja tidak bisa disunting di sini
 * (server menolak lewat AkunSekolahPolicy).
 */
import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { IkonCari, IkonMenu, IkonMuatUlang, IkonPengguna, IkonSilang } from '../../icons.jsx'
import { galatKolom, pesanGalatApi } from '../auth/api.js'
import Banner from '../../shared/ui/Banner.jsx'
import HeaderHalaman from '../../shared/ui/HeaderHalaman.jsx'
import KosongData from '../../shared/ui/KosongData.jsx'
import PanelForm from '../../shared/ui/PanelForm.jsx'
import Skeleton from '../../shared/ui/Skeleton.jsx'
import TabelData from '../../shared/ui/TabelData.jsx'
import { Tombol, TombolIkon } from '../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { ambilAkunSekolah, mintaTokenAkun, setelSandiAkun, ubahEmailAkun, ubahStatusAkun } from './api.js'
import {
  ALASAN_MIN,
  SANDI_MIN,
  aksiStatusBerikut,
  bolehMintaToken,
  bolehSimpanAkun,
  catatanAksi,
  judulAksi,
} from './akunSekolah.js'
import { statusAkunTampilan, waktuLalu } from './dasborAdmin.js'

/**
 * Jeda sebelum kata kunci dikirim ke server (ms) — sama dengan daftar murid:
 * tanpa jeda, mengetik "rina" menembak empat permintaan dan hasil ketikan
 * pertama bisa tiba sesudah yang terakhir.
 */
const JEDA_CARI_MS = 300

/** Pilihan peran dan status untuk menyaring daftar. */
const PILIHAN_PERAN = [
  { nilai: '', label: 'Semua peran' },
  { nilai: 'guru', label: 'Guru' },
  { nilai: 'murid', label: 'Murid' },
]

const PILIHAN_STATUS = [
  { nilai: '', label: 'Semua status' },
  { nilai: 'aktif', label: 'Aktif' },
  { nilai: 'pending', label: 'Menunggu verifikasi' },
  { nilai: 'suspended', label: 'Ditangguhkan' },
]

export default function HalamanAkunSekolah() {
  const queryClient = useQueryClient()
  const [parameter] = useSearchParams()

  // Saringan awal boleh datang dari tautan dasbor (mis. ?status=suspended dari
  // kartu "akun ditangguhkan") supaya admin langsung mendarat di daftar yang
  // dimaksud, bukan di seluruh sekolah.
  const [peran, setPeran] = useState(parameter.get('peran') ?? '')
  const [status, setStatus] = useState(parameter.get('status') ?? '')
  const [cari, setCari] = useState('')
  const [cariDipakai, setCariDipakai] = useState('')
  const [halaman, setHalaman] = useState(1)

  /** Akun yang sedang dibuka di panel; `null` berarti panel tertutup. */
  const [akunAktif, setAkunAktif] = useState(
    /** @type {import('./api.js').AkunSekolah|null} */ (null),
  )
  const [jenisAksi, setJenisAksi] = useState(/** @type {'email'|'sandi'|'status'} */ ('email'))

  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [konfirmasi, setKonfirmasi] = useState('')
  const [statusBaru, setStatusBaru] = useState('suspended')
  const [alasan, setAlasan] = useState('')
  const [token, setToken] = useState('')
  const [kedaluwarsa, setKedaluwarsa] = useState(/** @type {string|null} */ (null))
  const [galatIsian, setGalatIsian] = useState(/** @type {Record<string,string>} */ ({}))

  /**
   * Apakah menu "…" tindakan DI DALAM panel sedang terbuka?
   *
   * Tiga pilihan tindakan (email · sandi · status) dulu berupa tiga pil berjajar
   * di dalam panel. Kini semuanya berada di balik satu tombol "…" dengan pilihan
   * BER-TEKS — sama seperti menu baris di daftar — supaya panelnya tidak dipenuhi
   * deretan tombol, dan tindakan yang sedang dipilih tetap terbaca dari judul
   * panelnya ("Setel ulang kata sandi: Bu Rina").
   */
  const [menuAksiTerbuka, setMenuAksiTerbuka] = useState(false)

  /** Wadah menu tindakan di panel — dipakai menutup saat klik di luar. */
  const wadahMenuAksi = useRef(/** @type {HTMLDivElement|null} */ (null))

  /**
   * Id akun yang menunya sedang terbuka (`null` = tidak ada).
   *
   * Tiga aksi sensitif per baris (email · sandi · status) dulu berupa tiga
   * tombol ikon berjajar. Ikon tanpa teks menuntut guru menebak artinya, dan di
   * layar sempit tiga tombol itu mendorong kolom Aksi keluar layar — jadi
   * sekarang satu tombol menu yang membuka pilihan **berteks**. Satu menu saja
   * yang boleh terbuka, jadi keadaannya cukup satu id.
   */
  const [menuTerbuka, setMenuTerbuka] = useState(/** @type {number|null} */ (null))

  /** Wadah menu yang sedang terbuka — dipakai menutup saat klik di luar. */
  const wadahMenu = useRef(/** @type {HTMLDivElement|null} */ (null))

  useEffect(() => {
    document.title = 'Kelola Akun Sekolah'
  }, [])

  useEffect(() => {
    const jeda = window.setTimeout(() => setCariDipakai(cari.trim()), JEDA_CARI_MS)
    return () => window.clearTimeout(jeda)
  }, [cari])

  // Menu baris ditutup saat admin mengeklik di luar menunya atau menekan Esc.
  // Tanpa ini menu tertinggal terbuka ketika daftar berganti halaman atau
  // saringan diubah, dan pilihannya jadi tampak milik baris yang salah.
  useEffect(() => {
    if (menuTerbuka === null) return undefined

    /** @param {Event} e */
    const tutupDiLuar = (e) => {
      const wadah = wadahMenu.current

      if (wadah !== null && e.target instanceof Node && ! wadah.contains(e.target)) {
        setMenuTerbuka(null)
      }
    }

    /** @param {Event} e */
    const tutupDenganEsc = (e) => {
      if (e instanceof KeyboardEvent && e.key === 'Escape') setMenuTerbuka(null)
    }

    document.addEventListener('pointerdown', tutupDiLuar)
    document.addEventListener('keydown', tutupDenganEsc)

    return () => {
      document.removeEventListener('pointerdown', tutupDiLuar)
      document.removeEventListener('keydown', tutupDenganEsc)
    }
  }, [menuTerbuka])

  // Menu tindakan di dalam panel ditutup dengan cara yang sama: klik di luar
  // menunya, atau Esc. Tanpa ini daftar pilihan tertinggal terbuka di atas
  // formulir saat admin mulai mengetik.
  useEffect(() => {
    if (!menuAksiTerbuka) return undefined

    /** @param {Event} e */
    const tutupDiLuar = (e) => {
      const wadah = wadahMenuAksi.current

      if (wadah !== null && e.target instanceof Node && ! wadah.contains(e.target)) {
        setMenuAksiTerbuka(false)
      }
    }

    /**
     * Esc menutup lapisan TERATAS dulu: menunya, bukan panelnya.
     *
     * Panel ini memuat alasan dan sandi yang sudah diketik admin; kalau Esc
     * langsung menutup panelnya, pekerjaan yang sudah ditulis hilang hanya karena
     * admin ingin membatalkan pilihan menunya. `preventDefault()` di sini mematikan
     * aksi bawaan Escape pada `<dialog>` (menutup dialog) — tanpa itu, `onCancel`
     * di `PanelForm` tetap ikut menutup panelnya.
     * @param {Event} e
     */
    const tutupDenganEsc = (e) => {
      if (e instanceof KeyboardEvent && e.key === 'Escape') {
        e.preventDefault()
        setMenuAksiTerbuka(false)
      }
    }

    document.addEventListener('pointerdown', tutupDiLuar)
    document.addEventListener('keydown', tutupDenganEsc)

    return () => {
      document.removeEventListener('pointerdown', tutupDiLuar)
      document.removeEventListener('keydown', tutupDenganEsc)
    }
  }, [menuAksiTerbuka])

  const daftar = useQuery({
    queryKey: ['admin-akun', peran, status, halaman, cariDipakai],
    queryFn: () => ambilAkunSekolah({ halaman, peran, status, cari: cariDipakai }),
    placeholderData: keepPreviousData,
  })

  const meta = daftar.data?.meta
  const baris = daftar.data?.data ?? []

  const isian = { jenis: jenisAksi, alasan, email, sandi, konfirmasi, status: statusBaru, token }
  const siapMintaToken = bolehMintaToken(isian)
  const siapSimpan = bolehSimpanAkun(isian)

  const mintaToken = useMutation({
    mutationFn: () => {
      if (akunAktif === null) throw new Error('Tidak ada akun yang dipilih.')
      return mintaTokenAkun(akunAktif.id, alasan.trim())
    },
    onSuccess: (hasil) => {
      setToken(hasil.token)
      setKedaluwarsa(hasil.expires_at)
      setGalatIsian({})
      tampilkanToast('info', 'Token konfirmasi terbit. Tekan Simpan dalam 5 menit.')
    },
    onError: (galat) => {
      setGalatIsian(galatKolom(galat))
      tampilkanToast('salah', pesanGalatApi(galat))
    },
  })

  const simpan = useMutation({
    mutationFn: async () => {
      if (akunAktif === null) throw new Error('Tidak ada akun yang dipilih.')

      const muatan = { alasan: alasan.trim(), token: token.trim() }

      if (jenisAksi === 'email') {
        return ubahEmailAkun(akunAktif.id, { ...muatan, email: email.trim() })
      }

      if (jenisAksi === 'sandi') {
        return setelSandiAkun(akunAktif.id, { ...muatan, password: sandi, konfirmasi })
      }

      return ubahStatusAkun(akunAktif.id, { ...muatan, status: statusBaru })
    },
    onSuccess: async (hasil) => {
      tampilkanToast('sukses', hasil.message)
      tutupPanel()
      await queryClient.invalidateQueries({ queryKey: ['admin-akun'] })
      // Dasbor ikut disegarkan: perubahan status/email mengubah angkanya.
      await queryClient.invalidateQueries({ queryKey: ['admin-monitor'] })
    },
    onError: (galat) => {
      setGalatIsian(galatKolom(galat))
      tampilkanToast('salah', pesanGalatApi(galat))
    },
  })

  const sibuk = mintaToken.isPending || simpan.isPending

  /**
   * Buka panel untuk satu akun dan satu aksi.
   * @param {import('./api.js').AkunSekolah} akun
   * @param {'email'|'sandi'|'status'} jenis
   */
  function bukaPanel(akun, jenis) {
    setMenuTerbuka(null)
    setMenuAksiTerbuka(false)
    setAkunAktif(akun)
    setJenisAksi(jenis)
    setEmail(akun.email)
    setSandi('')
    setKonfirmasi('')
    setStatusBaru(aksiStatusBerikut(akun.status).status)
    setAlasan('')
    setToken('')
    setKedaluwarsa(null)
    setGalatIsian({})
  }

  /**
   * Ganti aksi di dalam panel. Token lama dimatikan di klien karena token itu
   * terikat sasaran & sudah dipakai untuk alasan sebelumnya — memakainya ulang
   * untuk aksi lain hanya akan ditolak server.
   * @param {'email'|'sandi'|'status'} jenis
   */
  function gantiAksi(jenis) {
    setJenisAksi(jenis)
    setMenuAksiTerbuka(false)
    setToken('')
    setKedaluwarsa(null)
    setGalatIsian({})
  }

  function tutupPanel() {
    setAkunAktif(null)
    setMenuAksiTerbuka(false)
    setSandi('')
    setKonfirmasi('')
    setAlasan('')
    setToken('')
    setKedaluwarsa(null)
    setGalatIsian({})
  }

  /** @param {string} nilai */
  function ubahCari(nilai) {
    setCari(nilai)
    setHalaman(1)
  }

  return (
    <>
      <HeaderHalaman
        judul="Kelola akun sekolah"
        jejak="Admin sekolah / Akun"
        deskripsi={
          meta
            ? `Menampilkan ${baris.length} dari ${meta.total} akun guru & murid${
                cariDipakai === '' ? '' : ` untuk “${cariDipakai}”`
              }${daftar.isFetching ? ' — mencari…' : ''}`
            : 'Memuat daftar akun…'
        }
      />

      <div className="mb-4">
        <Banner jenis="info" judul="Perubahan akun wajib beralasan dan tercatat">
          Mengubah email atau menyetel ulang sandi memindahkan kendali atas akun itu, jadi tiap
          perubahan meminta token konfirmasi sekali pakai beserta alasan tertulis. Jejaknya
          append-only dan muncul di dasbor sekolah.
        </Banner>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-3">
          <label className="form-label fw-semibold" htmlFor="filter-peran">
            Peran
          </label>
          <select
            id="filter-peran"
            className="form-select"
            value={peran}
            onChange={(e) => {
              setPeran(e.target.value)
              setHalaman(1)
            }}
          >
            {PILIHAN_PERAN.map((pilihan) => (
              <option key={pilihan.nilai} value={pilihan.nilai}>
                {pilihan.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-12 col-md-3">
          <label className="form-label fw-semibold" htmlFor="filter-status-akun">
            Status
          </label>
          <select
            id="filter-status-akun"
            className="form-select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setHalaman(1)
            }}
          >
            {PILIHAN_STATUS.map((pilihan) => (
              <option key={pilihan.nilai} value={pilihan.nilai}>
                {pilihan.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label fw-semibold" htmlFor="cari-akun">
            Cari akun
          </label>
          <div className="d-flex gap-2">
            <input
              id="cari-akun"
              type="search"
              className="form-control"
              placeholder="Nama atau email"
              value={cari}
              onChange={(e) => ubahCari(e.target.value)}
            />
            {cari !== '' && (
              <TombolIkon
                label="Bersihkan pencarian"
                ikon={IkonSilang}
                onClick={() => ubahCari('')}
              />
            )}
          </div>
        </div>
      </div>

      {daftar.isPending && <Skeleton judul baris={5} label="Memuat akun…" />}

      {daftar.isError && (
        <Banner jenis="salah" judul="Gagal memuat daftar akun">
          <p className="mb-2">Periksa koneksi, lalu coba lagi.</p>
          <Tombol varian="tepi" ikon={IkonMuatUlang} onClick={() => daftar.refetch()}>
            Coba lagi
          </Tombol>
        </Banner>
      )}

      {daftar.isSuccess && baris.length > 0 && (
        <div className="kartu-soft p-0">
          <TabelData
            label="Daftar akun guru dan murid"
            kolom={[
              {
                kunci: 'nama',
                judul: 'Akun',
                sel: (akun) => (
                  <>
                    <strong className="d-block">{akun.nama}</strong>
                    <span className="teks-lembut small">{akun.email}</span>
                  </>
                ),
              },
              {
                kunci: 'peran',
                judul: 'Peran',
                sel: (akun) => (
                  <>
                    <span className="d-block">{akun.peran_label}</span>
                    <span className="teks-lembut small">
                      {akun.peran === 'murid' ? (akun.kelas_nama ?? 'Tanpa kelas') : 'Guru sekolah'}
                    </span>
                  </>
                ),
              },
              {
                kunci: 'status',
                judul: 'Status',
                sel: (akun) => {
                  const tampilan = statusAkunTampilan(akun)
                  return <span className={`badge-status ${tampilan.jenis}`}>{tampilan.label}</span>
                },
              },
              {
                kunci: 'terakhir_aktif',
                judul: 'Terakhir aktif',
                sel: (akun) => waktuLalu(akun.terakhir_aktif),
              },
              {
                kunci: 'aksi',
                judul: 'Aksi',
                aksi: true,
                sel: (akun) => {
                  const berikut = aksiStatusBerikut(akun.status)
                  const terbuka = menuTerbuka === akun.id

                  return (
                    <div className="aksi-baris">
                      <div className="menu-aksi" ref={terbuka ? wadahMenu : null}>
                        <TombolIkon
                          label={`Menu aksi untuk ${akun.nama}`}
                          ikon={IkonMenu}
                          varian={terbuka ? 'utama' : 'tepi'}
                          aria-haspopup="menu"
                          aria-expanded={terbuka}
                          onClick={() => setMenuTerbuka(terbuka ? null : akun.id)}
                        />

                        {terbuka && (
                          <div
                            className="menu-aksi-daftar"
                            role="menu"
                            aria-label={`Aksi akun ${akun.nama}`}
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="menu-aksi-item"
                              onClick={() => bukaPanel(akun, 'email')}
                            >
                              Ubah email
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="menu-aksi-item"
                              onClick={() => bukaPanel(akun, 'sandi')}
                            >
                              Setel ulang kata sandi
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className={[
                                'menu-aksi-item',
                                berikut.status === 'suspended' ? 'menu-aksi-bahaya' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              onClick={() => bukaPanel(akun, 'status')}
                            >
                              {berikut.label}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                },
              },
            ]}
            baris={baris}
            kunciBaris={(akun) => akun.id}
          />
        </div>
      )}

      {daftar.isSuccess && baris.length === 0 && (
        <KosongData
          judul={cariDipakai === '' ? 'Tidak ada akun pada saringan ini' : 'Tidak ada akun yang cocok'}
          ikon={cariDipakai === '' ? IkonPengguna : IkonCari}
          aksi={
            cariDipakai !== '' ? (
              <Tombol varian="tepi" onClick={() => ubahCari('')}>
                Bersihkan pencarian
              </Tombol>
            ) : undefined
          }
        >
          Daftar ini memuat akun guru dan murid. Akun admin sekolah tidak dikelola dari sini — itu
          bukan pengelolaan sekolah, melainkan perebutan kendali antar-pengelola.
        </KosongData>
      )}

      {meta && meta.last_page > 1 && (
        <nav className="d-flex flex-wrap align-items-center gap-3 mt-4" aria-label="Navigasi halaman">
          <Tombol
            varian="tepi"
            ukuran="sedang"
            disabled={halaman <= 1}
            onClick={() => setHalaman(halaman - 1)}
          >
            Sebelumnya
          </Tombol>
          <span className="teks-lembut">
            Halaman {meta.current_page} dari {meta.last_page}
          </span>
          <Tombol
            varian="tepi"
            ukuran="sedang"
            disabled={halaman >= meta.last_page}
            onClick={() => setHalaman(halaman + 1)}
          >
            Berikutnya
          </Tombol>
        </nav>
      )}

      <PanelForm
        buka={akunAktif !== null}
        judul={akunAktif === null ? 'Kelola akun' : `${judulAksi(jenisAksi)}: ${akunAktif.nama}`}
        labelTutup="Tutup panel kelola akun"
        onTutup={tutupPanel}
      >
        {akunAktif !== null && (
          <>
            <p className="teks-lembut small">
              {akunAktif.peran_label} · {akunAktif.email}
              {akunAktif.peran === 'murid' && akunAktif.nis ? ` · NIS ${akunAktif.nis}` : ''}
            </p>

            {/**
             * Tindakan ditawarkan lewat menu "…", bukan tiga tombol berjajar di
             * panel. Salah pilih tindakan tidak merusak apa pun — token
             * konfirmasinya terbit per tindakan — tetapi deretan tombol membuat
             * panel ini terasa seperti formulir tiga halaman sekaligus.
             */}
            <div className="menu-aksi mb-3" ref={menuAksiTerbuka ? wadahMenuAksi : null}>
              <TombolIkon
                label={`Pilih tindakan untuk ${akunAktif.nama}`}
                ikon={IkonMenu}
                varian={menuAksiTerbuka ? 'utama' : 'tepi'}
                aria-haspopup="menu"
                aria-expanded={menuAksiTerbuka}
                onClick={() => setMenuAksiTerbuka((satu) => !satu)}
              />

              {menuAksiTerbuka && (
                <div
                  className="menu-aksi-daftar"
                  role="menu"
                  aria-label={`Tindakan untuk akun ${akunAktif.nama}`}
                >
                  {/** @type {Array<['email'|'sandi'|'status', string]>} */ ([
                    ['email', 'Ubah email'],
                    ['sandi', 'Setel ulang kata sandi'],
                    ['status', 'Status akun'],
                  ]).map(([nilai, label]) => (
                    <button
                      key={nilai}
                      type="button"
                      role="menuitem"
                      aria-current={jenisAksi === nilai ? 'true' : undefined}
                      className={[
                        'menu-aksi-item',
                        jenisAksi === nilai ? 'menu-aksi-item-aktif' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => gantiAksi(nilai)}
                    >
                      {label}
                      {jenisAksi === nilai && <span className="sr-saja"> (sedang dipilih)</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className="teks-lembut small">{catatanAksi(jenisAksi)}</p>

            {jenisAksi === 'email' && (
              <div className="mb-3">
                <label className="form-label fw-semibold" htmlFor="email-akun">
                  Email baru
                </label>
                <input
                  id="email-akun"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                />
                {galatIsian.email && (
                  <p className="status-salah small mb-0 mt-1">{galatIsian.email}</p>
                )}
              </div>
            )}

            {jenisAksi === 'sandi' && (
              <>
                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="sandi-akun">
                    Kata sandi baru
                  </label>
                  <input
                    id="sandi-akun"
                    type="password"
                    className="form-control"
                    value={sandi}
                    onChange={(e) => setSandi(e.target.value)}
                    autoComplete="new-password"
                  />
                  <p className="teks-lembut small mb-0 mt-1">
                    Minimal {SANDI_MIN} karakter. Sandi tidak akan ditampilkan lagi setelah disimpan.
                  </p>
                  {galatIsian.password && (
                    <p className="status-salah small mb-0 mt-1">{galatIsian.password}</p>
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="konfirmasi-sandi-akun">
                    Ulangi kata sandi baru
                  </label>
                  <input
                    id="konfirmasi-sandi-akun"
                    type="password"
                    className="form-control"
                    value={konfirmasi}
                    onChange={(e) => setKonfirmasi(e.target.value)}
                    autoComplete="new-password"
                  />
                  {konfirmasi !== '' && konfirmasi !== sandi && (
                    <p className="status-salah small mb-0 mt-1">Ulangan sandi belum sama.</p>
                  )}
                </div>
              </>
            )}

            {jenisAksi === 'status' && (
              <div className="mb-3">
                <label className="form-label fw-semibold" htmlFor="status-akun">
                  Status akun
                </label>
                <select
                  id="status-akun"
                  className="form-select"
                  value={statusBaru}
                  onChange={(e) => setStatusBaru(e.target.value)}
                >
                  <option value="aktif">Aktif</option>
                  <option value="suspended">Ditangguhkan</option>
                </select>
                {galatIsian.status && (
                  <p className="status-salah small mb-0 mt-1">{galatIsian.status}</p>
                )}
              </div>
            )}

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="alasan-akun">
                Alasan perubahan
              </label>
              <textarea
                id="alasan-akun"
                className="form-control"
                rows={3}
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="Mis. “Email murid salah ketik saat impor, orang tua minta diperbaiki.”"
              />
              <p className="teks-lembut small mb-0 mt-1">
                {alasan.trim().length}/{ALASAN_MIN} karakter minimal. Alasan ini yang muncul di jejak
                audit.
              </p>
              {galatIsian.alasan && (
                <p className="status-salah small mb-0 mt-1">{galatIsian.alasan}</p>
              )}
            </div>

            {kedaluwarsa !== null && (
              <Banner jenis="info" judul="Token konfirmasi siap">
                Token aktif sampai {new Date(kedaluwarsa).toLocaleTimeString('id-ID')}. Tekan Simpan
                sebelum itu; token hanya bisa dipakai sekali.
              </Banner>
            )}

            {galatIsian.token && <p className="status-salah small">{galatIsian.token}</p>}

            <div className="d-flex flex-wrap justify-content-end gap-2 mt-3">
              <Tombol varian="tepi" onClick={tutupPanel}>
                Batal
              </Tombol>
              <Tombol
                varian="tepi"
                disabled={sibuk || !siapMintaToken}
                memuat={mintaToken.isPending}
                onClick={() => mintaToken.mutate()}
              >
                Minta token konfirmasi
              </Tombol>
              <Tombol
                disabled={sibuk || !siapSimpan}
                memuat={simpan.isPending}
                onClick={() => simpan.mutate()}
              >
                Simpan perubahan
              </Tombol>
            </div>
          </>
        )}
      </PanelForm>
    </>
  )
}
