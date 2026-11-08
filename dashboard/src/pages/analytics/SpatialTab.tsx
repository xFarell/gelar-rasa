import { useMemo, useState } from "react";
import { Columns } from "../../components/charts";
import { CategoryLegend, categoryHex } from "../../components/legend";
import { StationMap } from "../../components/StationMap";
import { Card, Empty, Fit, Seg, TierBadge } from "../../components/ui";
import { useFilters } from "../../lib/filters";
import { limitFor, stationStat, tierOf, values, VAR_META } from "../../lib/kpi";
import { fmt, fmtPct, SITE_CLASS_ID } from "../../lib/format";
import { cityLabel } from "../../lib/regions";
import { monitoring } from "../../lib/selectors";
import { quantileSorted, sortedFinite } from "../../lib/stats";
import { ScopeLine, useRegionScope } from "./common";

export default function SpatialTab() {
  const { ds, f, range, regions, selectStation } = useFilters();
  const v = f.pollutant, meta = VAR_META[v];
  const reg = useRegionScope();
  const regAll = useMemo(() => (f.region === "all" ? ds.stations.map((s) => s.code) : regions.byId.get(f.region)!.codes), [ds, f.region, regions]);
  const lim = limitFor(ds, f.standard, v, "24h");
  const [groupBy, setGroupBy] = useState<"pulau" | "siteClass">("pulau");
  const [links, setLinks] = useState(true);
  const statLabel = f.stat === "median" ? "Median" : "P95";
  const inReg = useMemo(() => new Set(reg.stations), [reg]);

  const stats = useMemo(() => new Map(ds.stations.map((s) => [s.code, stationStat(ds, s.code, v, range)])), [ds, v, range]);
  const points = ds.stations.map((s) => {
    const st = stats.get(s.code)!, val = st[f.stat];
    const usable = s.status !== "excluded" && tierOf(s, v) !== "tidak_layak";
    return { code: s.code, lat: s.lat, lon: s.lon, label: `${cityLabel(s)}, ${s.provinsi}`, color: categoryHex(usable ? val : NaN, lim), dim: !inReg.has(s.code), size: 7,
      tipRows: [[`${statLabel} harian`, `${fmt(val)} ${meta.unit}`], ["Hari dengan data", `${st.n} (${fmtPct(st.pctUsable, 0)})`], ["Kelas", SITE_CLASS_ID[s.siteClass] ?? s.siteClass], ["Tetangga terdekat", `${s.nnStation} · ${fmt(s.nnKm, 0)} km`]] as [string, string][] };
  });
  const nnLinks = useMemo<[string, string][]>(() => { const seen = new Set<string>(); return ds.stations.map((s) => [s.code, s.nnStation] as [string, string]).filter(([a, b]) => { const k = [a, b].sort().join(); if (seen.has(k)) return false; seen.add(k); return true; }); }, [ds]);

  const groups = useMemo(() => {
    const key = (c: string) => (groupBy === "pulau" ? ds.byCode.get(c)!.pulau : ds.byCode.get(c)!.siteClass);
    const by = new Map<string, number[]>(), nSt = new Map<string, number>();
    for (const c of reg.stations) {
      const x = values(ds, c, v, range), k = key(c), arr = by.get(k) ?? [];
      let any = false;
      for (let i = 0; i < x.length; i++) if (Number.isFinite(x[i])) { arr.push(x[i]); any = true; }
      by.set(k, arr); if (any) nSt.set(k, (nSt.get(k) ?? 0) + 1);
    }
    return [...by.entries()].filter(([, a]) => a.length).map(([k, a]) => {
      const s = sortedFinite(a);
      const val = quantileSorted(s, f.stat === "median" ? 0.5 : 0.95);
      return { key: k, label: groupBy === "pulau" ? k : SITE_CLASS_ID[k] ?? k, v: val, note: `${nSt.get(k)} stasiun · ${s.length.toLocaleString("id-ID")} stasiun-hari` };
    }).sort((a, b) => b.v - a.v);
  }, [ds, reg, v, range, groupBy, f.stat]);

  const mon = useMemo(() => monitoring(ds, regAll, v, range), [ds, regAll, v, range]);
  const avSorted = [...mon.av].sort((a, b) => b.pct - a.pct || a.code.localeCompare(b.code));

  return (
    <div className="tabgrid tabgrid--spatial">
      <Card className="g-a" title={`Peta ${statLabel.toLowerCase()} harian ${meta.short}`} sub="Posisi dari koordinat metadata stasiun"
        actions={<label className="toggle toggle--sm"><input type="checkbox" checked={links} onChange={(e) => setLinks(e.target.checked)} />Garis tetangga terdekat</label>}>
        <ScopeLine n={reg.stations.length} extra="titik pudar: di luar wilayah" />
        <CategoryLegend limit={lim} statLabel={statLabel} />
        <Fit>{(_, h) => <StationMap height={h} label={`Peta stasiun ${meta.short}`} points={points} onSelect={(c) => selectStation(c)} selected={f.station || null} links={links ? nnLinks : []} />}</Fit>
      </Card>

      <Card className="g-b" title={groupBy === "pulau" ? "Perbandingan antarpulau" : "Perbandingan antarkelas lokasi"} sub={`${statLabel} gabungan stasiun-hari · ${meta.unit}`}
        actions={<Seg size="sm" label="Kelompokkan" value={groupBy} onChange={setGroupBy} options={[{ v: "pulau", l: "Pulau" }, { v: "siteClass", l: "Kelas lokasi" }]} />}>
        {!groups.length ? <Empty /> : <Fit>{(_, h) => <Columns label="Perbandingan kelompok" unit={meta.unit} height={h} data={groups} highlight={() => true} refLine={lim !== null ? { v: lim, label: `Baku 24 jam ${fmt(lim, 0)}`, color: "var(--coral-ink)" } : undefined} />}</Fit>}
        <p className="card__foot">Kelompok dengan sedikit stasiun sangat dipengaruhi stasiun itu.</p>
      </Card>

      <Card className="g-c" title={`Kelengkapan data: ${mon.meet} dari ${mon.total} stasiun ≥ 75% hari`} sub={`${meta.short} · keseluruhan ${fmtPct(mon.pct, 0)} hari memiliki data`}>
        <ul className="avlist scrollbody">
          {avSorted.map((a) => (
            <li key={a.code}>
              <button type="button" onClick={() => selectStation(a.code)}>
                <span className="avlist__code"><b>{a.code}</b> {cityLabel(ds.byCode.get(a.code)!)}</span>
                <span className="bar" aria-hidden><i style={{ width: `${a.pct}%`, background: a.tier === "utama" ? "var(--green)" : a.tier === "terbatas" ? "var(--yellow)" : "var(--coral)" }} /></span>
                <span className="num avlist__pct">{fmtPct(a.pct, 0)}</span>
                <TierBadge tier={a.tier} />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
