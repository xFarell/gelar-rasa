# Revisi UI — ringkas dan tajam (7 Nov 2026)

Revisi ini hanya menyentuh tampilan dan teks. `src/lib/kpi.ts` (rumus, deduplikasi, agregasi) dan data tidak diubah.

## Perubahan per halaman

| Halaman | Dipertahankan | Dihapus | Dipindah ke bagian yang dapat dibuka |
|---|---|---|---|
| **Ringkasan** | Judul, subjudul, animasi partikel → jaringan stasiun, satu kalimat pengantar, tombol "Jelajahi Data"; tren PM2.5/PM10; peta + peringkat; navigasi topik | Tagline tambahan, tombol kedua, baris "dataset sintetis", kotak placeholder logo, tombol putar ulang animasi, panel "Bagaimana membacanya", panel kesehatan & meteorologi, insight keempat, teks bukti di kartu insight | — |
| Ringkasan: KPI | 4 KPI: median, P95, stasiun melampaui, stasiun dengan data lengkap; satu tombol PM2.5/PM10 | KPI ganda PM10 (6 → 4 kartu), kode KPI internal, campuran jumlah stasiun dengan % stasiun-hari | — |
| **Kualitas Udara** | Distribusi, median & P95, peringkat, box plot, perbandingan stasiun, tren, rasio terhadap baku | Paragraf penjelasan distribusi, aside judul | Statistik deskriptif, tabel per stasiun |
| **Tren Waktu** | Tren, profil bulan, heatmap stasiun × bulan, profil jam, episode | Bagian besar hari kerja vs akhir pekan (jadi satu KPI: "Hampir sama"), panel jam puncak (jadi judul dinamis), aside judul | Perbandingan antar-tahun, musim kalender (diberi label "bukan musim meteorologis terverifikasi") |
| **Sebaran Wilayah** | Peta, peringkat, antarpulau/kelas, kelengkapan data | Aside, catatan kelas lokasi | Tabel kelengkapan, prioritas evaluasi jaringan |
| **Meteorologi** | Judul baru; korelasi di dalam stasiun sebagai hasil utama (3 KPI), gabungan sebagai pembanding; korelasi per stasiun; sebaran; wind rose | Tabel sebagai tampilan utama, paragraf ecological fallacy | Tabel lengkap Spearman/Pearson/IK, PM per kelas kelembapan, matriks korelasi |
| **Baku Mutu** | Urutan baru: jumlah stasiun melampaui → konsentrasi vs ambang (grafik baru dari fungsi KPI yang sama) → pelampauan per bulan → status per stasiun → matriks → tahunan | Paragraf sumber di atas | Tabel nilai ambang |
| **Kesehatan** | RR, IK 95%, I², validitas pemetaan (KPI); RR per lag; forest plot; tabel 7 indikator; satu catatan metodologis | Aside dan kotak "cara membaca" yang berulang; nama RS placeholder ("RSUD XXX") | Uji kepekaan, korelasi kasar vs disesuaikan, deret deskriptif, tabel pemetaan (memakai kode RS) |
| **Metodologi** | Dataset & periode, sumber, cakupan stasiun, 5 langkah pengolahan, 6 definisi KPI berbahasa awam, standar PM, 6 keterbatasan penting | Kartu panduan interpretasi (sudah ada di halaman terkait) | Detail QC & agregasi, kamus KPI lengkap, nilai baku lengkap, keterbatasan lain, 19 insight, register uji, log keputusan |

## Perubahan lintas halaman

- Navigasi dan judul tab berbahasa Indonesia: Ringkasan, Kualitas Udara, Tren Waktu, Sebaran Wilayah, Meteorologi, Baku Mutu, Kesehatan, Metodologi.
- Judul seksi menyatakan temuan bila datanya mendukung (mis. "15 dari 24 stasiun melampaui 55 µg/m³"), dihitung dari filter yang aktif.
- Istilah teknis di antarmuka diganti: "usable" → "dengan data", tier "utama/tidak layak" → "Lengkap/Kurang", "outcome" → "indikator".
- Pernyataan data simulasi muncul sekali di Metodologi (dihapus dari hero dan footer).
- Logo: tanpa aset resmi, tidak ada kotak placeholder; wordmark AIR IN MOTION tetap.
- Label eyebrow tidak lagi huruf kapital berjarak lebar; label filter dan kepala tabel tidak lagi kapital.
- Denyut penanda peta: tiga kali saat muncul, lalu berhenti (sebelumnya berulang tanpa akhir).
- Warna teks redup `--faint` dinaikkan ke #8a9cad agar lolos kontras 4,5:1 di semua latar (sebelumnya 3,77–4,27:1).
- Baris tabel yang bisa diklik kini memakai tombol pada kode stasiun (dapat dipakai dengan keyboard); `cursor: pointer` di lapisan dasar untuk semua kontrol.
- Bulan parsial (Oktober 2026, 14 hari) tidak dipakai sebagai "bulan tertinggi" di judul Ringkasan; tetap tampil di grafik dengan catatan.
- Panah dekoratif hanya di tombol utama.

## Hasil pengujian

- `npm test`: 9/9 lulus (angka KPI sama dengan laporan EDA, tidak berubah).
- KPI sebelum vs sesudah (Ringkasan, periode penuh, dedup): median PM2.5 31,0; P95 87,5; 15 dari 24 stasiun melampaui; 22 dari 27 data lengkap. Sama dengan versi sebelumnya. PM10 2025: 46,4 dan 132,9, juga sama.
- Pengujian Playwright:
  - Tombol PM2.5/PM10, preset 2025, dan drill-down KPI ke Baku Mutu (filter ikut terbawa) berfungsi.
  - Navigasi ke 8 halaman dengan filter tetap, reset, dan opsi stasiun kembar (16 dari 25) berfungsi.
  - Bagian tambahan dapat dibuka dengan Enter.
  - Tidak ada error console.
- Lebar ponsel 390 px: tidak ada scroll horizontal di 8 halaman.
- `tsc --noEmit` bersih; build multi-file dan satu-file berhasil; artifact diperbarui ke versi 2.
