# Aset latar tema perjalanan

Berkas di folder ini adalah **gambar latar** tema yang dipakai peta perjalanan
materi (`frontend/src/sections/material/PetaPerjalanan.jsx`, peta `adegan` →
berkas). Semuanya harus berlisensi bebas dan boleh dipakai ulang, termasuk untuk
keperluan komersial, tanpa izin tambahan — jadi proyek ini tidak menempelkan
gambar yang hak pakainya tidak jelas.

## Daftar

| Berkas | Aset | Pembuat | Lisensi | Sumber | Ukuran akhir |
| --- | --- | --- | --- | --- | --- |
| `gunung.svg` | "Pendakian bertingkat" — dilukis untuk proyek ini, bukan berkas unduhan | tim proyek ini (dibuat langsung di repo) | **CC0 / domain publik** (karya sendiri, dilepas ke domain publik) | tidak ada berkas asal; gambar disusun di sini dan ikut riwayat git repo ini | 9,3 KB · viewBox 1600×900, atribut 1600×900 |

Catatan berkas `gunung.svg`: ini karya **sendiri untuk proyek ini** dan sudah
dilepas ke domain publik (CC0), jadi tidak ada pihak ketiga yang perlu dimintai
izin dan tidak ada syarat atribusi. Isinya gambar rata ala buku cerita: langit
gradien `#6fb7f0 → #eef7fb`, matahari berbingkai, awan, **tiga puncak bersalju
yang membulat** — satu punggung utama di tengah (x ≈ 52%, tingginya 268 px dari
kaki) dan dua puncak jalur yang lebih rendah di x ≈ 14% dan 90%, tepat di jalur
zigzag pos peta perjalanan — lalu tiga lapis bukit makin depan makin tua, danau
kecil di lembah, pepohonan berdaun bulat, batu, dan tiga burung. Murni vektor
(66 bentuk, 24 warna, tanpa `<image>` raster, tanpa `<text>`, tanpa `<filter>`),
jadi tidak ada bagian yang pecah saat diperbesar.

Dua berkas berikut menyusul pada putaran A.50, keduanya juga dilukis di repo ini, dan tiap benda yang diinjak pos ditandai `id` supaya bisa diperiksa mesin:

| Berkas | Aset | Pembuat | Lisensi | Sumber | Ukuran akhir |
| --- | --- | --- | --- | --- | --- |
| `pulau.svg` | "Pelayaran Harta Karun" — dilukis untuk proyek ini, **dirombak total pada A.73** | tim proyek ini + 2 ikon CC0 (peti & karang, lihat tabel di bawah) | **CC0 / domain publik** | ikon CC0: lihat "Aset CC0 yang dipakai" di bawah | 21,2 KB · viewBox 1600×900, atribut 1600×900 |
| `angkasa.svg` | "Menjelajah Luar Angkasa" — dilukis untuk proyek ini, **dirombak total pada A.73** | tim proyek ini + 3 ikon CC0 (roket, Mars, bintang, lihat tabel di bawah) | **CC0 / domain publik** | ikon CC0: lihat "Aset CC0 yang dipakai" di bawah | 17,0 KB · viewBox 1600×900, atribut 1600×900 |

## Aset CC0 yang dipakai (putaran A.73)

Latar `pulau.svg` dan `angkasa.svg` dirombak total pada A.73, dan kali ini **lima ikon CC0 dari luar repo** benar-benar disisipkan (bukan hanya jadi rujukan). Semuanya dari Wikimedia Commons dengan lisensi **CC0 1.0 (public domain dedication)** — boleh dipakai, diubah, dan disebarkan tanpa izin tambahan maupun syarat atribusi; atribusinya ditulis di sini sebagai jejak, bukan kewajiban.

| Berkas sumber | Dipakai untuk | Pembuat | Lisensi | Sumber |
| --- | --- | --- | --- | --- |
| `Rocketship Pinhead icon.svg` | roket di landasan (`angkasa.svg`) | Maki contributors | CC0 | <https://commons.wikimedia.org/wiki/File:Rocketship_Pinhead_icon.svg> |
| `Star Pinhead icon.svg` | satu bintang besar (`angkasa.svg`) | Maki contributors | CC0 | <https://commons.wikimedia.org/wiki/File:Star_Pinhead_icon.svg> |
| `Mars Pinhead icon.svg` | planet Mars kecil (`angkasa.svg`) | Quincy Morgan | CC0 | <https://commons.wikimedia.org/wiki/File:Mars_Pinhead_icon.svg> |
| `Open chest with treasure and sparkles Pinhead icon.svg` | peti harta karun di mulut goa (`pulau.svg`) | GitHub user @viglino, Viglino contributors | CC0 | <https://commons.wikimedia.org/wiki/File:Open_chest_with_treasure_and_sparkles_Pinhead_icon.svg> |
| `Coral Pinhead icon.svg` | karang di laut (`pulau.svg`) | Quincy Morgan | CC0 | <https://commons.wikimedia.org/wiki/File:Coral_Pinhead_icon.svg> |

Cara memasukkannya (supaya bisa diperiksa ulang, bukan diklaim): berkas CC0 diunduh apa adanya, lalu **koordinatnya didatar-kan** — perintah `H`/`V`/`S` diubah menjadi `L`/`C`, dan `transform` grup dibakar ke koordinat absolut. Alasannya teknis: pagar mutu `__tests__/theme/latarTema.test.js` membaca koordinat **mentah** tiap `path`/`circle`/`ellipse`/`rect`/`polygon` dan hanya mengerti `M`/`L`/`C`/`Z`. Karena itu pula berkas akhir ini **tidak memuat satu pun `transform`** (diperiksa: nol). Warnanya ditimpa ke palet tema masing-masing, jadi tidak ada ikon hitam nyasar di latar siang.

Yang **tidak** dipakai, dan alasannya (supaya tidak diulang tanpa hasil):

- **Versi adegan utuh dari situs vektor bebas.** Kandidat adegan (publicdomainvectors, freesvg) hanya tersedia sebagai **AI/EPS** dan unduhan `.svg`-nya gagal dari lingkungan ini (TLS/kode 429); bentuk yang tersedia dari situs-situs itu berupa **ikon satu warna**, bukan adegan.
- **Ikon satu warna untuk benda utama.** Palem, ikan, dan Venus sempat dicoba, tetapi hanya ikon siluet (satu path, satu warna) — dipakai sebagai pohon/perahu akan terbaca seperti stempel, bukan ilustrasi. Pohon kelapa karena itu digambar di repo (lihat `buat-palem` di catatan A.73), sedangkan ikon siluet hanya dipakai untuk benda yang memang wajar jadi siluet (roket, peti, karang, bintang, Mars).
- **Berkas lama tema ini sendiri** sudah dihapus dari riwayat kerja (diganti, bukan disimpan berdampingan) — versi sebelumnya tetap bisa diambil dari riwayat git repo ini.

Catatan berkas `pulau.svg` (**196 bentuk, 83 warna** setelah A.73): langit siang dengan matahari bersinar, awan, pulau jauh, laut berlapis tiga, pantai berpasir diagonal, rimba kelapa bertingkat **dengan enam pohon kelapa yang digambar di koordinat absolut** (tanpa transform, lihat A.73), tanjung batu berikut goa, dermaga kayu, perahu layar, dan karang berwarna. Pos tema ini berdiri di `dermaga`, `perahu`, `karang`, `pantai`, `hutan`, dan `goa` — lihat `RUTE_TEMA.pulau`. Tempat pos yang ditandai `id` ada **enam**, tetapi jangan terkecoh bentuk penandanya: `dermaga`, `perahu`, `karang`, dan `goa` ditulis sebagai `<g id="…">`, sedangkan `pantai` dan `hutan` hanya bisa ditandai pada `<path id="…">` karena bidangnya satu path. Pagar bentuk di `__tests__/theme/latarTema.test.js` karena itu membaca **kedua** bentuk penanda (lihat catatan di kepala berkas SVG).

Catatan berkas `angkasa.svg` (**164 bentuk, 78 warna** setelah A.73): langit malam tiga tingkat, pita galaksi menyilang, tiga nebula berwarna, ~60 bintang (sebagian berkilau empat sudut), dua bintang jatuh, satelit kecil, komet, Bumi berawan, sabuk asteroid, Saturnus bercincin (cincin depannya digambar **terpisah** di atas bola planet), Bulan berkawah dengan halo, dan kompleks peluncuran (dermaga, menara, tangki, roket, asap) di kiri bawah. Kelima tempat pos (`landasan`, `bumi`, `asteroid`, `saturnus`, `bulan`) ditandai `<g id="…">`. Ini satu-satunya latar yang **sengaja gelap** — jalur peta bawaan (pekat, untuk latar terang) tenggelam di atasnya, jadi tema ini memakai jalur versi terang lewat aturan `.jelajah[data-adegan='angkasa']` di `theme.css`. Posnya berdiri di `landasan`, `bumi`, `asteroid`, `saturnus`, dan `bulan`.

Bentuk **tiga puncak** itu hasil putaran A.48: pemilik produk mengirim gambar
referensi dan meminta *"3 puncak namun yang di sebelah-sebelahnya itu menjadi
jalur pendakian"*. Aturan bentuknya dikunci — bukan dikira — di
`frontend/src/__tests__/theme/gunungLatar.test.js`: tepat satu puncak utama,
paling banyak dua puncak jalur, dan puncak jalur wajib lebih rendah sekaligus
berada di tepi. Angka terukurnya ada di kepala berkas `gunung.svg`.

Kenapa berkas unduhan yang lama (`publicdomainvectors` 78943, "Mountains on a
sunny day", CC0) dibuang: bentuknya **bukan** gunung, melainkan baji bersisi
tegak — dua titik dengan x sama pada satu bentuk (`M 533.5 389 L 533.5 833
L ...`) dan bahkan ada path tanpa luas (`M 577.37 220 L 577.37 834.33`). Di
panggung peta, sisi tegak itu terbaca seperti tebing. Atas permintaan pemilik
produk ("seperti gunung bukan curan tapi tumpul dan lebih detail"), berkasnya
diganti gambar di atas. Permintaan lanjutannya ("gunungnya hanya 1 saja … dan
pastikan tidak ada endpoint yang lepas") waktu itu dipenuhi dengan **satu**
puncak di cakrawala. Sejak catatan A.48 angkanya berbeda karena bentuknya memang
digambar ulang menjadi **tiga puncak** (satu utama + dua puncak jalur); yang
tidak berubah: batu tetap ada dan **tidak ada
goresan panjang yang ujungnya menggantung** — satu-satunya goresan yang tersisa
adalah tiga burung kecil (masing-masing < 5% lebar kanvas).

Satu angka dari catatan A.48 sudah **tidak berlaku** sejak A.50: dulu titik jalur
peta berhenti di `y = 12%` sementara punggungan berkas ini ada di `y ≈ 39%`,
jadi pos terakhir (dan tiap pos yang baru disisipkan) berdiri di langit. Rute
tema sekarang (`RUTE_TEMA.gunung` di `sections/material/perjalanan.js`) menaruh
pos terakhir di **`y = 42%`** — di puncak, bukan di langit — dan pagar
"tidak ada pos di langit" itu ada di `__tests__/theme/latarTema.test.js`. Bedanya tidak
dikira-kira, tetapi diukur dan dikunci tes
`frontend/src/__tests__/theme/gunungLatar.test.js` (9 tes):

| Ukuran bentuk | Berkas lama | Berkas sekarang | Ambang tes |
| --- | --- | --- | --- |
| Jumlah puncak di garis cakrawala | banyak (baji terpisah-pisah) | **1 utama + 2 jalur** | 1 utama, ≤ 2 jalur (lebih rendah ≥ 10% & di tepi) |
| Puncak utama menonjol | banyak puncak setara | **29,8%** tinggi bingkai (268 px) | ≥ 25% |
| Kemiringan sisi maksimum | **90°** (tegak) | **41,3°** | ≤ 45° |
| Putaran antarruas maksimum | **121,6°** (kunci tajam) | **6,3°** | ≤ 20° |
| Sisi nyaris tegak terpanjang | 614 px (tegak) | **27 px** | ≤ 36 px |
| Punggung puncak (di 20 px bawah titik tertinggi) | **0%** (ujung pisau) | **9,0%** | ≥ 6% |
| Bidang tanpa luas | ada 1 (`577.37,220 → 577.37,834.33`) | tidak ada | nol |
| Goresan menggantung | tidak ada | tidak ada (3 burung, masing-masing < 5% lebar) | ≤ 8% |
| Warna teredup · rata-rata | 127 · 199 | 94 · 177 | ≥ 90 · ≥ 170 |
| Bentuk · warna | 47 · 16 | 66 · 24 | — ("lebih detail") |

## Riwayat

Dulu di sini ada `gunung.jpg` (foto pendakian sungguhan, CC0). Foto itu
**dibuang** atas permintaan pemilik produk (catatan A.43): latar tema "Mendaki
Gunung" diganti ilustrasi. Ilustrasi itu sempat **digambar sendiri** di
`frontend/src/sections/material/AdeganGunung.jsx` (SVG + animasi CSS), lalu
pemilik produk meminta supaya **memakai gambar jadi dari domain publik yang
bergaya grafik** alih-alih gambar tangan — maka `gunung.svg` di atas dipasang
(catatan A.45). Komponen gambar tangan tetap ada dan masih bisa dipakai lagi
dengan mengembalikan `'gunung'` ke `ADEGAN_DIGAMBAR`.

Lalu (catatan A.46) pemilik produk menilai gambar unduhan itu **terbaca seperti
tebing**, dan memintanya diganti: *"seperti gunung bukan curan tapi tumpul dan
lebih detail"*. Karena dari empat berkas CC0 kandidat tidak ada satu pun yang
lebih baik pada ukuran di atas (satu malah 39% sisi berarah tegak, sisanya
rasio 3:1, gelap, atau memuat kapal), latarnya dibuat ulang di sini dengan
kurva — tiap puncak membulat, tiap sisi miring — dan sekaligus dilengkapi pagar
mutu bentuk supaya tidak bisa kembali jadi tebing tanpa ketahuan.

## Aturan penambahan aset

1. Hanya lisensi **CC0 / public domain** (tanpa syarat atribusi) atau lisensi
   yang menyebutkan izin pakai ulang secara eksplisit pada berkas ini.
2. Tulis sumber asli (URL halaman), pembuat, lisensi, dan ukuran akhir di tabel
   di atas; simpan juga versi aslinya di keterangan supaya bisa ditelusuri.
3. Ukuran akhir dijaga ≤ 400 KB dan sisi terpanjang ≤ 1600 px — latar ini hanya
   latar, bukan konten yang perlu tajam sekali. Untuk berkas **vektor**, aturan
   ukuran ini berlaku pada `width`/`height`-nya; `viewBox` boleh tetap besar
   karena vektor tidak pecah saat diperbesar. Khusus latar gunung, `viewBox`
   dijaga **16:9** — panggung peta 16:9 dengan `object-fit: cover`, jadi rasio
   lain akan memotong puncak (dan itu diperiksa
   `frontend/src/__tests__/theme/gunungLatar.test.js`).
4. Pilih **grafik/ilustrasi**, bukan foto realis: gambar rata terbaca jelas di
   ponsel dan tidak bersaing dengan jalur serta titik pos di atasnya.
5. Beri `id` pada tiap benda yang **diinjak pos** tema itu (`<g id="…">` atau
   bentuk tunggal ber-`id`). Pagar mutu `frontend/src/__tests__/theme/latarTema.test.js` memakai `id` itu untuk membuktikan tiap pos benar-benar berdiri di atas gambarnya — bukan di ruang kosong. Keluhan pemilik produk *"saat disisipkan kuis hasilnya masih di udara"* (A.50) ditutup dengan pagar itu, jadi berkas baru wajib menyertakannya.
