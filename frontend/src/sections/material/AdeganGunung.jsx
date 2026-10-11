/**
 * Adegan gunung yang **digambar** (SVG beranimasi) — bukan foto.
 *
 * Sudut pandangnya sengaja **dari bawah**: pendaki berdiri di kaki gunung lalu
 * mendongak. Tandanya ada di komposisi, bukan cuma judulnya:
 *
 * - satu puncak menjulang tinggi di bingkai, kakinya jauh di luar bawah layar;
 * - kaki lereng kiri/kanan bertemu di titik itu sehingga garis-garisnya
 *   mengerucut ke atas (pandangan menyamping akan terbaca datar, bukan tajam);
 * - ada dua bidikan lereng depan yang memotong dari sudut kiri-bawah dan
 *   kanan-bawah — benda terdekat tampak paling besar, seperti saat mendongak;
 * - awan melintas di **belakang** puncak, kabut dan burung naik ke atas.
 *
 * Dua hal sengaja tidak ditulis di sini:
 *
 * 1. **Warna.** Tidak ada nilai hex di komponen (pagar mutu `tema.test.js`):
 *    semua `fill`/`stroke`/`stop-color` diatur kelas di `theme.css`, yang
 *    mengambilnya dari variabel `--adegan-*`.
 * 2. **Animasi.** Geraknya kelas CSS, bukan SMIL, supaya aturan
 *    `prefers-reduced-motion` milik aplikasi ikut mematikannya.
 *
 * Semua elemen `aria-hidden`: panggung peta sudah punya label aksesibelnya
 * sendiri, dan informasi pos tetap dibaca dari daftar teks di bawah peta.
 */
export default function AdeganGunung() {
  return (
    <svg
      className="jelajah-adegan"
      viewBox="0 0 160 90"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="ag-langit" x1="0" y1="0" x2="0" y2="1">
          <stop className="ag-stop-langit-atas" offset="0%" />
          <stop className="ag-stop-langit-tengah" offset="45%" />
          <stop className="ag-stop-langit-bawah" offset="100%" />
        </linearGradient>
        <linearGradient id="ag-lereng" x1="0" y1="0" x2="0" y2="1">
          <stop className="ag-stop-lereng-atas" offset="0%" />
          <stop className="ag-stop-lereng-tengah" offset="40%" />
          <stop className="ag-stop-lereng-bawah" offset="100%" />
        </linearGradient>
        <linearGradient id="ag-lereng-depan" x1="0" y1="0" x2="0" y2="1">
          <stop className="ag-stop-depan-atas" offset="0%" />
          <stop className="ag-stop-depan-bawah" offset="100%" />
        </linearGradient>
        <radialGradient id="ag-cahaya" cx="50%" cy="50%" r="50%">
          <stop className="ag-stop-cahaya" offset="0%" stopOpacity="0.65" />
          <stop className="ag-stop-cahaya" offset="100%" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Langit: bagian terbesar bingkai, seperti saat mendongak. */}
      <rect className="ag-langit" width="160" height="90" />

      {/* Semburat matahari pagi di balik punggung puncak. */}
      <circle className="jelajah-matahari" cx="80" cy="20" r="26" />

      {/* Punggung jauh: tipis, tanpa detail — hanya kedalaman. */}
      <path
        className="ag-punggung"
        d="M0 52 L30 30 L58 50 L84 26 L112 48 L138 28 L160 46 L160 90 L0 90 Z"
      />

      {/* Awan jauh yang melintas di BELAKANG puncak. */}
      <g className="jelajah-awan jelajah-awan-belakang ag-awan">
        <ellipse cx="34" cy="22" rx="17" ry="4.2" />
        <ellipse cx="120" cy="15" rx="21" ry="4.6" />
        <ellipse cx="76" cy="34" rx="13" ry="3.2" />
      </g>

      {/*
        Puncak utama. Apex di (80, 6) dengan kaki jauh di luar kanvas bawah —
        lerengnya bertemu tajam, jadi terbaca menjulang di atas pendaki.
      */}
      <path className="jelajah-puncak ag-lereng" d="M80 6 L172 90 L-12 90 Z" />
      <path className="ag-salju" d="M80 6 L96 26 L88 23 L80 30 L71 23 L64 26 Z" />
      <path className="ag-salju-bayang" d="M80 30 L87 36 L80 41 L73 36 Z" />

      {/* Rusuk lereng: mempertegas arah mengerucut ke atas. */}
      <path className="ag-rusuk" d="M80 6 L62 90" />
      <path className="ag-rusuk" d="M80 6 L98 90" />

      {/* Kabut tipis yang bergerak naik di tengah lereng. */}
      <g className="jelajah-kabut ag-kabut">
        <ellipse cx="60" cy="62" rx="26" ry="3.4" />
        <ellipse cx="104" cy="55" rx="22" ry="3" />
      </g>

      {/* Lereng depan: memotong dari kedua sudut bawah, paling gelap & terbesar. */}
      <path className="jelajah-lereng-depan ag-lereng-depan" d="M-12 90 L-12 54 L44 90 Z" />
      <path className="jelajah-lereng-depan ag-lereng-depan" d="M172 90 L172 50 L118 90 Z" />

      {/* Burung naik ke arah puncak — penanda gerak "mendongak". */}
      <g className="jelajah-burung ag-burung">
        <path d="M96 46 l2.4 -1.8 l2.4 1.8" />
        <path d="M104 40 l2 -1.5 l2 1.5" />
        <path d="M100 54 l1.8 -1.4 l1.8 1.4" />
      </g>
    </svg>
  )
}
