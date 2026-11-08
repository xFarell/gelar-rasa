import { useEffect, useRef, useState } from "react";
import { useBox, useCountUp } from "../lib/hooks";
import { fmt } from "../lib/format";

// ---------------------------------------------------------------------
// Tooltip global (satu elemen, dipakai grafik, kota 3D, dan info KPI)
// ---------------------------------------------------------------------
type TipState = { x: number; y: number; content: React.ReactNode; show: boolean };
let setTipExt: ((s: TipState) => void) | null = null;
let lastTip: TipState = { x: 0, y: 0, content: null, show: false };
export const tip = {
  show(e: { clientX: number; clientY: number }, content: React.ReactNode) {
    lastTip = { x: e.clientX, y: e.clientY, content, show: true };
    setTipExt?.(lastTip);
  },
  hide() { lastTip = { ...lastTip, show: false }; setTipExt?.(lastTip); },
};
export function Tooltip() {
  const [s, set] = useState<TipState>(lastTip);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { setTipExt = set; return () => { setTipExt = null; }; }, []);
  const w = ref.current?.offsetWidth ?? 220, h = ref.current?.offsetHeight ?? 80;
  const left = Math.min(s.x + 16, window.innerWidth - w - 12);
  const top = s.y + h + 24 > window.innerHeight ? s.y - h - 14 : s.y + 16;
  return <div ref={ref} className="tooltip" role="status" data-show={s.show} style={{ left: Math.max(8, left), top }}>{s.content}</div>;
}
export const TipRow = ({ k, v }: { k: React.ReactNode; v: React.ReactNode }) => <div className="tt-row"><span>{k}</span><b>{v}</b></div>;

/** Tombol "i" kecil: definisi muncul saat hover atau fokus keyboard. */
export function InfoTip({ title, children }: { title: string; children: React.ReactNode }) {
  const show = (el: HTMLElement) => { const r = el.getBoundingClientRect(); tip.show({ clientX: r.right, clientY: r.bottom }, <><b>{title}</b><div className="tt-body">{children}</div></>); };
  return (
    <button type="button" className="info" aria-label={`Definisi: ${title}`}
      onPointerEnter={(e) => show(e.currentTarget)} onPointerLeave={() => tip.hide()} onFocus={(e) => show(e.currentTarget)} onBlur={() => tip.hide()}
      onClick={(e) => { e.stopPropagation(); show(e.currentTarget); }}>i</button>
  );
}

// ---------------------------------------------------------------------
// Logo resmi Gelar Rasa 2026: dipakai hanya bila aset ada di src/assets/brand/. Tanpa aset → tidak ada logo (tanpa placeholder).
const LOGO = Object.values(import.meta.glob("../assets/brand/gelar-rasa-2026-logo.{png,svg,webp,jpg}", { eager: true, query: "?url", import: "default" }))[0] as string | undefined;
export function Logo({ height = 30 }: { height?: number }) {
  return LOGO ? <img className="logo-img" src={LOGO} alt="Logo resmi Gelar Rasa 2026" style={{ height }} /> : null;
}

/** Ikon aliran udara (wordmark AIR IN MOTION, bukan logo kompetisi). */
export function AirMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="airmark">
      <path d="M4 11c4-4 8 4 12 0s8 4 12 0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M4 17c4-4 8 4 12 0s8 4 12 0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity=".7" />
      <path d="M4 23c4-4 8 4 12 0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity=".45" />
    </svg>
  );
}

// ---------------------------------------------------------------------
// Kartu
// ---------------------------------------------------------------------
export function Card({ title, sub, actions, children, className = "", foot, id, style }: {
  title?: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; foot?: React.ReactNode; id?: string; style?: React.CSSProperties;
}) {
  return (
    <section className={`card ${className}`} id={id} style={style}>
      {(title || actions) && (
        <header className="card__head">
          <div className="card__titles">{title && <h2 className="card__title">{title}</h2>}{sub && <p className="card__sub">{sub}</p>}</div>
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      {children}
      {foot && <div className="card__foot">{foot}</div>}
    </section>
  );
}

/** Area yang mengisi sisa tinggi kartu; anak menerima lebar dan tinggi terukur. */
export function Fit({ children, min = 120, className = "" }: { children: (w: number, h: number) => React.ReactNode; min?: number; className?: string }) {
  const [ref, b] = useBox<HTMLDivElement>();
  return <div ref={ref} className={`fit ${className}`} style={{ minHeight: min }}>{b.w > 0 && b.h > 0 && children(b.w, b.h)}</div>;
}

/** Angka dengan count-up singkat. */
export function CountUp({ value, digits = 1 }: { value: number; digits?: number }) {
  const v = useCountUp(value, 700, true);
  return <>{fmt(v, digits)}</>;
}

export function Loading({ label = "Memuat data…" }: { label?: string }) {
  return <div className="loading" role="status" aria-live="polite"><div className="breath" /><span>{label}</span></div>;
}
export function Empty({ title = "Tidak ada data untuk filter ini", children }: { title?: string; children?: React.ReactNode }) {
  return <div className="empty" role="status"><div><b>{title}</b>{children ?? "Perluas periode atau pilih wilayah lain."}</div></div>;
}
export function ErrorBox({ error }: { error: Error }) {
  return <div style={{ padding: 40 }}><div className="note note--crit"><div><b>Data gagal dimuat.</b> {error.message}</div></div></div>;
}

export function Seg<T extends string>({ value, options, onChange, label, size }: { value: T; options: { v: T; l: React.ReactNode; title?: string }[]; onChange: (v: T) => void; label: string; size?: "sm" }) {
  return (
    <div className={`seg ${size === "sm" ? "seg--sm" : ""}`} role="group" aria-label={label}>
      {options.map((o) => <button key={o.v} type="button" aria-pressed={value === o.v} title={o.title} onClick={() => onChange(o.v)}>{o.l}</button>)}
    </div>
  );
}

export function TierBadge({ tier }: { tier: string }) {
  const cls = tier === "utama" ? "ok" : tier === "terbatas" ? "warn" : "crit";
  const label = { utama: "Lengkap", terbatas: "Terbatas", tidak_layak: "Kurang", dikecualikan: "Dikecualikan" }[tier] ?? tier;
  return <span className={`badge badge--${cls}`}>{label}</span>;
}

/** Label status kepatuhan: teks + warna (bukan warna saja). */
export function ComplianceBadge({ exceed, na }: { exceed: boolean; na?: boolean }) {
  if (na) return <span className="badge badge--muted">Tidak dinilai</span>;
  return exceed ? <span className="badge badge--crit">Melampaui</span> : <span className="badge badge--ok">Memenuhi</span>;
}

/** Bagian tambahan yang dapat dibuka (detail teknis). */
export function More({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <details className="more">
      <summary>{title}{hint && <small>{hint}</small>}</summary>
      <div className="more__body">{children}</div>
    </details>
  );
}

/** Seksi sederhana untuk konten panjang (Metodologi). */
export function Section({ kicker, title, lede, children }: { kicker?: string; title?: React.ReactNode; lede?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="msec">
      {(title || kicker) && <div className="msec__head">{kicker && <p className="msec__kicker">{kicker}</p>}{title && <h3>{title}</h3>}{lede && <p className="msec__lede">{lede}</p>}</div>}
      {children}
    </section>
  );
}
