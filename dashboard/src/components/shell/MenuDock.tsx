import { useEffect, useRef, useState } from "react";
import { useFilters } from "../../lib/filters";
import { AirMark } from "../ui";

const I = {
  overview: <svg viewBox="0 0 24 24" aria-hidden><path d="M4 13.5 12 4l8 9.5M6.5 11v8.5h11V11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 19.5v-4.5h4v4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>,
  analytics: <svg viewBox="0 0 24 24" aria-hidden><path d="M4 19.5h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M6.5 16V11M11 16V6.5M15.5 16v-6M20 16V8.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>,
  method: <svg viewBox="0 0 24 24" aria-hidden><path d="M5 5.5c2.5-1.2 5-1.2 7 .5 2-1.7 4.5-1.7 7-.5v13c-2.5-1.2-5-1.2-7 .5-2-1.7-4.5-1.7-7-.5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M12 6v13" stroke="currentColor" strokeWidth="1.7" /></svg>,
  motion: <svg viewBox="0 0 24 24" aria-hidden><path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
};

/**
 * MenuDock: pengganti sidebar. Satu tombol di pojok kanan atas TopBar; klik membuka panel
 * yang turun ke bawah (stagger 40 ms per butir). Tanpa scrim — klik luar, Esc, atau Tab keluar
 * menutup panel dan mengembalikan fokus ke tombol.
 */
export function MenuDock() {
  const { view, go, setModal, modal } = useFilters();
  const [open, setOpen] = useState(false);
  const [reduce, setReduce] = useState(() => document.documentElement.dataset.motion === "reduce");
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.documentElement.dataset.motion = reduce ? "reduce" : "";
    window.dispatchEvent(new Event("motionchange"));
  }, [reduce]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); } };
    const onDown = (e: PointerEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);

  const active = modal === "methodology" ? "method" : view;
  const items = [
    { k: "overview", label: "Overview", icon: I.overview, on: () => { setOpen(false); go("overview"); } },
    { k: "analytics", label: "Analytics", icon: I.analytics, on: () => { setOpen(false); go("analytics"); } },
    { k: "method", label: "Metodologi", icon: I.method, on: () => { setOpen(false); setModal("methodology"); } },
  ];

  return (
    <div className={`menudock ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className="menudock__btn"
        aria-expanded={open}
        aria-controls="menudock-panel"
        aria-label="Menu navigasi"
        title="Menu"
        onClick={() => setOpen((o) => !o)}
      >
        <AirMark size={22} />
      </button>
      <div className="menudock__panel" id="menudock-panel" role="menu" aria-label="Navigasi utama" hidden={!open}>
        {items.map((it, i) => (
          <button
            key={it.k}
            type="button"
            role="menuitem"
            className={`menudock__item ${active === it.k ? "is-active" : ""}`}
            aria-current={active === it.k ? "page" : undefined}
            aria-haspopup={it.k === "method" ? "dialog" : undefined}
            style={{ animationDelay: `${i * 40}ms` }}
            onClick={it.on}
          >
            {it.icon}<span>{it.label}</span>
          </button>
        ))}
        <span className="menudock__sep" aria-hidden />
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={reduce}
          className="menudock__item menudock__item--toggle"
          style={{ animationDelay: `${items.length * 40}ms` }}
          onClick={() => setReduce((r) => !r)}
          title={reduce ? "Animasi minimal aktif" : "Aktifkan animasi minimal"}
        >
          {I.motion}<span>{reduce ? "Animasi minimal" : "Animasi penuh"}</span>
          <i className="menudock__dot" aria-hidden />
        </button>
      </div>
    </div>
  );
}
