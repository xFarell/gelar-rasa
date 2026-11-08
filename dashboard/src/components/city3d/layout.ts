/**
 * Penempatan stasiun pada miniatur kota representatif.
 * Bukan peta: stasiun dikelompokkan ke kolom menurut urutan bujur (barat → timur) lalu diurutkan
 * menurut lintang di setiap kolom (utara di belakang). Arah mata angin konsisten, jarak tidak.
 */
export const CELL = 6.9;
export const COLS = 7;

export interface Lot { code: string; x: number; z: number; col: number; row: number }

export function layoutStations(stations: { code: string; lat: number; lon: number }[]) {
  const byLon = [...stations].sort((a, b) => a.lon - b.lon || a.code.localeCompare(b.code));
  const rows = Math.ceil(byLon.length / COLS);
  const cols: typeof byLon[] = [];
  let k = 0;
  for (let c = 0; c < COLS; c++) {
    const left = byLon.length - k, colsLeft = COLS - c;
    const take = Math.ceil(left / colsLeft);
    cols.push(byLon.slice(k, k + take));
    k += take;
  }
  const lots: Lot[] = [];
  cols.forEach((col, c) => {
    const sorted = [...col].sort((a, b) => b.lat - a.lat);
    sorted.forEach((s, r) => {
      const off = (rows - sorted.length) / 2;
      lots.push({ code: s.code, col: c, row: r, x: (c - (COLS - 1) / 2) * CELL, z: (r + off - (rows - 1) / 2) * CELL });
    });
  });
  return { lots, width: COLS * CELL, depth: rows * CELL, rows };
}

/** Bilangan semu deterministik per kode (dekorasi tetap sama di setiap kunjungan). */
export function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

/** Vektor aliran (x = timur, z = selatan) dari jumlah jam per sektor arah asal angin (0 = utara, searah jarum jam). */
export function flowFromSectors(counts: number[]): { x: number; z: number; strength: number } | null {
  const n = counts.length;
  let sx = 0, sz = 0, tot = 0;
  counts.forEach((c, i) => {
    const th = (i / n) * Math.PI * 2;
    sx += c * Math.sin(th); sz += c * -Math.cos(th); tot += c;
  });
  if (!tot) return null;
  const len = Math.hypot(sx, sz);
  if (len / tot < 0.05) return { x: 0, z: 0, strength: 0 };
  return { x: -sx / len, z: -sz / len, strength: len / tot };
}
