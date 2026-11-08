/**
 * MESIN KPI — satu-satunya sumber definisi dan rumus angka di dashboard.
 * Semua halaman memanggil fungsi di file ini; tidak ada halaman yang menghitung KPI dengan rumus sendiri.
 * Definisi mengikuti KPI framework (Laporan Bab 8.3) dan diuji terhadap laporan EDA (tests/kpi.test.ts).
 *
 * Prinsip:
 *  - Unit dasar = rata-rata harian usable (≥ 18 jam valid) dari mart harian. NaN = tidak usable; tidak diimputasi.
 *  - Median & P95 berdampingan (kuantil tipe 7, sama dengan pandas).
 *  - Agregat jaringan memakai stasiun terdedup: satu wakil per kelompok data kembar per variabel (keputusan 2026-11-04).
 *  - Baku mutu hanya dibandingkan dengan periode rata-rata yang sama (24 jam ↔ rata-rata harian, dst.).
 */
import type { Dataset } from "./dataset";
import type { DailyVar, DayRange, Pollutant, StandardKey, Station, Tier } from "./types";
import { count, mean, quantileSorted, sortedFinite, spearman } from "./stats";

// ---------------------------------------------------------------------
// Variabel
// ---------------------------------------------------------------------
export const POLLUTANTS: Pollutant[] = ["pm25", "pm10", "so2", "no2", "o3", "co"];
export const METEO: DailyVar[] = ["temperature", "humidity", "wind_speed"];

export const VAR_META: Record<DailyVar, { label: string; short: string; unit: string; eligKey: string }> = {
  pm25: { label: "PM2.5", short: "PM2.5", unit: "µg/m³", eligKey: "pm25" },
  pm10: { label: "PM10", short: "PM10", unit: "µg/m³", eligKey: "pm10" },
  so2: { label: "SO₂", short: "SO₂", unit: "µg/m³", eligKey: "so2" },
  no2: { label: "NO₂", short: "NO₂", unit: "µg/m³", eligKey: "no2" },
  o3: { label: "O₃", short: "O₃", unit: "µg/m³", eligKey: "o3" },
  co: { label: "CO", short: "CO", unit: "µg/m³", eligKey: "co" },
  temperature: { label: "Suhu", short: "Suhu", unit: "°C", eligKey: "temperature_c" },
  humidity: { label: "Kelembapan relatif", short: "RH", unit: "%", eligKey: "humidity_pct" },
  wind_speed: { label: "Kecepatan angin", short: "Angin", unit: "m/s", eligKey: "wind_speed_ms" },
};

export const isPollutant = (v: string): v is Pollutant => (POLLUTANTS as string[]).includes(v);

export const fullRange = (ds: Dataset): DayRange => ({ from: 0, to: ds.cal.n - 1 });

// ---------------------------------------------------------------------
// Cakupan stasiun (scope) + deduplikasi data kembar
// ---------------------------------------------------------------------
export interface ScopeOptions {
  variable: DailyVar;
  pulau?: string; // "all" atau nama pulau
  siteClass?: string; // "all" atau kelas lokasi
  selected?: string[]; // kosong = semua stasiun dalam wilayah/kelas
  includeTwins?: boolean; // false (default) = satu wakil per kelompok kembar
  tiers?: Tier[]; // default: utama + terbatas
}
export interface Scope { stations: string[]; excluded: { code: string; reason: string }[] }

export function tierOf(s: Station, v: DailyVar): Tier {
  return (s.tier[VAR_META[v].eligKey] ?? "tidak_layak") as Tier;
}

export function scopeStations(ds: Dataset, o: ScopeOptions): Scope {
  const tiers = o.tiers ?? ["utama", "terbatas"];
  const excluded: Scope["excluded"] = [];
  let pool = ds.stations.filter((s) =>
    (!o.pulau || o.pulau === "all" || s.pulau === o.pulau) &&
    (!o.siteClass || o.siteClass === "all" || s.siteClass === o.siteClass) &&
    (!o.selected?.length || o.selected.includes(s.code)));
  pool = pool.filter((s) => {
    const t = tierOf(s, o.variable);
    if (!tiers.includes(t)) { excluded.push({ code: s.code, reason: `tier ${t.replace("_", " ")}` }); return false; }
    return true;
  });
  if (!o.includeTwins) {
    const groups = new Map<string, Station[]>();
    for (const s of pool) {
      const tw = s.twin[o.variable];
      if (tw) groups.set(tw.group, [...(groups.get(tw.group) ?? []), s]);
    }
    const drop = new Set<string>();
    for (const [group, members] of groups) {
      if (members.length < 2) continue;
      const rep = members.find((m) => m.twin[o.variable]?.representative) ??
        [...members].sort((a, b) => (b.pctDaysUsable[VAR_META[o.variable].eligKey] ?? 0) - (a.pctDaysUsable[VAR_META[o.variable].eligKey] ?? 0) || a.code.localeCompare(b.code))[0];
      for (const m of members) if (m !== rep) { drop.add(m.code); excluded.push({ code: m.code, reason: `data kembar ${group}, diwakili ${rep.code}` }); }
    }
    pool = pool.filter((s) => !drop.has(s.code));
  }
  return { stations: pool.map((s) => s.code), excluded };
}

// ---------------------------------------------------------------------
// Nilai harian & statistik stasiun
// ---------------------------------------------------------------------
export function series(ds: Dataset, code: string, v: DailyVar): Float64Array {
  return ds.daily.get(code)?.[v] ?? new Float64Array(ds.cal.n).fill(NaN);
}

export function values(ds: Dataset, code: string, v: DailyVar, r: DayRange): Float64Array {
  return series(ds, code, v).subarray(r.from, r.to + 1);
}

export interface StationStat {
  code: string; nDays: number; n: number; pctUsable: number;
  median: number; p95: number; mean: number; min: number; max: number; q1: number; q3: number; p5: number;
}

export function stationStat(ds: Dataset, code: string, v: DailyVar, r: DayRange): StationStat {
  const x = values(ds, code, v, r);
  const s = sortedFinite(x);
  const nDays = r.to - r.from + 1;
  return {
    code, nDays, n: s.length, pctUsable: (100 * s.length) / nDays,
    median: quantileSorted(s, 0.5), p95: quantileSorted(s, 0.95), q1: quantileSorted(s, 0.25), q3: quantileSorted(s, 0.75),
    p5: quantileSorted(s, 0.05), mean: mean(s), min: s.length ? s[0] : NaN, max: s.length ? s[s.length - 1] : NaN,
  };
}

/** KPI-AQ-01/02: median & P95 harian gabungan — kuantil dari semua stasiun-hari usable dalam cakupan. */
export function pooledStat(ds: Dataset, codes: string[], v: DailyVar, r: DayRange) {
  const all: number[] = [];
  let nSt = 0;
  for (const c of codes) {
    const x = values(ds, c, v, r);
    const before = all.length;
    for (let i = 0; i < x.length; i++) if (Number.isFinite(x[i])) all.push(x[i]);
    if (all.length > before) nSt++;
  }
  const s = Float64Array.from(all).sort();
  return { n: s.length, nStations: nSt, median: quantileSorted(s, 0.5), p95: quantileSorted(s, 0.95), mean: mean(s), sorted: s };
}

// ---------------------------------------------------------------------
// Baku mutu & pelampauan (24 jam ↔ rata-rata harian)
// ---------------------------------------------------------------------
export function limitFor(ds: Dataset, std: StandardKey, v: DailyVar, period: string): number | null {
  return ds.meta.standards[std]?.limits?.[v]?.[period] ?? null;
}

export interface Exceed { den: number; n: number; pct: number }

/** % hari > baku 24 jam = hari usable dengan rata-rata > baku / hari usable × 100. */
export function exceedance(ds: Dataset, code: string, v: DailyVar, limit: number, r: DayRange): Exceed {
  const x = values(ds, code, v, r);
  let den = 0, n = 0;
  for (let i = 0; i < x.length; i++) if (Number.isFinite(x[i])) { den++; if (x[i] > limit) n++; }
  return { den, n, pct: den ? (100 * n) / den : NaN };
}

/** KPI-AQ-05/06: stasiun dengan ≥ 1 hari usable melampaui baku 24 jam dalam periode. */
export function networkExceedance(ds: Dataset, codes: string[], v: DailyVar, limit: number, r: DayRange) {
  let den = 0, n = 0;
  const per = codes.map((c) => ({ code: c, ...exceedance(ds, c, v, limit, r) })).filter((e) => e.den > 0);
  for (const e of per) { den += e.den; n += e.n; }
  const exceeding = per.filter((e) => e.n > 0).map((e) => e.code);
  return { per, exceeding, nEvaluated: per.length, den, n, pct: den ? (100 * n) / den : NaN };
}

/** Rangkaian ≥ minDays hari berturut-turut di atas baku (hari tidak usable memutus rangkaian). */
export function episodes(ds: Dataset, code: string, v: DailyVar, limit: number, r: DayRange, minDays = 2) {
  const x = series(ds, code, v);
  const out: { code: string; from: number; to: number; days: number; peak: number; mean: number }[] = [];
  let start = -1;
  const close = (end: number) => {
    if (start >= 0 && end - start + 1 >= minDays) {
      const seg = x.subarray(start, end + 1);
      out.push({ code, from: start, to: end, days: end - start + 1, peak: Math.max(...seg), mean: mean(seg) });
    }
    start = -1;
  };
  for (let i = r.from; i <= r.to; i++) {
    if (Number.isFinite(x[i]) && x[i] > limit) { if (start < 0) start = i; } else close(i - 1);
  }
  close(r.to);
  return out;
}

/** Rata-rata tahunan: hanya tahun kalender lengkap, ≥ 75% hari usable dan setiap kuartal ≥ 50%. */
export function annualMean(ds: Dataset, code: string, v: DailyVar, year: number) {
  const x = series(ds, code, v);
  const { cal } = ds;
  const qDays = [0, 0, 0, 0], qUse = [0, 0, 0, 0];
  let days = 0, use = 0, sum = 0;
  for (let i = 0; i < cal.n; i++) {
    if (cal.year[i] !== year) continue;
    const q = Math.floor((cal.month[i] - 1) / 3);
    days++; qDays[q]++;
    if (Number.isFinite(x[i])) { use++; qUse[q]++; sum += x[i]; }
  }
  const complete = days >= 365;
  const pct = days ? (100 * use) / days : 0;
  const minQ = Math.min(...qDays.map((d, i) => (d ? (100 * qUse[i]) / d : 0)));
  const ok = complete && pct >= ds.meta.rules.annualMinPctDays && minQ >= ds.meta.rules.annualMinQuarterPctDays;
  return { year, complete, pct, minQuarterPct: minQ, ok, mean: ok ? sum / use : NaN };
}

export function completeYears(ds: Dataset, r: DayRange): number[] {
  const ys = new Set<number>();
  for (let i = r.from; i <= r.to; i++) ys.add(ds.cal.year[i]);
  return [...ys].filter((y) => {
    const first = ds.cal.indexOf(`${y}-01-01`), last = ds.cal.indexOf(`${y}-12-31`);
    return first >= Math.max(0, r.from) && last <= Math.min(ds.cal.n - 1, r.to) && first >= 0 && last < ds.cal.n;
  });
}

// ---------------------------------------------------------------------
// Deret waktu jaringan
// ---------------------------------------------------------------------
export type Granularity = "day" | "week" | "month";
export type StatKey = "median" | "p95";

export interface PeriodPoint { key: string; from: number; to: number; value: number; q1: number; q3: number; nStations: number; nStationDays: number }

/** Rata-rata stasiun per periode; representatif bila hari usable ≥ 75% hari periode (dalam rentang). */
export function stationPeriodMeans(ds: Dataset, code: string, v: DailyVar, r: DayRange, gran: Granularity) {
  const x = series(ds, code, v);
  const { cal } = ds;
  const out: { key: string; from: number; to: number; mean: number; n: number; days: number; representative: boolean }[] = [];
  const keyOf = (i: number) => gran === "day" ? cal.iso(i) : gran === "week" ? cal.iso(i - ((cal.dow[i] + 6) % 7)) : cal.monthKeys[cal.monthIdx[i]];
  let cur = "", from = r.from, sum = 0, n = 0, days = 0;
  const flush = (to: number) => {
    if (days) out.push({ key: cur, from, to, mean: n ? sum / n : NaN, n, days,
      representative: gran === "day" ? n === 1 : (100 * n) / days >= ds.meta.rules.monthlyRepresentativePct });
  };
  for (let i = r.from; i <= r.to; i++) {
    const k = keyOf(i);
    if (k !== cur) { flush(i - 1); cur = k; from = i; sum = 0; n = 0; days = 0; }
    days++;
    if (Number.isFinite(x[i])) { sum += x[i]; n++; }
  }
  flush(r.to);
  return out;
}

/**
 * KPI-T-01 "median antarstasiun": per periode, median (dan IQR) dari rata-rata stasiun yang representatif.
 * Untuk granularitas bulan, identik dengan `median_jaringan` EDA (32_network_monthly) bila cakupannya sama.
 * stat = "p95": P95 dari seluruh nilai harian stasiun-hari dalam periode (intensitas episode).
 */
export function networkSeries(ds: Dataset, codes: string[], v: DailyVar, r: DayRange, gran: Granularity, stat: StatKey = "median"): PeriodPoint[] {
  const per = codes.map((c) => stationPeriodMeans(ds, c, v, r, gran));
  if (!per.length) return [];
  const base = per[0];
  return base.map((p, k) => {
    if (stat === "median") {
      const ms = per.map((s) => s[k]).filter((s) => s.representative && Number.isFinite(s.mean)).map((s) => s.mean);
      const s = Float64Array.from(ms).sort();
      return { key: p.key, from: p.from, to: p.to, value: quantileSorted(s, 0.5), q1: quantileSorted(s, 0.25), q3: quantileSorted(s, 0.75), nStations: s.length, nStationDays: per.reduce((a, s) => a + s[k].n, 0) };
    }
    const pooled = pooledStat(ds, codes, v, { from: p.from, to: p.to });
    return { key: p.key, from: p.from, to: p.to, value: pooled.p95, q1: NaN, q3: NaN, nStations: pooled.nStations, nStationDays: pooled.n };
  });
}

/** Profil bulan kalender: rata-rata (antar-tahun) median antarstasiun bulanan — seperti Laporan Bab 4.3c. */
export function calendarMonthProfile(ds: Dataset, codes: string[], v: DailyVar, r: DayRange) {
  const ms = networkSeries(ds, codes, v, r, "month", "median");
  return Array.from({ length: 12 }, (_, m) => {
    const pts = ms.filter((p) => Number(p.key.slice(5, 7)) === m + 1 && Number.isFinite(p.value));
    return { month: m + 1, value: mean(pts.map((p) => p.value)), nYears: pts.length };
  });
}

// ---------------------------------------------------------------------
// Pemantauan & kualitas data
// ---------------------------------------------------------------------
export function tierFromPct(pct: number, rules: Record<string, number>): Tier {
  return pct >= rules.tierUtamaPct ? "utama" : pct >= rules.tierTerbatasPct ? "terbatas" : "tidak_layak";
}

/** KPI-M-01..03: ketersediaan per stasiun dalam periode (hari usable / hari periode). */
export function availability(ds: Dataset, codes: string[], v: DailyVar, r: DayRange) {
  return codes.map((c) => {
    const s = ds.byCode.get(c)!;
    const n = count(values(ds, c, v, r));
    const nDays = r.to - r.from + 1;
    const pct = (100 * n) / nDays;
    const tier: Tier = s.status === "excluded" ? "dikecualikan" : tierFromPct(pct, ds.meta.rules);
    return { code: c, usable: n, nDays, pct, tier };
  });
}

// ---------------------------------------------------------------------
// Meteorologi: korelasi dalam stasiun vs gabungan
// ---------------------------------------------------------------------
export function withinStationSpearman(ds: Dataset, codes: string[], x: DailyVar, y: DailyVar, r: DayRange) {
  const per = codes.map((c) => {
    const a = values(ds, c, x, r), b = values(ds, c, y, r);
    let n = 0;
    for (let i = 0; i < a.length; i++) if (Number.isFinite(a[i]) && Number.isFinite(b[i])) n++;
    return { code: c, rho: spearman(a, b), n };
  }).filter((p) => p.n >= 30 && Number.isFinite(p.rho));
  const s = Float64Array.from(per.map((p) => p.rho)).sort();
  return { per, median: quantileSorted(s, 0.5), q1: quantileSorted(s, 0.25), q3: quantileSorted(s, 0.75) };
}

export function pooledPairs(ds: Dataset, codes: string[], x: DailyVar, y: DailyVar, r: DayRange) {
  const xs: number[] = [], ys: number[] = [], st: string[] = [];
  for (const c of codes) {
    const a = values(ds, c, x, r), b = values(ds, c, y, r);
    for (let i = 0; i < a.length; i++) if (Number.isFinite(a[i]) && Number.isFinite(b[i])) { xs.push(a[i]); ys.push(b[i]); st.push(c); }
  }
  return { x: Float64Array.from(xs), y: Float64Array.from(ys), station: st, rho: spearman(xs, ys) };
}

// ---------------------------------------------------------------------
// Kamus KPI (dipakai halaman Methodology dan tooltip "i")
// ---------------------------------------------------------------------
export interface KpiDef { id: string; group: string; name: string; definition: string; source: string; granularity: string; interpretation: string; limitation: string }

export const KPI_DEFS: KpiDef[] = [
  { id: "AQ-01", group: "Kualitas udara", name: "Median harian (gabungan)", definition: "Median dari seluruh rata-rata harian usable (≥ 18 jam valid) stasiun-hari dalam cakupan filter; stasiun kembar dideduplikasi.", source: "daily mart (L4)", granularity: "cakupan × periode", interpretation: "Kondisi tipikal.", limitation: "Menyembunyikan episode; stasiun dengan lebih banyak hari usable berbobot lebih besar." },
  { id: "AQ-02", group: "Kualitas udara", name: "P95 harian (gabungan)", definition: "Persentil ke-95 dari nilai yang sama dengan AQ-01 (interpolasi linear, tipe 7).", source: "daily mart (L4)", granularity: "cakupan × periode", interpretation: "Keparahan episode konsentrasi tinggi.", limitation: "Butuh cukup hari; peka terhadap periode yang dipilih." },
  { id: "AQ-03", group: "Kualitas udara", name: "Median & P95 harian per stasiun", definition: "Median dan P95 rata-rata harian usable satu stasiun dalam periode.", source: "daily mart (L4)", granularity: "stasiun × periode", interpretation: "Membedakan masalah kronis (median tinggi) dan episodik (P95 jauh di atas median).", limitation: "Denominator hari usable berbeda antarstasiun." },
  { id: "AQ-04", group: "Kualitas udara", name: "% hari > baku 24 jam", definition: "Hari usable dengan rata-rata harian > baku 24 jam ÷ hari usable × 100.", source: "daily mart + PP 22/2021 / WHO 2021", granularity: "stasiun × periode", interpretation: "Frekuensi pelampauan.", limitation: "Hanya untuk polutan yang memiliki baku 24 jam." },
  { id: "AQ-05", group: "Kualitas udara", name: "Stasiun melampaui baku 24 jam", definition: "Jumlah stasiun dengan ≥ 1 hari usable > baku 24 jam ÷ stasiun yang memiliki hari usable dalam periode.", source: "daily mart + baku mutu", granularity: "cakupan × periode", interpretation: "Sebaran spasial pelanggaran.", limitation: "Satu hari sudah dihitung; lihat AQ-04 untuk frekuensi." },
  { id: "AQ-06", group: "Kualitas udara", name: "Pelampauan gas 1 jam / 8 jam", definition: "Jam usable > baku 1 jam; hari dengan maksimum rata-rata bergerak 8 jam (≥ 6 jam usable, ≥ 75% jendela) > baku 8 jam. O₃ 1 jam hanya pukul 11–14, O₃ 8 jam di jendela 06–18.", source: "hourly grid (L3), dihitung ulang per bulan dengan aturan EDA", granularity: "stasiun × bulan", interpretation: "Masalah gas yang terlokalisasi.", limitation: "Filter tanggal diterapkan per bulan penuh; level gas PSW-01, MDN-01, BJB-01 bergantung asumsi konversi ppm → µg/m³." },
  { id: "AQ-07", group: "Kualitas udara", name: "Rata-rata tahunan vs baku tahunan", definition: "Rata-rata hari usable dalam tahun kalender lengkap (≥ 75% hari, tiap kuartal ≥ 50%).", source: "daily mart", granularity: "stasiun × tahun", interpretation: "Paparan jangka panjang.", limitation: "Hanya 2024 dan 2025 (2026 belum lengkap)." },
  { id: "T-01", group: "Temporal", name: "Median antarstasiun per periode", definition: "Median (dan IQR) dari rata-rata stasiun per hari/minggu/bulan; periode stasiun dihitung bila hari usable ≥ 75%.", source: "daily mart", granularity: "jaringan × periode", interpretation: "Pola waktu jaringan tanpa didominasi satu stasiun.", limitation: "Jumlah stasiun representatif dapat berubah antarperiode." },
  { id: "T-02", group: "Temporal", name: "Profil bulan kalender", definition: "Rata-rata antar-tahun dari median antarstasiun bulanan untuk tiap bulan kalender.", source: "daily mart", granularity: "bulan kalender", interpretation: "Bulan dengan konsentrasi jaringan tertinggi.", limitation: "Agu–Okt hanya penanda kalender, bukan bukti kebakaran/kabut asap." },
  { id: "T-03", group: "Temporal", name: "Episode", definition: "Rangkaian ≥ 2 hari berturut-turut dengan rata-rata harian > baku 24 jam.", source: "daily mart", granularity: "stasiun", interpretation: "Lama paparan berat.", limitation: "Hari tidak usable memutus rangkaian." },
  { id: "T-04", group: "Temporal", name: "Profil diurnal", definition: "Rata-rata gabungan jam usable per jam dalam sehari (jumlah ÷ cacah jam usable).", source: "hourly grid (L3)", granularity: "jam × cakupan", interpretation: "Jam rawan.", limitation: "Filter tanggal diterapkan per bulan penuh; pola harian dataset tampak deterministik (sintetis)." },
  { id: "M-01", group: "Pemantauan", name: "Stasiun dengan data valid", definition: "Stasiun dengan ≥ 1 hari usable untuk polutan terpilih dalam periode.", source: "daily mart", granularity: "periode", interpretation: "Kapasitas aktual jaringan.", limitation: "—" },
  { id: "M-02", group: "Pemantauan", name: "Stasiun memenuhi kriteria pemantauan", definition: "Stasiun dengan hari usable ≥ 75% hari periode (tier utama).", source: "daily mart", granularity: "periode", interpretation: "Data cukup untuk analisis utama.", limitation: "Ambang 75% adalah konvensi." },
  { id: "M-03", group: "Pemantauan", name: "Ketersediaan data", definition: "Hari usable ÷ hari periode × 100, per stasiun dan gabungan.", source: "daily mart", granularity: "stasiun × periode", interpretation: "Kelengkapan.", limitation: "Hari usable butuh ≥ 18 dari 24 jam valid." },
  { id: "H-01", group: "Kesehatan", name: "RR per 10 µg/m³ PM2.5", definition: "exp(10β) gabungan efek acak DerSimonian–Laird dari GLM quasi-Poisson per RS (tren waktu, hari, suhu, RH disesuaikan) + IK 95%.", source: "glm_pooled.csv (Tahap 4)", granularity: "outcome × lag", interpretation: "Besar asosiasi jangka pendek.", limitation: "Asosiasi ekologis, bukan kausal; hasil model statis (tidak berubah oleh filter)." },
  { id: "H-02", group: "Kesehatan", name: "Heterogenitas I²", definition: "Porsi variasi antar-RS yang bukan karena kebetulan.", source: "glm_pooled.csv", granularity: "outcome × lag", interpretation: "Seberapa mewakili angka gabungan.", limitation: "I² tinggi membatasi interpretasi agregat." },
  { id: "H-03", group: "Kesehatan", name: "Pemetaan RS–stasiun valid", definition: "RS dengan mapping_status validated (provinsi + kecamatan cocok dan korelasi suhu harian tertinggi).", source: "hospital_station_mapping", granularity: "RS", interpretation: "Kelayakan pasangan paparan.", limitation: "Paparan stasiun ≠ paparan individu." },
  { id: "H-04", group: "Kesehatan", name: "Total kasus per kategori", definition: "Jumlah kasus harian RS dalam periode dan cakupan filter.", source: "health exposure mart", granularity: "RS × periode", interpretation: "Beban layanan.", limitation: "Bukan laju per penduduk; tidak ada data populasi." },
];

/** Kunci periode (YYYY-MM-DD atau YYYY-MM) → epoch ms UTC untuk sumbu waktu. */
export function keyTime(key: string): number {
  return key.length === 7 ? Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, 1) : Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));
}

/** Rentang Agu–Okt (penanda periode episode) dalam sumbu waktu untuk arsiran grafik. */
export function episodeShades(ds: Dataset, r: DayRange): { x0: number; x1: number }[] {
  const out: { x0: number; x1: number }[] = [];
  let start = -1;
  for (let i = r.from; i <= r.to + 1; i++) {
    const inEp = i <= r.to && ds.meta.season.episodeMonths.includes(ds.cal.month[i]);
    if (inEp && start < 0) start = i;
    if (!inEp && start >= 0) { out.push({ x0: ds.cal.date(start).getTime(), x1: ds.cal.date(i - 1).getTime() + 864e5 }); start = -1; }
  }
  return out;
}
