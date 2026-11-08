# Redesign: Interactive 3D Environmental Intelligence Dashboard (7 Nov 2026)

Desain baru hanya mengubah tampilan, navigasi, dan interaksi. `src/lib/kpi.ts` (rumus KPI, deduplikasi stasiun kembar, agregasi) tidak diubah. Satu-satunya perubahan pada ekspor data adalah kolom `locationId` (dari `station_dimension_ar.location_id`) untuk pemilih kota.

## Audit singkat

- Video referensi dipakai untuk komposisi (sidebar gelap, kartu terang, model 3D sebagai pusat, tooltip gelap, transisi zoom). Tema energi, angka, dan aset video tidak dipakai.
- Metadata: 27 stasiun, masing-masing satu `location_id` dan satu kota/kabupaten, 21 provinsi. Provinsi dengan lebih dari satu stasiun: DKI Jakarta (3), Kalimantan Tengah (3), Jawa Barat (2), Jambi (2).
- Tidak ada data geometri kota, sehingga kota 3D adalah satu model representatif yang diberi label jelas.
- Logo resmi kompetisi tetap tidak ada di proyek; header memakai wordmark dan ikon aliran udara AIR IN MOTION.

## Struktur halaman

| Sebelum | Sesudah |
|---|---|
| 8 halaman bergulir (Ringkasan … Metodologi) | **Overview** dan **Analytics** (6 tab). Metodologi menjadi modal. |
| Hero animasi + KPI + peta | Kota 3D di tengah, KPI di kiri, tren dan pelampauan di kanan, peringkat/status/temuan di bawah |
| Filter bar per halaman (pulau, kelas lokasi, multi-stasiun) | Header global: wilayah, stasiun, periode, polutan. Opsi median/P95, acuan baku, dan stasiun kembar ada di toolbar Analytics |

Tidak ada halaman yang bergulir pada 1440×900 dan 1366×768 (diuji: `scrollHeight` = tinggi layar untuk Overview dan keenam tab). Daftar panjang (peringkat, forest plot, kalender stasiun × bulan) bergulir di dalam kartunya.

## Kota 3D

| Elemen | Sumber | Catatan |
|---|---|---|
| Posisi stasiun | Urutan bujur (7 kolom, barat → timur) dan lintang dalam kolom | Bukan peta; label "model kota representatif, bukan peta" selalu tampil |
| Tinggi kolom | Median atau P95 harian polutan terpilih dalam periode | Linear dari nol, kolom tertinggi = 7,5 satuan |
| Warna kolom | Kategori terhadap baku 24 jam acuan terpilih: ≤ 50%, 50–100%, > baku | Abu-abu: data < 25% hari atau stasiun dikecualikan |
| Selubung dan cincin | Tinggi baku 24 jam pada skala yang sama | Kolom yang menembus selubung berada di atas baku |
| Garis lengkung | Tetangga terdekat dari metadata (`nnStation`) | Jarak km ada di tooltip peta Spasial |
| Partikel dan garis aliran | Arah = resultan wind rose (jam per sektor) stasiun dalam cakupan dan bulan dalam periode; kecepatan mengikuti median kecepatan angin harian | Dinyatakan "bukan simulasi sebaran polutan" |
| Bangunan, pohon | Dekoratif, deterministik per kode stasiun | Tidak membawa data |

Interaksi: hover stasiun (kolom terangkat, halo, tooltip PM2.5/PM10/kelengkapan), hover bangunan (sorot halus), klik stasiun (kamera terbang ke stasiun, panel detail, KPI dan tren berpindah ke stasiun itu, "Kembali ke kota"/Esc). Kamera: putar ±49°, sudut vertikal dibatasi, zoom dan geser dibatasi ke alas, tombol +/−/reset.

Kinerja: three.js dimuat sebagai chunk terpisah (527 kB, 135 kB gzip) hanya saat Overview tampil. Bangunan dan pohon memakai InstancedMesh. Loop render berhenti saat kanvas tidak terlihat, tab tersembunyi, atau gerak dikurangi (mode statis merender hanya saat ada perubahan). Tanpa WebGL, Overview memakai peta 2D.

## KPI (nilai sebelum dan sesudah)

Default (periode penuh, seluruh stasiun, stasiun kembar dihitung sekali):

| KPI | Sebelum | Sesudah |
|---|---|---|
| Median PM2.5 | 31,0 | 31,0 |
| P95 PM2.5 | 87,5 | 87,5 |
| Median PM10 | 46,0 | 46,0 |
| Stasiun melampaui baku 24 jam PM2.5 (PP 22/2021) | 15 dari 24 | 15 dari 24 |
| Median PM10, 2025 | 46,4 | 46,4 |
| RR pernapasan lag 0 (IK 95%), I² | 1,086 (1,065–1,107), 99,3% | sama |

"Stasiun melampaui", "stasiun-hari di atas baku", dan "% stasiun-hari" ditampilkan sebagai tiga angka terpisah dengan label sendiri. Perubahan dibanding periode sebelumnya hanya ditampilkan bila periode dengan panjang sama sebelum filter masih berada dalam data; selain itu tertulis "Tanpa periode pembanding".

## Warna dan aksesibilitas

Palet brief dipakai untuk isian. Teks kecil memakai varian gelap agar kontras ≥ 4,5:1: `#839087` (3,3:1 di putih) diganti `#5B6A60` untuk teks; teks berwarna coral, amber, teal, dan sky memakai `#B5534C`, `#9A6420`, `#2B716B`, `#2E6F8A`. Warna semantik hanya dipakai bila ada dasar klasifikasi (kategori terhadap baku, tier kelengkapan data, status kepatuhan) dan selalu disertai teks.

Navigasi keyboard: tab Analytics dengan panah kiri/kanan, semua kontrol berupa tombol/select asli, daftar peringkat sebagai alternatif klik di kanvas, modal memakai `<dialog>` (Esc menutup).

## Pengujian (7 Nov 2026)

- `tsc --noEmit` bersih; `vitest`: 9/9 lulus.
- Playwright 1440×900 dan 1366×768: Overview dan 6 tab tanpa scroll halaman; tanpa error console.
- Filter: wilayah DKI Jakarta (3 stasiun, KPI dan kota ikut), stasiun lewat peringkat dan lewat klik kanvas 3D (hash `st=` diperbarui, panel detail muncul), preset 2025, polutan PM10.
- WebGL dimatikan: peta 2D tampil dengan keterangan. Gerak dikurangi: kanvas tetap tampil statis.
- iPhone 13 (390 px): tanpa scroll horizontal di Overview dan 6 tab.
- Build multi-file dan satu-file berhasil; build satu-file diuji dari `file://` (deep link `#analytics-standards`).

## Pembaruan dependensi (8 Nov 2026)

`npm audit` melaporkan 5 kerentanan pada alat pengembangan (esbuild lewat Vite 5, Vitest 2, tinypool). Versi dinaikkan: Vite 5.4 → 7.3.7, Vitest 2.1 → 4.1.12, @vitejs/plugin-react 4.3 → 5.2.0, vite-plugin-singlefile 2.0 → 2.3.4. Hasil: `npm audit` 0 kerentanan; uji 9/9 lulus; build multi-file dan satu-file berhasil; Playwright menghasilkan KPI yang sama dan tanpa error console. Vite 7 membutuhkan Node.js 20.19+ atau 22.12+ (`engines` di package.json, `NODE_VERSION = "22"` di netlify.toml).

Catatan: dengan npm 10.9 resolusi dependensi dari nol gagal ("Cannot read properties of null (reading 'edgesOut')", bug npm). Karena `package-lock.json` disertakan, `npm install` dan `npm ci` memakai lockfile dan berjalan normal.
