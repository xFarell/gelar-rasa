import { useEffect, useRef } from "react";
import { City3DScene as Engine, type LabelSpec } from "./engine";
import type { StationVisual } from "./objects";

export interface City3DProps {
  stations: { code: string; lat: number; lon: number }[];
  nn: [string, string][];
  visuals: StationVisual[];
  selected: string | null;
  focus: string[];
  labels: LabelSpec[];
  flow: { x: number; z: number; speed: number } | null;
  animate: boolean;
  onSelect: (code: string) => void;
  onHover: (code: string | null, e: { clientX: number; clientY: number } | null) => void;
  label: string;
}

/** Pembungkus React untuk mesin three.js (dimuat terpisah agar tidak memperlambat muatan awal). */
export default function City3DScene(p: City3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const eng = useRef<Engine | null>(null);
  const cbs = useRef({ onSelect: p.onSelect, onHover: p.onHover });
  cbs.current = { onSelect: p.onSelect, onHover: p.onHover };

  useEffect(() => {
    const e = new Engine(host.current!, overlay.current!, p.stations, p.nn,
      { onSelect: (c) => cbs.current.onSelect(c), onHover: (c, ev) => cbs.current.onHover(c, ev) }, p.animate);
    eng.current = e;
    return () => { e.dispose(); eng.current = null; };
    // mesin dibuat sekali; data diperbarui lewat efek di bawah
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { eng.current?.setData(p.visuals); }, [p.visuals]);
  useEffect(() => { eng.current?.setSelected(p.selected); }, [p.selected]);
  useEffect(() => { eng.current?.setLabels(p.labels); }, [p.labels]);
  useEffect(() => { eng.current?.setFlow(p.flow); }, [p.flow]);
  useEffect(() => { eng.current?.setAnimate(p.animate); }, [p.animate]);
  const focusKey = p.focus.join();
  useEffect(() => { eng.current?.focus(p.focus); }, [focusKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="city3d">
      <div ref={host} className="city3d__host" role="img" aria-label={p.label} />
      <div ref={overlay} className="city3d__labels" aria-hidden />
      <div className="city3d__ctrl" role="group" aria-label="Kontrol kamera">
        <button type="button" onClick={() => eng.current?.zoom(0.78)} aria-label="Perbesar" title="Perbesar">+</button>
        <button type="button" onClick={() => eng.current?.zoom(1.28)} aria-label="Perkecil" title="Perkecil">−</button>
        <button type="button" onClick={() => eng.current?.reset()} aria-label="Kembalikan sudut kamera" title="Kembalikan sudut kamera">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  );
}
