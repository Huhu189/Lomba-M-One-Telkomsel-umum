/**
 * Pemberitahuan bahwa proteksi ulangan aktif (slice 07).
 *
 * Ini **pemberitahuan, bukan gerbang**: murid menutupnya lalu tetap bisa
 * mengerjakan. Menyembunyikan aturan akan membuat anak merasa dijebak, dan
 * chunk anticheat memang menuntut keterbukaan (bukti, bukan vonis).
 */

/**
 * @param {object} props
 * @param {string[]} props.daftar  label saklar yang sedang aktif
 * @param {() => void} props.onTutup
 */
export default function ModalProteksi({ daftar, onTutup }) {
  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
      style={{ background: 'rgba(11, 21, 48, 0.55)', zIndex: 1080 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-proteksi"
    >
      <div className="kartu-soal p-3 p-md-4" style={{ maxWidth: '32rem' }}>
        <h2 id="judul-proteksi" className="h5 fw-bold mb-2">
          Ulangan ini memakai pengaman
        </h2>
        <p className="teks-lembut small mb-3">
          Gurumu menyalakan beberapa pengaman supaya nilainya jujur. Pengaman ini <strong>hanya mencatat</strong> —
          tidak menutup ulanganmu, dan catatannya dibaca guru baik-baik, bukan dihukum otomatis.
        </p>

        <ul className="small mb-3">
          {daftar.map((satu) => (
            <li key={satu}>{satu}</li>
          ))}
        </ul>

        <p className="teks-lembut small mb-3">
          Kalau pengaman ini mengganggu (misalnya kamu perlu memakai alat bantu), bilang ke gurumu dulu.
        </p>

        <button type="button" className="btn btn-aksen" onClick={onTutup}>
          Saya mengerti, lanjut mengerjakan
        </button>
      </div>
    </div>
  )
}
