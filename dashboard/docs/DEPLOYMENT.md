# Panduan deployment

Dashboard adalah situs statis: tidak membutuhkan server aplikasi, database, atau variabel lingkungan rahasia. Semua path relatif (`base: "./"`), jadi build dapat disajikan dari root domain maupun subfolder.

## Status saat ini

- **Sudah online (privat)**: build satu-file dipublikasikan sebagai Claude Artifact (diperbarui 7 Nov 2026 dengan desain 3D). Link hanya dapat dibuka pemilik akun sampai dibagikan lewat menu *Share* di halaman artifact.
- **Belum dideploy**: Netlify, Vercel, dan GitHub Pages. Konfigurasinya sudah disiapkan di repositori, tetapi belum dijalankan karena butuh akun Anda.

## Opsi A — Netlify (paling sederhana)

1. Push folder proyek ke GitHub.
2. Netlify → *Add new site* → *Import from Git* → pilih repo.
3. **Base directory**: `dashboard`. Perintah build dan folder publish dibaca dari `dashboard/netlify.toml` (`npm ci && npm run build`, `dist`).
4. Deploy. Tidak ada environment variable yang diperlukan.

Alternatif tanpa Git: jalankan `npm run build`, lalu seret folder `dashboard/dist` ke https://app.netlify.com/drop.

## Opsi B — Vercel

*New Project* → import repo → **Root Directory** `dashboard`. Pengaturan lain dibaca dari `vercel.json`.

## Opsi C — GitHub Pages

Workflow `.github/workflows/deploy-dashboard.yml` menjalankan uji KPI, build, lalu deploy setiap kali ada push ke `main` yang mengubah `dashboard/**`. Aktifkan lewat *Settings → Pages → Source: GitHub Actions*. Routing berbasis hash (`#/analytics/spatial`), jadi tidak perlu aturan rewrite 404.

## Opsi D — satu file HTML

`npm run build:single` menghasilkan `dist-single/index.html` (±4,6 MB; JS, CSS, font, dan data di-inline). File ini bisa dibuka langsung dari disk, dilampirkan, atau diunggah ke host statis apa pun. Pada mode ini routing memakai hash polos (`#spatial`), dan filter tidak disimpan di URL.

## Konfigurasi dev vs produksi

| | `npm run dev` | `npm run build` | `npm run build:single` |
|---|---|---|---|
| Output | server dev, HMR | `dist/` multi-file, code-split | `dist-single/` satu file |
| Data | dimuat per tampilan | chunk terpisah (core, hourly, health, insights, geo) | inline |
| URL | `#/analytics/tab?filter` | `#/analytics/tab?filter` | `#analytics-tab` |
| Kota 3D (three.js) | chunk terpisah, dimuat saat Overview dibuka | chunk terpisah | inline |
| Env | — | — | `.env.single` (`VITE_HASH_MODE=plain`) |

## Pemeriksaan setelah deploy

1. Buka Overview dan keenam tab Analytics lewat navigasi dan lewat URL langsung (mis. `…/#/analytics/health`).
2. Pastikan font Fraunces/Manrope termuat (judul berserif) dan logo tampil (atau slot placeholder bila logo belum ditambahkan).
3. Ubah periode ke 2025 lalu pindah ke Analytics; periode harus tetap 1 Jan–31 Des 2025.
4. Console browser harus bebas error.

## Memperbarui data

```bash
python -m src.run_all --stages dashboard   # dari root proyek
cd dashboard && npm test && npm run build
```

Commit `dashboard/src/data/*.json`, lalu push (Netlify/Vercel/GitHub Pages akan build ulang otomatis).
