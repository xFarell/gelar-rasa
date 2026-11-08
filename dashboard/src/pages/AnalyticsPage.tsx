import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import { TABS, useFilters, type TabId } from "../lib/filters";
import { Loading, Seg } from "../components/ui";
import { MotionTransition } from "../components/shell/MotionTransition";

const TAB_VIEWS: Record<TabId, React.LazyExoticComponent<() => JSX.Element>> = {
  pollutants: lazy(() => import("./analytics/PollutantsTab")),
  time: lazy(() => import("./analytics/TimeTab")),
  spatial: lazy(() => import("./analytics/SpatialTab")),
  meteorology: lazy(() => import("./analytics/MeteorologyTab")),
  standards: lazy(() => import("./analytics/StandardsTab")),
  health: lazy(() => import("./analytics/HealthTab")),
};

/** AnalyticsTabs: daftar tab dengan indikator aktif yang bergeser + kontrol khusus analitik. */
function AnalyticsTabs() {
  const { tab, go, f, set } = useFilters();
  const list = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => { const el = list.current?.querySelector<HTMLElement>(`[aria-selected="true"]`); if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth }); };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [tab]);
  const onKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const n = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : -1;
    if (n >= 0) { e.preventDefault(); go("analytics", TABS[n].id); list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[n]?.focus(); }
  };
  return (
    <div className="atabs">
      <div ref={list} className="atabs__list" role="tablist" aria-label="Topik analitik" onKeyDown={onKey}>
        {ind && <span className="atabs__ind" aria-hidden style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} />}
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-controls="tabpanel" aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1} onClick={() => go("analytics", t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="atabs__tools">
        {(tab === "pollutants" || tab === "spatial") && <Seg size="sm" label="Statistik" value={f.stat} onChange={(stat) => set({ stat })} options={[{ v: "median", l: "Median" }, { v: "p95", l: "P95" }]} />}
        {(tab === "standards" || tab === "pollutants" || tab === "time" || tab === "spatial") && <Seg size="sm" label="Acuan baku" value={f.standard} onChange={(standard) => set({ standard })} options={[{ v: "PP22_2021", l: "PP 22/2021" }, { v: "WHO_2021", l: "WHO 2021" }]} />}
        {tab !== "health" && (
          <label className="toggle toggle--sm" title="Stasiun dengan data kembar biasanya dihitung sekali (diwakili satu stasiun)">
            <input type="checkbox" checked={f.twins} onChange={(e) => set({ twins: e.target.checked })} />Stasiun kembar terpisah
          </label>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { tab } = useFilters();
  const View = TAB_VIEWS[tab];
  return (
    <div className="an">
      <AnalyticsTabs />
      <div id="tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="an__panel">
        <Suspense fallback={<Loading label="Menyiapkan analitik…" />}>
          <MotionTransition k={tab} variant="tab"><View /></MotionTransition>
        </Suspense>
      </div>
    </div>
  );
}
