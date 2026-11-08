import { useMemo } from "react";
import { LineChart, RankDumbbell } from "../../components/charts";
import { Card, ComplianceBadge, Empty, Fit } from "../../components/ui";
import { useFilters, useScope } from "../../lib/filters";
import { keyTime, limitFor, networkExceedance, POLLUTANTS, stationStat, VAR_META } from "../../lib/kpi";
import { fmt, fmtInt, fmtPct } from "../../lib/format";
import { cityLabel } from "../../lib/regions";
import { ScopeLine, stdName, useRegionScope } from "./common";

const PERIOD_LABEL: Record<string, string> = { "1h": "1 jam", "8h": "8 jam", "24h": "24 jam", annual: "tahunan", peak_season: "musim puncak" };

export default function StandardsTab() {
  const { ds, f, range, selectStation } = useFilters();
  const std = f.standard;
  const v = f.pollutant, meta = VAR_META[v];
  const scope = useScope();
  const reg = useRegionScope();
  const lim = limitFor(ds, std, v, "24h");
  const ex = useMemo(() => (lim !== null ? networkExceedance(ds, scope.stations, v, lim, range) : null), [ds, scope, v, lim, range]);
  const exReg = useMemo(() => (lim !== null ? networkExceedance(ds, reg.stations, v, lim, range) : null), [ds, reg, v, lim, range]);
  const monthly = useMemo(() => {
    if (lim === null) return [];
    return ds.cal.monthKeys.map((key, m) => {
      const from = Math.max(range.from, ds.cal.monthStart[m]), to = Math.min(range.to, ds.cal.monthStart[m] + ds.cal.monthLen[m] - 1);
      if (from > to) return null;
      const e = networkExceedance(ds, scope.stations, v, lim, { from, to });
      return { key, pct: e.pct, nSt: e.exceeding.length };
    }).filter(Boolean) as { key: string; pct: number; nSt: number }[];
  }, [ds, scope, v, lim, range]);
  const stats = useMemo(() => reg.stations.map((c) => stationStat(ds, c, v, range)).filter((x) => x.n > 0), [ds, reg, v, range]);

  if (lim === null || !ex) {
    return (
      <div className="tabgrid tabgrid--std">
        <Card className="g-a" title={`${meta.short} tidak memiliki baku 24 jam pada ${stdName(std)}`}>
          <Empty title="Pilih polutan dengan baku 24 jam">PP 22/2021: PM2.5, PM10, SO₂, NO₂. WHO 2021: PM2.5, PM10, SO₂, NO₂, CO. Rata-rata harian hanya dibandingkan dengan baku 24 jam.</Empty>
        </Card>
        <ThresholdTable std={std} />
      </div>
    );
  }
  return (
    <div className="tabgrid tabgrid--std">
      <div className="g-k kstrip">
        <div className="kstrip__i"><span>Stasiun melampaui</span><b className="num">{ex.exceeding.length}<small> dari {ex.nEvaluated}</small></b><em>minimal satu hari di atas {fmt(lim, 0)} µg/m³</em></div>
        <div className="kstrip__i"><span>Stasiun-hari di atas baku</span><b className="num">{fmtInt(ex.n)}<small> dari {fmtInt(ex.den)}</small></b><em>jumlah pasangan stasiun × hari</em></div>
        <div className="kstrip__i"><span>% stasiun-hari</span><b className="num">{fmtPct(ex.pct)}</b><em>{stdName(std)} · {meta.short} 24 jam</em></div>
        <div className="kstrip__i"><span>Bulan dengan pelampauan</span><b className="num">{monthly.filter((m) => m.pct > 0).length}<small> dari {monthly.length}</small></b><em>dalam periode terpilih</em></div>
      </div>

      <Card className="g-a" title="Konsentrasi aktual dibanding ambang" sub={`Median dan P95 harian per stasiun vs baku 24 jam ${stdName(std)} · ${meta.unit}`}>
        <ScopeLine n={reg.stations.length} />
        <div className="scrollbody">
          <RankDumbbell label={`Median dan P95 ${meta.short} per stasiun terhadap baku`} unit={meta.unit} sortBy="p95" limit={lim} limitLabel={`${stdName(std)} ${fmt(lim, 0)}`}
            onSelect={(c) => selectStation(c)} highlight={f.station ? [f.station] : []}
            rows={stats.map((x) => ({ code: x.code, label: cityLabel(ds.byCode.get(x.code)!), median: x.median, p95: x.p95, n: x.n, twin: !!ds.byCode.get(x.code)!.twin[v] }))} />
        </div>
      </Card>

      <Card className="g-b" title="Pelampauan per bulan" sub="% stasiun-hari di atas baku dalam bulan itu">
        {!monthly.length ? <Empty /> : <Fit>{(_, h) => <LineChart label="Persentase stasiun-hari melampaui per bulan" unit="%" yLabel="%" height={h} animateKey={`${v}-${std}-${range.from}-${range.to}`}
          series={[{ id: "ex", label: "Stasiun-hari melampaui", color: "var(--coral)", width: 2.4, points: monthly.map((m) => ({ x: keyTime(m.key), y: m.pct, n: m.nSt })) }]} />}</Fit>}
      </Card>

      <Card className="g-c" title="Status per stasiun" sub="Diurutkan menurut % hari di atas baku">
        <div className="scrollbody">
          <table className="data"><thead><tr><th>Stasiun</th><th>Status</th><th className="r">% hari</th></tr></thead>
            <tbody>{[...(exReg?.per ?? [])].sort((a, b) => b.pct - a.pct).map((e) => <tr key={e.code} aria-selected={f.station === e.code}><td><button className="rowbtn" onClick={() => selectStation(e.code)}>{e.code}</button> <span className="muted">{cityLabel(ds.byCode.get(e.code)!)}</span></td><td><ComplianceBadge exceed={e.n > 0} /></td><td className="r num">{fmtPct(e.pct)}</td></tr>)}</tbody></table>
        </div>
        <ThresholdMini std={std} />
      </Card>
    </div>
  );
}

function ThresholdMini({ std }: { std: "PP22_2021" | "WHO_2021" }) {
  const { ds } = useFilters();
  const d = ds.meta.standards[std];
  return (
    <p className="card__foot">
      Baku 24 jam {stdName(std)}: {POLLUTANTS.filter((p) => d.limits[p]?.["24h"]).map((p) => `${VAR_META[p].short} ${fmt(d.limits[p]["24h"], 0)}`).join(" · ")} µg/m³. Baku 1 jam, 8 jam, dan tahunan ada di Metodologi.
    </p>
  );
}

function ThresholdTable({ std }: { std: "PP22_2021" | "WHO_2021" }) {
  const { ds } = useFilters();
  const d = ds.meta.standards[std];
  return (
    <Card className="g-b" title={`Nilai ambang ${stdName(std)}`} sub={d.source}>
      <div className="scrollbody">
        <table className="data"><thead><tr><th>Polutan</th><th>Waktu rata-rata</th><th className="r">µg/m³</th></tr></thead>
          <tbody>{POLLUTANTS.flatMap((p) => Object.entries(d.limits[p] ?? {}).map(([per, val]) => <tr key={p + per}><td><b>{VAR_META[p].short}</b></td><td>{PERIOD_LABEL[per] ?? per}</td><td className="r num">{fmt(val, 0)}</td></tr>))}</tbody></table>
      </div>
    </Card>
  );
}
