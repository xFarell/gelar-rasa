import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Dataset } from "./dataset";
import type { DayRange, Pollutant, StandardKey, Tier } from "./types";
import type { Granularity, StatKey } from "./kpi";
import { scopeStations } from "./kpi";
import { buildRegions, type Regions } from "./regions";

// ---------------------------------------------------------------------
// Dua halaman (Overview, Analytics + 6 tab). Routing hash; filter tersimpan di URL agar dapat dibagikan.
// ---------------------------------------------------------------------
export const TABS = [
  { id: "pollutants", label: "Polutan" },
  { id: "time", label: "Pola Waktu" },
  { id: "spatial", label: "Spasial" },
  { id: "meteorology", label: "Meteorologi" },
  { id: "standards", label: "Baku Mutu" },
  { id: "health", label: "Kesehatan" },
] as const;
export type TabId = (typeof TABS)[number]["id"];
export type View = "overview" | "analytics";

export interface Filters {
  from: string; to: string; pollutant: Pollutant;
  region: string; station: string;
  twins: boolean; stat: StatKey; gran: Granularity; standard: StandardKey;
}

/** "plain" = hash hanya berisi nama tampilan (#analytics-time); untuk host yang hanya meneruskan #nama (artifact). */
export const PLAIN_HASH = import.meta.env.VITE_HASH_MODE === "plain";

interface Route { view: View; tab: TabId }
function parseHash(): { route: Route; q: URLSearchParams } {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path, qs] = raw.split("?");
  const [v, t] = path.split(/[/-]/);
  const view: View = v === "analytics" ? "analytics" : "overview";
  const tab = (TABS.find((x) => x.id === t)?.id ?? "pollutants") as TabId;
  return { route: { view, tab }, q: new URLSearchParams(qs ?? "") };
}
const routePath = (r: Route) => (r.view === "overview" ? "overview" : `analytics${PLAIN_HASH ? "-" : "/"}${r.tab}`);

export function defaultFilters(ds: Dataset): Filters {
  return { from: ds.meta.period.start, to: ds.meta.period.end, pollutant: "pm25", region: "all", station: "",
    twins: false, stat: "median", gran: "month", standard: "PP22_2021" };
}

function fromQuery(ds: Dataset, regions: Regions, q: URLSearchParams): Filters {
  const d = defaultFilters(ds);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const pick = <T extends string>(v: string | null, ok: readonly T[], def: T): T => (v && (ok as readonly string[]).includes(v) ? (v as T) : def);
  const region = regions.byId.has(q.get("r") ?? "") ? q.get("r")! : d.region;
  const st = q.get("st") ?? "";
  return {
    from: iso.test(q.get("from") ?? "") ? q.get("from")! : d.from,
    to: iso.test(q.get("to") ?? "") ? q.get("to")! : d.to,
    pollutant: pick(q.get("p"), ["pm25", "pm10", "so2", "no2", "o3", "co"] as const, d.pollutant),
    region, station: ds.byCode.has(st) && regions.byId.get(region)!.codes.includes(st) ? st : "",
    twins: q.get("twins") === "1",
    stat: pick(q.get("stat"), ["median", "p95"] as const, d.stat),
    gran: pick(q.get("gran"), ["day", "week", "month"] as const, d.gran),
    standard: pick(q.get("std"), ["PP22_2021", "WHO_2021"] as const, d.standard),
  };
}

export function toQuery(ds: Dataset, f: Filters): string {
  const d = defaultFilters(ds);
  const q = new URLSearchParams();
  if (f.from !== d.from) q.set("from", f.from);
  if (f.to !== d.to) q.set("to", f.to);
  if (f.pollutant !== d.pollutant) q.set("p", f.pollutant);
  if (f.region !== d.region) q.set("r", f.region);
  if (f.station) q.set("st", f.station);
  if (f.twins) q.set("twins", "1");
  if (f.stat !== d.stat) q.set("stat", f.stat);
  if (f.gran !== d.gran) q.set("gran", f.gran);
  if (f.standard !== d.standard) q.set("std", f.standard);
  const s = q.toString();
  return s ? `?${s}` : "";
}

interface Ctx {
  ds: Dataset; regions: Regions; view: View; tab: TabId; f: Filters; range: DayRange;
  /** Stasiun terpilih menurut wilayah/stasiun (kosong = seluruh stasiun). Cakupan KPI diturunkan dari sini. */
  codes: string[];
  set: (patch: Partial<Filters>) => void; reset: () => void;
  go: (view: View, tab?: TabId, patch?: Partial<Filters>) => void;
  selectStation: (code: string | null) => void;
  modal: string | null; setModal: (m: string | null) => void;
}
const FilterCtx = createContext<Ctx | null>(null);

export function FilterProvider({ ds, children }: { ds: Dataset; children: React.ReactNode }) {
  const regions = useMemo(() => buildRegions(ds), [ds]);
  const [{ route, f }, setState] = useState(() => { const { route, q } = parseHash(); return { route, f: fromQuery(ds, regions, q) }; });
  const [modal, setModal] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => {
      const { route, q } = parseHash();
      setState((s) => ({ route, f: PLAIN_HASH ? s.f : fromQuery(ds, regions, q) }));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [ds, regions]);

  const writeUrl = useCallback((r: Route, nf: Filters) => {
    const url = PLAIN_HASH ? `#${routePath(r)}` : `#/${routePath(r)}${toQuery(ds, nf)}`;
    if (url !== window.location.hash) history.replaceState(null, "", url);
  }, [ds]);

  const set = useCallback((patch: Partial<Filters>) => setState((s) => {
    const nf = { ...s.f, ...patch };
    if (nf.from > nf.to) [nf.from, nf.to] = [nf.to, nf.from];
    // Stasiun selalu berada di dalam wilayah terpilih; wilayah baru yang tidak memuat stasiun → stasiun dikosongkan.
    if (nf.station && !regions.byId.get(nf.region)!.codes.includes(nf.station)) nf.station = "";
    writeUrl(s.route, nf);
    return { ...s, f: nf };
  }), [writeUrl, regions]);
  const reset = useCallback(() => set(defaultFilters(ds)), [ds, set]);
  const go = useCallback((view: View, tab?: TabId, patch?: Partial<Filters>) => setState((s) => {
    const route = { view, tab: tab ?? s.route.tab };
    const nf = { ...s.f, ...patch };
    const url = PLAIN_HASH ? `#${routePath(route)}` : `#/${routePath(route)}${toQuery(ds, nf)}`;
    history.pushState(null, "", url);
    return { route, f: nf };
  }), [ds]);
  const selectStation = useCallback((code: string | null) => setState((s) => {
    const nf = { ...s.f, station: code ?? "" };
    if (code && !regions.byId.get(nf.region)!.codes.includes(code)) nf.region = "all";
    writeUrl(s.route, nf);
    return { ...s, f: nf };
  }), [regions, writeUrl]);

  const range = useMemo<DayRange>(() => ({ from: ds.cal.clamp(ds.cal.indexOf(f.from)), to: ds.cal.clamp(ds.cal.indexOf(f.to)) }), [ds, f.from, f.to]);
  const codes = useMemo(() => (f.station ? [f.station] : f.region === "all" ? [] : regions.byId.get(f.region)!.codes), [f.station, f.region, regions]);
  const value = useMemo(() => ({ ds, regions, view: route.view, tab: route.tab, f, range, codes, set, reset, go, selectStation, modal, setModal }),
    [ds, regions, route, f, range, codes, set, reset, go, selectStation, modal]);
  return <FilterCtx.Provider value={value}>{children}</FilterCtx.Provider>;
}

export function useFilters(): Ctx {
  const c = useContext(FilterCtx);
  if (!c) throw new Error("useFilters di luar FilterProvider");
  return c;
}

/** Cakupan stasiun untuk variabel tertentu sesuai filter global (dipakai SEMUA komponen; aturan di kpi.ts). */
export function useScope(variableArg?: string, opts?: { codes?: string[]; includeAllTiers?: boolean; twins?: boolean }) {
  const { ds, f, codes } = useFilters();
  const variable = variableArg ?? f.pollutant;
  const sel = opts?.codes ?? codes;
  const twins = opts?.twins ?? f.twins;
  const all = opts?.includeAllTiers;
  return useMemo(() => scopeStations(ds, { variable: variable as Pollutant, selected: sel, includeTwins: twins,
    ...(all ? { tiers: ["utama", "terbatas", "tidak_layak", "dikecualikan"] as Tier[] } : {}) }), [ds, variable, sel, twins, all]);
}

/** Rentang dengan panjang sama tepat sebelum periode terpilih; null bila keluar dari data. */
export function previousRange(r: DayRange): DayRange | null {
  const len = r.to - r.from + 1;
  return r.from - len >= 0 ? { from: r.from - len, to: r.from - 1 } : null;
}
