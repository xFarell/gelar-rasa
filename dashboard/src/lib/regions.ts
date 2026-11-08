import type { Dataset } from "./dataset";
import type { Station } from "./types";

/**
 * Pilihan wilayah dari metadata stasiun (location_id, kota_kabupaten, provinsi).
 * Tidak ada kota atau wilayah di luar metadata. Setiap lokasi (location_id) saat ini memiliki satu stasiun.
 *   all            → seluruh stasiun
 *   prov:<nama>    → semua stasiun di provinsi
 *   loc:<LOC-...>  → satu lokasi (kota/kabupaten)
 */
export interface RegionOption { id: string; kind: "all" | "prov" | "loc"; label: string; codes: string[]; provinsi?: string }
export interface RegionGroup { provinsi: string; prov: RegionOption | null; cities: RegionOption[] }

export const cityLabel = (s: Station) => s.kota.replace(/^Kota Administrasi /, "");

export function buildRegions(ds: Dataset) {
  const byProv = new Map<string, Station[]>();
  for (const s of ds.stations) byProv.set(s.provinsi, [...(byProv.get(s.provinsi) ?? []), s]);
  const groups: RegionGroup[] = [...byProv.entries()].sort((a, b) => a[0].localeCompare(b[0], "id")).map(([provinsi, sts]) => ({
    provinsi,
    prov: sts.length > 1 ? { id: `prov:${provinsi}`, kind: "prov", label: `Seluruh ${provinsi}`, codes: sts.map((s) => s.code), provinsi } : null,
    cities: [...sts].sort((a, b) => cityLabel(a).localeCompare(cityLabel(b), "id")).map((s) => ({ id: `loc:${s.locationId}`, kind: "loc" as const, label: cityLabel(s), codes: [s.code], provinsi })),
  }));
  const all: RegionOption = { id: "all", kind: "all", label: "Seluruh stasiun", codes: ds.stations.map((s) => s.code) };
  const byId = new Map<string, RegionOption>([[all.id, all]]);
  for (const g of groups) { if (g.prov) byId.set(g.prov.id, g.prov); for (const c of g.cities) byId.set(c.id, c); }
  return { all, groups, byId, nProv: groups.length };
}
export type Regions = ReturnType<typeof buildRegions>;
