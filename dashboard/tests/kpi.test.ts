// Uji integritas KPI: angka mesin KPI dashboard harus sama dengan laporan EDA/Tahap 4.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDataset } from "../src/lib/dataset";
import {
  availability, fullRange, networkExceedance, networkSeries, calendarMonthProfile, scopeStations, stationStat,
  stationPeriodMeans, exceedance, limitFor,
} from "../src/lib/kpi";
import type { CoreJson, DailyVar } from "../src/lib/types";

const core = JSON.parse(readFileSync(new URL("../src/data/core.json", import.meta.url), "utf8")) as CoreJson;
const ref = JSON.parse(readFileSync(new URL("./fixtures/reference.json", import.meta.url), "utf8"));
const ds = buildDataset(core);
const R = fullRange(ds);
const TOL = 0.01; // nilai disimpan dengan 2 desimal

describe("statistik stasiun (40_station_summary)", () => {
  it("median & P95 harian semua stasiun × polutan", () => {
    let checked = 0;
    for (const row of ref.stationSummary) {
      const s = stationStat(ds, row.station_code, row.parameter as DailyVar, R);
      expect(Math.abs(s.median - row.median_harian)).toBeLessThan(TOL);
      expect(Math.abs(s.p95 - row.p95_harian)).toBeLessThan(TOL);
      expect(Math.abs(s.mean - row.rata2_harian)).toBeLessThan(TOL);
      checked++;
    }
    expect(checked).toBeGreaterThan(140);
  });
  it("baseline: JKT-02 PM2.5 median ≈ 58,5 dan P95 ≈ 64,8; P95 KTG-01 & PKN-01", () => {
    const j = stationStat(ds, "JKT-02", "pm25", R);
    expect(j.median).toBeCloseTo(58.5, 1);
    expect(j.p95).toBeCloseTo(64.8, 1);
    expect(stationStat(ds, "KTG-01", "pm25", R).p95).toBeCloseTo(125.8, 1);
    expect(stationStat(ds, "PKN-01", "pm25", R).p95).toBeCloseTo(147.4, 1);
  });
});

describe("kepatuhan 24 jam (60_compliance_pp22, 62_comparison_who2021)", () => {
  it("jumlah hari usable dan hari melampaui identik", () => {
    const rows = ref.compliancePP.filter((r: { periode: string }) => r.periode === "24h");
    for (const r of rows) {
      const e = exceedance(ds, r.station_code, r.parameter, r.baku, R);
      expect([r.station_code, r.parameter, e.den, e.n]).toEqual([r.station_code, r.parameter, r.denominator, r.n_melampaui]);
    }
    const who = ref.complianceWHO.filter((r: { periode: string }) => r.periode === "24h");
    for (const r of who) expect(exceedance(ds, r.station_code, r.parameter, r.aqg, R).n).toBe(r.n_melampaui);
  });
  it("PM2.5 16/25 dan PM10 17/25 stasiun (tanpa dedup); versi dedup lebih kecil dan dilaporkan", () => {
    for (const [v, want] of [["pm25", 16], ["pm10", 17]] as const) {
      const all = scopeStations(ds, { variable: v, includeTwins: true });
      const ex = networkExceedance(ds, all.stations, v, limitFor(ds, "PP22_2021", v, "24h")!, R);
      expect([ex.exceeding.length, ex.nEvaluated]).toEqual([want, 25]);
      const dd = scopeStations(ds, { variable: v });
      expect(dd.stations).not.toContain("KTG-02");
      expect(dd.stations.length).toBe(24);
    }
  });
});

describe("pemantauan (01_eligibility)", () => {
  it("22 dari 27 stasiun memenuhi kriteria (tier utama PM2.5) pada periode penuh", () => {
    const av = availability(ds, ds.stations.map((s) => s.code), "pm25", R);
    expect(av.filter((a) => a.tier === "utama").length).toBe(22);
    for (const e of ref.eligibility.filter((r: { parameter: string }) => r.parameter === "pm25")) {
      const a = av.find((x) => x.code === e.station_code)!;
      expect(Math.abs(a.pct - e.pct_hari_usable)).toBeLessThan(0.01);
    }
  });
});

describe("deret jaringan (32_network_monthly, monthly mart)", () => {
  it("rata-rata bulanan & status representatif stasiun = monthly mart", () => {
    for (const code of ["BGL-01", "SM2-01", "PLB-01", "MDN-01"]) {
      const pm = stationPeriodMeans(ds, code, "pm25", R, "month");
      for (const m of ref.monthlyRepresentative.filter((r: { station_code: string; parameter: string }) => r.station_code === code && r.parameter === "pm25")) {
        const p = pm.find((x) => x.key === m.year_month)!;
        expect(p.representative).toBe(m.is_monthly_representative);
        expect(p.n).toBe(m.n_usable_days);
        if (m.n_usable_days) expect(Math.abs(p.mean - m.mean)).toBeLessThan(TOL);
      }
    }
  });
  it("median jaringan bulanan (tier utama, tanpa dedup) = EDA", () => {
    for (const v of ["pm25", "pm10"] as const) {
      const sc = scopeStations(ds, { variable: v, includeTwins: true, tiers: ["utama"] });
      const s = networkSeries(ds, sc.stations, v, R, "month");
      for (const r of ref.networkMonthly.filter((x: { parameter: string }) => x.parameter === v)) {
        const p = s.find((x) => x.key === r.year_month)!;
        expect(p.nStations).toBe(r.n_stasiun);
        expect(Math.abs(p.value - r.median_jaringan)).toBeLessThan(TOL);
      }
    }
  });
  it("profil bulan kalender: Agu–Okt 51,6–54,0; Feb–Mar ≈ 22,0", () => {
    const sc = scopeStations(ds, { variable: "pm25", includeTwins: true, tiers: ["utama"] });
    const prof = calendarMonthProfile(ds, sc.stations, "pm25", R);
    expect(prof[7].value).toBeCloseTo(51.6, 1);
    expect(prof[9].value).toBeCloseTo(54.0, 1);
    expect(prof[1].value).toBeCloseTo(22.0, 1);
  });
});

describe("kesehatan (glm_pooled.csv)", () => {
  it("RR pernapasan lag 0 = 1,086 (IK 1,065–1,107), I² ≈ 99,3%, 21 RS", () => {
    const h = JSON.parse(readFileSync(new URL("../src/data/health.json", import.meta.url), "utf8"));
    const r = h.glmPooled.find((g: { outcome: string; lag: number }) => g.outcome === "resp" && g.lag === 0);
    expect(r.rr_per10).toBeCloseTo(1.086, 3);
    expect(r.ci_low).toBeCloseTo(1.065, 3);
    expect(r.ci_high).toBeCloseTo(1.107, 3);
    expect(r.I2_pct).toBeCloseTo(99.3, 1);
    expect(r.n_rs).toBe(21);
    expect(h.hospitals.filter((x: { mapping_status: string }) => x.mapping_status === "validated").length).toBe(24);
  });
});
