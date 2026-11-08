import type { CoreJson, DailyVar, HealthJson, HourlyJson, InsightsJson, Meta, Station } from "./types";

/** Kalender indeks hari: hari ke-i = start + i hari (UTC). */
export class Calendar {
  readonly start: Date;
  readonly n: number;
  readonly monthIdx: Int16Array; // indeks bulan (0 = bulan pertama data)
  readonly month: Int8Array; // 1–12
  readonly year: Int16Array;
  readonly dow: Int8Array; // 0 = Minggu
  readonly monthKeys: string[];
  readonly monthStart: number[]; // indeks hari pertama tiap bulan
  readonly monthLen: number[]; // jumlah hari bulan itu di dalam periode data

  constructor(startIso: string, n: number) {
    this.start = new Date(startIso + "T00:00:00Z");
    this.n = n;
    this.monthIdx = new Int16Array(n);
    this.month = new Int8Array(n);
    this.year = new Int16Array(n);
    this.dow = new Int8Array(n);
    this.monthKeys = [];
    this.monthStart = [];
    this.monthLen = [];
    for (let i = 0; i < n; i++) {
      const d = this.date(i);
      const key = d.toISOString().slice(0, 7);
      if (this.monthKeys[this.monthKeys.length - 1] !== key) {
        this.monthKeys.push(key);
        this.monthStart.push(i);
        this.monthLen.push(0);
      }
      const m = this.monthKeys.length - 1;
      this.monthLen[m]++;
      this.monthIdx[i] = m;
      this.month[i] = d.getUTCMonth() + 1;
      this.year[i] = d.getUTCFullYear();
      this.dow[i] = d.getUTCDay();
    }
  }
  date(i: number): Date { return new Date(this.start.getTime() + i * 86400000); }
  iso(i: number): string { return this.date(i).toISOString().slice(0, 10); }
  indexOf(iso: string): number { return Math.round((new Date(iso + "T00:00:00Z").getTime() - this.start.getTime()) / 86400000); }
  clamp(i: number): number { return Math.max(0, Math.min(this.n - 1, i)); }
}

export interface Dataset {
  meta: Meta;
  stations: Station[];
  byCode: Map<string, Station>;
  cal: Calendar;
  /** Rata-rata harian usable; NaN = tidak usable (tidak diimputasi). */
  daily: Map<string, Record<DailyVar, Float64Array>>;
}

function decode(arr: (number | null)[], scale: number): Float64Array {
  const out = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] === null ? NaN : (arr[i] as number) / scale;
  return out;
}

export function buildDataset(core: CoreJson): Dataset {
  const cal = new Calendar(core.daily.start, core.daily.n);
  const daily = new Map<string, Record<DailyVar, Float64Array>>();
  for (const [code, vars] of Object.entries(core.daily.series)) {
    const rec = {} as Record<DailyVar, Float64Array>;
    for (const v of core.daily.vars) rec[v] = decode(vars[v], core.daily.scale);
    daily.set(code, rec);
  }
  return { meta: core.meta, stations: core.stations, byCode: new Map(core.stations.map((s) => [s.code, s])), cal, daily };
}

// Pemuatan terpisah (code splitting): data inti dimuat di awal; agregat jam, kesehatan,
// dan insight hanya saat halaman yang membutuhkannya dibuka.
let corePromise: Promise<Dataset> | null = null;
export const loadCore = () => (corePromise ??= import("../data/core.json").then((m) => buildDataset(m.default as unknown as CoreJson)));

let hourlyPromise: Promise<HourlyJson> | null = null;
export const loadHourly = () => (hourlyPromise ??= import("../data/hourly.json").then((m) => m.default as unknown as HourlyJson));

let healthPromise: Promise<HealthJson> | null = null;
export const loadHealth = () => (healthPromise ??= import("../data/health.json").then((m) => m.default as unknown as HealthJson));

let insightsPromise: Promise<InsightsJson> | null = null;
export const loadInsights = () => (insightsPromise ??= import("../data/insights.json").then((m) => m.default as unknown as InsightsJson));

let geoPromise: Promise<GeoJSON.FeatureCollection> | null = null;
export const loadGeo = () => (geoPromise ??= import("../data/geo.json").then((m) => m.default as unknown as GeoJSON.FeatureCollection));
