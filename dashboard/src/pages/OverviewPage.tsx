import { useMemo } from "react";
import { useFilters, useScope } from "../lib/filters";
import { loadHourly } from "../lib/dataset";
import { usePromise } from "../lib/hooks";
import { networkExceedance } from "../lib/kpi";
import { monitoring, overviewKpis, stationRows, stationVisuals, windFlow } from "../lib/selectors";
import { KPISection } from "../components/overview/KPISection";
import { CityStage } from "../components/overview/CityStage";
import { AirQualityTrend, ExceedanceSummary, Insights, MonitoringStatus, StationRanking } from "../components/overview/panels";

/**
 * OverviewPage: satu layar. Kiri KPI, tengah kota 3D, kanan tren + pelampauan, bawah peringkat, status pemantauan, temuan.
 * KPI dan tren mengikuti stasiun terpilih; kota, peringkat, dan temuan menampilkan seluruh wilayah agar konteks tetap terlihat.
 */
export default function OverviewPage() {
  const { ds, f, range, codes, regions } = useFilters();
  const v = f.pollutant;
  const region = regions.byId.get(f.region)!;
  const regionCodes = f.region === "all" ? null : region.codes;
  const regionSel = useMemo(() => regionCodes ?? [], [regionCodes]);

  // KPI: cakupan mengikuti wilayah + stasiun
  const s25 = useScope("pm25"), s10 = useScope("pm10"), sv = useScope(v);
  const k = useMemo(() => overviewKpis(ds, { pm25: s25.stations, pm10: s10.stations, v: sv.stations }, v, f.standard, range), [ds, s25, s10, sv, v, f.standard, range]);

  // Kota & peringkat: cakupan wilayah (tanpa stasiun) agar stasiun lain tetap terlihat
  const rv = useScope(v, { codes: regionSel });
  const rows = useMemo(() => stationRows(ds, v, f.stat, range, regionCodes ? new Set(regionCodes) : null, new Set(rv.stations)), [ds, v, f.stat, range, regionCodes, rv]);
  const vis = useMemo(() => stationVisuals(rows, k.lim), [rows, k.lim]);

  // Angin untuk arah partikel
  const hourly = usePromise(loadHourly).data;
  const ws = useScope("wind_speed", { codes: regionSel });
  const wind = useMemo(() => windFlow(ds, hourly, f.station ? [f.station] : ws.stations, range), [ds, hourly, f.station, ws, range]);

  const exRegion = useMemo(() => (k.lim !== null ? networkExceedance(ds, rv.stations, v, k.lim, range) : null), [ds, rv, v, k.lim, range]);
  const mon = useMemo(() => monitoring(ds, codes.length ? codes : ds.stations.map((s) => s.code), v, range), [ds, codes, v, range]);

  return (
    <div className="ov">
      <div className="ov__kpis"><KPISection k={k} /></div>
      <div className="ov__city">
        <CityStage rows={rows} visuals={vis.visuals} max={vis.max} limit={k.lim} wind={wind} regionLabel={region.kind === "all" ? "Seluruh stasiun" : region.label} regionCodes={regionCodes} />
      </div>
      <div className="ov__right">
        <AirQualityTrend codes25={s25.stations} codes10={s10.stations} />
        <ExceedanceSummary ex={k.ex} lim={k.lim} />
      </div>
      <div className="ov__bottom">
        <StationRanking rows={rows} limit={k.lim} />
        <MonitoringStatus m={mon} />
        <Insights rows={rows} codes={rv.stations} ex={exRegion} lim={k.lim} />
      </div>
    </div>
  );
}
