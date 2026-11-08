# Air Quality & Public Health — Gelar Rasa 2026

## Cara cepat (satu pipeline)

1. Buka folder proyek ini di VS Code (folder yang berisi `config/`, `src/`, `notebooks/`).
2. Letakkan `Dataset_DA_Gelar_Rasa_2026.zip` di folder proyek (atau ekstrak isinya ke `data/raw/`).
3. Buka `notebooks/00_pipeline_lengkap.ipynb`, pilih kernel Python, klik **Run All** (± 5 menit).

Notebook tersebut memasang dependensi, menyiapkan data mentah, lalu menjalankan Tahap 2 → 3 → 4 berurutan.
Alternatif terminal: `python -m src.run_all` (dependensi: `pip install -r requirements.txt`).

| Notebook | Isi |
|---|---|
| `00_pipeline_lengkap.ipynb` | Orkestrator: instalasi, data mentah, Tahap 2–4, ringkasan |
| `02_data_preprocessing.ipynb` | Dokumentasi & eksekusi preprocessing (L0–L4) |
| `03_exploratory_data_analysis.ipynb` | EDA 1–8 |
| `04_analytical_insights.ipynb` | Keputusan metodologis, jaringan, model kesehatan, katalog insight |

---

## Tahap 2 — Preprocessing

Pipeline preprocessing berlapis (L0 raw → L1 standardized → L2 quality-flagged → L3 hourly grid → L4 marts) untuk dataset Gelar Rasa 2026.

## Menjalankan

1. Letakkan 33 file dataset asli di `data/raw/` dengan struktur aslinya (`metadata/` sebagai subfolder).
2. Pasang dependensi: `pip install -r requirements.txt`
3. Jalankan salah satu:
   - Notebook: `notebooks/02_data_preprocessing.ipynb` (jalankan semua sel), atau
   - CLI dari root proyek: `python -m src.pipeline` (± 40 detik)

Kedua cara memanggil fungsi yang sama di `src/` dan menghasilkan output identik. Pipeline berhenti dengan error bila ada cek validasi berstatus FAIL.

## Konfigurasi (`config/`)

| File | Mengatur |
|---|---|
| `preprocessing.yaml` | Path, pola file, parameter, zona waktu, musim, ambang agregasi, pulau, site_class, stasiun dikecualikan, aturan integrasi kesehatan |
| `qc_rules.yaml` | Definisi usable, sentinel, batas fisik, STUCK, rasio PM |
| `unit_conversion.yaml` | Metode konversi ppm → µg/m³ per parameter + alternatif sensitivitas |
| `standards.yaml` | Template baku mutu (nilai `null`, harus diisi & diverifikasi) |

## Output utama

| Lapisan | File |
|---|---|
| L1 | `data/standardized/aqms_standardized.parquet` (+ tabel kesehatan & master) |
| L2 | `data/quality_flagged/aqms_quality_flagged.parquet` |
| L3 | `data/hourly_grid/aqms_hourly_grid.parquet` |
| L4 | `data/analytical_marts/{daily_mart, monthly_mart, station_dimension, hospital_station_mapping, health_exposure_mart}.parquet` |
| Laporan | `reports/validation_report.csv`, `data_quality_report.csv`, `preprocessing_summary.csv`, dll. |

L1 dan L2 (± 58 MB) tidak disertakan dalam paket; keduanya dibuat ulang dengan menjalankan pipeline.

Diuji dengan Python 3.13, pandas 3.0.5, numpy 2.5.3, pyarrow 26.0.0, PyYAML 6.0.3, matplotlib 3.11.2.

---

## Tahap 3 — Exploratory Data Analysis

Membaca output L3–L4 Tahap 2 (tidak menjalankan ulang preprocessing, tidak membaca CSV mentah).

1. Pastikan Tahap 2 sudah dijalankan (`data/hourly_grid/` dan `data/analytical_marts/` berisi file `.parquet`).
2. Buka `notebooks/03_exploratory_data_analysis.ipynb` lalu Run All (± 1–2 menit).

| Komponen | Isi |
|---|---|
| `config/eda.yaml` | Ambang kelayakan, deteksi anomali, dua skema musim, baku mutu PP 22/2021 & WHO 2021 (terpisah) |
| `src/eda_analysis.py` | Fungsi analisis & statistik |
| `src/eda_plots.py` | Fungsi visualisasi |
| `reports/eda/` | Tabel hasil (CSV, bernomor per bagian) |
| `reports/eda/figures/` | Grafik f01–f36 (PNG) |
| `data/eda/` | Dataset turunan EDA (flag anomali) |

---

## Tahap 4 — Keputusan metodologis & Analytical Insights

Notebook: `notebooks/04_analytical_insights.ipynb` (± 3 menit). Membutuhkan output Tahap 2 dan Tahap 3 (`reports/eda/`).

| Komponen | Isi |
|---|---|
| `config/decisions.yaml` | Keputusan 2026-11-04: konversi gas (molar_25c utama, ×1000 sensitivitas), `season_local` + `is_episode_period`, kebijakan data kembar |
| `src/decisions.py` | Membangun lapisan analysis-ready (salinan L3/L4 + kolom keputusan) |
| `src/insights.py` | Dampak keputusan, jaringan pemantauan, GLM quasi-Poisson + meta-analisis, register uji, katalog insight |
| `src/insight_plots.py` | Grafik g01–g06 |
| `data/analysis_ready/` | hourly_ar, daily_ar, monthly_ar, station_dimension_ar, twin_registry, unit_conversion_hourly |
| `reports/decisions/` | decision_log.md, config_changes, dataset_impact, dampak utama vs sensitivitas |
| `reports/insights/` | jaringan, GLM, register uji statistik, insight_catalog (CSV & MD), figures |

L1–L4 tidak diubah. Analisis utama vs sensitivitas dibedakan pada `reports/decisions/decision_log.md`.

## Tahap 5 — Dashboard "AIR IN MOTION"

Aplikasi web di `dashboard/` (Vite + React + TypeScript + D3). Data diekspor dari mart oleh `src/dashboard_data.py`
(`python -m src.run_all --stages dashboard`). Cara menjalankan, build, dan deploy ada di `dashboard/README.md` dan
`dashboard/docs/DEPLOYMENT.md`; validasi KPI ada di `dashboard/docs/KPI_VALIDATION.md`.
