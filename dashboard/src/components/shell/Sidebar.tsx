import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFilters } from "../../lib/filters";
import { AirMark } from "../ui";

const I = {
  overview: <svg viewBox="0 0 24 24" aria-hidden><path d="M4 13.5 12 4l8 9.5M6.5 11v8.5h11V11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 19.5v-4.5h4v4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>,
  analytics: <svg viewBox="0 0 24 24" aria-hidden><path d="M4 19.5h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M6.5 16V11M11 16V6.5M15.5 16v-6M20 16V8.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>,
  method: <svg viewBox="0 0 24 24" aria-hidden><path d="M5 5.5c2.5-1.2 5-1.2 7 .5 2-1.7 4.5-1.7 7-.5v13c-2.5-1.2-5-1.2-7 .5-2-1.7-4.5-1.7-7-.5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M12 6v13" stroke="currentColor" strokeWidth="1.7" /></svg>,
  motion: <svg viewBox="0 0 24 24" aria-hidden><path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
};

/** Sidebar hijau tua: navigasi dua halaman, metodologi (modal), dan mode animasi minimal. */
export function Sidebar() {
  const { view, go, setModal, modal } = useFilters();
  const nav = useRef<HTMLUListElement>(null);
  const [ind, setInd] = useState<{ top: number; left: number; w: number; h: number } | null>(null);
  const [reduce, setReduce] = useState(() => document.documentElement.dataset.motion === "reduce");
  useEffect(() => {
    document.documentElement.dataset.motion = reduce ? "reduce" : "";
    window.dispatchEvent(new Event("motionchange"));
  }, [reduce]);
  const active = modal === "methodology" ? "method" : view;
  useLayoutEffect(() => {
    const place = () => {
      const el = nav.current?.querySelector<HTMLElement>(`[data-k="${active}"]`);
      if (el) setInd({ top: el.offsetTop, left: el.offsetLeft, w: el.offsetWidth, h: el.offsetHeight });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active]);
  const items = [
    { k: "overview", label: "Overview", icon: I.overview, on: () => go("overview") },
    { k: "analytics", label: "Analytics", icon: I.analytics, on: () => go("analytics") },
    { k: "method", label: "Metodologi", icon: I.method, on: () => setModal("methodology") },
  ];
  return (
    <aside className="sidebar" aria-label="Navigasi utama">
      <button className="sidebar__mark" onClick={() => go("overview")} aria-label="AIR IN MOTION, ke Overview"><AirMark size={26} /></button>
      <nav>
        <ul ref={nav} className="sidebar__nav">
          {ind && <li className="sidebar__ind" aria-hidden style={{ transform: `translate(${ind.left}px, ${ind.top}px)`, width: ind.w, height: ind.h }} />}
          {items.map((it) => (
            <li key={it.k} data-k={it.k}>
              <button type="button" onClick={it.on} aria-current={active === it.k ? "page" : undefined} aria-haspopup={it.k === "method" ? "dialog" : undefined}>
                {it.icon}<span>{it.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <button type="button" className="sidebar__motion" aria-pressed={reduce} onClick={() => setReduce(!reduce)} title={reduce ? "Animasi minimal aktif" : "Aktifkan animasi minimal"}>
        {I.motion}<span>{reduce ? "Animasi minimal" : "Animasi penuh"}</span>
      </button>
    </aside>
  );
}
