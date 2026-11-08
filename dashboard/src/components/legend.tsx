import { fmt } from "../lib/format";

/**
 * Kategori konsentrasi stasiun relatif terhadap baku 24 jam (statistik harian ↔ baku harian: periode rata-rata sama).
 * Dasar klasifikasi: ≤ 50% baku (biru), 50–100% baku (amber, mendekati), > baku (coral, melampaui).
 */
export const CATEGORY_HEX = { low: "#4a94c4", mid: "#e6a85d", high: "#d97770", na: "#c9d0c8", neutral: "#6fb0c9" };
export function categoryHex(v: number, limit: number | null): string {
  if (!Number.isFinite(v)) return CATEGORY_HEX.na;
  if (limit === null) return CATEGORY_HEX.neutral;
  return v > limit ? CATEGORY_HEX.high : v > limit / 2 ? CATEGORY_HEX.mid : CATEGORY_HEX.low;
}
export const categoryColor = categoryHex;
/** Warna teks yang terbaca untuk kategori yang sama. */
export function categoryInk(v: number, limit: number | null): string {
  if (!Number.isFinite(v)) return "var(--muted)";
  if (limit === null) return "var(--sky-ink)";
  return v > limit ? "var(--coral-ink)" : v > limit / 2 ? "var(--amber-ink)" : "var(--green-ink)";
}

export function CategoryLegend({ limit, statLabel, compact }: { limit: number | null; statLabel: string; compact?: boolean }) {
  if (limit === null) return <ul className="legend"><li><i style={{ background: CATEGORY_HEX.neutral }} />{statLabel} (tanpa baku 24 jam)</li><li><i style={{ background: CATEGORY_HEX.na }} />Data kurang</li></ul>;
  return (
    <ul className="legend" aria-label="Legenda kategori">
      <li><i style={{ background: CATEGORY_HEX.low }} />{compact ? "≤ 50% baku" : `${statLabel} ≤ ${fmt(limit / 2, 1)}`}</li>
      <li><i style={{ background: CATEGORY_HEX.mid }} />{compact ? "50–100%" : `${fmt(limit / 2, 1)}–${fmt(limit, 0)}`}</li>
      <li><i style={{ background: CATEGORY_HEX.high }} />{compact ? "> baku" : `> ${fmt(limit, 0)} µg/m³`}</li>
      <li><i style={{ background: CATEGORY_HEX.na }} />Data kurang</li>
    </ul>
  );
}

/** Skala warna sekuensial untuk heatmap (hijau → amber → coral bila ada baku; biru bila tidak). */
export function seqColor(max: number, limit?: number | null) {
  return (v: number) => {
    if (limit) { const r = v / limit; return r > 1 ? `rgba(217,119,112,${Math.min(1, 0.6 + (r - 1) * 0.5)})` : r > 0.5 ? `rgba(230,168,93,${0.45 + (r - 0.5) * 1})` : `rgba(95,154,112,${0.2 + r * 0.9})`; }
    const r = Math.min(1, v / max);
    return `rgba(46,111,138,${0.12 + r * 0.8})`;
  };
}
