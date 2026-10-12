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
 * Gayanya sengaja **gambar** (ilustrasi rata ala buku cerita), bukan lukisan
 * gelap: semua lereng berupa lengkung — tidak ada satu pun sudut tajam — dan
 * tiap bidang punya garis tepi tipis. Langitnya siang cerah dengan matahari di
 * sudut kiri atas, jadi tidak ada bagian yang tenggelam jadi hitam.
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
          <stop className="ag-stop-langit-tengah" offset="52%" />
          <stop className="ag-stop-langit-bawah" offset="100%" />
        </linearGradient>
        <radialGradient id="ag-cahaya" cx="50%" cy="50%" r="50%">
          <stop className="ag-stop-cahaya" offset="0%" stopOpacity="0.72" />
          <stop className="ag-stop-cahaya" offset="100%" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Langit siang: bagian terbesar bingkai, seperti saat mendongak. */}
      <rect className="ag-langit" width="160" height="90" />

      {/* Semburat + bulatan matahari di langit kiri atas, di atas punggung jauh. */}
      <circle className="jelajah-matahari" cx="46" cy="19" r="23" />
      <circle className="ag-matahari-inti" cx="46" cy="18" r="8.5" />

      {/* Punggung jauh: ombak lembut tanpa sudut, hanya kedalaman. */}
      <path
        className="ag-punggung"
        d="M-8 62 C 8 49 20 42 33 45 C 46 48 54 54 66 51 C 78 48 87 39 100 42 C 113 45 124 53 137 49 C 148 46 159 50 168 57 L168 94 L-8 94 Z"
      />

      {/* Awan kapas yang melintas di BELAKANG puncak. */}
      <g className="jelajah-awan jelajah-awan-belakang ag-awan">
        <ellipse cx="30" cy="23" rx="18" ry="4.6" />
        <ellipse cx="21" cy="19.5" rx="10" ry="3.6" />
        <ellipse cx="39" cy="19" rx="9" ry="3.2" />
        <ellipse cx="121" cy="15" rx="21" ry="5" />
        <ellipse cx="112" cy="11.5" rx="11" ry="3.6" />
        <ellipse cx="130" cy="11" rx="9" ry="3.2" />
        <ellipse cx="73" cy="34" rx="13" ry="3.4" />
      </g>

      {/*
        Puncak utama. Apex di sekitar (80, 8) dengan kaki jauh di luar kanvas
        bawah, tetapi kedua lerengnya **melengkung** (bukan garis lurus) supaya
        tidak terasa kaku — arahnya tetap mengerucut ke atas.
      */}
      <path
        className="jelajah-puncak ag-lereng"
        d="M80 8 C 76 22 62 44 44 62 C 30 75 12 86 -14 94 L174 94 C 153 85 133 72 117 60 C 99 46 85 24 80 8 Z"
      />
      <path
        className="ag-salju"
        d="M80 8 C 85 16 90 24 95 31 C 91 29 87 30 83 33 C 79.5 30.6 76 29.6 72 31.5 C 67.5 30 64 26 60.5 22.5 C 67 16 74 11 80 8 Z"
      />
      <path
        className="ag-salju-bayang"
        d="M75 33.5 C 79 36.5 83 36.5 87 33.4 C 86.6 38 82.6 41 78.5 40.4 C 76.2 38.2 75.2 35.8 75 33.5 Z"
      />

      {/* Rusuk lereng: mempertegas arah mengerucut ke atas, juga melengkung. */}
      <path className="ag-rusuk" d="M80 10 C 72 28 58 48 40 66" />
      <path className="ag-rusuk" d="M80 10 C 87 28 101 47 119 63" />

      {/* Kaki gunung: sabuk hijau lembut di pangkalan, penanda bahwa ini siang. */}
      <path
        className="ag-kaki"
        d="M-8 90 C 18 78 48 82 78 87 C 106 91 138 78 168 86 L168 96 L-8 96 Z"
      />

      {/* Kabut tipis yang bergerak naik di tengah lereng. */}
      <g className="jelajah-kabut ag-kabut">
        <ellipse cx="58" cy="63" rx="27" ry="3.6" />
        <ellipse cx="106" cy="56" rx="22" ry="3" />
      </g>

      {/* Lereng depan: memotong dari kedua sudut bawah, terdekat & paling pekat. */}
      <path
        className="jelajah-lereng-depan ag-lereng-depan"
        d="M-8 94 L-8 50 C 10 58 30 72 52 94 Z"
      />
      <path
        className="jelajah-lereng-depan ag-lereng-depan ag-lereng-depan-kanan"
        d="M168 94 L168 45 C 150 55 130 70 108 94 Z"
      />

      {/* Burung naik ke arah puncak — penanda gerak "mendongak". */}
      <g className="jelajah-burung ag-burung">
        <path d="M92 46 q2.8 -2.8 5.6 0" />
        <path d="M103 38 q2.4 -2.4 4.8 0" />
        <path d="M98 54 q2 -2 4 0" />
      </g>
    </svg>
  )
}
