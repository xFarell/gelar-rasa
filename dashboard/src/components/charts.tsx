import * as d3 from "d3";
import { useMemo, useState } from "react";
import { useSize } from "../lib/hooks";
import { fmt, fmtAuto } from "../lib/format";
import { quantileSorted } from "../lib/stats";
import { tip, TipRow } from "./ui";

export const C = { teal: "var(--teal)", sky: "var(--c-pm10)", lime: "var(--green-deep)", amber: "var(--amber)", coral: "var(--coral)", muted: "var(--muted)", faint: "var(--faint)", text: "var(--text)", pm25: "var(--c-pm25)", pm10: "var(--c-pm10)" };
/** Warna kategori konsisten di seluruh dashboard (stasiun/series pembanding). */
export const SERIES_COLORS = ["#285440", "#2e6f8a", "#9a6420", "#368c85", "#8a5a8f", "#b5534c", "#5f9a70", "#6b7f2e"];

function Frame({ height, children, label }: { height: number; children: (w: number) => React.ReactNode; label: string }) {
  const [ref, w] = useSize<HTMLDivElement>();
  return <div ref={ref} className="chart" style={{ height }} role="img" aria-label={label}>{w > 0 && children(w)}</div>;
}

function YAxis({ y, width, ticks = 5, format = fmtAuto, label }: { y: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>; width: number; ticks?: number; format?: (v: number) => string; label?: string }) {
  const tv = (y as d3.ScaleLinear<number, number>).ticks(ticks);
  return (
    <g className="axis" aria-hidden>
      {tv.map((t) => (
        <g key={t} transform={`translate(0,${y(t)})`}>
          <line className="gridline" x2={width} />
          <text x={-8} dy="0.32em" textAnchor="end">{format(t)}</text>
        </g>
      ))}
      {label && <text x={-8} y={-12} textAnchor="end" style={{ fontWeight: 700 }}>{label}</text>}
    </g>
  );
}

// ---------------------------------------------------------------------
// Deret waktu
// ---------------------------------------------------------------------
export interface LinePoint { x: number; y: number; lo?: number; hi?: number; label?: string; n?: number }
export interface LineSeries { id: string; label: string; color: string; points: LinePoint[]; dash?: boolean; band?: boolean; width?: number }

export function LineChart({ series, height = 320, xType = "time", yLabel, unit = "", refLines = [], shades = [], xFormat, yMin, label, animateKey }: {
  series: LineSeries[]; height?: number; xType?: "time" | "linear"; yLabel?: string; unit?: string;
  refLines?: { y: number; label: string; color: string }[]; shades?: { x0: number; x1: number; label?: string }[];
  xFormat?: (v: number) => string; yMin?: number; label: string; animateKey?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <Frame height={height} label={label}>{(w) => {
      const m = { t: 24, r: 16, b: 30, l: 48 };
      const iw = w - m.l - m.r, ih = height - m.t - m.b;
      const xs = series.flatMap((s) => s.points.map((p) => p.x));
      if (!xs.length) return null;
      const ys = series.flatMap((s) => s.points.flatMap((p) => [p.y, s.band ? p.hi ?? p.y : p.y]).filter(Number.isFinite)).concat(refLines.map((r) => r.y));
      const x = (xType === "time" ? d3.scaleUtc().domain(d3.extent(xs) as [number, number]) : d3.scaleLinear().domain(d3.extent(xs) as [number, number])).range([0, iw]) as d3.ScaleLinear<number, number>;
      const y = d3.scaleLinear().domain([yMin ?? Math.min(0, d3.min(ys) ?? 0), (d3.max(ys) ?? 1) * 1.08]).nice().range([ih, 0]);
      const line = d3.line<LinePoint>().defined((p) => Number.isFinite(p.y)).x((p) => x(p.x)).y((p) => y(p.y)).curve(d3.curveMonotoneX);
      const area = d3.area<LinePoint>().defined((p) => Number.isFinite(p.lo!) && Number.isFinite(p.hi!)).x((p) => x(p.x)).y0((p) => y(p.lo!)).y1((p) => y(p.hi!)).curve(d3.curveMonotoneX);
      const xt = (x as d3.ScaleLinear<number, number>).ticks(Math.max(2, Math.floor(iw / 110)));
      const fx = xFormat ?? ((v: number) => xType === "time" ? d3.utcFormat("%b %y")(new Date(v)) : String(v));
      const allX = [...new Set(xs)].sort((a, b) => a - b);
      const onMove = (e: React.PointerEvent<SVGRectElement>) => {
        const px = e.nativeEvent.offsetX - m.l;
        const xv = x.invert(px) as unknown as number;
        const xi = allX[Math.max(0, Math.min(allX.length - 1, d3.bisectCenter(allX, +xv)))];
        setHover(xi);
        tip.show(e, <>
          <b>{fx(xi)}</b>
          {series.map((s) => { const p = s.points.find((q) => q.x === xi); return p && <TipRow key={s.id} k={<><i style={{ display: "inline-block", width: 8, height: 8, background: s.color, borderRadius: 2, marginRight: 6 }} />{s.label}</>} v={`${fmt(p.y, 1)} ${unit}`} />; })}
          {series[0]?.points.find((q) => q.x === xi)?.n !== undefined && <TipRow k="Stasiun" v={series[0].points.find((q) => q.x === xi)!.n} />}
        </>);
      };
      return (
        <svg width={w} height={height}>
          <g transform={`translate(${m.l},${m.t})`}>
            {shades.map((s, i) => <rect key={i} x={x(s.x0)} width={Math.max(1, x(s.x1) - x(s.x0))} y={0} height={ih} fill="var(--c-shade)" />)}
            <YAxis y={y} width={iw} label={yLabel} ticks={Math.max(2, Math.min(5, Math.floor(ih / 32)))} />
            <g className="axis" transform={`translate(0,${ih})`} aria-hidden>
              {xt.map((t) => <text key={+t} x={x(t)} y={18} textAnchor="middle">{fx(+t)}</text>)}
            </g>
            {refLines.map((r) => (
              <g key={r.label}>
                <line x1={0} x2={iw} y1={y(r.y)} y2={y(r.y)} stroke={r.color} strokeDasharray="5 4" strokeWidth={1.4} />
                <text x={iw} y={y(r.y) - 6} textAnchor="end" fill={r.color === "var(--coral)" ? "var(--coral-ink)" : r.color} fontSize={11} fontWeight={700}>{r.label}</text>
              </g>
            ))}
            <g key={animateKey}>
              {series.filter((s) => s.band).map((s) => <path key={s.id + "b"} className="fade-in" d={area(s.points) ?? ""} fill={s.color} opacity={0.14} />)}
              {series.map((s) => <path key={s.id} className="draw-line" pathLength={1} d={line(s.points) ?? ""} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash ? "4 4" : undefined} style={s.dash ? { animation: "none" } : undefined} />)}
            </g>
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={ih} stroke="var(--line-strong)" />}
            {hover !== null && series.map((s) => { const p = s.points.find((q) => q.x === hover); return p && Number.isFinite(p.y) && <circle key={s.id} cx={x(p.x)} cy={y(p.y)} r={4} fill={s.color} stroke="var(--card)" strokeWidth={2} />; })}
            <rect width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => { setHover(null); tip.hide(); }} />
          </g>
        </svg>
      );
    }}</Frame>
  );
}

// ---------------------------------------------------------------------
// Peringkat median ↔ P95 per stasiun (dumbbell)
// ---------------------------------------------------------------------
export interface RankRow { code: string; label: string; median: number; p95: number; n: number; twin?: boolean; note?: string }
export function RankDumbbell({ rows, sortBy, limit, limitLabel, unit, onSelect, highlight = [], label }: {
  rows: RankRow[]; sortBy: "median" | "p95"; limit?: number | null; limitLabel?: string; unit: string;
  onSelect?: (code: string) => void; highlight?: string[]; label: string;
}) {
  const sorted = useMemo(() => [...rows].filter((r) => Number.isFinite(r.median)).sort((a, b) => b[sortBy] - a[sortBy]), [rows, sortBy]);
  const rowH = 26, height = sorted.length * rowH + 44;
  return (
    <Frame height={height} label={label}>{(w) => {
      const m = { t: 26, r: 96, b: 18, l: Math.min(110, w * 0.28) };
      const iw = w - m.l - m.r;
      const max = d3.max(sorted, (r) => r.p95) ?? 1;
      const x = d3.scaleLinear().domain([0, Math.max(max, limit ?? 0) * 1.05]).nice().range([0, iw]);
      return (
        <svg width={w} height={height}>
          <g transform={`translate(${m.l},${m.t})`}>
            <g className="axis" aria-hidden>
              {x.ticks(Math.max(2, Math.floor(iw / 90))).map((t) => <g key={t} transform={`translate(${x(t)},0)`}><line className="gridline" y2={sorted.length * rowH} /><text y={-10} textAnchor="middle">{fmtAuto(t)}</text></g>)}
            </g>
            {limit != null && <g><line x1={x(limit)} x2={x(limit)} y1={-4} y2={sorted.length * rowH} stroke={C.coral} strokeDasharray="5 4" /><text x={x(limit) + 4} y={sorted.length * rowH + 14} fill="var(--coral-ink)" fontSize={11} fontWeight={700}>{limitLabel}</text></g>}
            {sorted.map((r, i) => {
              const yy = i * rowH + rowH / 2;
              const hi = highlight.includes(r.code);
              const over = limit != null && r.p95 > limit;
              return (
                <g key={r.code} transform={`translate(0,${yy})`} style={{ cursor: onSelect ? "pointer" : undefined }} tabIndex={onSelect ? 0 : undefined}
                  role={onSelect ? "button" : undefined} aria-label={`${r.code}: median ${fmt(r.median)}, P95 ${fmt(r.p95)} ${unit}`}
                  onClick={() => onSelect?.(r.code)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect?.(r.code)}
                  onPointerMove={(e) => tip.show(e, <><b>{r.code} · {r.label}</b><TipRow k="Median harian" v={`${fmt(r.median)} ${unit}`} /><TipRow k="P95 harian" v={`${fmt(r.p95)} ${unit}`} /><TipRow k="Hari dengan data" v={r.n} />{r.note && <div className="faint" style={{ marginTop: 4 }}>{r.note}</div>}</>)}
                  onPointerLeave={() => tip.hide()}>
                  <rect x={-m.l} y={-rowH / 2} width={w} height={rowH} fill={hi ? "rgba(73,123,91,0.10)" : "transparent"} />
                  <text x={-10} dy="0.32em" textAnchor="end" fontSize={12} fill={hi ? C.lime : C.text} fontWeight={hi ? 700 : 500}>{r.code}{r.twin ? " ◇" : ""}</text>
                  <line className="bar-grow" x1={x(r.median)} x2={x(r.p95)} stroke="var(--line-strong)" strokeWidth={2} style={{ animationDelay: `${i * 25}ms` }} />
                  <circle cx={x(r.median)} r={5} fill={C.teal} className="fade-in" style={{ animationDelay: `${i * 25}ms` }} />
                  <circle cx={x(r.p95)} r={5} fill={over ? C.coral : C.amber} className="fade-in" style={{ animationDelay: `${i * 25 + 120}ms` }} />
                  <text x={x(r.p95) + 9} dy="0.32em" fontSize={11} className="num"><tspan fill="var(--teal-ink)" fontWeight={sortBy === "median" ? 700 : 400}>{fmt(r.median, 1)}</tspan><tspan fill={C.faint}> | </tspan><tspan fill={over ? "var(--coral-ink)" : "var(--amber-ink)"} fontWeight={sortBy === "p95" ? 700 : 400}>{fmt(r.p95, 1)}</tspan></text>
                </g>
              );
            })}
          </g>
        </svg>
      );
    }}</Frame>
  );
}

// ---------------------------------------------------------------------
// Box plot horizontal (kotak = IQR, garis = P5–P95, titik = median)
// ---------------------------------------------------------------------
export interface BoxRow { code: string; label: string; p5: number; q1: number; median: number; q3: number; p95: number; max: number; n: number }
export function BoxPlot({ rows, unit, limit, limitLabel, label, onSelect }: { rows: BoxRow[]; unit: string; limit?: number | null; limitLabel?: string; label: string; onSelect?: (c: string) => void }) {
  const rowH = 24, height = rows.length * rowH + 44;
  return (
    <Frame height={height} label={label}>{(w) => {
      const m = { t: 26, r: 20, b: 18, l: Math.min(112, Math.max(64, 8 + 6.6 * Math.max(...rows.map((r) => r.code.length)))) };
      const iw = w - m.l - m.r;
      const x = d3.scaleLinear().domain([0, Math.max(d3.max(rows, (r) => r.p95) ?? 1, limit ?? 0) * 1.06]).nice().range([0, iw]);
      return (
        <svg width={w} height={height}>
          <g transform={`translate(${m.l},${m.t})`}>
            <g className="axis" aria-hidden>{x.ticks(Math.max(2, Math.floor(iw / 90))).map((t) => <g key={t} transform={`translate(${x(t)},0)`}><line className="gridline" y2={rows.length * rowH} /><text y={-10} textAnchor="middle">{fmtAuto(t)}</text></g>)}</g>
            {limit != null && <g><line x1={x(limit)} x2={x(limit)} y1={-4} y2={rows.length * rowH} stroke={C.coral} strokeDasharray="5 4" /><text x={x(limit) + 4} y={rows.length * rowH + 14} fill="var(--coral-ink)" fontSize={11} fontWeight={700}>{limitLabel}</text></g>}
            {rows.map((r, i) => (
              <g key={r.code} transform={`translate(0,${i * rowH + rowH / 2})`} onClick={() => onSelect?.(r.code)} style={{ cursor: onSelect ? "pointer" : undefined }}
                onPointerMove={(e) => tip.show(e, <><b>{r.code} · {r.label}</b><TipRow k="P5" v={fmt(r.p5)} /><TipRow k="Q1" v={fmt(r.q1)} /><TipRow k="Median" v={fmt(r.median)} /><TipRow k="Q3" v={fmt(r.q3)} /><TipRow k="P95" v={fmt(r.p95)} /><TipRow k="Maks" v={fmt(r.max)} /><TipRow k="Hari dengan data" v={r.n} /><div className="faint">{unit}</div></>)}
                onPointerLeave={() => tip.hide()}>
                <rect x={-m.l} y={-rowH / 2} width={w} height={rowH} fill="transparent" />
                <text x={-10} dy="0.32em" textAnchor="end" fontSize={12} fill={C.text}>{r.code}</text>
                <line x1={x(r.p5)} x2={x(r.p95)} stroke="var(--muted)" strokeWidth={1} className="bar-grow" style={{ animationDelay: `${i * 20}ms` }} />
                <rect x={x(r.q1)} y={-7} width={Math.max(1.5, x(r.q3) - x(r.q1))} height={14} rx={3} fill={limit != null && r.median > limit ? "rgba(217,119,112,0.32)" : "rgba(73,123,91,0.28)"} stroke={limit != null && r.median > limit ? C.coral : C.teal} className="bar-grow" style={{ animationDelay: `${i * 20}ms` }} />
                <line x1={x(r.median)} x2={x(r.median)} y1={-8} y2={8} stroke={C.text} strokeWidth={2} />
              </g>
            ))}
          </g>
        </svg>
      );
    }}</Frame>
  );
}

// ---------------------------------------------------------------------
// Histogram
// ---------------------------------------------------------------------
export function Histogram({ values, unit, limits = [], label, color = C.teal, height = 260, compare }: {
  values: Float64Array; unit: string; limits?: { v: number; label: string; color: string }[]; label: string; color?: string; height?: number;
  compare?: { values: Float64Array; label: string; color: string };
}) {
  return (
    <Frame height={height} label={label}>{(w) => {
      const m = { t: 20, r: 14, b: 32, l: 44 };
      const iw = w - m.l - m.r, ih = height - m.t - m.b;
      const all = compare ? Float64Array.from([...values, ...compare.values]) : values;
      if (!all.length) return null;
      const hiQ = quantileSorted(Float64Array.from(all).sort(), 0.995) || 1;
      const x = d3.scaleLinear().domain([0, Math.max(hiQ, ...limits.map((l) => l.v * 1.1))]).nice().range([0, iw]);
      const bin = d3.bin().domain(x.domain() as [number, number]).thresholds(x.ticks(Math.min(48, Math.floor(iw / 12))));
      const b1 = bin(Array.from(values).map((v) => Math.min(v, x.domain()[1] - 1e-9)));
      const b2 = compare ? bin(Array.from(compare.values).map((v) => Math.min(v, x.domain()[1] - 1e-9))) : [];
      const pct = (b: d3.Bin<number, number>, n: number) => (100 * b.length) / Math.max(1, n);
      const y = d3.scaleLinear().domain([0, Math.max(d3.max(b1, (b) => pct(b, values.length)) ?? 1, d3.max(b2, (b) => pct(b, compare!.values.length)) ?? 0)]).nice().range([ih, 0]);
      return (
        <svg width={w} height={height}>
          <g transform={`translate(${m.l},${m.t})`}>
            <YAxis y={y} width={iw} ticks={4} format={(v) => `${fmt(v, 0)}%`} />
            {b1.map((b, i) => <rect key={i} className="col-grow" style={{ animationDelay: `${i * 8}ms` }} x={x(b.x0!) + 0.5} width={Math.max(0, x(b.x1!) - x(b.x0!) - 1)} y={y(pct(b, values.length))} height={ih - y(pct(b, values.length))} fill={color} opacity={compare ? 0.55 : 0.85}
              onPointerMove={(e) => tip.show(e, <><b>{fmt(b.x0!, 0)}–{fmt(b.x1!, 0)} {unit}</b><TipRow k="Stasiun-hari" v={b.length} /><TipRow k="Porsi" v={`${fmt(pct(b, values.length))}%`} /></>)} onPointerLeave={() => tip.hide()} />)}
            {compare && <path d={d3.line<d3.Bin<number, number>>().x((b) => x((b.x0! + b.x1!) / 2)).y((b) => y(pct(b, compare.values.length))).curve(d3.curveStep)(b2) ?? ""} fill="none" stroke={compare.color} strokeWidth={2} className="draw-line" pathLength={1} />}
            {limits.map((l) => <g key={l.label}><line x1={x(l.v)} x2={x(l.v)} y1={0} y2={ih} stroke={l.color} strokeDasharray="5 4" /><text x={x(l.v) + 4} y={10} fill={l.color} fontSize={11} fontWeight={700}>{l.label}</text></g>)}
            <g className="axis" transform={`translate(0,${ih})`} aria-hidden>{x.ticks(Math.floor(iw / 70)).map((t) => <text key={t} x={x(t)} y={18} textAnchor="middle">{fmtAuto(t)}</text>)}<text x={iw} y={30} textAnchor="end">{unit}</text></g>
          </g>
        </svg>
      );
    }}</Frame>
  );
}

// ---------------------------------------------------------------------
// Heatmap baris × kolom
// ---------------------------------------------------------------------
export interface HeatCell { r: string; c: string; v: number; label?: string; tip?: React.ReactNode }
export function Heatmap({ rows, cols, cells, color, colLabel = (c) => c, rowLabel = (r) => r, cellH = 22, label, showValues = false, valueFmt = (v: number) => fmt(v, 0), onRowClick, onCellClick, minCellW = 10, textColor = () => "#29382f" }: {
  rows: string[]; cols: string[]; cells: HeatCell[]; color: (v: number) => string; colLabel?: (c: string, i: number) => string;
  rowLabel?: (r: string) => string; cellH?: number; label: string; showValues?: boolean; valueFmt?: (v: number) => string; onRowClick?: (r: string) => void; onCellClick?: (r: string, c: string) => void; minCellW?: number; textColor?: (v: number) => string;
}) {
  const map = useMemo(() => new Map(cells.map((c) => [`${c.r}|${c.c}`, c])), [cells]);
  const height = rows.length * cellH + 46;
  return (
    <Frame height={height} label={label}>{(w) => {
      const m = { t: 40, r: 6, b: 6, l: 72 };
      const cw = Math.max(minCellW, (w - m.l - m.r) / cols.length);
      const every = Math.max(1, Math.ceil(46 / cw));
      return (
        <svg width={Math.max(w, m.l + cw * cols.length + m.r)} height={height}>
          <g transform={`translate(${m.l},${m.t})`}>
            <g className="axis" aria-hidden>{cols.map((c, i) => i % every === 0 && <text key={c} x={i * cw + cw / 2} y={-10} textAnchor="middle">{colLabel(c, i)}</text>)}</g>
            {rows.map((r, ri) => (
              <g key={r} transform={`translate(0,${ri * cellH})`}>
                <text onClick={() => onRowClick?.(r)} style={{ cursor: onRowClick ? "pointer" : undefined }} x={-8} y={cellH / 2} dy="0.32em" textAnchor="end" fontSize={11.5} fill={C.text}>{rowLabel(r)}</text>
                {cols.map((c, ci) => {
                  const cell = map.get(`${r}|${c}`);
                  const ok = cell && Number.isFinite(cell.v);
                  return (
                    <g key={c}>
                      <rect className="fade-in" x={ci * cw + 0.5} y={0.5} width={cw - 1} height={cellH - 1} rx={2}
                        fill={ok ? color(cell!.v) : "rgba(131,144,135,0.06)"} stroke={ok ? "none" : "rgba(131,144,135,0.22)"}
                        onClick={() => (onCellClick ? onCellClick(r, c) : onRowClick?.(r))} style={{ animationDelay: `${(ri + ci) * 6}ms`, cursor: onCellClick || onRowClick ? "pointer" : undefined }}
                        onPointerMove={(e) => tip.show(e, cell?.tip ?? <><b>{rowLabel(r)} · {colLabel(c, ci)}</b><div>{ok ? valueFmt(cell!.v) : "Tidak ada data"}</div></>)} onPointerLeave={() => tip.hide()} />
                      {showValues && ok && cw > 26 && <text x={ci * cw + cw / 2} y={cellH / 2} dy="0.32em" textAnchor="middle" fontSize={10.5} fill={textColor(cell!.v)} fontWeight={700} pointerEvents="none">{cell!.label ?? valueFmt(cell!.v)}</text>}
                    </g>
                  );
                })}
              </g>
            ))}
          </g>
        </svg>
      );
    }}</Frame>
  );
}

// ---------------------------------------------------------------------
// Kolom vertikal sederhana (profil bulan kalender, dsb.)
// ---------------------------------------------------------------------
export function Columns({ data, unit, height = 280, label, highlight = () => false, refLine, valueDigits = 1 }: {
  data: { key: string; label: string; v: number; note?: string }[]; unit: string; height?: number; label: string;
  highlight?: (k: string) => boolean; refLine?: { v: number; label: string; color: string }; valueDigits?: number;
}) {
  return (
    <Frame height={height} label={label}>{(w) => {
      const m = { t: 26, r: 8, b: 28, l: 8 };
      const iw = w - m.l - m.r, ih = height - m.t - m.b;
      const x = d3.scaleBand().domain(data.map((d) => d.key)).range([0, iw]).padding(0.22);
      const y = d3.scaleLinear().domain([0, Math.max(d3.max(data, (d) => d.v) ?? 1, refLine?.v ?? 0) * 1.12]).range([ih, 0]);
      return (
        <svg width={w} height={height}>
          <g transform={`translate(${m.l},${m.t})`}>
            {data.map((d, i) => Number.isFinite(d.v) && (
              <g key={d.key} onPointerMove={(e) => tip.show(e, <><b>{d.label}</b><div>{fmt(d.v, valueDigits)} {unit}</div>{d.note && <div className="faint">{d.note}</div>}</>)} onPointerLeave={() => tip.hide()}>
                <rect className="col-grow" style={{ animationDelay: `${i * 40}ms` }} x={x(d.key)} width={x.bandwidth()} y={y(d.v)} height={ih - y(d.v)} rx={3} fill={highlight(d.key) ? C.teal : "rgba(131,144,135,0.35)"} />
                <text x={x(d.key)! + x.bandwidth() / 2} y={y(d.v) - 7} textAnchor="middle" fontSize={x.bandwidth() > 34 ? 11 : 9.5} fill={highlight(d.key) ? C.text : C.muted} fontWeight={highlight(d.key) ? 700 : 500} className="num">{fmt(d.v, valueDigits)}</text>
              </g>
            ))}
            {refLine && <g><line x1={0} x2={iw} y1={y(refLine.v)} y2={y(refLine.v)} stroke={refLine.color} strokeDasharray="5 4" /><text x={iw} y={y(refLine.v) - 5} textAnchor="end" fontSize={11} fill={refLine.color} fontWeight={700}>{refLine.label}</text></g>}
            <line x1={0} x2={iw} y1={ih} y2={ih} stroke="var(--line-strong)" />
            <g className="axis">{data.map((d) => <text key={d.key} x={x(d.key)! + x.bandwidth() / 2} y={ih + 18} textAnchor="middle">{d.label}</text>)}</g>
          </g>
        </svg>
      );
    }}</Frame>
  );
}

// ---------------------------------------------------------------------
// Scatter kepadatan (bin 2D) + garis median per desil x
// ---------------------------------------------------------------------
export function DensityScatter({ x: xs, y: ys, xLabel, yLabel, height = 300, label, color = C.sky }: { x: Float64Array; y: Float64Array; xLabel: string; yLabel: string; height?: number; label: string; color?: string }) {
  return (
    <Frame height={height} label={label}>{(w) => {
      const m = { t: 16, r: 12, b: 40, l: 48 };
      const iw = w - m.l - m.r, ih = height - m.t - m.b;
      if (xs.length < 5) return null;
      const sx = Float64Array.from(xs).sort(), sy = Float64Array.from(ys).sort();
      const x = d3.scaleLinear().domain([quantileSorted(sx, 0.002), quantileSorted(sx, 0.998)]).nice().range([0, iw]);
      const y = d3.scaleLinear().domain([Math.min(0, quantileSorted(sy, 0.002)), quantileSorted(sy, 0.995)]).nice().range([ih, 0]);
      const nx = Math.max(10, Math.floor(iw / 9)), ny = Math.max(8, Math.floor(ih / 9));
      const grid = new Uint32Array(nx * ny);
      for (let i = 0; i < xs.length; i++) {
        const gx = Math.floor((x(xs[i]) / iw) * nx), gy = Math.floor((y(ys[i]) / ih) * ny);
        if (gx >= 0 && gx < nx && gy >= 0 && gy < ny) grid[gy * nx + gx]++;
      }
      const maxC = d3.max(grid) ?? 1;
      const op = d3.scaleLog().domain([1, maxC]).range([0.12, 1]);
      const order = d3.range(xs.length).sort((a, b) => xs[a] - xs[b]);
      const k = 12, med: [number, number][] = [];
      for (let q = 0; q < k; q++) {
        const seg = order.slice(Math.floor((q * order.length) / k), Math.floor(((q + 1) * order.length) / k));
        if (seg.length < 10) continue;
        med.push([d3.median(seg, (i) => xs[i])!, d3.median(seg, (i) => ys[i])!]);
      }
      return (
        <svg width={w} height={height}>
          <g transform={`translate(${m.l},${m.t})`}>
            <YAxis y={y} width={iw} ticks={5} />
            {Array.from(grid).map((c, i) => c > 0 && <rect key={i} className="fade-in" x={(i % nx) * (iw / nx)} y={Math.floor(i / nx) * (ih / ny)} width={iw / nx - 0.5} height={ih / ny - 0.5} fill={color} opacity={op(c)} />)}
            <path className="draw-line" pathLength={1} d={d3.line().curve(d3.curveMonotoneX)(med.map(([a, b]) => [x(a), y(b)])) ?? ""} fill="none" stroke={C.lime} strokeWidth={2.5} />
            <g className="axis" transform={`translate(0,${ih})`}>{x.ticks(Math.floor(iw / 70)).map((t) => <text key={t} x={x(t)} y={18} textAnchor="middle">{fmtAuto(t)}</text>)}<text x={iw / 2} y={34} textAnchor="middle" style={{ fontWeight: 700 }}>{xLabel}</text></g>
            <text className="axis" x={0} y={-4} fontSize={11} fill={C.faint} fontWeight={700}>{yLabel}</text>
          </g>
        </svg>
      );
    }}</Frame>
  );
}

// ---------------------------------------------------------------------
// Wind rose (16 sektor × kelas kecepatan)
// ---------------------------------------------------------------------
const SECTORS = ["U", "UTL", "TL", "TTL", "T", "TTG", "TG", "STG", "S", "SBD", "BD", "BBD", "B", "BBL", "BL", "UBL"];
export function WindRose({ counts, bins, label, size = 320 }: { counts: number[][]; bins: (number | null)[]; label: string; size?: number }) {
  const total = d3.sum(counts.flat());
  const colors = ROSE_COLORS;
  return (
    <Frame height={size} label={label}>{(w) => {
      const s = Math.min(w, size), r0 = 18, R = s / 2 - 26;
      const sectorTotals = counts.map((c) => d3.sum(c));
      const maxPct = (100 * (d3.max(sectorTotals) ?? 1)) / Math.max(1, total);
      const rr = d3.scaleSqrt().domain([0, maxPct]).range([r0, R]);
      const arc = d3.arc<{ a0: number; a1: number; i0: number; i1: number }>().innerRadius((d) => rr(d.i0)).outerRadius((d) => rr(d.i1)).startAngle((d) => d.a0).endAngle((d) => d.a1).padAngle(0.02);
      const step = (2 * Math.PI) / 16;
      const rings = rr.ticks(3).filter((t) => t > 0);
      if (!total) return null;
      return (
        <svg width={w} height={s}>
          <g transform={`translate(${w / 2},${s / 2})`}>
            {rings.map((t) => <g key={t}><circle r={rr(t)} fill="none" stroke="var(--line)" /><text y={-rr(t) - 2} textAnchor="middle" fontSize={9.5} fill={C.faint}>{fmt(t, 0)}%</text></g>)}
            {counts.map((c, si) => {
              let acc = 0;
              return c.map((v, bi) => {
                const p0 = (100 * acc) / total; acc += v; const p1 = (100 * acc) / total;
                if (!v) return null;
                return <path key={`${si}-${bi}`} className="fade-in" style={{ animationDelay: `${si * 30}ms` }} d={arc({ a0: si * step - step / 2, a1: si * step + step / 2, i0: p0, i1: p1 }) ?? ""} fill={colors[bi % colors.length]}
                  onPointerMove={(e) => tip.show(e, <><b>Dari {SECTORS[si]}</b><TipRow k="Semua kecepatan" v={`${fmt((100 * sectorTotals[si]) / total)}%`} />{c.map((vv, bb) => <TipRow key={bb} k={binLabel(bins, bb)} v={`${fmt((100 * vv) / total)}%`} />)}</>)} onPointerLeave={() => tip.hide()} />;
              });
            })}
            {SECTORS.map((sname, i) => i % 2 === 0 && <text key={sname} x={Math.sin(i * step) * (R + 14)} y={-Math.cos(i * step) * (R + 14)} dy="0.32em" textAnchor="middle" fontSize={10.5} fill={C.muted} fontWeight={700}>{sname}</text>)}
          </g>
        </svg>
      );
    }}</Frame>
  );
}
export const binLabel = (bins: (number | null)[], i: number) => bins[i + 1] === null ? `≥ ${bins[i]} m/s` : `${bins[i]}–${bins[i + 1]} m/s`;
export const ROSE_COLORS = ["#b9dce9", "#6fb0c9", "#2e6f8a", "#285440"];

// ---------------------------------------------------------------------
// RR per lag dan forest plot
// ---------------------------------------------------------------------
export function LagChart({ rows, label, height = 260, color = C.teal }: { rows: { lag: number; rr: number; lo: number; hi: number }[]; label: string; height?: number; color?: string }) {
  return (
    <Frame height={height} label={label}>{(w) => {
      const m = { t: 20, r: 16, b: 36, l: 52 };
      const iw = w - m.l - m.r, ih = height - m.t - m.b;
      const x = d3.scalePoint<number>().domain(rows.map((r) => r.lag)).range([0, iw]).padding(0.5);
      const y = d3.scaleLinear().domain([Math.min(0.99, d3.min(rows, (r) => r.lo)!), Math.max(1.01, d3.max(rows, (r) => r.hi)!)]).nice().range([ih, 0]);
      return (
        <svg width={w} height={height}>
          <g transform={`translate(${m.l},${m.t})`}>
            <YAxis y={y} width={iw} ticks={5} format={(v) => fmt(v, 2)} />
            <line x1={0} x2={iw} y1={y(1)} y2={y(1)} stroke={C.muted} strokeDasharray="4 4" />
            <text x={iw} y={y(1) - 5} textAnchor="end" fontSize={11} fill={C.muted}>RR = 1 (tanpa asosiasi)</text>
            <path className="draw-line" pathLength={1} d={d3.line<{ lag: number; rr: number }>().x((r) => x(r.lag)!).y((r) => y(r.rr))(rows) ?? ""} fill="none" stroke={color} strokeWidth={1.5} opacity={0.6} />
            {rows.map((r, i) => (
              <g key={r.lag} className="fade-in" style={{ animationDelay: `${i * 90}ms` }} onPointerMove={(e) => tip.show(e, <><b>Lag {r.lag}</b><TipRow k="RR per 10 µg/m³" v={fmt(r.rr, 3)} /><TipRow k="IK 95%" v={`${fmt(r.lo, 3)}–${fmt(r.hi, 3)}`} /></>)} onPointerLeave={() => tip.hide()}>
                <line x1={x(r.lag)} x2={x(r.lag)} y1={y(r.lo)} y2={y(r.hi)} stroke={color} strokeWidth={2} />
                <circle cx={x(r.lag)} cy={y(r.rr)} r={5.5} fill={r.lo > 1 ? color : "var(--card)"} stroke={color} strokeWidth={2} />
              </g>
            ))}
            <g className="axis" transform={`translate(0,${ih})`}>{rows.map((r) => <text key={r.lag} x={x(r.lag)} y={18} textAnchor="middle">{r.lag}</text>)}<text x={iw / 2} y={32} textAnchor="middle" style={{ fontWeight: 700 }}>lag (hari sebelum kasus)</text></g>
          </g>
        </svg>
      );
    }}</Frame>
  );
}

export function ForestPlot({ rows, pooled, label }: { rows: { id: string; label: string; rr: number; lo: number; hi: number; note?: string }[]; pooled?: { rr: number; lo: number; hi: number; label: string }; label: string }) {
  const rowH = 22, height = (rows.length + (pooled ? 2 : 0)) * rowH + 48;
  return (
    <Frame height={height} label={label}>{(w) => {
      const m = { t: 28, r: 92, b: 20, l: 76 };
      const iw = w - m.l - m.r;
      const lo = Math.min(0.85, d3.min(rows, (r) => r.lo) ?? 0.9), hi = Math.max(1.2, d3.max(rows, (r) => r.hi) ?? 1.1);
      const x = d3.scaleLog().domain([Math.max(0.5, lo), Math.min(2.5, hi)]).range([0, iw]).clamp(true);
      const ticks = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 2].filter((t) => t >= x.domain()[0] && t <= x.domain()[1]);
      return (
        <svg width={w} height={height}>
          <g transform={`translate(${m.l},${m.t})`}>
            <g className="axis">{ticks.map((t) => <g key={t} transform={`translate(${x(t)},0)`}><line className="gridline" y2={height - m.t - m.b} /><text y={-10} textAnchor="middle">{fmt(t, 2)}</text></g>)}</g>
            <line x1={x(1)} x2={x(1)} y1={0} y2={height - m.t - m.b} stroke={C.muted} strokeDasharray="4 4" />
            {rows.map((r, i) => (
              <g key={r.id} transform={`translate(0,${i * rowH + rowH / 2})`} className="fade-in" style={{ animationDelay: `${i * 18}ms` }}
                onPointerMove={(e) => tip.show(e, <><b>{r.label}</b><TipRow k="RR" v={fmt(r.rr, 3)} /><TipRow k="IK 95%" v={`${fmt(r.lo, 3)}–${fmt(r.hi, 3)}`} />{r.note && <div className="faint">{r.note}</div>}</>)} onPointerLeave={() => tip.hide()}>
                <rect x={-m.l} y={-rowH / 2} width={w} height={rowH} fill="transparent" />
                <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill={C.text}>{r.id}</text>
                <line x1={x(r.lo)} x2={x(r.hi)} stroke="var(--muted)" />
                <rect x={x(r.rr) - 4} y={-4} width={8} height={8} fill={r.lo > 1 ? C.teal : r.hi < 1 ? C.sky : "var(--muted)"} />
                <text x={iw + 8} dy="0.32em" fontSize={10.5} fill={C.muted} className="num">{fmt(r.rr, 3)}</text>
              </g>
            ))}
            {pooled && (() => { const yy = (rows.length + 1) * rowH; const p = `M${x(pooled.lo)},${yy} L${x(pooled.rr)},${yy - 7} L${x(pooled.hi)},${yy} L${x(pooled.rr)},${yy + 7} Z`; return <g><text x={-8} y={yy} dy="0.32em" textAnchor="end" fontSize={11} fontWeight={700} fill={C.lime}>Gabungan</text><path d={p} fill={C.lime} /><text x={iw + 8} y={yy} dy="0.32em" fontSize={10.5} fill={C.lime} fontWeight={700}>{fmt(pooled.rr, 3)}</text></g>; })()}
          </g>
        </svg>
      );
    }}</Frame>
  );
}
