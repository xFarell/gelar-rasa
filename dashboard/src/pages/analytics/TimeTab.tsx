import * as d3 from "d3";
import { useMemo } from "react";
import { C, Heatmap, LineChart } from "../../components/charts";
import { seqColor } from "../../components/legend";
import { Card, Empty, Fit, Loading, Seg, tip, TipRow } from "../../components/ui";
import { useFilters, useScope } from "../../lib/filters";
import { episodes, episodeShades, keyTime, limitFor, stationPeriodMeans, values, VAR_META } from "../../lib/kpi";
import { loadHourly } from "../../lib/dataset";
import { fmt, fmtDate, fmtMonthKey, monthShort } from "../../lib/format";
import { useBox, usePromise } from "../../lib/hooks";
import { median } from "../../lib/stats";
import { monthsInRange, trendSeries } from "../../lib/selectors";
import type { DayRange } from "../../lib/types";
import { ScopeLine, stdName, useRegionScope } from "./common";

const hh = (h: number) => `${String(h).padStart(2, "0")}.00`;

export default function TimeTab() {
  const { ds, f, range, set, selectStation } = useFilters();
  const v = f.pollutant, meta = VAR_META[v];
  const scope = useScope();
  const reg = useRegionScope();
  const lim = limitFor(ds, f.standard, v, "24h");
  const hourly = usePromise(loadHourly).data;
  const station = f.station || null;

  const trend = useMemo(() => trendSeries(ds, scope.stations, station, v, range, f.gran), [ds, scope, station, v, range, f.gran]);
  const months = useMemo(() => monthsInRange(ds, range), [ds, range]);
  const cells = useMemo(() => reg.stations.flatMap((c) => stationPeriodMeans(ds, c, v, range, "month").map((p) => ({ r: c, c: p.key, v: p.representative ? p.mean : NaN,
    tip: <><b>{c} · {fmtMonthKey(p.key, true)}</b><TipRow k="Rata-rata bulanan" v={p.representative ? `${fmt(p.mean)} ${meta.unit}` : "tidak representatif"} /><TipRow k="Hari dengan data" v={`${p.n}/${p.days}`} /><div className="tt-sub">Klik sel untuk memfokuskan periode ke bulan ini</div></> }))), [ds, reg, v, range, meta.unit]);
  const rowOrder = useMemo(() => [...reg.stations].sort((a, b) => median(values(ds, b, v, range)) - median(values(ds, a, v, range))), [ds, reg, v, range]);
  const maxCell = d3.max(cells, (c) => c.v) ?? 1;

  const diurnal = useMemo(() => {
    if (!hourly || !hourly.diurnal[v]) return null;
    const mIdx = hourly.months.map((k, i) => (months.includes(k) ? i : -1)).filter((i) => i >= 0);
    return Array.from({ length: 24 }, (_, h) => {
      let s = 0, n = 0;
      for (const c of scope.stations) { const d = hourly.diurnal[v][c]; if (!d) continue; for (const m of mIdx) { s += d.sum[m][h]; n += d.n[m][h]; } }
      return { x: h, y: n ? s / n : NaN, n };
    });
  }, [hourly, v, months, scope]);
  const dHi = diurnal ? d3.greatest(diurnal.filter((p) => Number.isFinite(p.y)), (p) => p.y) : undefined;
  const dLo = diurnal ? d3.least(diurnal.filter((p) => Number.isFinite(p.y)), (p) => p.y) : undefined;

  const eps = useMemo(() => (lim !== null ? reg.stations.flatMap((c) => episodes(ds, c, v, lim, range, ds.meta.rules.episodeMinDays)) : []), [ds, reg, v, lim, range]);
  const focusMonth = (key: string) => {
    const m = ds.cal.monthKeys.indexOf(key);
    set({ from: ds.cal.iso(ds.cal.monthStart[m]), to: ds.cal.iso(ds.cal.monthStart[m] + ds.cal.monthLen[m] - 1), gran: "day" });
  };
  const granLabel = f.gran === "day" ? "harian" : f.gran === "week" ? "mingguan" : "bulanan";

  return (
    <div className="tabgrid tabgrid--time">
      <Card className="g-a" title={`Tren ${granLabel} ${meta.short}`} sub={`${station ? `Stasiun ${station}` : "Median antarstasiun, pita 50% stasiun di tengah"} · ${meta.unit}`}
        actions={<Seg size="sm" label="Granularitas" value={f.gran} onChange={(gran) => set({ gran })} options={[{ v: "day", l: "Hari" }, { v: "week", l: "Minggu" }, { v: "month", l: "Bulan" }]} />}>
        <ScopeLine n={scope.stations.length} extra="arsiran: Agu–Okt, penanda bulan, bukan bukti kebakaran" />
        {!trend.some((p) => Number.isFinite(p.value)) ? <Empty /> : (
          <Fit>{(_, h) => <LineChart label={`Tren ${meta.short}`} unit={meta.unit} height={h} shades={episodeShades(ds, range)} animateKey={`${v}-${f.gran}-${station}-${range.from}-${range.to}-${scope.stations.length}`}
            refLines={lim !== null && f.gran === "day" ? [{ y: lim, label: `Baku 24 jam ${fmt(lim, 0)}`, color: "var(--coral)" }] : []}
            series={[{ id: "t", label: station ?? "Median antarstasiun", color: "var(--c-pm25)", band: !station, width: f.gran === "day" ? 1.2 : 2.2, points: trend.map((p) => ({ x: keyTime(p.key), y: p.value, lo: p.q1, hi: p.q3, n: station ? undefined : p.n })) }]} />}</Fit>
        )}
      </Card>

      <Card className="g-b" title="Kalender stasiun × bulan" sub={`Rata-rata bulanan · warna relatif terhadap baku${lim !== null ? ` ${fmt(lim, 0)}` : ""} · sel kosong: data < 75%`}>
        {!cells.length ? <Empty /> : (
          <Fit>{(_, h) => (
            <div className="scrollbody scrollbody--x">
              <Heatmap label="Rata-rata bulanan per stasiun" rows={rowOrder} cols={months} cells={cells} color={seqColor(maxCell, lim)}
                colLabel={(c) => (c.endsWith("-01") ? c.slice(0, 4) : monthShort(+c.slice(5, 7)))} cellH={Math.max(12, Math.min(22, (h - 50) / Math.max(1, rowOrder.length)))}
                onRowClick={(c) => selectStation(c)} onCellClick={(_, c) => focusMonth(c)} minCellW={11} />
            </div>
          )}</Fit>
        )}
      </Card>

      <Card className="g-c" title={dHi && dLo ? `Jam harian: puncak ${hh(dHi.x)}, terendah ${hh(dLo.x)}` : "Profil jam harian"} sub={`Rata-rata per jam waktu lokal · ${meta.unit} · per bulan penuh`}>
        {!hourly ? <Loading label="Memuat data jam…" /> : !diurnal ? <Empty title="Profil jam tersedia untuk PM2.5, PM10, NO₂, dan O₃" /> : (
          <Fit>{(_, h) => <LineChart label="Profil jam harian" xType="linear" xFormat={(x) => hh(x)} unit={meta.unit} height={h} animateKey={`${v}-${months.length}-${scope.stations.length}`}
            series={[{ id: "d", label: "Rata-rata", color: "var(--c-pm10)", width: 2.4, points: diurnal }]} />}</Fit>
        )}
      </Card>

      <Card className="g-d" title={lim !== null ? `${eps.length} episode di atas ${fmt(lim, 0)} µg/m³` : "Episode"} sub={`${ds.meta.rules.episodeMinDays}+ hari berturut-turut di atas baku 24 jam ${stdName(f.standard)}`}>
        {lim === null ? <Empty title={`Tidak ada baku 24 jam untuk ${meta.short}`}>Pilih PM2.5, PM10, SO₂, atau NO₂.</Empty>
          : !eps.length ? <Empty title="Tidak ada episode dalam filter ini" />
          : <div className="scrollbody"><EpisodeTimeline eps={eps} range={range} order={rowOrder} unit={meta.unit} onSelect={(c) => selectStation(c)} /></div>}
      </Card>
    </div>
  );
}

function EpisodeTimeline({ eps, range, order, unit, onSelect }: { eps: { code: string; from: number; to: number; days: number; peak: number; mean: number }[]; range: DayRange; order: string[]; unit: string; onSelect: (c: string) => void }) {
  const { ds } = useFilters();
  const [ref, b] = useBox<HTMLDivElement>();
  const w = b.w;
  const rows = order.filter((c) => eps.some((e) => e.code === c));
  const rowH = 20, ml = 62, h = rows.length * rowH + 30;
  const x = d3.scaleUtc().domain([ds.cal.date(range.from), ds.cal.date(range.to + 1)]).range([ml, Math.max(ml + 100, w - 10)]);
  const maxPeak = d3.max(eps, (e) => e.peak) ?? 1;
  return (
    <div ref={ref} className="chart" style={{ height: h }} role="img" aria-label="Garis waktu episode per stasiun">
      {w > 0 && <svg width={w} height={h}>
        <g className="axis">{x.ticks(Math.max(2, Math.floor(w / 110))).map((t) => <g key={+t} transform={`translate(${x(t)},0)`}><line className="gridline" y1={14} y2={h} /><text y={10} textAnchor="middle">{d3.utcFormat("%b %y")(t)}</text></g>)}</g>
        {rows.map((c, i) => (
          <g key={c} transform={`translate(0,${20 + i * rowH})`}>
            <text x={ml - 8} y={rowH / 2 - 2} dy="0.32em" textAnchor="end" fontSize={11} fill={C.text} style={{ cursor: "pointer" }} onClick={() => onSelect(c)}>{c}</text>
            <line x1={ml} x2={x.range()[1]} y1={rowH / 2 - 2} y2={rowH / 2 - 2} stroke="var(--line)" />
            {eps.filter((e) => e.code === c).map((e) => (
              <rect key={e.from} className="fade-in" x={x(ds.cal.date(e.from))} width={Math.max(2.5, x(ds.cal.date(e.to + 1)) - x(ds.cal.date(e.from)))} y={3} height={rowH - 9} rx={2}
                fill={`rgba(217,119,112,${0.4 + 0.6 * Math.min(1, e.peak / maxPeak)})`}
                onPointerMove={(ev) => tip.show(ev, <><b>{c} · {e.days} hari</b><TipRow k="Mulai" v={fmtDate(ds.cal.iso(e.from))} /><TipRow k="Selesai" v={fmtDate(ds.cal.iso(e.to))} /><TipRow k="Puncak harian" v={`${fmt(e.peak)} ${unit}`} /><TipRow k="Rata-rata" v={`${fmt(e.mean)} ${unit}`} /></>)} onPointerLeave={() => tip.hide()} />
            ))}
          </g>
        ))}
      </svg>}
    </div>
  );
}
