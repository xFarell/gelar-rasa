import { useEffect, useRef, useState } from "react";
import { defaultFilters, useFilters } from "../../lib/filters";
import { POLLUTANTS, VAR_META } from "../../lib/kpi";
import { fmtDate } from "../../lib/format";
import { cityLabel } from "../../lib/regions";
import { Logo } from "../ui";
import { MenuDock } from "./MenuDock";

/** Header ringkas: wordmark, wilayah, stasiun, periode, polutan, status data. */
export function TopNavigation() {
  const { ds, f, reset, view, tab } = useFilters();
  const d = defaultFilters(ds);
  const dirty = (["from", "to", "pollutant", "region", "station"] as const).some((k) => f[k] !== d[k]);
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="wordmark">AIR IN <em>Motion</em></span>
        <Logo height={28} />
        <span className="topbar__crumb">{view === "overview" ? "Overview" : `Analytics`}{view === "analytics" && <span className="sr-only"> · {tab}</span>}</span>
      </div>
      <div className="topbar__filters" role="group" aria-label="Filter global">
        <CitySelector />
        <StationSelector />
        <DateRangeSelector />
        <PollutantSelector />
        {dirty && <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>Atur ulang</button>}
      </div>
      <DataStatus />
      <MenuDock />
    </header>
  );
}

export function CitySelector() {
  const { regions, f, set } = useFilters();
  return (
    <label className="fld fld--region">
      <span>Wilayah</span>
      <select className="select" value={f.region} onChange={(e) => set({ region: e.target.value, station: "" })}>
        <option value="all">Seluruh stasiun ({regions.all.codes.length})</option>
        {regions.groups.map((g) => (
          <optgroup key={g.provinsi} label={g.provinsi}>
            {g.prov && <option value={g.prov.id}>{g.prov.label} ({g.prov.codes.length})</option>}
            {g.cities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export function StationSelector() {
  const { ds, regions, f, set } = useFilters();
  const codes = regions.byId.get(f.region)!.codes;
  return (
    <label className="fld fld--station">
      <span>Stasiun</span>
      <select className="select" value={f.station} onChange={(e) => set({ station: e.target.value })}>
        <option value="">Seluruh stasiun{codes.length > 1 ? ` (${codes.length})` : ""}</option>
        {codes.map((c) => { const s = ds.byCode.get(c)!; return <option key={c} value={c}>{c} · {cityLabel(s)}</option>; })}
      </select>
    </label>
  );
}

export function DateRangeSelector() {
  const { ds, f, set } = useFilters();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  const { start, end } = ds.meta.period;
  const years = [...new Set(Array.from(ds.cal.year))];
  const last12 = ds.cal.iso(Math.max(0, ds.cal.n - 365));
  const presets = [
    { l: "Seluruh periode", from: start, to: end },
    ...years.map((y) => ({ l: `${y}${`${y}-12-31` > end ? ` (s.d. ${fmtDate(end)})` : ""}`, from: `${y}-01-01` < start ? start : `${y}-01-01`, to: `${y}-12-31` > end ? end : `${y}-12-31` })),
    { l: "12 bulan terakhir", from: last12, to: end },
  ];
  const nDays = ds.cal.indexOf(f.to) - ds.cal.indexOf(f.from) + 1;
  return (
    <div className="fld fld--period popover" ref={ref}>
      <span id="period-lbl">Periode</span>
      <button type="button" className="select select--btn" aria-expanded={open} aria-labelledby="period-lbl" onClick={() => setOpen(!open)}>
        {fmtDate(f.from)} – {fmtDate(f.to)}
      </button>
      {open && (
        <div className="popover__panel" role="dialog" aria-label="Pilih periode">
          <div className="presets">
            {presets.map((p) => (
              <button key={p.l} type="button" aria-pressed={f.from === p.from && f.to === p.to} onClick={() => { set({ from: p.from, to: p.to }); setOpen(false); }}>{p.l}</button>
            ))}
          </div>
          <div className="daterow">
            <label>Dari<input className="input" type="date" min={start} max={end} value={f.from} onChange={(e) => e.target.value && set({ from: e.target.value })} /></label>
            <label>Sampai<input className="input" type="date" min={start} max={end} value={f.to} onChange={(e) => e.target.value && set({ to: e.target.value })} /></label>
          </div>
          <p className="popover__note">{nDays.toLocaleString("id-ID")} hari dipilih. Berlaku untuk semua KPI, grafik, dan kota 3D.</p>
        </div>
      )}
    </div>
  );
}

export function PollutantSelector() {
  const { f, set } = useFilters();
  return (
    <label className="fld fld--pol">
      <span>Polutan</span>
      <select className="select" value={f.pollutant} onChange={(e) => set({ pollutant: e.target.value as typeof f.pollutant })}>
        {POLLUTANTS.map((p) => <option key={p} value={p}>{VAR_META[p].short}</option>)}
      </select>
    </label>
  );
}

function DataStatus() {
  const { ds } = useFilters();
  const { start, end, nDays } = ds.meta.period;
  return (
    <div className="status" title={`Data ${fmtDate(start, true)} sampai ${fmtDate(end, true)} · ${nDays.toLocaleString("id-ID")} hari · ${ds.stations.length} stasiun`}>
      <i aria-hidden />
      <span><b>Data s.d. {fmtDate(end)}</b><small>{ds.stations.length} stasiun · sejak {fmtDate(start)}</small></span>
    </div>
  );
}
