import { lazy, Suspense, useEffect } from "react";
import { FilterProvider, TABS, useFilters } from "./lib/filters";
import { loadCore } from "./lib/dataset";
import { usePromise } from "./lib/hooks";
import { ErrorBox, Loading, Tooltip } from "./components/ui";
import { Sidebar } from "./components/shell/Sidebar";
import { TopNavigation } from "./components/shell/TopBar";
import { MotionTransition } from "./components/shell/MotionTransition";

const OverviewPage = lazy(() => import("./pages/OverviewPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const MethodologyModal = lazy(() => import("./components/shell/MethodologyModal"));

/** AppLayout: sidebar + header + satu area konten setinggi layar (desktop) atau bergulir (ponsel). */
function AppLayout() {
  const { view, tab, modal } = useFilters();
  useEffect(() => {
    document.title = view === "overview" ? "Air in Motion" : `${TABS.find((t) => t.id === tab)?.label} · Air in Motion`;
  }, [view, tab]);
  return (
    <div className="app">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Lewati ke konten</a>
      <Sidebar />
      <div className="app__main">
        <TopNavigation />
        <main id="main" className="app__content" tabIndex={-1}>
          <Suspense fallback={<Loading label="Menyiapkan tampilan…" />}>
            <MotionTransition k={view}>{view === "overview" ? <OverviewPage /> : <AnalyticsPage />}</MotionTransition>
          </Suspense>
        </main>
      </div>
      {modal === "methodology" && <Suspense fallback={null}><MethodologyModal /></Suspense>}
      <Tooltip />
    </div>
  );
}

export default function App() {
  const { data, error } = usePromise(loadCore);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading label="Memuat data kualitas udara…" />;
  return <FilterProvider ds={data}><AppLayout /></FilterProvider>;
}
