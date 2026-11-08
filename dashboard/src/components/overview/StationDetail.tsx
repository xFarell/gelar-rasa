import { useEffect, useMemo, useRef } from "react";
import { useFilters } from "../../lib/filters";
import { exceedance, keyTime, limitFor, stationPeriodMeans, stationStat, tierOf, VAR_META } from "../../lib/kpi";
import { fmt, fmtPct, SITE_CLASS_ID } from "../../lib/format";
import { cityLabel } from "../../lib/regions";
import { LineChart } from "../charts";
import { TierBadge } from "../ui";

/** DetailDrawer stasiun: muncul di samping kota 3D saat stasiun dipilih. */
export function StationDetail({ code }: { code: string }) {
  const { ds, f, range, selectStation, go } = useFilters();
  const s = ds.byCode.get(code)!;
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    back.current?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => e.key === "Escape" && selectStation(null);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [code, selectStation]);
  const v = f.pollutant, meta = VAR_META[v];
  const a = useMemo(() => stationStat(ds, code, "pm25", range), [ds, code, range]);
  const b = useMemo(() => stationStat(ds, code, "pm10", range), [ds, code, range]);
  const sv = useMemo(() => stationStat(ds, code, v, range), [ds, code, v, range]);
  const lim = limitFor(ds, f.standard, v, "24h");
  const ex = lim !== null ? exceedance(ds, code, v, lim, range) : null;
  const trend = useMemo(() => stationPeriodMeans(ds, code, v, range, range.to - range.from > 120 ? "month" : "day"), [ds, code, v, range]);
  const tier = s.status === "excluded" ? "dikecualikan" : tierOf(s, v);
  const twin = s.twin[v];
  return (
    <aside className="detail" aria-label={`Detail stasiun ${code}`}>
      <button ref={back} type="button" className="detail__back" onClick={() => selectStation(null)}>← Kembali ke kota</button>
      <p className="detail__code">{code} · {SITE_CLASS_ID[s.siteClass] ?? s.siteClass}</p>
      <h2 className="detail__name">{cityLabel(s)}</h2>
      <p className="detail__where">{s.name !== cityLabel(s) ? `${s.name}, ` : ""}{s.provinsi}</p>
      <dl className="detail__grid">
        <div><dt>Median PM2.5</dt><dd className="num">{fmt(a.median)}</dd></div>
        <div><dt>P95 PM2.5</dt><dd className="num">{fmt(a.p95)}</dd></div>
        <div><dt>Median PM10</dt><dd className="num">{fmt(b.median)}</dd></div>
        <div><dt>P95 PM10</dt><dd className="num">{fmt(b.p95)}</dd></div>
      </dl>
      <p className="detail__unit">µg/m³, rata-rata harian dalam periode</p>
      <div className="detail__row"><span>Kelengkapan {meta.short}</span><span className="num">{fmtPct(sv.pctUsable, 0)} <TierBadge tier={tier} /></span></div>
      {ex && <div className="detail__row"><span>Hari di atas {fmt(lim, 0)} µg/m³</span><span className="num">{ex.n} dari {ex.den}</span></div>}
      {twin && <p className="detail__note">Data {meta.short} kembar dengan {twin.members.filter((m) => m !== code).join(", ")}{twin.representative ? "; stasiun ini wakil kelompok." : "; dalam KPI diwakili stasiun lain."}</p>}
      <h3 className="detail__h">Tren {meta.short}</h3>
      {trend.some((p) => p.representative) ? (
        <LineChart label={`Tren ${meta.short} stasiun ${code}`} height={110} unit={meta.unit} animateKey={`${code}-${v}-${range.from}-${range.to}`}
          series={[{ id: "s", label: code, color: "var(--c-pm25)", width: 2, points: trend.map((p) => ({ x: keyTime(p.key), y: p.representative ? p.mean : NaN })) }]} />
      ) : <p className="detail__note">Data tidak cukup untuk tren.</p>}
      <button type="button" className="btn btn--sm btn--primary detail__go" onClick={() => go("analytics", "pollutants")}>Analitik stasiun ini</button>
    </aside>
  );
}
