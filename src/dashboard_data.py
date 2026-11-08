"""Tahap 5 — lapisan data dashboard (AIR IN MOTION).

Membaca output yang SUDAH ADA (L3–L4, analysis-ready, laporan EDA/insight) dan menulis JSON ringkas
untuk aplikasi web di `dashboard/`. Tidak ada preprocessing, QC, atau imputasi ulang; L0–L4 tidak diubah.

Penggunaan (dari root proyek):
    python -m src.dashboard_data

Output:
    dashboard/src/data/core.json      meta, stasiun, rata-rata harian usable (×1000, null = tidak usable)
    dashboard/src/data/hourly.json    agregat jam: profil diurnal, pelampauan gas 1 jam/8 jam, wind rose
    dashboard/src/data/health.json    RS, kasus harian, hasil GLM & meta-analisis
    dashboard/src/data/insights.json  katalog insight, register uji, prioritas jaringan
    dashboard/tests/fixtures/reference.json  angka acuan dari laporan EDA/insight untuk uji KPI
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

from src import eda_analysis as ea

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "dashboard"
OUT = APP / "src" / "data"
FIX = APP / "tests" / "fixtures"

POLLUTANTS = ["pm25", "pm10", "so2", "co", "o3", "no2"]
METEO = {"temperature": "temperature_c", "humidity": "humidity_pct", "wind_speed": "wind_speed_ms"}
DAILY_VARS = POLLUTANTS + list(METEO)  # nama kolom harian: <var>_daily_mean
TWIN_VAR = {**{p: p for p in POLLUTANTS}, **METEO}
DIURNAL_VARS = ["pm25", "pm10", "no2", "o3"]
WIND_SPEED_BINS = [0, 1, 2, 3, math.inf]  # m/s
OUTCOMES = ["resp_admissions_under5", "resp_admissions_over60", "asthma_emergency_cases", "copd_admissions",
            "resp", "cvd", "death"]


def _num(x, nd=4):
    if x is None or (isinstance(x, float) and not math.isfinite(x)) or pd.isna(x):
        return None
    if isinstance(x, (np.bool_, bool)):
        return bool(x)
    if isinstance(x, (np.integer, int)):
        return int(x)
    return round(float(x), nd)


def _records(df: pd.DataFrame, nd=4) -> list[dict]:
    out = []
    for r in df.to_dict("records"):
        out.append({k: (_num(v, nd) if isinstance(v, (int, float, np.number, np.bool_, bool)) or v is None
                        else (None if pd.isna(v) else str(v))) for k, v in r.items()})
    return out


def _scaled(s: pd.Series, usable: pd.Series) -> list:
    """Nilai ×1000 dibulatkan ke integer; hari tidak usable → null (tidak diimputasi)."""
    v = np.where(usable.to_numpy(bool), np.round(s.to_numpy(float) * 1000), np.nan)
    return [None if np.isnan(x) else int(x) for x in v]


def _write(obj, path: Path) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    txt = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    path.write_text(txt, encoding="utf-8")
    return len(txt.encode())


# ---------------------------------------------------------------------
# core.json
# ---------------------------------------------------------------------
def build_stations(ctx, elig: pd.DataFrame) -> list[dict]:
    sd = pd.read_parquet(ROOT / "data/analysis_ready/station_dimension_ar.parquet")
    twins = pd.read_parquet(ROOT / "data/analysis_ready/twin_registry.parquet")
    net = pd.read_csv(ROOT / "reports/insights/network_stations.csv").set_index("station_code")
    mapping = pd.read_parquet(ROOT / "data/analytical_marts/hospital_station_mapping.parquet")
    out = []
    for _, s in sd.iterrows():
        st = s["station_code"]
        e = elig[elig["station_code"] == st].set_index("parameter")
        tw = twins[twins["station_code"] == st].set_index("variable")
        twin = {}
        for v, col in TWIN_VAR.items():
            if col in tw.index and bool(tw.loc[col, "potential_twin"]):
                r = tw.loc[col]
                twin[v] = {"group": r["twin_group_id"], "representative": bool(r["is_representative"]),
                           "members": [m.strip() for m in str(r["group_members"]).split(",")]}
        hosp = mapping[mapping["station_code"] == st]
        out.append({
            "code": st, "locationId": s["location_id"], "name": s["metadata_city"], "sensor": s["nama_sensor"],
            "provinsi": s["provinsi"], "kota": s["kota_kabupaten"], "kecamatan": s["kecamatan"],
            "pulau": s["pulau"], "siteClass": s["site_class"], "siteType": s["site_type"],
            "lat": _num(s["latitude_dd"], 5), "lon": _num(s["longitude_dd"], 5), "tz": s["tz_label"],
            "status": s["analysis_status"], "unitConverted": bool(s["unit_converted"]),
            "roadDistanceM": _num(s["distance_to_road_m"], 1), "trafficPerH": _num(s["traffic_intensity_per_h"], 1),
            "contexts": [c.replace("is_", "").replace("_context", "") for c in
                         ["is_peatland_context", "is_coastal_context", "is_industrial_context", "is_urban_context",
                          "is_traffic_context", "is_clean_background_context"] if bool(s[c])],
            "tier": {p: e.loc[p, "tier"] for p in e.index},
            "pctDaysUsable": {p: _num(e.loc[p, "pct_hari_usable"], 2) for p in e.index},
            "twin": twin,
            "nnKm": _num(net.loc[st, "nn_km"], 1), "nnStation": net.loc[st, "nn_stasiun"],
            "functional": bool(net.loc[st, "fungsional"]),
            "hospital": None if hosp.empty else {"id": hosp.iloc[0]["hospital_id"],
                                                 "name": hosp.iloc[0]["nama_rumah_sakit"],
                                                 "mapping": hosp.iloc[0]["mapping_status"],
                                                 "exposure": hosp.iloc[0]["exposure_status"]},
        })
    return out


def build_meta(ctx, daily: pd.DataFrame) -> dict:
    eda_cfg = ctx.cfg
    dec = yaml.safe_load((ROOT / "config/decisions.yaml").read_text(encoding="utf-8"))
    std = eda_cfg["standards"]
    return {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "period": {"start": str(daily["date"].min().date()), "end": str(daily["date"].max().date()),
                   "nDays": int(daily["date"].nunique())},
        "dataset": "Dataset_DA_Gelar_Rasa_2026 (sintetis, disediakan panitia Gelar Rasa 2026)",
        "units": "µg/m³ pada 25 °C, 1 atm (polutan); °C, % RH, m/s (meteorologi)",
        "standards": {
            k: {"source": v["source"], "url": v.get("url"), "note": v.get("note"),
                "limits": v["limits"], **({"o3_1h_hours": v["o3_1h_hours"], "o3_8h_window": v["o3_8h_window"]}
                                          if "o3_1h_hours" in v else {})}
            for k, v in std.items()},
        "rules": {
            "dailyMinHours": 18, "monthlyRepresentativePct": 75, "tierUtamaPct": 75, "tierTerbatasPct": 25,
            "rolling8MinHours": eda_cfg["compliance"]["rolling8_min_hours"],
            "annualMinPctDays": eda_cfg["compliance"]["annual_min_pct_days"],
            "annualMinQuarterPctDays": eda_cfg["compliance"]["annual_min_quarter_pct_days"],
            "episodeMinDays": eda_cfg["compliance"]["episode_min_days"],
        },
        "season": {"definitions": dec["season"]["definitions"], "episodeMonths": dec["season"]["episode_period"]["months"],
                   "episodeCaveat": dec["season"]["episode_period"]["caveat"].strip()},
        "unitDecision": {"stations": dec["unit_conversion"]["stations"], "main": dec["unit_conversion"]["main_method"],
                         "sensitivity": dec["unit_conversion"]["sensitivity_methods"]},
        "windSpeedBins": [b if math.isfinite(b) else None for b in WIND_SPEED_BINS],
        "pipeline": {
            "validation": pd.read_csv(ROOT / "reports/validation_report.csv")["status"].value_counts().to_dict(),
            "nSourceFiles": int(len(pd.read_csv(ROOT / "reports/data_manifest.csv"))),
            "hoursPerStation": int(ctx.hourly.groupby("station_code").size().max()),
        },
    }


def build_daily(ctx) -> dict:
    d = ctx.daily.sort_values(["station_code", "date"])
    dates = pd.date_range(d["date"].min(), d["date"].max(), freq="D")
    series = {}
    for st, g in d.groupby("station_code"):
        g = g.set_index("date").reindex(dates)
        series[st] = {v: _scaled(g[ea.dcol(v) if v in POLLUTANTS else f"{v}_daily_mean"],
                                 g[ea.ducol(v) if v in POLLUTANTS else f"{v}_daily_usable"].fillna(False))
                      for v in DAILY_VARS}
    return {"start": str(dates[0].date()), "n": len(dates), "scale": 1000, "vars": DAILY_VARS, "series": series}


# ---------------------------------------------------------------------
# hourly.json
# ---------------------------------------------------------------------
def build_hourly(ctx, elig: pd.DataFrame) -> dict:
    h = ctx.hourly
    months = sorted(h["year_month"].astype(str).unique())
    m_idx = {m: i for i, m in enumerate(months)}
    hh = h.assign(mi=h["year_month"].astype(str).map(m_idx), hr=h["hour"].astype(int))

    # Profil diurnal: jumlah & cacah jam usable per stasiun × bulan × jam (rata-rata gabungan tepat).
    diurnal = {}
    for v in DIURNAL_VARS:
        x = hh[hh[f"{v}_usable"]].groupby(["station_code", "mi", "hr"])[v].agg(["sum", "count"])
        per = {}
        for st, g in x.groupby(level=0):
            arr_s = np.zeros((len(months), 24)); arr_n = np.zeros((len(months), 24), int)
            gi = g.droplevel(0)
            arr_s[gi.index.get_level_values(0), gi.index.get_level_values(1)] = gi["sum"]
            arr_n[gi.index.get_level_values(0), gi.index.get_level_values(1)] = gi["count"]
            per[st] = {"sum": np.round(arr_s, 1).tolist(), "n": arr_n.tolist()}
        diurnal[v] = per

    # Pelampauan gas PP 22/2021 (1 jam & 8 jam) per stasiun × bulan — aturan identik dengan EDA (compliance_pp).
    std = ctx.cfg["standards"]["PP22_2021"]
    cc = ctx.cfg["compliance"]
    gas = {}
    for p, lims in std["limits"].items():
        sts = ea.eligible_stations(elig, p, ("utama", "terbatas"))
        for per, lim in lims.items():
            if per not in ("1h", "8h"):
                continue
            key = f"{p}_{per}"
            res = {}
            if per == "1h":
                sub = hh[hh["station_code"].isin(sts)]
                if p == "o3":
                    sub = sub[sub["hr"].isin(std["o3_1h_hours"])]
                agg = sub.assign(ex=(sub[p] > lim) & sub[f"{p}_usable"]).groupby(["station_code", "mi"]).agg(
                    den=(f"{p}_usable", "sum"), n=("ex", "sum"))
            else:
                r8 = ea.rolling8(ctx, p, sts)
                dm = ea.daily_max8(r8, tuple(std["o3_8h_window"]) if p == "o3" else None, cc["daily_max8_min_windows_frac"])
                dm["mi"] = pd.to_datetime(dm["date"]).dt.strftime("%Y-%m").map(m_idx)
                agg = dm.assign(ex=(dm["max"] > lim) & dm["valid"]).groupby(["station_code", "mi"]).agg(
                    den=("valid", "sum"), n=("ex", "sum"))
            for st, g in agg.groupby(level=0):
                den = np.zeros(len(months), int); n = np.zeros(len(months), int)
                gi = g.droplevel(0)
                den[gi.index] = gi["den"]; n[gi.index] = gi["n"]
                res[st] = {"den": den.tolist(), "n": n.tolist()}
            gas[key] = {"limit": lim, "unit": "jam usable" if per == "1h" else "hari (maks 8 jam valid)", "stations": res}

    # Wind rose: 16 sektor × kelas kecepatan, hanya jam dengan arah & kecepatan usable.
    w = hh[hh["wind_direction_deg_usable"] & hh["wind_speed_ms_usable"]]
    sector = np.floor(((w["wind_direction_deg"].to_numpy() % 360) + 11.25) / 22.5).astype(int) % 16
    sbin = np.digitize(w["wind_speed_ms"].to_numpy(), WIND_SPEED_BINS[1:-1])
    w = w.assign(sec=sector, sb=sbin)
    cnt = w.groupby(["station_code", "mi", "sec", "sb"]).size()
    rose = {}
    nb = len(WIND_SPEED_BINS) - 1
    for st, g in cnt.groupby(level=0):
        arr = np.zeros((len(months), 16, nb), int)
        gi = g.droplevel(0)
        arr[gi.index.get_level_values(0), gi.index.get_level_values(1), gi.index.get_level_values(2)] = gi.to_numpy()
        rose[st] = arr.reshape(len(months), -1).tolist()
    return {"months": months, "diurnal": diurnal, "gas": gas, "windRose": rose, "windSectors": 16,
            "windSpeedBins": [b if math.isfinite(b) else None for b in WIND_SPEED_BINS]}


# ---------------------------------------------------------------------
# health.json & insights.json
# ---------------------------------------------------------------------
def build_health(ctx) -> dict:
    hm = pd.read_parquet(ROOT / "data/analytical_marts/health_exposure_mart.parquet")
    d0, d1 = ctx.daily["date"].min(), ctx.daily["date"].max()
    n_outside = int(((hm["date"] < d0) | (hm["date"] > d1)).sum())
    hm = hm[(hm["date"] >= d0) & (hm["date"] <= d1)]
    dates = pd.date_range(d0, d1, freq="D")
    daily = {}
    for hid, g in hm.groupby("hospital_id"):
        g = g.drop_duplicates("date").set_index("date").reindex(dates)
        daily[hid] = {o: [None if pd.isna(x) else int(x) for x in g[o]] for o in OUTCOMES}
    mp = pd.read_parquet(ROOT / "data/analytical_marts/hospital_station_mapping.parquet")
    hospitals = _records(mp[["hospital_id", "nama_rumah_sakit", "station_code", "provinsi", "kota_kabupaten",
                             "kecamatan", "mapping_status", "exposure_status", "use_in_exposure_analysis",
                             "temp_r", "n_overlap_days", "pm25_daily_usable_pct"]], 4)
    hosp = pd.read_csv(ROOT / "data/raw/hospitals.csv")[["hospital_id", "kelas_faskes", "kapasitas_tempat_tidur"]]
    extra = hosp.set_index("hospital_id").to_dict("index")
    for h in hospitals:
        h.update({k: _num(v) if not isinstance(v, str) else v for k, v in extra.get(h["hospital_id"], {}).items()})
    pooled = pd.read_csv(ROOT / "reports/insights/glm_pooled.csv")
    by_h = pd.read_csv(ROOT / "reports/insights/glm_by_hospital.csv")
    sens = pd.read_csv(ROOT / "reports/insights/glm_sensitivity.csv")
    lag_sp = pd.read_csv(ROOT / "reports/eda/71_lag_spearman_summary.csv")
    return {"start": str(dates[0].date()), "n": len(dates), "outcomes": OUTCOMES, "nRowsOutsidePeriod": n_outside,
            "hospitals": hospitals, "daily": daily,
            "glmPooled": _records(pooled, 6), "glmByHospital": _records(by_h[by_h["analisis"] == "utama"], 6),
            "glmSensitivity": _records(sens, 6), "lagSpearman": _records(lag_sp, 4)}


def build_insights() -> dict:
    rd = lambda p: pd.read_csv(ROOT / p)  # noqa: E731
    return {
        "catalog": _records(rd("reports/insights/insight_catalog.csv")),
        "tests": _records(rd("reports/insights/statistical_test_register.csv")),
        "networkPriority": _records(rd("reports/insights/network_evaluation_priority.csv")),
        "episodeComparison": _records(rd("reports/insights/episode_period_comparison.csv")),
        "withinStationSpearman": _records(rd("reports/eda/50_corr_spearman_within_station.csv").rename(
            columns={"Unnamed: 0": "var"})),
        "pooledSpearman": _records(rd("reports/eda/50_corr_spearman_pooled.csv").rename(columns={"Unnamed: 0": "var"})),
        "decisionLog": (ROOT / "reports/decisions/decision_log.md").read_text(encoding="utf-8"),
    }


def build_reference(ctx) -> dict:
    """Angka acuan dari laporan sebelumnya — dipakai uji otomatis mesin KPI dashboard."""
    rd = lambda p: pd.read_csv(ROOT / p)  # noqa: E731
    summ = rd("reports/eda/40_station_summary.csv")
    comp = rd("reports/eda/60_compliance_pp22.csv")
    netm = rd("reports/eda/32_network_monthly.csv")
    elig = rd("reports/eda/01_eligibility.csv")
    who = rd("reports/eda/62_comparison_who2021.csv")
    km = rd("reports/eda/80_key_metrics.csv")
    return {
        "stationSummary": _records(summ[["parameter", "station_code", "tier", "median_harian", "p95_harian",
                                         "rata2_harian"]], 6),
        "compliancePP": _records(comp, 6), "complianceWHO": _records(who[["parameter", "periode", "aqg", "station_code",
                                                                        "denominator", "n_melampaui"]], 6),
        "networkMonthly": _records(netm, 6),
        "eligibility": _records(elig, 4),
        "keyMetrics": _records(km, 6),
        "monthlyRepresentative": _records(ctx.monthly[ctx.monthly["parameter"].isin(["pm25", "pm10"])][
            ["station_code", "year_month", "parameter", "n_usable_days", "coverage_pct", "is_monthly_representative",
             "mean"]], 6),
    }


def main() -> None:
    ctx = ea.load_eda_context(ROOT)
    elig = pd.read_csv(ROOT / "reports/eda/01_eligibility.csv")
    sizes = {}
    core = {"meta": build_meta(ctx, ctx.daily), "stations": build_stations(ctx, elig), "daily": build_daily(ctx)}
    sizes["core.json"] = _write(core, OUT / "core.json")
    sizes["hourly.json"] = _write(build_hourly(ctx, elig), OUT / "hourly.json")
    sizes["health.json"] = _write(build_health(ctx), OUT / "health.json")
    sizes["insights.json"] = _write(build_insights(), OUT / "insights.json")
    sizes["reference.json"] = _write(build_reference(ctx), FIX / "reference.json")
    for k, v in sizes.items():
        print(f"{k:16s} {v / 1e6:6.2f} MB")


if __name__ == "__main__":
    main()
