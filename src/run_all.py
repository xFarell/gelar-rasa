"""Orkestrator pipeline lengkap: data mentah → Tahap 2 (preprocessing) → Tahap 3 (EDA) → Tahap 4 (insights)
→ Tahap 5 (ekspor data dashboard).

Penggunaan (dari root proyek):
    python -m src.run_all                      # semua tahap
    python -m src.run_all --stages eda insights
    python -m src.run_all --with-nb02          # juga mengeksekusi notebook 02 (dokumentasi)

Setiap tahap notebook dieksekusi pada proses terpisah dengan kernel Python yang sama
(`sys.executable`), sehingga aman dijalankan dari dalam Jupyter/VS Code.
"""
from __future__ import annotations

import argparse
import shutil
import sys
import time
import zipfile
from pathlib import Path

KERNEL_NAME = "gelarrasa2026"
STAGES = ["raw", "preprocessing", "eda", "insights", "dashboard"]
NOTEBOOKS = {
    "preprocessing": "02_data_preprocessing.ipynb",
    "eda": "03_exploratory_data_analysis.ipynb",
    "insights": "04_analytical_insights.ipynb",
}
REQUIRED_OUTPUTS = {
    "preprocessing": ["data/hourly_grid/aqms_hourly_grid.parquet", "data/analytical_marts/daily_mart.parquet",
                      "data/analytical_marts/health_exposure_mart.parquet",
                      "data/quality_flagged/aqms_quality_flagged.parquet", "reports/validation_report.csv"],
    "eda": ["reports/eda/60_compliance_pp22.csv", "reports/eda/80_key_metrics.csv"],
    "insights": ["data/analysis_ready/daily_ar.parquet", "reports/insights/insight_catalog.csv",
                 "reports/decisions/decision_log.md"],
}
DATASET_ZIP_GLOBS = ["Dataset_DA_Gelar_Rasa_2026*.zip", "Dataset*Gelar*Rasa*.zip"]


def find_root(start: Path | None = None) -> Path:
    here = (start or Path.cwd()).resolve()
    for cand in [here, *here.parents]:
        if (cand / "config").is_dir() and (cand / "src").is_dir():
            return cand
    raise FileNotFoundError("Root proyek (berisi config/ dan src/) tidak ditemukan. Buka folder proyek terlebih dahulu.")


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ---------------------------------------------------------------------
# Tahap 0 — data mentah
# ---------------------------------------------------------------------
def count_raw(raw: Path) -> dict[str, int]:
    return {"aqms": len(list(raw.glob("*_AQMS.csv"))), "health": len(list(raw.glob("HLT-01_*.csv"))),
            "master": sum((raw / f).exists() for f in ("sites.csv", "sensors.csv", "hospitals.csv")),
            "metadata": sum((raw / "metadata" / f).exists() for f in ("metadata_sensors.csv", "metadata_dates.csv"))}


def raw_complete(raw: Path) -> bool:
    return count_raw(raw) == {"aqms": 27, "health": 1, "master": 3, "metadata": 2}


def find_dataset_zip(root: Path) -> Path | None:
    for folder in (root, root / "data", root / "data" / "raw", root.parent):
        for pat in DATASET_ZIP_GLOBS:
            hits = sorted(folder.glob(pat))
            if hits:
                return hits[0]
    return None


def prepare_raw(root: Path) -> dict[str, int]:
    """Memastikan 33 file mentah ada di data/raw/. Bila belum, mengekstrak zip dataset (tanpa mengubah isi file).

    Bila zip berisi satu folder pembungkus, isinya dipindahkan naik satu tingkat."""
    raw = root / "data" / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    if raw_complete(raw):
        log(f"Data mentah lengkap di {raw.relative_to(root)}: {count_raw(raw)}")
        return count_raw(raw)
    zp = find_dataset_zip(root)
    if zp is None:
        raise FileNotFoundError(
            "Data mentah belum lengkap di data/raw/ dan zip dataset tidak ditemukan. Letakkan "
            "'Dataset_DA_Gelar_Rasa_2026.zip' di folder proyek (atau ekstrak isinya ke data/raw/), lalu ulangi.")
    log(f"Mengekstrak {zp.name} → {raw.relative_to(root)}")
    tmp = raw.parent / "_raw_extract_tmp"
    shutil.rmtree(tmp, ignore_errors=True)
    with zipfile.ZipFile(zp) as z:
        z.extractall(tmp)
    src = tmp
    entries = [p for p in tmp.iterdir() if not p.name.startswith(("__MACOSX", "."))]
    if len(entries) == 1 and entries[0].is_dir() and not list(tmp.glob("*_AQMS.csv")):
        src = entries[0]
    for item in src.iterdir():
        target = raw / item.name
        if target.exists():
            continue  # tidak menimpa file mentah yang sudah ada
        shutil.move(str(item), str(target))
    shutil.rmtree(tmp, ignore_errors=True)
    if not raw_complete(raw):
        raise FileNotFoundError(f"Setelah ekstraksi, isi data/raw/ belum sesuai: {count_raw(raw)} "
                                "(harus aqms=27, health=1, master=3, metadata=2).")
    log(f"Data mentah siap: {count_raw(raw)}")
    return count_raw(raw)


# ---------------------------------------------------------------------
# Kernel & eksekusi notebook
# ---------------------------------------------------------------------
def ensure_kernel() -> str:
    """Mendaftarkan kernelspec yang menunjuk ke Python ini (sekali saja, tingkat pengguna)."""
    from jupyter_client.kernelspec import KernelSpecManager
    if KERNEL_NAME not in KernelSpecManager().find_kernel_specs():
        from ipykernel.kernelspec import install
        install(user=True, kernel_name=KERNEL_NAME, display_name="Python (Gelar Rasa 2026)")
        log(f"Kernel '{KERNEL_NAME}' didaftarkan untuk {sys.executable}")
    return KERNEL_NAME


def run_notebook(root: Path, name: str, timeout: int = 3600) -> float:
    """Mengeksekusi notebook di tempat (output disimpan ke file yang sama). Gagal keras bila ada error."""
    import nbformat
    from nbclient import NotebookClient
    path = root / "notebooks" / name
    nb = nbformat.read(path, as_version=4)
    t = time.time()
    client = NotebookClient(nb, timeout=timeout, kernel_name=ensure_kernel(),
                            resources={"metadata": {"path": str(path.parent)}})
    try:
        client.execute()
    finally:
        nbformat.write(nb, path)
    errors = [o for c in nb.cells if c.cell_type == "code" for o in c.get("outputs", []) if o.output_type == "error"]
    if errors:
        raise RuntimeError(f"{name}: {errors[0]['ename']}: {errors[0]['evalue']}")
    return time.time() - t


def check_outputs(root: Path, stage: str) -> None:
    missing = [p for p in REQUIRED_OUTPUTS.get(stage, []) if not (root / p).exists()]
    if missing:
        raise FileNotFoundError(f"Output tahap '{stage}' tidak lengkap: {missing}")


# ---------------------------------------------------------------------
# Tahap 2–4
# ---------------------------------------------------------------------
def run_preprocessing(root: Path, with_nb02: bool = False) -> None:
    if with_nb02:
        log("Tahap 2 — mengeksekusi notebook 02 (preprocessing + dokumentasi)")
        log(f"Tahap 2 selesai ({run_notebook(root, NOTEBOOKS['preprocessing']):.0f} dtk)")
    else:
        log("Tahap 2 — menjalankan pipeline preprocessing (src.pipeline)")
        sys.path.insert(0, str(root))
        from src.pipeline import run_pipeline
        t = time.time()
        ctx = run_pipeline(root)
        counts = ctx.validator.frame()["status"].value_counts().to_dict()
        log(f"Tahap 2 selesai ({time.time() - t:.0f} dtk) — validasi: {counts}")
    check_outputs(root, "preprocessing")


def run_stage_notebook(root: Path, stage: str, label: str) -> None:
    log(f"{label} — mengeksekusi {NOTEBOOKS[stage]}")
    log(f"{label} selesai ({run_notebook(root, NOTEBOOKS[stage]):.0f} dtk)")
    check_outputs(root, stage)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description="Pipeline lengkap Gelar Rasa 2026")
    ap.add_argument("--stages", nargs="+", choices=STAGES, default=STAGES)
    ap.add_argument("--with-nb02", action="store_true", help="eksekusi notebook 02 alih-alih src.pipeline")
    args = ap.parse_args(argv)
    root = find_root()
    t0 = time.time()
    if "raw" in args.stages:
        prepare_raw(root)
    if "preprocessing" in args.stages:
        run_preprocessing(root, args.with_nb02)
    if "eda" in args.stages:
        check_outputs(root, "preprocessing")
        run_stage_notebook(root, "eda", "Tahap 3 (EDA)")
    if "insights" in args.stages:
        check_outputs(root, "eda")
        run_stage_notebook(root, "insights", "Tahap 4 (Insights)")
    if "dashboard" in args.stages:
        check_outputs(root, "insights")
        log("Tahap 5 — mengekspor lapisan data dashboard (src.dashboard_data)")
        sys.path.insert(0, str(root))
        from src.dashboard_data import main as export_dashboard
        export_dashboard()
    log(f"Pipeline selesai dalam {time.time() - t0:.0f} dtk")


if __name__ == "__main__":
    main()
