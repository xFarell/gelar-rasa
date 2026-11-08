import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** true bila pengguna meminta gerak dikurangi (preferensi sistem atau tombol di footer). */
export function useReducedMotion(): boolean {
  const q = () => (typeof window !== "undefined" &&
    (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce"));
  const [r, setR] = useState(q);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(q());
    mq.addEventListener("change", on);
    window.addEventListener("motionchange", on);
    return () => { mq.removeEventListener("change", on); window.removeEventListener("motionchange", on); };
  }, []);
  return r;
}

/** Lebar elemen (ResizeObserver) untuk grafik responsif. */
export function useSize<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Lebar dan tinggi elemen (ResizeObserver) untuk grafik yang mengisi kartu. */
export function useBox<T extends HTMLElement>(): [React.RefObject<T>, { w: number; h: number }] {
  const ref = useRef<T>(null);
  const [b, setB] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    setB({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(([e]) => setB({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, b];
}

/** Sekali terlihat di viewport → true (untuk animasi masuk/scroll reveal). */
export function useInView<T extends Element>(margin = "0px 0px -10% 0px"): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    if (!ref.current || v) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [v, margin]);
  return [ref, v];
}

/** Angka naik halus dari nilai sebelumnya ke target. */
export function useCountUp(target: number, duration = 1100, start = true): number {
  const reduced = useReducedMotion();
  const [val, setVal] = useState(reduced ? target : 0);
  const from = useRef(0);
  useEffect(() => {
    if (!Number.isFinite(target)) { setVal(target); return; }
    if (reduced || !start) { setVal(start ? target : 0); from.current = start ? target : 0; return; }
    const a = from.current, t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(a + (target - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start, reduced]);
  return val;
}

/** Scroll reveal selektif: tambahkan data-reveal pada elemen; hook ini menandai saat terlihat. */
export function useScrollReveal(dep: unknown) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-reveal='in'])"));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { (e.target as HTMLElement).dataset.reveal = "in"; io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dep]);
}

export function usePromise<T>(fn: () => Promise<T>): { data: T | null; error: Error | null } {
  const [s, setS] = useState<{ data: T | null; error: Error | null }>({ data: null, error: null });
  useEffect(() => {
    let alive = true;
    fn().then((data) => alive && setS({ data, error: null }), (error) => alive && setS({ data: null, error }));
    return () => { alive = false; };
  }, [fn]);
  return s;
}
