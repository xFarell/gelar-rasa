# Aset yang masih diperlukan, keterbatasan, dan fitur yang belum diimplementasikan

## Aset yang masih diperlukan

| Aset | Status | Tindakan |
|---|---|---|
| Logo resmi Gelar Rasa 2026 | **Tidak ditemukan** di proyek maupun file yang diberikan | Simpan file dari panitia sebagai `src/assets/brand/gelar-rasa-2026-logo.png` (atau .svg/.webp), lalu build ulang. Logo otomatis tampil di header di samping wordmark AIR IN MOTION. Tanpa aset, tidak ada placeholder; logo tidak digambar ulang. |
| Font | Tersedia (Fraunces & Manrope, lisensi SIL OFL, dibundel) | — |
| Peta dasar | Tersedia (Natural Earth, domain publik) | — |
| Model kota 3D | Dibuat prosedural di kode (three.js), bukan aset unduhan | — |

## Keterbatasan data (ditampilkan juga di modal Metodologi)

1. Dataset sintetis. Kesimpulan berlaku untuk dataset ini, bukan untuk kondisi riil Indonesia.
2. Gas dan meteorologi kembar lintas pulau (11–14 stasiun). Data tidak dihapus, tetapi dideduplikasi pada agregat.
3. Level gas di PSW-01, MDN-01, dan BJB-01 bergantung pada asumsi konversi ppm → µg/m³ (molar, 25 °C).
4. Cakupan tidak merata: MER-01 dan JMB-02 praktis tanpa data, sedangkan MDN-01, PLB-01, dan BJB-01 hanya terbatas.
5. Periode pendek (2024 – 14 Okt 2026). Baku tahunan hanya dinilai untuk 2024–2025.
6. Agu–Okt hanyalah penanda kalender, bukan bukti kebakaran atau kabut asap. Musim lokal juga hanya pembagian kalender.
7. Tidak ada koreksi higroskopis; analisis RH bersifat eksplorasi.
8. Hasil kesehatan adalah asosiasi ekologis tingkat stasiun–RS dengan heterogenitas sangat tinggi (I² ≈ 99%). Tidak ada klaim kausal atau klinis.
9. Tidak ada data populasi, sehingga kasus disajikan sebagai jumlah, bukan laju.
10. Kota 3D adalah model representatif, bukan model geografis. Stasiun disusun menurut bujur (barat → timur) dan lintang; jarak tidak sebenarnya. Tinggi kolom dan warna berasal dari data; bangunan dan pohon dekoratif. Partikel bukan simulasi sebaran polutan; arah geraknya mengikuti arah angin dominan dari wind rose (stasiun dalam cakupan, bulan dalam periode). Untuk posisi sebenarnya gunakan tombol "Peta".

## Fitur yang belum diimplementasikan

| Fitur | Alasan / rencana |
|---|---|
| Hasil GLM yang mengikuti filter periode | Model dijalankan di Python (Tahap 4). Menjalankannya ulang di browser tidak tepat; dashboard menampilkan hasil periode penuh dengan label jelas. |
| Pelampauan 1 jam/8 jam, profil diurnal, dan wind rose pada resolusi hari | Agregat jam diekspor per bulan agar data tetap ringan (±1 MB), sehingga filter tanggal diterapkan per bulan penuh. Ekspor harian dapat ditambahkan bila diperlukan (±5–8 MB). |
| Pedoman WHO O₃ 8 jam (semua jendela) dan musim puncak O₃ | Belum diturunkan ke lapisan dashboard; tersedia di `reports/eda/62_comparison_who2021.csv`. |
| Persentil-99 harian WHO per tahun | Dashboard menampilkan % hari > AQG; nilai P99 ada di laporan EDA. |
| DLNM / case-crossover | Analisis lanjutan yang direkomendasikan di laporan, belum dikerjakan. |
| Model 3D geografis per kota | Tidak ada data bangunan/topografi di dataset; dipakai satu model representatif berlabel. |
| Ekspor CSV/PNG dari grafik | Belum dibuat. |
| Deploy publik (Netlify/Vercel/Pages) | Konfigurasi siap; butuh akun pemilik proyek. Lihat `DEPLOYMENT.md`. |
