/**
 * Selector: menyusun data tampilan dari fungsi KPI (kpi.ts) tanpa mengubah definisinya.
 * Komponen hanya memanggil fungsi di sini atau di kpi.ts; tidak ada rumus KPI di komponen.
 */
import type { Dataset } from "./dataset";
import type { DailyVar, DayRange, HourlyJson, Pollutant, StandardKey } from "./types";
import { availability, limitFor, networkExceedance, networkSeries, pooledStat, stationPeriodMeans, stationStat, tierOf, type Granularity, type StatKey } from "./kpi";
import { categoryHex } from "../components/legend";
import { flowFromSectors } from "../components/city3d/layout";
import { previousRange } from "./filters";

export const SECTOR_NAMES = ["Utara", "Utara-timur laut", "Timur laut", "Timur-timur laut", "Timur", "Timur-tenggara", "Tenggara", "Selatan-tenggara", "Selatan", "Selatan-barat daya", "Barat daya", "Barat-barat daya", "Barat", "Barat-barat laut", "Barat laut", "Utara-barat laut"];

export function monthsInRange(ds: Dataset, r: DayRange) {
  return ds.cal.monthKeys.filter((_, m) => ds.cal.monthStart[m] + ds.cal.monthLen[m] - 1 >= r.from && ds.cal.monthStart[m] <= r.to);
}
export const isFullMonth = (p: { key: string; from: number; to: number }) =>
  p.to - p.from + 1 === new Date(Date.UTC(+p.key.slice(0, 4), +p.key.slice(5, 7), 0)).getUTCDate();

// ---------------------------------------------------------------------
// KPI Overview: median & P95 PM2.5, median PM10, stasiun melampaui baku 24 jam (polutan terpilih)
// ---------------------------------------------------------------------
export interface KpiValue { value: number; prev: number | null; n: number; nStations: number }
export function overviewKpis(ds: Dataset, s: { pm25: string[]; pm10: string[]; v: string[] }, v: Pollutant, std: StandardKey, r: DayRange) {
  const prev = previousRange(r);
  const p25 = pooledStat(ds, s.pm25, "pm25", r), p10 = pooledStat(ds, s.pm10, "pm10", r);
  const q25 = prev ? pooledStat(ds, s.pm25, "pm25", prev) : null, q10 = prev ? pooledStat(ds, s.pm10, "pm10", prev) : null;
  const lim = limitFor(ds, std, v, "24h");
  const ex = lim !== null ? networkExceedance(ds, s.v, v, lim, r) : null;
  const exPrev = lim !== null && prev ? networkExceedance(ds, s.v, v, lim, prev) : null;
  return {
    prev,
    median25: { value: p25.median, prev: q25 && q25.n ? q25.median : null, n: p25.n, nStations: p25.nStations },
    p95_25: { value: p25.p95, prev: q25 && q25.n ? q25.p95 : null, n: p25.n, nStations: p25.nStations },
    median10: { value: p10.median, prev: q10 && q10.n ? q10.median : null, n: p10.n, nStations: p10.nStations },
    lim, ex,
    exceeding: ex ? { value: ex.exceeding.length, prev: exPrev && exPrev.nEvaluated ? exPrev.exceeding.length : null, n: ex.den, nStations: ex.nEvaluated } : null,
  };
}

// ---------------------------------------------------------------------
// Visual stasiun untuk kota 3D
// ---------------------------------------------------------------------
export interface StationRow { code: string; value: number; n: number; pct: number; tier: string; inRegion: boolean; inScope: boolean }
export function stationRows(ds: Dataset, v: DailyVar, stat: StatKey, r: DayRange, regionCodes: Set<string> | null, scope: Set<string>): StationRow[] {
  return ds.stations.map((s) => {
    const st = stationStat(ds, s.code, v, r);
    const tier = s.status === "excluded" ? "dikecualikan" : tierOf(s, v);
    return { code: s.code, value: st[stat], n: st.n, pct: st.pctUsable, tier, inRegion: !regionCodes || regionCodes.has(s.code), inScope: scope.has(s.code) };
  });
}

export function stationVisuals(rows: StationRow[], limit: number | null, maxH = 7.5) {
  const usable = rows.filter((r) => r.tier !== "tidak_layak" && r.tier !== "dikecualikan" && Number.isFinite(r.value));
  const max = Math.max(1e-6, ...usable.map((r) => r.value));
  return {
    max,
    visuals: rows.map((r) => {
      const noData = r.tier === "tidak_layak" || r.tier === "dikecualikan" || !Number.isFinite(r.value);
      return {
        code: r.code, value: r.value, height: noData ? 0 : (r.value / max) * maxH, color: categoryHex(noData ? NaN : r.value, limit),
        dim: !r.inRegion, noData, limitHeight: limit !== null && limit <= max * 1.3 ? (limit / max) * maxH : null,
      };
    }),
  };
}

// ---------------------------------------------------------------------
// Arah angin dominan (wind rose per stasiun × bulan) untuk arah partikel dekoratif
// ---------------------------------------------------------------------
export function windFlow(ds: Dataset, hourly: HourlyJson | null, codes: string[], r: DayRange) {
  if (!hourly || !codes.length) return null;
  const mk = new Set(monthsInRange(ds, r));
  const nb = hourly.windSpeedBins.length - 1;
  const sectors = new Array(hourly.windSectors).fill(0);
  let n = 0;
  for (const c of codes) {
    const rose = hourly.windRose[c]; if (!rose) continue;
    hourly.months.forEach((k, mi) => { if (!mk.has(k)) return; rose[mi].forEach((cnt, j) => { sectors[Math.floor(j / nb)] += cnt; n += cnt; }); });
  }
  if (!n) return null;
  const flow = flowFromSectors(sectors);
  const ws = pooledStat(ds, codes, "wind_speed", r);
  const top = sectors.indexOf(Math.max(...sectors));
  return { flow, hours: n, speed: ws.median, from: SECTOR_NAMES[top], topPct: (100 * sectors[top]) / n };
}

// ---------------------------------------------------------------------
// Tren
// ---------------------------------------------------------------------
export function trendSeries(ds: Dataset, codes: string[], station: string | null, v: DailyVar, r: DayRange, gran: Granularity) {
  if (station) return stationPeriodMeans(ds, station, v, r, gran).map((p) => ({ key: p.key, from: p.from, to: p.to, value: p.representative ? p.mean : NaN, q1: NaN, q3: NaN, n: 1 }));
  return networkSeries(ds, codes, v, r, gran, "median").map((p) => ({ key: p.key, from: p.from, to: p.to, value: p.value, q1: p.q1, q3: p.q3, n: p.nStations }));
}

// ---------------------------------------------------------------------
// Status pemantauan (semua stasiun di wilayah, termasuk yang dikecualikan)
// ---------------------------------------------------------------------
export function monitoring(ds: Dataset, codes: string[], v: DailyVar, r: DayRange) {
  const av = availability(ds, codes, v, r);
  const usable = av.reduce((s, a) => s + a.usable, 0), days = av.reduce((s, a) => s + a.nDays, 0);
  return { av, total: av.length, meet: av.filter((a) => a.tier === "utama").length, withData: av.filter((a) => a.usable > 0).length, pct: days ? (100 * usable) / days : NaN };
}
