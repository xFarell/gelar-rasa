import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useFilters } from "../../lib/filters";
import { fmt, fmtPct, SITE_CLASS_ID } from "../../lib/format";
import { stationStat, VAR_META } from "../../lib/kpi";
import { cityLabel } from "../../lib/regions";
import type { StationRow } from "../../lib/selectors";
import { useReducedMotion } from "../../lib/hooks";
import type { StationVisual } from "../city3d/objects";
import { hasWebGL } from "../city3d/webgl";
import { CATEGORY_HEX, categoryHex } from "../legend";
import { StationMap } from "../StationMap";
import { Fit, InfoTip, Loading, Seg, tip, TipRow } from "../ui";
import { StationDetail } from "./StationDetail";

const City3DScene = lazy(() => import("../city3d/City3DScene"));

export interface WindInfo { flow: { x: number; z: number; strength: number } | null; hours: number; speed: number; from: string; topPct: number }

/** Panggung kota: miniatur 3D (atau peta 2D sebagai cadangan/pilihan) + kartu wilayah + legenda + detail stasiun. */
export function CityStage({ rows, visuals, max, limit, wind, regionLabel, regionCodes }: {
  rows: StationRow[]; visuals: StationVisual[]; max: number; limit: number | null; wind: WindInfo | null; regionLabel: string; regionCodes: string[] | null;
}) {
  const { ds, f, range, selectStation } = useFilters();
  const reduced = useReducedMotion();
  const webgl = useMemo(hasWebGL, []);
  const [mode, setMode] = useState<"3d" | "map">(webgl ? "3d" : "map");
  const v = f.pollutant, meta = VAR_META[v];
  const statLabel = f.stat === "median" ? "Median" : "P95";
  const byCode = useMemo(() => new Map(rows.map((r) => [r.code, r])), [rows]);

  const nn = useMemo(() => ds.stations.map((s) => [s.code, s.nnStation] as [string, string]), [ds]);
  const stations = useMemo(() => ds.stations.map((s) => ({ code: s.code, lat: s.lat, lon: s.lon })), [ds]);
  const focus = useMemo(() => (f.station ? [f.station] : regionCodes ?? []), [f.station, regionCodes]);
  const labels = useMemo(() => {
    const inReg = rows.filter((r) => r.inRegion && r.inScope && Number.isFinite(r.value));
    const pick = f.station ? [f.station] : regionCodes && regionCodes.length <= 6 ? regionCodes : [...inReg].sort((a, b) => b.value - a.value).slice(0, 3).map((r) => r.code);
    return pick.map((c) => ({ code: c, text: fmt(byCode.get(c)?.value ?? NaN), strong: c === f.station }));
  }, [rows, f.station, regionCodes, byCode]);
  const flow = useMemo(() => (wind?.flow && wind.flow.strength > 0 ? { x: wind.flow.x, z: wind.flow.z, speed: wind.speed } : null), [wind]);

  const hoverTip = useCallback((code: string | null, e: { clientX: number; clientY: number } | null) => {
    if (!code || !e) { tip.hide(); return; }
    const s = ds.byCode.get(code)!, r = byCode.get(code)!;
    const a = stationStat(ds, code, "pm25", range), b = stationStat(ds, code, "pm10", range);
    tip.show(e, <>
      <b>{code} · {cityLabel(s)}</b>
      <div className="tt-sub">{s.provinsi} · {SITE_CLASS_ID[s.siteClass] ?? s.siteClass}</div>
      <TipRow k="Median PM2.5" v={`${fmt(a.median)} µg/m³`} />
      <TipRow k="Median PM10" v={`${fmt(b.median)} µg/m³`} />
      <TipRow k={`Kelengkapan ${meta.short}`} v={fmtPct(r.pct, 0)} />
      {!r.inScope && <div className="tt-sub">{r.tier === "tidak_layak" || r.tier === "dikecualikan" ? "Data kurang; tidak masuk KPI." : "Data kembar; dalam KPI diwakili stasiun lain."}</div>}
      <div className="tt-sub">Klik untuk detail</div>
    </>);
  }, [ds, byCode, range, meta.short]);

  const mapPoints = useMemo(() => rows.map((r) => {
    const s = ds.byCode.get(r.code)!;
    const noData = r.tier === "tidak_layak" || r.tier === "dikecualikan";
    return { code: r.code, lat: s.lat, lon: s.lon, label: cityLabel(s), color: categoryHex(noData ? NaN : r.value, limit), dim: !r.inRegion, size: 6,
      tipRows: [[`${statLabel} ${meta.short}`, `${fmt(r.value)} ${meta.unit}`], [`Kelengkapan`, fmtPct(r.pct, 0)]] as [string, string][] };
  }), [rows, ds, limit, statLabel, meta]);

  const regionVals = rows.filter((r) => r.inRegion && r.inScope && Number.isFinite(r.value));
  const sel = f.station ? ds.byCode.get(f.station) : null;

  return (
    <section className="card stage" aria-label="Miniatur kota dan stasiun pemantauan">
      <div className="stage__view">
        {mode === "3d" && webgl ? (
          <Suspense fallback={<Loading label="Menyiapkan kota 3D…" />}>
            <City3DScene stations={stations} nn={nn} visuals={visuals} selected={f.station || null} focus={focus} labels={labels} flow={flow}
              animate={!reduced} onSelect={(c) => selectStation(c)} onHover={hoverTip}
              label={`Miniatur kota representatif dengan ${rows.length} stasiun. Tinggi kolom menunjukkan ${statLabel.toLowerCase()} harian ${meta.short}. Gunakan daftar peringkat atau pemilih stasiun untuk navigasi dengan keyboard.`} />
          </Suspense>
        ) : (
          <Fit className="stage__map">{(_, h) => <StationMap height={h} points={mapPoints} onSelect={(c) => selectStation(c)} selected={f.station || null} label={`Peta stasiun ${meta.short}`} />}</Fit>
        )}
      </div>

      <div className="stage__info">
        <p className="stage__eyebrow">{sel ? "Stasiun terpilih" : f.region === "all" ? "Jaringan pemantauan" : "Wilayah terpilih"}</p>
        <h2 className="stage__title">{sel ? cityLabel(sel) : regionLabel}</h2>
        <p className="stage__meta">
          {sel ? `${sel.code} · ${sel.provinsi}` : `${regionCodes?.length ?? rows.length} stasiun${f.region === "all" ? ` · ${new Set(ds.stations.map((s) => s.provinsi)).size} provinsi` : ""}`}
          {!sel && regionVals.length > 0 && <> · {statLabel.toLowerCase()} {meta.short} {fmt(Math.min(...regionVals.map((r) => r.value)))}–{fmt(Math.max(...regionVals.map((r) => r.value)))} µg/m³</>}
        </p>
      </div>

      <div className="stage__mode">
        <Seg size="sm" label="Tampilan" value={mode} onChange={setMode} options={[{ v: "3d", l: "Kota 3D", title: webgl ? "Miniatur kota representatif" : "WebGL tidak tersedia" }, { v: "map", l: "Peta" }]} />
      </div>

      <div className="stage__legend">
        <ul className="legend legend--stage">
          {limit !== null ? <>
            <li><i style={{ background: CATEGORY_HEX.low }} />≤ 50% baku</li>
            <li><i style={{ background: CATEGORY_HEX.mid }} />50–100%</li>
            <li><i style={{ background: CATEGORY_HEX.high }} />&gt; baku 24 jam</li>
          </> : <li><i style={{ background: CATEGORY_HEX.neutral }} />Tanpa baku 24 jam</li>}
          <li><i style={{ background: CATEGORY_HEX.na }} />Data kurang</li>
        </ul>
        {mode === "3d" && webgl ? (
          <p className="stage__note">
            Tinggi kolom: {statLabel.toLowerCase()} {meta.short}{limit !== null ? ` · selubung & cincin: baku 24 jam ${fmt(limit, 0)}` : ""} · model kota representatif, bukan peta
            <InfoTip title="Cara membaca kota 3D">
              Tinggi kolom sebanding dengan {statLabel.toLowerCase()} harian {meta.short} (tertinggi {fmt(max)} µg/m³). {limit !== null ? `Selubung kaca setinggi baku 24 jam ${fmt(limit, 0)} µg/m³; kolom yang menembusnya berada di atas baku. ` : ""}
              Kota adalah model representatif: stasiun disusun menurut bujur (barat → timur) dan lintang, jarak tidak sebenarnya. Bangunan dan pohon dekoratif.
              {" "}{flow && wind ? `Partikel bergerak searah angin dominan dari ${wind.from.toLowerCase()} (wind rose, ${fmt(wind.hours, 0)} jam, median ${fmt(wind.speed, 1)} m/s); bukan simulasi sebaran polutan.` : "Partikel dekoratif, bukan simulasi sebaran polutan."}
            </InfoTip>
          </p>
        ) : <p className="stage__note">{webgl ? "Posisi dari koordinat metadata." : "WebGL tidak tersedia; menampilkan peta 2D."} Warna: {statLabel.toLowerCase()} harian {meta.short}.</p>}
      </div>

      {sel && <StationDetail code={sel.code} />}
    </section>
  );
}
