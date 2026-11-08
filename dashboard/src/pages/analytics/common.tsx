import { useMemo } from "react";
import { useFilters, useScope } from "../../lib/filters";
import { VAR_META } from "../../lib/kpi";
import { cityLabel } from "../../lib/regions";

/** Cakupan wilayah tanpa pilihan stasiun (untuk peringkat/perbandingan agar stasiun lain tetap terlihat). */
export function useRegionScope(v?: string) {
  const { f, regions } = useFilters();
  const codes = useMemo(() => (f.region === "all" ? [] : regions.byId.get(f.region)!.codes), [f.region, regions]);
  return useScope(v, { codes });
}

/** Satu baris konteks: polutan, wilayah/stasiun, jumlah stasiun, penanganan data kembar. */
export function ScopeLine({ n, extra }: { n: number; extra?: React.ReactNode }) {
  const { ds, f, regions } = useFilters();
  const where = f.station ? `${f.station} · ${cityLabel(ds.byCode.get(f.station)!)}` : regions.byId.get(f.region)!.label;
  return (
    <p className="scopeline">
      <b>{VAR_META[f.pollutant].short}</b> · {where} · {n} stasiun{f.twins ? " (stasiun kembar dihitung terpisah)" : ""}{extra ? <> · {extra}</> : null}
    </p>
  );
}

export const stdName = (k: string) => (k === "PP22_2021" ? "PP 22/2021" : "WHO 2021");
