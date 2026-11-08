const nf = new Map<string, Intl.NumberFormat>();
function getNf(d: number) {
  const k = String(d);
  if (!nf.has(k)) nf.set(k, new Intl.NumberFormat("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d }));
  return nf.get(k)!;
}

/** Angka format Indonesia (koma desimal, titik ribuan). NaN → "—". */
export function fmt(x: number | null | undefined, d = 1): string {
  return x === null || x === undefined || !Number.isFinite(x) ? "—" : getNf(d).format(x);
}
export const fmtInt = (x: number | null | undefined) => fmt(x, 0);
export const fmtPct = (x: number | null | undefined, d = 1) => (Number.isFinite(x as number) ? `${fmt(x, d)}%` : "—");
/** Desimal adaptif untuk sumbu/label. */
export function fmtAuto(x: number): string {
  if (!Number.isFinite(x)) return "—";
  if (Number.isInteger(x)) return fmt(x, 0);
  const a = Math.abs(x);
  return fmt(x, a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 1 : 2);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const monthShort = (m: number) => MONTHS[m - 1];
export const monthLong = (m: number) => MONTHS_LONG[m - 1];

export function fmtDate(iso: string, long = false): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${long ? MONTHS_LONG[m - 1] : MONTHS[m - 1]} ${y}`;
}
export function fmtMonthKey(key: string, long = false): string {
  const [y, m] = key.split("-").map(Number);
  return `${long ? MONTHS_LONG[m - 1] : MONTHS[m - 1]} ${y}`;
}

export const OUTCOME_LABEL: Record<string, string> = {
  resp: "Pernapasan (total)",
  resp_admissions_under5: "Rawat napas balita",
  resp_admissions_over60: "Rawat napas lansia",
  asthma_emergency_cases: "Darurat asma",
  copd_admissions: "Rawat PPOK",
  cvd: "Kardiovaskular",
  death: "Kematian",
};

export const SITE_CLASS_ID: Record<string, string> = {
  Urban: "Urban", Industrial: "Industri", Traffic: "Lalu lintas", Peatland: "Gambut",
  "Clean/Regional": "Latar bersih/regional", "Coastal/Remote": "Pesisir/terpencil",
};

export const TIER_LABEL: Record<string, string> = {
  utama: "Utama (≥ 75%)", terbatas: "Terbatas (25–75%)", tidak_layak: "Tidak layak (< 25%)", dikecualikan: "Dikecualikan",
};

export const STATUS_LABEL: Record<string, string> = { included: "dianalisis", partial_coverage: "cakupan parsial", excluded: "dikecualikan" };
