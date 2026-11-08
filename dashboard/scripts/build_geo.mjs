// Mengekstrak garis pantai Indonesia + negara tetangga dari world-atlas (Natural Earth 1:50m, domain publik).
// Hanya konteks peta dasar; koordinat stasiun tetap dari metadata proyek (sites.csv).
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
const topo = JSON.parse(readFileSync(new URL("../node_modules/world-atlas/countries-50m.json", import.meta.url)));
const keep = new Set(["360", "458", "626", "598", "096", "608", "702", "036", "764", "704", "116"]);
const fc = feature(topo, topo.objects.countries);
const round = (c) => (typeof c[0] === "number" ? [+c[0].toFixed(3), +c[1].toFixed(3)] : c.map(round));
const inBox = ([x, y]) => x > 90 && x < 146 && y > -14 && y < 10;
const clip = (geom) => {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  const kept = polys.filter((p) => p[0].some(inBox));
  return kept.length ? { type: "MultiPolygon", coordinates: round(kept) } : null;
};
const features = fc.features
  .filter((f) => keep.has(String(f.id)))
  .map((f) => ({ type: "Feature", id: String(f.id), properties: { name: f.properties.name }, geometry: clip(f.geometry) }))
  .filter((f) => f.geometry && f.properties.name !== "Ashmore and Cartier Is.");
writeFileSync(new URL("../src/data/geo.json", import.meta.url), JSON.stringify({ type: "FeatureCollection", features }));
console.log(features.map((f) => f.properties.name).join(", "));
