import { useMemo, useState } from "react";
import { BoxPlot, Histogram, LineChart, RankDumbbell } from "../../components/charts";
import { Card, Empty, Fit, Seg } from "../../components/ui";
import { useFilters, useScope } from "../../lib/filters";
import { limitFor, pooledStat, stationStat, values, VAR_META } from "../../lib/kpi";
import { fmt, fmtInt } from "../../lib/format";
import { cityLabel } from "../../lib/regions";
import { mean, quantileSorted, sortedFinite } from "../../lib/stats";
import { ScopeLine, stdName, useRegionScope } from "./common";

export default function PollutantsTab() {
  const { ds, f, range, selectStation } = useFilters();
  const v = f.pollutant, meta = VAR_META[v];
  const scope = useScope();
  const reg = useRegionScope();
  const lim = limitFor(ds, f.standard, v, "24h");
  const pooled = useMemo(() => pooledStat(ds, scope.stations, v, range), [ds, scope, v, range]);
  const stats = useMemo(() => reg.stations.map((c) => stationStat(ds, c, v, range)).filter((s) => s.n > 0), [ds, reg, v, range]);
  const [dist, setDist] = useState<"hist" | "ecdf">("hist");
  const [group, setGroup] = useState<"pulau" | "station">("pulau");

  const ecdf = useMemo(() => {
    const s = pooled.sorted, n = s.length; if (!n) return [];
    const step = Math.max(1, Math.floor(n / 300));
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i += step) pts.push({ x: s[i], y: (100 * (i + 1)) / n });
    pts.push({ x: s[n - 1], y: 100 });
    return pts;
  }, [pooled]);

  const boxes = useMemo(() => {
    if (group === "station") return stats.map((s) => ({ code: s.code, label: cityLabel(ds.byCode.get(s.code)!), p5: s.p5, q1: s.q1, median: s.median, q3: s.q3, p95: s.p95, max: s.max, n: s.n })).sort((a, b) => b[f.stat] - a[f.stat]);
    const by = new Map<string, number[]>(), nSt = new Map<string, number>();
    for (const c of reg.stations) {
      const k = ds.byCode.get(c)!.pulau, x = values(ds, c, v, range), arr = by.get(k) ?? [];
      let any = false;
      for (let i = 0; i < x.length; i++) if (Number.isFinite(x[i])) { arr.push(x[i]); any = true; }
      by.set(k, arr); if (any) nSt.set(k, (nSt.get(k) ?? 0) + 1);
    }
    return [...by.entries()].filter(([, a]) => a.length).map(([k, a]) => {
      const s = sortedFinite(a);
      return { code: k, label: `${nSt.get(k)} stasiun`, p5: quantileSorted(s, 0.05), q1: quantileSorted(s, 0.25), median: quantileSorted(s, 0.5), q3: quantileSorted(s, 0.75), p95: quantileSorted(s, 0.95), max: s[s.length - 1], n: s.length };
    }).sort((a, b) => b[f.stat] - a[f.stat]);
  }, [group, stats, reg, ds, v, range, f.stat]);

  const limLines = lim !== null ? [{ v: lim, label: `${stdName(f.standard)} ${fmt(lim, 0)}`, color: "var(--coral-ink)" }] : [];
  return (
    <div className="tabgrid tabgrid--pol">
      <Card className="g-a" title={`${f.stat === "median" ? "Median" : "P95"} dan sebaran per stasiun`} sub={`Titik hijau: median, titik oranye: P95 · ${meta.unit}`}>
        <ScopeLine n={reg.stations.length} />
        {!stats.length ? <Empty /> : (
          <div className="scrollbody">
            <RankDumbbell label={`Median dan P95 ${meta.short} per stasiun`} unit={meta.unit} sortBy={f.stat} limit={lim} limitLabel={lim !== null ? `Baku 24 jam ${fmt(lim, 0)}` : undefined}
              onSelect={(c) => selectStation(f.station === c ? null : c)} highlight={f.station ? [f.station] : []}
              rows={stats.map((s) => ({ code: s.code, label: cityLabel(ds.byCode.get(s.code)!), median: s.median, p95: s.p95, n: s.n, twin: !!ds.byCode.get(s.code)!.twin[v] }))} />
          </div>
        )}
        <p className="card__foot">◇ data kembar. Klik stasiun untuk memfilter seluruh dashboard.</p>
      </Card>

      <Card className="g-b" title="Distribusi harian" sub={`${f.station ? `Stasiun ${f.station}` : "Semua stasiun-hari dalam cakupan"} · ${meta.unit}`}
        actions={<Seg size="sm" label="Jenis distribusi" value={dist} onChange={setDist} options={[{ v: "hist", l: "Histogram" }, { v: "ecdf", l: "ECDF" }]} />}>
        <dl className="statrow">
          <div><dt>Median</dt><dd className="num">{fmt(pooled.median)}</dd></div>
          <div><dt>P95</dt><dd className="num">{fmt(pooled.p95)}</dd></div>
          <div><dt>Rata-rata</dt><dd className="num">{fmt(mean(pooled.sorted))}</dd></div>
          <div><dt>Stasiun-hari</dt><dd className="num">{fmtInt(pooled.n)}</dd></div>
        </dl>
        {!pooled.n ? <Empty /> : (
          <Fit>{(_, h) => dist === "hist"
            ? <Histogram label={`Histogram ${meta.short} harian`} values={pooled.sorted} unit={meta.unit} height={h} limits={limLines} color="var(--green)" />
            : <LineChart label={`ECDF ${meta.short} harian`} xType="linear" xFormat={(x) => fmt(x, 0)} height={h} unit="%" yLabel="% stasiun-hari ≤ x"
                refLines={[]} series={[{ id: "e", label: "Proporsi kumulatif", color: "var(--c-pm25)", width: 2, points: ecdf }]} animateKey={`${v}-${range.from}-${range.to}-${scope.stations.length}`} />}
          </Fit>
        )}
      </Card>

      <Card className="g-c" title={group === "pulau" ? "Box plot per pulau" : "Box plot per stasiun"} sub="Kotak: 50% tengah · garis: P5–P95 · garis tegak: median"
        actions={<Seg size="sm" label="Kelompok box plot" value={group} onChange={setGroup} options={[{ v: "pulau", l: "Pulau" }, { v: "station", l: "Stasiun" }]} />}>
        {!boxes.length ? <Empty /> : (
          <div className="scrollbody">
            <BoxPlot label={`Box plot ${meta.short}`} unit={meta.unit} rows={boxes} limit={lim} limitLabel={lim !== null ? `Baku 24 jam ${fmt(lim, 0)}` : undefined} onSelect={group === "station" ? (c) => selectStation(c) : undefined} />
          </div>
        )}
      </Card>
    </div>
  );
}
