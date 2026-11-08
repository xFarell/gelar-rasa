import * as d3 from "d3";
import { useMemo, useState } from "react";
import { binLabel, C, DensityScatter, ROSE_COLORS, WindRose } from "../../components/charts";
import { Card, Empty, Fit, Loading, Seg, tip, TipRow } from "../../components/ui";
import { useFilters, useScope } from "../../lib/filters";
import { pooledPairs, scopeStations, VAR_META, withinStationSpearman } from "../../lib/kpi";
import { loadHourly } from "../../lib/dataset";
import { fmt } from "../../lib/format";
import { usePromise, useBox } from "../../lib/hooks";
import { monthsInRange, SECTOR_NAMES } from "../../lib/selectors";
import type { MeteoVar } from "../../lib/types";
import { ScopeLine } from "./common";

const METS: MeteoVar[] = ["temperature", "humidity", "wind_speed"];

export default function MeteorologyTab() {
  const { ds, f, range, codes, selectStation } = useFilters();
  const v = f.pollutant, meta = VAR_META[v];
  const pScope = useScope();
  const [mv, setMv] = useState<MeteoVar>("humidity");
  const hourly = usePromise(loadHourly).data;

  // Stasiun dihitung bila masuk cakupan polutan DAN variabel meteorologi (dedup keduanya).
  const table = useMemo(() => METS.map((m) => {
    const ms = scopeStations(ds, { variable: m, selected: codes, includeTwins: f.twins });
    const sts = pScope.stations.filter((c) => ms.stations.includes(c));
    const w = withinStationSpearman(ds, sts, v, m, range);
    const p = pooledPairs(ds, sts, v, m, range);
    return { m, sts, w, rho: p.rho, n: p.x.length };
  }), [ds, pScope, v, range, codes, f.twins]);
  const sel = table.find((t) => t.m === mv)!;
  const pairs = useMemo(() => pooledPairs(ds, sel.sts, v, mv, range), [ds, sel, v, mv, range]);

  const roseStations = useScope("wind_speed").stations;
  const rose = useMemo(() => {
    if (!hourly) return null;
    const mk = new Set(monthsInRange(ds, range));
    const nb = hourly.windSpeedBins.length - 1;
    const acc = Array.from({ length: hourly.windSectors }, () => new Array(nb).fill(0));
    let n = 0;
    for (const c of roseStations) {
      const r = hourly.windRose[c]; if (!r) continue;
      hourly.months.forEach((k, mi) => { if (!mk.has(k)) return; r[mi].forEach((cnt, j) => { acc[Math.floor(j / nb)][j % nb] += cnt; n += cnt; }); });
    }
    return { acc, n };
  }, [hourly, roseStations, range, ds]);
  const top = rose?.n ? (() => { const tot = rose.acc.map((r) => d3.sum(r)); const i = d3.maxIndex(tot); return { name: SECTOR_NAMES[i], pct: (100 * tot[i]) / rose.n }; })() : null;

  return (
    <div className="tabgrid tabgrid--met">
      <Card className="g-a" title="Korelasi di dalam stasiun" sub={`Median ρ Spearman antarhari di setiap stasiun · ${meta.short}`}>
        <ScopeLine n={pScope.stations.length} />
        <ul className="corrlist">
          {table.map((t) => (
            <li key={t.m}>
              <button type="button" aria-pressed={mv === t.m} onClick={() => setMv(t.m)}>
                <span className="corrlist__k">{VAR_META[t.m].label}</span>
                <span className="corrlist__v num">{fmt(t.w.median, 2)}</span>
                <span className="corrlist__s">gabungan ρ = {fmt(t.rho, 2)} · {t.w.per.length} stasiun</span>
              </button>
            </li>
          ))}
        </ul>
        <h3 className="card__h3">ρ per stasiun: {VAR_META[mv].label.toLowerCase()}</h3>
        {sel.w.per.length ? <div className="scrollbody"><RhoBars rows={sel.w.per} onSelect={(c) => selectStation(c)} /></div> : <Empty />}
        <p className="card__foot">Korelasi bukan sebab-akibat. Hasil utama memakai korelasi di dalam stasiun; korelasi gabungan dapat dipengaruhi perbedaan antarstasiun.</p>
      </Card>

      <Card className="g-b" title={`${meta.short} dan ${VAR_META[mv].label.toLowerCase()}`} sub="Kepadatan stasiun-hari · garis: median per kelompok"
        actions={<Seg size="sm" label="Variabel meteorologi" value={mv} onChange={setMv} options={METS.map((m) => ({ v: m, l: VAR_META[m].label }))} />}>
        {pairs.x.length < 30 ? <Empty /> : (
          <Fit>{(_, h) => <DensityScatter label={`Kepadatan ${meta.short} terhadap ${VAR_META[mv].label}`} x={pairs.y} y={pairs.x} xLabel={`${VAR_META[mv].label} (${VAR_META[mv].unit})`} yLabel={`${meta.short} (${meta.unit})`} height={h} color="var(--c-pm10)" />}</Fit>
        )}
        <p className="card__foot">{pairs.x.length.toLocaleString("id-ID")} stasiun-hari berpasangan. PM tidak dikoreksi kelembapan.</p>
      </Card>

      <Card className="g-c" title={top ? `Angin dominan dari ${top.name.toLowerCase()}` : "Wind rose"} sub={`${f.station ? `Stasiun ${f.station}` : `${roseStations.length} stasiun dalam cakupan`} · arah = asal angin · per bulan penuh`}>
        {!hourly ? <Loading label="Memuat data jam…" /> : !rose?.n ? <Empty /> : (
          <>
            <Fit>{(w, h) => <div className="rosebox"><WindRose label="Wind rose" counts={rose.acc} bins={hourly.windSpeedBins} size={Math.max(180, Math.min(w, h) - 8)} /></div>}</Fit>
            <ul className="legend legend--foot">{rose.acc[0].map((_, b) => <li key={b}><i style={{ background: ROSE_COLORS[b] }} />{binLabel(hourly.windSpeedBins, b)}</li>)}</ul>
            <p className="card__foot">{rose.n.toLocaleString("id-ID")} jam{top ? `; ${fmt(top.pct, 0)}% dari arah ${top.name.toLowerCase()}` : ""}.</p>
          </>
        )}
      </Card>
    </div>
  );
}

function RhoBars({ rows, onSelect }: { rows: { code: string; rho: number; n: number }[]; onSelect: (c: string) => void }) {
  const [ref, b] = useBox<HTMLDivElement>();
  const w = b.w;
  const sorted = [...rows].sort((a, b) => a.rho - b.rho);
  const rowH = 18, h = sorted.length * rowH + 24, ml = 60;
  const lim = Math.max(0.3, d3.max(sorted, (r) => Math.abs(r.rho)) ?? 0.3);
  const x = d3.scaleLinear().domain([-lim, lim]).range([ml, Math.max(ml + 60, w - 10)]);
  return (
    <div ref={ref} className="chart" style={{ height: h }} role="img" aria-label="Korelasi Spearman dalam stasiun per stasiun">
      {w > 0 && <svg width={w} height={h}>
        <g className="axis">{x.ticks(5).map((t) => <g key={t} transform={`translate(${x(t)},0)`}><line className="gridline" y1={14} y2={h} /><text y={10} textAnchor="middle">{fmt(t, 1)}</text></g>)}</g>
        <line x1={x(0)} x2={x(0)} y1={14} y2={h} stroke="var(--muted)" />
        {sorted.map((r, i) => (
          <g key={r.code} transform={`translate(0,${18 + i * rowH})`} style={{ cursor: "pointer" }} onClick={() => onSelect(r.code)} onPointerMove={(e) => tip.show(e, <><b>{r.code}</b><TipRow k="ρ Spearman" v={fmt(r.rho, 3)} /><TipRow k="Hari berpasangan" v={r.n} /></>)} onPointerLeave={() => tip.hide()}>
            <text x={ml - 6} y={rowH / 2} dy="0.32em" textAnchor="end" fontSize={10.5} fill={C.text}>{r.code}</text>
            <rect x={Math.min(x(0), x(r.rho))} y={3} width={Math.abs(x(r.rho) - x(0))} height={rowH - 6} rx={2} fill={r.rho >= 0 ? "var(--teal)" : "var(--coral)"} className="fade-in" />
          </g>
        ))}
      </svg>}
    </div>
  );
}
