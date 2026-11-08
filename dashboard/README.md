# AIR IN MOTION — Understanding the Air We Breathe

Dashboard interaktif kualitas udara dan kesehatan masyarakat untuk Gelar Rasa 2026 (Tahap 5 proyek).
Tagline: *Making the invisible visible.*

- **Stack**: Vite 7 + React 18 + TypeScript + D3 7 (grafik SVG buatan sendiri) + three.js 0.169 (kota 3D, dimuat terpisah).
- **Data**: JSON yang diekspor dari mart proyek oleh `src/dashboard_data.py`. Tidak ada backend; semua KPI dihitung di browser oleh satu modul (`src/lib/kpi.ts`) sehingga mengikuti filter.
- **Font**: Fraunces (judul) dan Manrope (antarmuka & angka), dibundel lewat `@fontsource` (tanpa CDN).
- **Peta dasar**: garis pantai Natural Earth 1:50m (domain publik, paket `world-atlas`). Koordinat stasiun dari metadata proyek.

## Struktur

```
dashboard/
├── src/
│   ├── App.tsx                    # AppLayout: sidebar, header, satu area konten
│   ├── lib/
│   │   ├── kpi.ts                 # SATU sumber definisi & rumus KPI (tidak diubah oleh desain 3D)
│   │   ├── selectors.ts           # menyusun data tampilan dari kpi.ts (KPI Overview, visual stasiun, arah angin)
│   │   ├── filters.tsx            # state global: wilayah, stasiun, periode, polutan; sinkron ke URL
│   │   ├── regions.ts             # pilihan wilayah dari metadata (provinsi, kota/kabupaten, location_id)
│   │   ├── stats.ts, dataset.ts, format.ts, hooks.ts, types.ts
│   ├── components/
│   │   ├── shell/                 # Sidebar, TopNavigation (CitySelector, StationSelector, DateRangeSelector), MotionTransition, MethodologyModal
│   │   ├── city3d/                # City3DScene (React), engine.ts (kamera, interaksi), objects.ts (BuildingObject, MonitoringStationObject, AirParticleSystem), layout.ts
│   │   ├── overview/              # KPISection, CityStage, StationDetail, panel tren/pelampauan/peringkat/status/temuan
│   │   ├── charts.tsx, legend.tsx, StationMap.tsx, ui.tsx
│   ├── pages/
│   │   ├── OverviewPage.tsx
│   │   ├── AnalyticsPage.tsx      # AnalyticsTabs
│   │   ├── analytics/             # PollutantsTab, TimeTab, SpatialTab, MeteorologyTab, StandardsTab, HealthTab
│   │   └── Methodology.tsx        # isi modal Metodologi
│   ├── styles/                    # tokens.css (palet terang), app.css
│   └── data/                      # core/hourly/health/insights/geo .json (hasil ekspor)
├── tests/kpi.test.ts
└── docs/                          # DEPLOYMENT, KPI_VALIDATION, ASSETS_AND_LIMITATIONS, UI_REVISION, REDESIGN_3D
```

## Menjalankan

Prasyarat: Node.js 20.19+ atau 22.12+ (diuji dengan 22; dibutuhkan Vite 7) dan Python proyek (hanya bila ingin mengekspor ulang data).

```bash
# 1) (opsional) ekspor ulang data dari mart proyek — dari root proyek
python -m src.run_all --stages dashboard      # atau: python -m src.dashboard_data

# 2) dashboard
cd dashboard
npm install
npm run dev          # http://localhost:5173
npm test             # uji integritas KPI
npm run build        # build produksi → dist/ (multi-file, code-split)
npm run build:single # satu file HTML mandiri → dist-single/index.html
npm run preview      # menyajikan dist/ secara lokal
```

Data JSON sudah ikut di repositori, jadi langkah 1 hanya diperlukan bila output Tahap 2–4 berubah.
`src/data/geo.json` dibuat sekali dengan `node scripts/build_geo.mjs`.

## Tampilan

Dua halaman. Pada layar desktop (diuji 1440×900 dan 1366×768) semua konten utama muat dalam satu layar tanpa scroll halaman; ponsel memakai tata letak bergulir.

| Halaman | Isi |
|---|---|
| **Overview** | Kiri: 4 KPI (median PM2.5, P95 PM2.5, median PM10, stasiun melampaui baku 24 jam). Tengah: kota 3D representatif (atau peta). Kanan: tren PM2.5/PM10 dan ringkasan pelampauan. Bawah: peringkat stasiun, status pemantauan, tiga temuan. |
| **Analytics** | Tab Polutan, Pola Waktu, Spasial, Meteorologi, Baku Mutu, Kesehatan. |
| Metodologi | Modal dari sidebar: data, pengolahan, definisi, baku, keterbatasan, lampiran teknis. |

## Interaksi

- Filter global di header: wilayah (provinsi atau kota/kabupaten dari metadata), stasiun (mengikuti wilayah), periode (preset + tanggal), polutan. Tersimpan di URL (`#/analytics/time?r=prov:DKI%20Jakarta&p=pm10`).
- Kota 3D: arahkan kursor ke kolom stasiun untuk tooltip; klik untuk fokus kamera dan panel detail ("Kembali ke kota" atau Esc untuk kembali). Putar, zoom, dan geser terbatas; tombol +, −, dan reset.
- KPI dapat diklik menuju tab Analytics yang sesuai; ikon "i" menampilkan definisi.
- Peringkat dan daftar stasiun di Analytics memilih stasiun yang sama dengan klik di kota.
- Tombol "Animasi minimal" di sidebar dan `prefers-reduced-motion` menghentikan partikel, denyut, dan transisi; kota dirender statis. Tanpa WebGL, Overview otomatis memakai peta 2D.

Catatan desain 3D: `docs/REDESIGN_3D.md`.
