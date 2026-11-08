/**
 * Transisi halaman: perspektif + rotateY halus + kedalaman + fade + skala (CSS, lihat .mt di app.css).
 * Kunci baru → elemen dipasang ulang dan animasi masuk diputar. Gerak dikurangi → hanya fade singkat.
 */
export function MotionTransition({ k, children, variant = "page" }: { k: string; children: React.ReactNode; variant?: "page" | "tab" }) {
  return <div key={k} className={`mt mt--${variant}`}>{children}</div>;
}
