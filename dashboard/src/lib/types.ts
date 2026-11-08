export type Pollutant = "pm25" | "pm10" | "so2" | "co" | "o3" | "no2";
export type MeteoVar = "temperature" | "humidity" | "wind_speed";
export type DailyVar = Pollutant | MeteoVar;
export type Tier = "utama" | "terbatas" | "tidak_layak" | "dikecualikan";
export type StandardKey = "PP22_2021" | "WHO_2021";

export interface TwinInfo { group: string; representative: boolean; members: string[] }

export interface Station {
  code: string; locationId: string; name: string; sensor: string; provinsi: string; kota: string; kecamatan: string;
  pulau: string; siteClass: string; siteType: string; lat: number; lon: number; tz: string;
  status: string; unitConverted: boolean; roadDistanceM: number | null; trafficPerH: number | null;
  contexts: string[]; tier: Record<string, Tier>; pctDaysUsable: Record<string, number>;
  twin: Partial<Record<DailyVar, TwinInfo>>; nnKm: number; nnStation: string; functional: boolean;
  hospital: { id: string; name: string; mapping: string; exposure: string } | null;
}

export interface StandardDef {
  source: string; url?: string; note?: string;
  limits: Record<string, Record<string, number>>;
  o3_1h_hours?: number[]; o3_8h_window?: number[];
}

export interface Meta {
  generatedAt: string;
  period: { start: string; end: string; nDays: number };
  dataset: string; units: string;
  standards: Record<StandardKey, StandardDef>;
  rules: Record<string, number>;
  season: { definitions: Record<string, number[]>; episodeMonths: number[]; episodeCaveat: string };
  unitDecision: { stations: string[]; main: string; sensitivity: string[] };
  windSpeedBins: (number | null)[];
  pipeline: { validation: Record<string, number>; nSourceFiles: number; hoursPerStation: number };
}

export interface CoreJson {
  meta: Meta;
  stations: Station[];
  daily: { start: string; n: number; scale: number; vars: DailyVar[]; series: Record<string, Record<DailyVar, (number | null)[]>> };
}

export interface HourlyJson {
  months: string[];
  diurnal: Record<string, Record<string, { sum: number[][]; n: number[][] }>>;
  gas: Record<string, { limit: number; unit: string; stations: Record<string, { den: number[]; n: number[] }> }>;
  windRose: Record<string, number[][]>;
  windSectors: number;
  windSpeedBins: (number | null)[];
}

export interface GlmRow {
  analisis: string; outcome: string; lag: number; n_rs?: number; rr_per10: number; ci_low: number; ci_high: number;
  p_value: number; tau2?: number; I2_pct?: number; Q?: number; p_heterogenitas?: number;
}
export interface GlmHospRow {
  hospital_id: string; outcome: string; lag: number; n_hari: number; rr_per10: number; rr_ci_low: number;
  rr_ci_high: number; p_value: number; dispersi: number; pm_sd: number;
}
export interface Hospital {
  hospital_id: string; nama_rumah_sakit: string; station_code: string; provinsi: string; kota_kabupaten: string;
  kecamatan: string; mapping_status: string; exposure_status: string; use_in_exposure_analysis: boolean;
  temp_r: number | null; n_overlap_days: number; pm25_daily_usable_pct: number; kelas_faskes?: string;
  kapasitas_tempat_tidur?: number;
}
export interface HealthJson {
  start: string; n: number; outcomes: string[]; nRowsOutsidePeriod: number;
  hospitals: Hospital[]; daily: Record<string, Record<string, (number | null)[]>>;
  glmPooled: GlmRow[]; glmByHospital: GlmHospRow[]; glmSensitivity: GlmRow[];
  lagSpearman: Record<string, number | string>[];
}

export interface Insight {
  id: string; tujuan: string; temuan: string; bukti: string; interpretasi: string; implikasi: string;
  rekomendasi: string; keyakinan: string; sumber: string;
}
export interface InsightsJson {
  catalog: Insight[];
  tests: Record<string, string | number | null>[];
  networkPriority: Record<string, string | number | boolean | null>[];
  episodeComparison: Record<string, number | string | null>[];
  withinStationSpearman: Record<string, number | string>[];
  pooledSpearman: Record<string, number | string>[];
  decisionLog: string;
}

/** Rentang indeks hari (inklusif). */
export interface DayRange { from: number; to: number }
