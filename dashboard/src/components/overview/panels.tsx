import { useEffect, useMemo, useState } from "react";
import { useFilters } from "../../lib/filters";
import { episodeShades, keyTime, limitFor, VAR_META, type Granularity } from "../../lib/kpi";
import { fmt, fmtInt, fmtMonthKey, fmtPct } from "../../lib/format";
import { cityLabel } from "../../lib/regions";
import { isFullMonth, trendSeries, type StationRow } from "../../lib/selectors";
import type { networkExceedance } from "../../lib/kpi";
import { LineChart } from "../charts";
import { categoryHex, categoryInk } from "../legend";
import { Card, Empty, Fit, InfoTip, Seg } from "../ui";

// ---------------------------------------------------------------------
// AirQualityTrend: PM2.5/PM10, granularitas, mengikuti stasiun terpilih
// ---------------------------------------------------------------------
export function AirQualityTrend({ codes25, codes10 }: { codes25: string[]; codes10: string[] }) {
  const { ds, f, range } = useFilters();
  const [pv, setPv] = useState<"pm25" | "pm10">(f.pollutant === "pm10" ? "pm10" : "pm25");
  const [gran, setGran] = useState<Granularity>("month");
  useEffect(() => { if (f.pollutant === "pm25" || f.pollutant === "pm10") setPv(f.pollutant); }, [f.pollutant]);
  const station = f.station || null;
  const pts = useMemo(() => trendSeries(ds, pv === "pm25" ? codes25 : codes10, station, pv, range, gran), [ds, pv, codes25, codes10, station, range, gran]);
  const lim = limitFor(ds, f.standard, pv, "24h");
  const color = pv === "pm25" ? "var(--c-pm25)" : "var(--c-pm10)";
  const what = station ? `Stasiun ${station}` : "Median antarstasiun";
  const granLabel = gran === "day" ? "harian" : gran === "week" ? "mingguan" : "bulanan";
  return (
    <Card className="trend" title={`Tren ${VAR_META[pv].short}`} sub={`${what}, ${granLabel} · µg/m³`}
      actions={<>
        <Seg size="sm" label="Parameter tren" value={pv} onChange={setPv} options={[{ v: "pm25", l: "PM2.5" }, { v: "pm10", l: "PM10" }]} />
        <Seg size="sm" label="Granularitas" value={gran} onChange={setGran} options={[{ v: "day", l: "H", title: "Harian" }, { v: "week", l: "M", title: "Mingguan" }, { v: "month", l: "B", title: "Bulanan" }]} />
      </>}>
      {!pts.some((p) => Number.isFinite(p.value)) ? <Empty /> : (
        <Fit min={110}>{(_, h) => (
          <LineChart label={`Tren ${VAR_META[pv].short}, ${what}`} height={h} unit="µg/m³" shades={episodeShades(ds, range)} animateKey={`${pv}-${gran}-${station}-${range.from}-${range.to}-${codes25.length}`}
            refLines={lim !== null && gran === "day" ? [{ y: lim, label: `Baku 24 jam ${fmt(lim, 0)}`, color: "var(--coral)" }] : []}
            series={[{ id: pv, label: VAR_META[pv].short, color, band: !station, width: gran === "day" ? 1.3 : 2.2, points: pts.map((p) => ({ x: keyTime(p.key), y: p.value, lo: p.q1, hi: p.q3, n: station ? undefined : p.n })) }]} />
        )}</Fit>
      )}
      <ul className="legend legend--foot">
        <li><i className="line" style={{ background: color }} />{station ? station : "Median"}</li>
        {!station && <li><i style={{ background: "var(--c-band)" }} />50% stasiun tengah</li>}
        <li><i style={{ background: "var(--c-shade)" }} />Agu–Okt</li>
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Ringkasan pelampauan: tiga ukuran yang berbeda, diberi label terpisah
// ---------------------------------------------------------------------
export function ExceedanceSummary({ ex, lim }: { ex: ReturnType<typeof networkExceedance> | null; lim: number | null }) {
  const { f, go } = useFilters();
  const pol = VAR_META[f.pollutant].short;
  const std = f.standard === "PP22_2021" ? "PP 22/2021" : "WHO 2021";
  return (
    <Card className="exceed" title="Pelampauan baku 24 jam" sub={lim !== null ? `${pol} · ${std} · ${fmt(lim, 0)} µg/m³` : `${pol} · ${std}`}
      actions={<button type="button" className="link" onClick={() => go("analytics", "standards")}>Detail</button>}>
      {lim === null || !ex ? <p className="muted small">Tidak ada baku 24 jam untuk {pol} pada {std}.</p> : (
        <dl className="exstats">
          <div><dt>Stasiun melampaui <InfoTip title="Stasiun melampaui">Stasiun dengan minimal satu hari di atas baku.</InfoTip></dt><dd className="num">{ex.exceeding.length}<small>dari {ex.nEvaluated} stasiun</small></dd></div>
          <div><dt>Stasiun-hari di atas baku <InfoTip title="Stasiun-hari">Jumlah pasangan stasiun × hari dengan rata-rata harian di atas baku.</InfoTip></dt><dd className="num">{fmtInt(ex.n)}<small>dari {fmtInt(ex.den)}</small></dd></div>
          <div><dt>% stasiun-hari di atas baku</dt><dd className="num">{fmtPct(ex.pct)}</dd>
            <span className="bar" aria-hidden><i style={{ width: `${Math.min(100, ex.pct)}%` }} /></span></div>
        </dl>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------
// StationRanking: klik → fokus kota + detail
// ---------------------------------------------------------------------
export function StationRanking({ rows, limit }: { rows: StationRow[]; limit: number | null }) {
  const { ds, f, selectStation } = useFilters();
  const ranked = rows.filter((r) => r.inRegion && r.inScope && Number.isFinite(r.value)).sort((a, b) => b.value - a.value);
  const max = ranked[0]?.value || 1;
  const statLabel = f.stat === "median" ? "Median" : "P95";
  return (
    <Card className="rank" title="Peringkat stasiun" sub={`${statLabel} harian ${VAR_META[f.pollutant].short} · µg/m³`}>
      {!ranked.length ? <Empty /> : (
        <ol className="ranklist">
          {ranked.map((r, i) => {
            const s = ds.byCode.get(r.code)!;
            return (
              <li key={r.code}>
                <button type="button" aria-pressed={f.station === r.code} onClick={() => selectStation(f.station === r.code ? null : r.code)}>
                  <span className="ranklist__n num">{i + 1}</span>
                  <span className="ranklist__name"><b>{r.code}</b> {cityLabel(s)}</span>
                  <span className="ranklist__bar" aria-hidden><i style={{ width: `${(100 * r.value) / max}%`, background: categoryHex(r.value, limit) }} /></span>
                  <span className="ranklist__v num" style={{ color: categoryInk(r.value, limit) }}>{fmt(r.value)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------
// MonitoringStatus: stasiun memenuhi kriteria data + % kelengkapan (gauge)
// ---------------------------------------------------------------------
export function MonitoringStatus({ m }: { m: { total: number; meet: number; withData: number; pct: number } }) {
  const { f } = useFilters();
  const share = m.total ? m.meet / m.total : 0;
  const R = 46, C = Math.PI * R;
  return (
    <Card className="monitor" title="Status pemantauan" sub={`${VAR_META[f.pollutant].short} · periode terpilih`}>
      <div className="gauge">
        <svg viewBox="0 0 120 70" role="img" aria-label={`${m.meet} dari ${m.total} stasiun memenuhi kriteria data`}>
          <path d={`M14 62 A${R} ${R} 0 0 1 106 62`} fill="none" stroke="var(--sage)" strokeWidth="11" strokeLinecap="round" />
          <path className="gauge__arc" d={`M14 62 A${R} ${R} 0 0 1 106 62`} fill="none" stroke="var(--green)" strokeWidth="11" strokeLinecap="round"
            strokeDasharray={`${C}`} strokeDashoffset={`${C * (1 - share)}`} />
          <text x="60" y="52" textAnchor="middle" className="gauge__v">{m.meet}/{m.total}</text>
          <text x="60" y="67" textAnchor="middle" className="gauge__l">stasiun ≥ 75% hari</text>
        </svg>
      </div>
      <dl className="mini">
        <div><dt>Kelengkapan data</dt><dd className="num">{fmtPct(m.pct, 0)}</dd></div>
        <div><dt>Stasiun dengan data</dt><dd className="num">{m.withData} dari {m.total}</dd></div>
      </dl>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Tiga insight dari data terfilter
// ---------------------------------------------------------------------
export function Insights({ rows, codes, ex, lim }: { rows: StationRow[]; codes: string[]; ex: ReturnType<typeof networkExceedance> | null; lim: number | null }) {
  const { ds, f, range, go } = useFilters();
  const v = f.pollutant, meta = VAR_META[v];
  const statLabel = f.stat === "median" ? "median" : "P95";
  const top = rows.filter((r) => r.inRegion && r.inScope && Number.isFinite(r.value)).sort((a, b) => b.value - a.value)[0];
  const months = useMemo(() => trendSeries(ds, codes, null, v, range, "month").filter((p) => Number.isFinite(p.value) && isFullMonth(p)), [ds, codes, v, range]);
  const peak = [...months].sort((a, b) => b.value - a.value)[0], low = [...months].sort((a, b) => a.value - b.value)[0];
  const worst = ex?.per.filter((e) => e.n > 0).sort((a, b) => b.pct - a.pct)[0];
  const items = [
    top && { k: "Konsentrasi tertinggi", t: <><b>{top.code}</b> ({cityLabel(ds.byCode.get(top.code)!)}) memiliki {statLabel} {meta.short} tertinggi: <b>{fmt(top.value)} µg/m³</b>.</>, tab: "pollutants" as const },
    peak && low && peak.key !== low.key && { k: "Perubahan waktu", t: <>Rata-rata bulanan tertinggi pada <b>{fmtMonthKey(peak.key, true)}</b> ({fmt(peak.value)}), terendah {fmtMonthKey(low.key, true)} ({fmt(low.value)} µg/m³).</>, tab: "time" as const },
    lim !== null && ex && (worst
      ? { k: "Pelampauan", t: <><b>{worst.code}</b> paling sering di atas baku 24 jam: <b>{fmtPct(worst.pct, 0)}</b> hari dengan data ({fmtInt(worst.n)} hari).</>, tab: "standards" as const }
      : { k: "Pelampauan", t: <>Tidak ada hari di atas baku 24 jam {fmt(lim, 0)} µg/m³ dalam filter ini.</>, tab: "standards" as const }),
  ].filter(Boolean) as { k: string; t: React.ReactNode; tab: "pollutants" | "time" | "standards" }[];
  return (
    <Card className="insights" title="Temuan dari filter ini">
      {!items.length ? <Empty /> : (
        <ol className="insightlist">
          {items.slice(0, 3).map((it) => (
            <li key={it.k}>
              <button type="button" onClick={() => go("analytics", it.tab)}>
                <span className="insightlist__k">{it.k}</span>
                <span className="insightlist__t">{it.t}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
