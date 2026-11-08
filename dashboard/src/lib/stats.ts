// Statistik dasar. Kuantil memakai interpolasi linear (Hyndman–Fan tipe 7),
// identik dengan default pandas `Series.quantile` yang dipakai pada EDA.

export function sortedFinite(xs: ArrayLike<number>): Float64Array {
  let n = 0;
  for (let i = 0; i < xs.length; i++) if (Number.isFinite(xs[i])) n++;
  const out = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < xs.length; i++) if (Number.isFinite(xs[i])) out[j++] = xs[i];
  return out.sort();
}

/** Kuantil tipe 7 dari array yang SUDAH terurut. */
export function quantileSorted(s: ArrayLike<number>, q: number): number {
  const n = s.length;
  if (!n) return NaN;
  const h = (n - 1) * q;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  return s[lo] + (h - lo) * (s[hi] - s[lo]);
}

export const quantile = (xs: ArrayLike<number>, q: number) => quantileSorted(sortedFinite(xs), q);
export const median = (xs: ArrayLike<number>) => quantile(xs, 0.5);

export function mean(xs: ArrayLike<number>): number {
  let s = 0, n = 0;
  for (let i = 0; i < xs.length; i++) if (Number.isFinite(xs[i])) { s += xs[i]; n++; }
  return n ? s / n : NaN;
}

export function count(xs: ArrayLike<number>): number {
  let n = 0;
  for (let i = 0; i < xs.length; i++) if (Number.isFinite(xs[i])) n++;
  return n;
}

/** Peringkat rata-rata (ties → rata-rata peringkat), seperti scipy.stats.rankdata. */
export function ranks(xs: ArrayLike<number>): Float64Array {
  const idx = Array.from({ length: xs.length }, (_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const r = new Float64Array(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k]] = avg;
    i = j + 1;
  }
  return r;
}

export function pearson(x: ArrayLike<number>, y: ArrayLike<number>): number {
  const n = x.length;
  if (n < 3) return NaN;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** Pasangan lengkap (keduanya finite). */
export function completePairs(x: ArrayLike<number>, y: ArrayLike<number>): [Float64Array, Float64Array] {
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < x.length; i++) if (Number.isFinite(x[i]) && Number.isFinite(y[i])) { xs.push(x[i]); ys.push(y[i]); }
  return [Float64Array.from(xs), Float64Array.from(ys)];
}

export function spearman(x: ArrayLike<number>, y: ArrayLike<number>): number {
  const [a, b] = completePairs(x, y);
  return a.length >= 3 ? pearson(ranks(a), ranks(b)) : NaN;
}

/** IK 95% korelasi via transformasi Fisher z (pendekatan, n efektif = n pasangan). */
export function fisherCI(r: number, n: number): [number, number] {
  if (!Number.isFinite(r) || n < 4) return [NaN, NaN];
  const z = Math.atanh(Math.max(-0.999999, Math.min(0.999999, r)));
  const se = 1 / Math.sqrt(n - 3);
  return [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)];
}
