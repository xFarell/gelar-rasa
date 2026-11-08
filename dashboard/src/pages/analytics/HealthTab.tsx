import { useState } from "react";
import { ForestPlot, LagChart } from "../../components/charts";
import { Card, Empty, Fit, Loading, Seg } from "../../components/ui";
import { loadHealth } from "../../lib/dataset";
import { fmt, OUTCOME_LABEL } from "../../lib/format";
import { usePromise } from "../../lib/hooks";

export default function HealthTab() {
  const { data: h, error } = usePromise(loadHealth);
  const [outcome, setOutcome] = useState("resp");
  const [lag, setLag] = useState(0);
  if (error) return <Empty title="Data kesehatan gagal dimuat">{error.message}</Empty>;
  if (!h) return <Loading label="Memuat data kesehatan…" />;

  const pooled = h.glmPooled.filter((g) => g.outcome === outcome).sort((a, b) => a.lag - b.lag);
  const sel = pooled.find((g) => g.lag === lag)!;
  const byH = h.glmByHospital.filter((g) => g.outcome === outcome && g.lag === lag);
  const hName = new Map(h.hospitals.map((x) => [x.hospital_id, x]));
  const nValid = h.hospitals.filter((x) => x.mapping_status === "validated").length;
  const strongest = pooled.reduce((a, b) => (b.rr_per10 > a.rr_per10 ? b : a), pooled[0]);

  return (
    <div className="tabgrid tabgrid--health">
      <div className="g-k kstrip">
        <div className="kstrip__i"><span>RR per 10 µg/m³ PM2.5</span><b className="num">{fmt(sel.rr_per10, 3)}</b><em>{OUTCOME_LABEL[outcome]}, lag {lag}</em></div>
        <div className="kstrip__i"><span>IK 95%</span><b className="num">{fmt(sel.ci_low, 3)}–{fmt(sel.ci_high, 3)}</b><em>{sel.ci_low > 1 ? "seluruhnya di atas 1" : sel.ci_high < 1 ? "seluruhnya di bawah 1" : "mencakup 1"}</em></div>
        <div className="kstrip__i"><span>Heterogenitas I²</span><b className="num">{fmt(sel.I2_pct, 1)}%</b><em>antar {sel.n_rs} rumah sakit</em></div>
        <div className="kstrip__i"><span>Pemetaan RS–stasiun tervalidasi</span><b className="num">{nValid}<small> dari {h.hospitals.length}</small></b><em>dipakai bila paparan penuh</em></div>
      </div>

      <Card className="g-a" title={`RR per lag 0–7: terkuat pada lag ${strongest.lag}`} sub="Lag k: PM2.5 k hari sebelum tanggal kasus · titik terisi: IK 95% di atas 1"
        actions={<label className="fld fld--inline"><span>Indikator</span><select className="select" value={outcome} onChange={(e) => setOutcome(e.target.value)}>{h.outcomes.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}</select></label>}>
        <Fit>{(_, hh) => <LagChart label={`RR per lag ${OUTCOME_LABEL[outcome]}`} rows={pooled.map((g) => ({ lag: g.lag, rr: g.rr_per10, lo: g.ci_low, hi: g.ci_high }))} height={hh} color="var(--c-pm25)" />}</Fit>
      </Card>

      <Card className="g-b" title={`Forest plot per rumah sakit, lag ${lag}`} sub={`${byH.length} RS · label: kode stasiun yang dipetakan · sumbu logaritmik`}
        actions={<Seg size="sm" label="Lag" value={String(lag)} onChange={(x) => setLag(+x)} options={pooled.map((g) => ({ v: String(g.lag), l: String(g.lag) }))} />}>
        {!byH.length ? <Empty /> : (
          <div className="scrollbody">
            <ForestPlot label="Forest plot RR per rumah sakit" pooled={{ rr: sel.rr_per10, lo: sel.ci_low, hi: sel.ci_high, label: "Gabungan" }}
              rows={[...byH].sort((a, b) => a.rr_per10 - b.rr_per10).map((g) => { const x = hName.get(g.hospital_id); return { id: x?.station_code ?? g.hospital_id, label: `${g.hospital_id} · stasiun ${x?.station_code ?? "—"}`, rr: g.rr_per10, lo: g.rr_ci_low, hi: g.rr_ci_high, note: `Variasi PM2.5 harian (SD) ${fmt(g.pm_sd, 1)} µg/m³ · ${g.n_hari} hari` }; })} />
          </div>
        )}
      </Card>

      <p className="g-n healthnote">
        <b>Asosiasi ekologis, bukan sebab-akibat.</b> Paparan berasal dari stasiun yang dipetakan ke rumah sakit, bukan paparan pasien; model menyesuaikan tren waktu, hari, suhu, dan kelembapan, dan memakai seluruh periode sehingga tidak mengikuti filter. I² tinggi berarti besar asosiasi sangat berbeda antar-RS.
      </p>
    </div>
  );
}
