import { useEffect, useRef } from "react";
import { useFilters } from "../../lib/filters";
import Methodology from "../../pages/Methodology";

/** Metodologi sebagai modal: konten panjang bergulir di dalam dialog, halaman utama tetap satu layar. */
export default function MethodologyModal() {
  const { setModal, f, set } = useFilters();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal();
    const onClose = () => setModal(null);
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, [setModal]);
  return (
    <dialog ref={ref} className="modal" aria-labelledby="mtitle" onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}>
      <div className="modal__inner">
        <header className="modal__head">
          <div>
            <p className="modal__kicker">Metodologi</p>
            <h2 id="mtitle">Bagaimana angka ini diperoleh</h2>
          </div>
          <label className="toggle" title="Stasiun dengan data kembar biasanya dihitung sekali (diwakili satu stasiun)">
            <input type="checkbox" checked={f.twins} onChange={(e) => set({ twins: e.target.checked })} />Hitung stasiun kembar terpisah
          </label>
          <button type="button" className="modal__close" onClick={() => ref.current?.close()} aria-label="Tutup metodologi">✕</button>
        </header>
        <div className="modal__body"><Methodology /></div>
      </div>
    </dialog>
  );
}
