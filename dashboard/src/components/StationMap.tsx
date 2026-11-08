import * as d3 from "d3";
import { useMemo } from "react";
import { loadGeo } from "../lib/dataset";
import { usePromise, useReducedMotion, useSize } from "../lib/hooks";
import { tip, TipRow } from "./ui";

export interface MapPoint { code: string; lat: number; lon: number; color: string; label: string; tipRows: [string, string][]; dim?: boolean; size?: number }

const BOUNDS: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: { type: "MultiPoint", coordinates: [[94.6, -11.2], [141.2, 6.4]] } };

export function useProjection(width: number, height: number) {
  return useMemo(() => d3.geoMercator().fitExtent([[12, 12], [width - 12, height - 12]], BOUNDS), [width, height]);
}

export function StationMap({ points, onSelect, selected, links = [], label, aspect = 0.42, height }: {
  points: MapPoint[]; onSelect?: (code: string) => void; selected?: string | null; links?: [string, string][]; label: string; aspect?: number; height?: number;
}) {
  const geo = usePromise(loadGeo).data;
  const [ref, w] = useSize<HTMLDivElement>();
  const h = height ?? Math.max(240, Math.round(w * aspect));
  const proj = useProjection(w || 800, h);
  const path = useMemo(() => d3.geoPath(proj), [proj]);
  const reduced = useReducedMotion();
  const pos = useMemo(() => new Map(points.map((p) => [p.code, proj([p.lon, p.lat])!])), [points, proj]);
  // Titik yang bertumpuk (mis. tiga stasiun Jakarta) digeser sedikit agar masing-masing dapat dipilih;
  // garis tipis menunjuk ke koordinat asli. Posisi data tidak diubah.
  const shown = useMemo(() => {
    const pts = points.map((p) => { const [x, y] = pos.get(p.code)!; return { code: p.code, x, y, x0: x, y0: y, r: p.size ?? 6 }; });
    for (let it = 0; it < 60; it++) {
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        let dx = b.x - a.x, dy = b.y - a.y; let d = Math.hypot(dx, dy);
        const min = a.r + b.r + 3;
        if (d < min) { if (d < 0.01) { dx = 1; dy = 0; d = 1; } const push = (min - d) / 2; a.x -= (dx / d) * push; a.y -= (dy / d) * push; b.x += (dx / d) * push; b.y += (dy / d) * push; }
      }
    }
    return new Map(pts.map((p) => [p.code, p]));
  }, [points, pos]);
  return (
    <div ref={ref} className="map-wrap" style={{ height: h }}>
      {w > 0 && (
        <svg width={w} height={h} role="group" aria-label={label}>
          <g aria-hidden>
            {geo?.features.map((f, i) => <path key={`${String(f.id)}-${i}`} d={path(f) ?? ""} className={f.id === "360" ? "map-land" : "map-land map-land--other"} />)}
          </g>
          <g aria-hidden>
            {links.map(([a, b], i) => { const p = pos.get(a), q = pos.get(b); return p && q && <line key={i} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="rgba(54,140,133,0.45)" strokeWidth={1} className="fade-in" style={{ animationDelay: `${i * 30}ms` }} />; })}
          </g>
          {points.map((p, i) => {
            const sp = shown.get(p.code)!;
            const x = sp.x, y = sp.y;
            const moved = Math.hypot(sp.x - sp.x0, sp.y - sp.y0) > 1;
            const r = p.size ?? 6;
            const sel = selected === p.code;
            return (
              <g key={p.code} transform={`translate(${x},${y})`} opacity={p.dim ? 0.35 : 1}>
                {moved && <><line x1={0} y1={0} x2={sp.x0 - x} y2={sp.y0 - y} stroke="var(--muted)" strokeWidth={0.8} pointerEvents="none" /><circle cx={sp.x0 - x} cy={sp.y0 - y} r={1.6} fill="var(--muted)" pointerEvents="none" /></>}
                {!reduced && !p.dim && <circle className="pulse" r={r} fill="none" stroke={p.color} strokeWidth={1.2} pointerEvents="none" style={{ animationDelay: `${(i % 9) * 0.4}s` }} />}
                <circle className="marker fade-in" style={{ animationDelay: `${i * 35}ms` }} r={sel ? r + 3 : r} fill={p.color} stroke={sel ? "var(--green-deep)" : "#ffffff"} strokeWidth={sel ? 3 : 1.5}
                  tabIndex={onSelect ? 0 : -1} role={onSelect ? "button" : undefined} aria-label={`${p.code} ${p.label}`}
                  onClick={() => onSelect?.(p.code)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect?.(p.code))}
                  onPointerMove={(e) => tip.show(e, <><b>{p.code} · {p.label}</b>{p.tipRows.map(([k, v]) => <TipRow key={k} k={k} v={v} />)}{onSelect && <div className="faint" style={{ marginTop: 4 }}>Klik untuk detail</div>}</>)}
                  onPointerLeave={() => tip.hide()} />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
