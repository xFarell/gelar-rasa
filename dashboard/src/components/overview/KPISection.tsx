import { useFilters, type TabId } from "../../lib/filters";
import type { Filters } from "../../lib/filters";
import { fmt, fmtDate } from "../../lib/format";
import { VAR_META } from "../../lib/kpi";
import type { KpiValue } from "../../lib/selectors";
import { CountUp, InfoTip } from "../ui";

interface KpiProps {
  label: string; unit?: string; v: KpiValue | null; digits?: number; suffix?: React.ReactNode;
  def: React.ReactNode; tab: TabId; patch?: Partial<Filters>; prevLabel: string | null; tone?: "crit";
}

function KpiCard({ label, unit, v, digits = 1, suffix, def, tab, patch, prevLabel, tone }: KpiProps) {
  const { go } = useFilters();
  const val = v?.value ?? NaN;
  const delta = v && v.prev !== null && Number.isFinite(val) ? val - v.prev : null;
  const open = () => go("analytics", tab, patch);
  return (
    <article className={`kpi ${tone ? `kpi--${tone}` : ""}`}>
      <div className="kpi__top">
        <h3 className="kpi__label">{label}</h3>
        <InfoTip title={label}>{def}</InfoTip>
      </div>
      <button type="button" className="kpi__body" onClick={open} aria-label={`${label}: ${fmt(val, digits)} ${unit ?? ""}. Buka analitik`}>
        <span className="kpi__value num">{Number.isFinite(val) ? <CountUp value={val} digits={digits} /> : "—"}{unit && <small>{unit}</small>}{suffix}</span>
        <span className="kpi__delta">
          {delta === null
            ? <span title="Periode sebelumnya dengan panjang sama berada di luar data">Tanpa periode pembanding</span>
            : <span><b aria-hidden>{delta > 0 ? "▲" : delta < 0 ? "▼" : "■"}</b> {delta > 0 ? "+" : ""}{fmt(delta, digits)} vs {prevLabel}</span>}
        </span>
      </button>
    </article>
  );
}

export function KPISection({ k }: { k: ReturnType<typeof import("../../lib/selectors").overviewKpis> }) {
  const { ds, f } = useFilters();
  const prevLabel = k.prev ? `${fmtDate(ds.cal.iso(k.prev.from))}–${fmtDate(ds.cal.iso(k.prev.to))}` : null;
  const pol = VAR_META[f.pollutant].short;
  const std = f.standard === "PP22_2021" ? "PP 22/2021" : "WHO 2021";
  const scopeNote = (v: KpiValue | null) => v ? `${v.nStations} stasiun, ${v.n.toLocaleString("id-ID")} stasiun-hari.` : "";
  return (
    <div className="kpis" aria-label="Indikator utama">
      <KpiCard label="Median PM2.5" unit="µg/m³" v={k.median25} tab="pollutants" patch={{ pollutant: "pm25", stat: "median" }} prevLabel={prevLabel}
        def={<>Nilai tengah rata-rata harian semua stasiun-hari dalam filter. {scopeNote(k.median25)} Stasiun dengan data kembar dihitung sekali.</>} />
      <KpiCard label="P95 PM2.5" unit="µg/m³" v={k.p95_25} tab="pollutants" patch={{ pollutant: "pm25", stat: "p95" }} prevLabel={prevLabel}
        def={<>95% stasiun-hari berada di bawah nilai ini; menggambarkan hari dengan konsentrasi tinggi. {scopeNote(k.p95_25)}</>} />
      <KpiCard label="Median PM10" unit="µg/m³" v={k.median10} tab="pollutants" patch={{ pollutant: "pm10", stat: "median" }} prevLabel={prevLabel}
        def={<>Nilai tengah rata-rata harian PM10 semua stasiun-hari dalam filter. {scopeNote(k.median10)}</>} />
      {k.exceeding && k.lim !== null ? (
        <KpiCard label={`Stasiun melampaui baku ${pol}`} v={k.exceeding} digits={0} tab="standards" prevLabel={prevLabel} tone="crit"
          suffix={<small>dari {k.exceeding.nStations}</small>}
          def={<>Jumlah stasiun dengan minimal satu hari rata-rata harian di atas baku 24 jam {std} ({fmt(k.lim, 0)} µg/m³). Bukan jumlah stasiun-hari.</>} />
      ) : (
        <article className="kpi kpi--na">
          <div className="kpi__top"><h3 className="kpi__label">Stasiun melampaui baku {pol}</h3></div>
          <p className="kpi__na">{std} tidak memiliki baku 24 jam untuk {pol}. Lihat tab Baku Mutu untuk baku 1 jam dan 8 jam.</p>
        </article>
      )}
    </div>
  );
}
