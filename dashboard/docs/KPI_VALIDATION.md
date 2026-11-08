# Validasi KPI dan integritas data

Semua angka di dashboard dihitung oleh `src/lib/kpi.ts` dari rata-rata harian usable yang diekspor dari mart proyek (`daily_mart`, ≥ 18 jam valid; nilai tidak usable = `null`, tidak diimputasi). Uji otomatis (`npm test`, 9 uji) membandingkan hasil mesin KPI dengan laporan EDA/Tahap 4 yang diekspor ke `tests/fixtures/reference.json`.

## Hasil uji (6 Nov 2026): 9/9 lulus

| Uji | Acuan | Hasil |
|---|---|---|
| Median, P95, rata-rata harian semua stasiun × 6 polutan (150+ kombinasi) | `40_station_summary.csv` | selisih < 0,01 µg/m³ |
| Baseline JKT-02 median 58,5 / P95 64,8; P95 KTG-01 125,8, PKN-01 147,4 | Laporan Tahap 3–4 | cocok |
| Hari usable & hari melampaui baku 24 jam, semua stasiun × polutan | `60_compliance_pp22.csv`, `62_comparison_who2021.csv` | identik |
| Stasiun melampaui PM2.5 16/25, PM10 17/25 (tanpa dedup) | `80_key_metrics.csv`, I01 | identik; versi dedup 15/24 dan 16/24 |
| 22 dari 27 stasiun memenuhi kriteria (≥ 75% hari usable PM2.5) | `01_eligibility.csv` | identik, termasuk % per stasiun |
| Rata-rata bulanan & status representatif | `monthly_mart` | identik |
| Median jaringan bulanan PM2.5/PM10 dan jumlah stasiun | `32_network_monthly.csv` | selisih < 0,01 |
| Profil bulan kalender: Agu 51,6, Okt 54,0, Feb 22,0 | Laporan Bab 4.3c | cocok |
| RR pernapasan lag 0 = 1,086 (1,065–1,107), I² 99,3%, 21 RS; 24 RS validated | `glm_pooled.csv` | cocok |

Pelampauan gas 1 jam dan 8 jam diekspor per stasiun × bulan dengan aturan yang sama seperti EDA (`compliance_pp`). Saat ekspor, jumlah semua bulannya dicocokkan dengan `60_compliance_pp22.csv`: 0 selisih.

Presisi: nilai harian disimpan dengan 3 desimal. Presisi 2 desimal sempat membuat satu hari bernilai 15,004 µg/m³ terbaca tepat 15,00 sehingga tidak terhitung melampaui pedoman WHO; masalah ini ditemukan oleh uji dan diperbaiki.

## Definisi yang perlu diketahui

- **Median/P95 harian (gabungan)** = kuantil dari semua stasiun-hari usable dalam cakupan. Ini *bukan* median dari median stasiun.
- **Median antarstasiun per periode** = median rata-rata stasiun pada periode itu. Sebuah periode dihitung untuk stasiun bila hari usable-nya ≥ 75%.
- **Deduplikasi** (default): satu wakil per kelompok data kembar per variabel. Bila wakil resmi berada di luar filter wilayah, dipilih anggota dengan hari usable tertinggi. Angka laporan EDA yang tanpa dedup muncul saat "Tampilkan stasiun kembar" diaktifkan.
- **Cakupan stasiun**: tier utama + terbatas untuk variabel terpilih. Stasiun tier tidak layak (MER-01) dan dikecualikan (JMB-02) tidak ikut agregat, tetapi tetap tampil di tabel ketersediaan.
- **Kepatuhan**: rata-rata harian hanya dibandingkan dengan baku 24 jam, jam usable dengan baku 1 jam, maksimum rata-rata bergerak 8 jam dengan baku 8 jam, dan rata-rata tahunan dengan baku tahunan (hanya tahun kalender lengkap). Garis baku 24 jam tidak digambar pada deret mingguan/bulanan.
- **Hasil model kesehatan** bersifat statis (periode penuh) dan dinyatakan demikian di halaman. Filter hanya memengaruhi total kasus dan grafik deskriptif.

## Pemeriksaan UI/teknis yang sudah dijalankan

- `tsc --noEmit` bersih; build produksi multi-file dan satu-file berhasil.
- Playwright (Chromium) memuat 8 halaman pada build produksi yang disajikan dari subfolder dan dari `file://`: tanpa error console.
- Interaksi diuji: klik marker → panel detail; preset 2025 → URL & cakupan 365 hari; ganti polutan; pindah halaman dengan filter tetap; reset; toggle kembar (16/25); 816 sel kalender dapat diklik; deep link `#temporal`.
- Lebar ponsel 390 px (iPhone 13): tanpa scroll horizontal; filter dilipat ke tombol "Filter".
- Belum diuji: Safari/Firefox nyata, pembaca layar nyata, dan perangkat berperforma rendah.
