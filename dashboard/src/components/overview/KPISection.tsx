import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useFilters, type TabId } from "../../lib/filters";
import type { Filters } from "../../lib/filters";
import { fmt, fmtDate } from "../../lib/format";
import { VAR_META } from "../../lib/kpi";
import type { KpiValue } from "../../lib/selectors";
import { CountUp } from "../ui";

interface KpiProps {
  label: string; unit?: string; v: KpiValue | null; digits?: number; suffix?: React.ReactNode;
  def: React.ReactNode; tab: TabId; patch?: Partial<Filters>; prevLabel: string | null; tone?: "crit";
}

/**
 * Kartu KPI dua sisi. Sisi depan: label + angka + delta. Sisi belakang: definisi metrik.
 * Flip dipicu hover pada ikon "i" (mouse), klik ikon (sentuh), atau fokus keyboard.
 * Klik area angka tetap membuka tab Analytics terkait.
 */
function KpiCard({ label, unit, v, digits = 1, suffix, def, tab, patch, prevLabel, tone }: KpiProps) {
  const { go } = useFilters();
  const val = v?.value ?? NaN;
  const delta = v && v.prev !== null && Number.isFinite(val) ? val - v.prev : null;
  const openAnalytics = () => go("analytics", tab, patch);

  const [open, setOpen] = useState(false);
  const id = useId();
  const cardRef = useRef<HTMLElement>(null);
  const infoRef = useRef<HTMLButtonElement>(null);
  // Sumber pembukaan: "hover" (mouse) atau "manual" (klik/tap/keyboard).
  // Hanya mode hover yang ditutup otomatis saat kursor meninggalkan kartu.
  const [mode, setMode] = useState<"hover" | "manual">("manual");
  // Jenis penunjuk terakhir yang menekan ikon: "mouse" → klik tidak menutup (hover sudah membuka);
  // sentuh/pen → klik men-toggle. Keyboard tidak memicu pointerdown, jadi ikut toggle.
  const lastPointer = useRef<string>("mouse");

  const close = useCallback(() => setOpen(false), []);
  const showByHover = useCallback(() => { setMode("hover"); setOpen(true); }, []);

  // Tutup otomatis saat kursor keluar kotak kartu. Memakai rect kartu (bukan pointerleave)
  // karena saat sisi depan/belakang berputar, elemen di bawah kursor sesaat hilang dan
  // memicu pointerleave palsu sehingga kartu menutup sendiri.
  useEffect(() => {
    if (!open || mode !== "hover") return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = cardRef.current?.getBoundingClientRect();
      if (!r) return;
      const pad = 6;
      const inside = e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
      if (!inside) setOpen(false);
    };
    document.addEventListener("pointermove", onMove);
    return () => document.removeEventListener("pointermove", onMove);
  }, [open, mode]);

  return (
    <article
      ref={cardRef}
      className={`kpi kpi--flip ${open ? "is-open" : ""} ${tone ? `kpi--${tone}` : ""}`}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close(); }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) { e.stopPropagation(); close(); infoRef.current?.focus(); }
      }}>
      <div className="kpi__inner">
        <div className="kpi__face kpi__face--front">
          <div className="kpi__top">
            <h3 className="kpi__label">{label}</h3>
            <button
              ref={infoRef} type="button" className="info"
              aria-label={`Definisi: ${label}`} aria-expanded={open} aria-controls={id}
              onPointerEnter={(e) => { if (e.pointerType === "mouse") showByHover(); }}
              onPointerDown={(e) => { lastPointer.current = e.pointerType; }}
              onFocus={() => { setMode("manual"); setOpen(true); }}
              onClick={(e) => {
                e.stopPropagation();
                // Keyboard (Enter/Space) → detail 0 → toggle.
                // Mouse: hover sudah membuka → klik hanya memastikan terbuka.
                // Sentuh / pen → toggle.
                if (e.detail > 0 && lastPointer.current === "mouse") { setMode("hover"); setOpen(true); return; }
                setMode("manual");
                setOpen((p) => !p);
              }}>i</button>
          </div>
          <button
            type="button" className="kpi__body" onClick={openAnalytics} tabIndex={open ? -1 : 0}
            aria-label={`${label}: ${fmt(val, digits)} ${unit ?? ""}. Buka analitik`}>
            <span className="kpi__value num">{Number.isFinite(val) ? <CountUp value={val} digits={digits} /> : "—"}{unit && <small>{unit}</small>}{suffix}</span>
            <span className="kpi__delta">
              {delta === null
                ? <span title="Periode sebelumnya dengan panjang sama berada di luar data">Tanpa periode pembanding</span>
                : <span><b aria-hidden>{delta > 0 ? "▲" : delta < 0 ? "▼" : "■"}</b> {delta > 0 ? "+" : ""}{fmt(delta, digits)} vs {prevLabel}</span>}
            </span>
          </button>
        </div>
        <div
          className="kpi__face kpi__face--back" id={id} aria-hidden={!open}>
          <button type="button" className="kpi__back-close" tabIndex={open ? 0 : -1} onClick={close} aria-label="Tutup definisi">×</button>
          <div className="kpi__back-t">{def}</div>
        </div>
      </div>
    </article>
  );
}

export function KPISection({ k }: { k: ReturnType<typeof import("../../lib/selectors").overviewKpis> }) {
  const { ds, f } = useFilters();
  const prevLabel = k.prev ? `${fmtDate(ds.cal.iso(k.prev.from))}–${fmtDate(ds.cal.iso(k.prev.to))}` : null;
  const pol = VAR_META[f.pollutant].short;
  const std = f.standard === "PP22_2021" ? "PP 22/2021" : "WHO 2021";
  const scopeNote = (v: KpiValue | null) => v ? `${v.nStations} stasiun, ${v.n.toLocaleString("id-ID")} stasiun-hari.` : "";
  return (
    <div className="kpis" aria-label="Indikator utama">
      <KpiCard label="Median PM2.5" unit="µg/m³" v={k.median25} tab="pollutants" patch={{ pollutant: "pm25", stat: "median" }} prevLabel={prevLabel}
        def={<>Nilai tengah rata-rata harian semua stasiun-hari dalam filter. {scopeNote(k.median25)} Stasiun dengan data kembar dihitung sekali.</>} />
      <KpiCard label="P95 PM2.5" unit="µg/m³" v={k.p95_25} tab="pollutants" patch={{ pollutant: "pm25", stat: "p95" }} prevLabel={prevLabel}
        def={<>95% stasiun-hari berada di bawah nilai ini; menggambarkan hari dengan konsentrasi tinggi. {scopeNote(k.p95_25)}</>} />
      <KpiCard label="Median PM10" unit="µg/m³" v={k.median10} tab="pollutants" patch={{ pollutant: "pm10", stat: "median" }} prevLabel={prevLabel}
        def={<>Nilai tengah rata-rata harian PM10 semua stasiun-hari dalam filter. {scopeNote(k.median10)}</>} />
      {k.exceeding && k.lim !== null ? (
        <KpiCard label={`Stasiun melampaui baku ${pol}`} v={k.exceeding} digits={0} tab="standards" prevLabel={prevLabel} tone="crit"
          suffix={<small>dari {k.exceeding.nStations}</small>}
          def={<>Jumlah stasiun dengan minimal satu hari rata-rata harian di atas baku 24 jam {std} ({fmt(k.lim, 0)} µg/m³). Bukan jumlah stasiun-hari.</>} />
      ) : (
        <article className="kpi kpi--na">
          <div className="kpi__top"><h3 className="kpi__label">Stasiun melampaui baku {pol}</h3></div>
          <p className="kpi__na">{std} tidak memiliki baku 24 jam untuk {pol}. Lihat tab Baku Mutu untuk baku 1 jam dan 8 jam.</p>
        </article>
      )}
    </div>
  );
}
