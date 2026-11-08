import { Fragment, useMemo } from "react";
import { More, Section } from "../components/ui";
import { useFilters } from "../lib/filters";
import { availability, fullRange, KPI_DEFS, POLLUTANTS, VAR_META } from "../lib/kpi";
import { loadInsights } from "../lib/dataset";
import { fmt, fmtDate } from "../lib/format";
import { usePromise } from "../lib/hooks";

const KEY_LIMITS: [string, string][] = [
  ["Data simulasi", "Dataset disediakan panitia untuk kompetisi. Kesimpulan berlaku untuk dataset ini, bukan untuk kondisi udara Indonesia yang sebenarnya."],
  ["Data kembar", "Gas dan meteorologi di 11–14 stasiun lintas pulau hampir identik. Data tidak dihapus; agregat memakai satu wakil per kelompok."],
  ["Cakupan tidak merata", "MER-01 dan JMB-02 hampir tanpa data. Jumlah stasiun bukan ukuran cakupan populasi."],
  ["Agustus–Oktober", "Penanda bulan dengan PM tertinggi. Tidak ada data titik api, curah hujan, atau komposisi aerosol untuk menyimpulkan penyebabnya."],
  ["Asosiasi kesehatan", "Asosiasi tingkat stasiun dan rumah sakit, bukan paparan individu dan bukan bukti sebab-akibat. I² sekitar 99%."],
  ["Kota 3D", "Miniatur kota adalah model representatif, bukan model geografis kota mana pun. Stasiun disusun menurut urutan bujur (barat → timur) dan lintang; jarak tidak sebenarnya. Tinggi kolom dan warna berasal dari data. Bangunan dan pohon dekoratif. Partikel bukan simulasi sebaran polutan; arahnya mengikuti arah angin dominan dari data wind rose bila tersedia."],
  ["Konversi satuan gas", "Gas di PSW-01, MDN-01, dan BJB-01 dikonversi dari ppm; level absolutnya bergantung pada asumsi 25 °C, 1 atm."],
];

const MORE_LIMITS: [string, string][] = [
  ["Periode pendek", "2026 hanya sampai 14 Oktober. Baku tahunan dinilai untuk 2024 dan 2025; perbandingan antar-tahun bukan uji tren."],
  ["Musim kalender", "Pembagian musim adalah pembagian bulan, bukan musim meteorologis terverifikasi."],
  ["Tanpa koreksi kelembapan", "Konsentrasi PM tidak dikoreksi higroskopis; analisis kelembapan bersifat eksplorasi."],
  ["Tanpa data populasi", "Kasus adalah jumlah, bukan laju per penduduk. Prioritas jaringan tidak memperhitungkan populasi atau luas wilayah."],
  ["Data jam per bulan", "Pelampauan 1 jam dan 8 jam, profil jam harian, dan wind rose diekspor per bulan, sehingga filter tanggal berlaku per bulan penuh untuk komponen itu."],
  ["Belum tersedia", "Pedoman WHO O₃ 8 jam dan musim puncak O₃ belum dihitung di dashboard (ada di laporan EDA)."],
  ["Identitas rumah sakit", "Nama rumah sakit disamarkan dalam dataset; dashboard memakai kode RS."],
];

// Definisi ringkas berbahasa awam; rumus lengkap ada di KPI_DEFS (src/lib/kpi.ts) pada lampiran.
const KEY_KPI: [string, string][] = [
  ["Median harian", "Nilai tengah rata-rata harian semua stasiun dalam filter. Stasiun dengan data kembar dihitung sekali."],
  ["P95 harian", "95% hari-stasiun berada di bawah nilai ini. Menggambarkan hari dengan konsentrasi tinggi."],
  ["Stasiun melampaui baku", "Stasiun dengan minimal satu hari yang rata-rata hariannya di atas baku 24 jam."],
  ["Median per bulan", "Nilai tengah rata-rata bulanan antarstasiun. Bulan dengan data kurang dari 75% tidak dihitung untuk stasiun itu."],
  ["Data lengkap", "Stasiun dengan data valid pada minimal 75% hari dalam periode."],
  ["RR per 10 µg/m³", "Perbandingan jumlah kasus pada hari dengan PM2.5 lebih tinggi 10 µg/m³, setelah tren waktu, hari, suhu, dan kelembapan disesuaikan."],
];

function MiniMarkdown({ text }: { text: string }) {
  const blocks = useMemo(() => text.split(/\n(?=#{1,3} )/), [text]);
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith("`") ? <code key={i}>{p.slice(1, -1)}</code> : <Fragment key={i}>{p}</Fragment>);
  return (
    <div className="prose">
      {blocks.map((b, i) => {
        const [head, ...rest] = b.split("\n");
        const h = head.match(/^(#{1,3}) (.*)/);
        const lines = (h ? rest : [head, ...rest]).join("\n").split(/\n(?=- )/).map((l) => l.trim()).filter(Boolean);
        return (
          <Fragment key={i}>
            {h && h[1].length > 1 && <h3>{h[2]}</h3>}
            {lines.map((l, k) => l.startsWith("- ") ? <ul key={k} style={{ margin: "4px 0" }}><li>{inline(l.slice(2).replace(/\n\s*/g, " "))}</li></ul> : <p key={k}>{inline(l.replace(/\n\s*/g, " "))}</p>)}
          </Fragment>
        );
      })}
    </div>
  );
}

export default function Methodology() {
  const { ds } = useFilters();
  const insights = usePromise(loadInsights).data;
  const { start, end, nDays } = ds.meta.period;
  const av = useMemo(() => availability(ds, ds.stations.map((s) => s.code), "pm25", fullRange(ds)), [ds]);
  const nProv = new Set(ds.stations.map((s) => s.provinsi)).size;
  const nIsland = new Set(ds.stations.map((s) => s.pulau)).size;
  const nHosp = ds.stations.filter((s) => s.hospital).length;
  const val = ds.meta.pipeline.validation;

  return (
    <>
      <Section kicker="Dataset" title="Data dan cakupan">
        <div className="grid">
          <div className="c-6">
            <dl className="dl" style={{ fontSize: 15, marginTop: 0 }}>
              <dt>Sumber</dt><dd>Dataset kompetisi Gelar Rasa 2026 (data simulasi dari panitia). Tidak ada data eksternal; garis pantai peta dari Natural Earth.</dd>
              <dt>Periode</dt><dd className="num">{fmtDate(start, true)} sampai {fmtDate(end, true)} ({nDays.toLocaleString("id-ID")} hari)</dd>
              <dt>File</dt><dd className="num">{ds.meta.pipeline.nSourceFiles} file: 27 stasiun udara, data kesehatan harian, 3 tabel referensi, 2 metadata</dd>
              <dt>Satuan</dt><dd>{ds.meta.units}</dd>
            </dl>
          </div>
          <div className="c-6">
            <dl className="dl" style={{ fontSize: 15, marginTop: 0 }}>
              <dt>Stasiun</dt><dd className="num">{ds.stations.length} stasiun di {nProv} provinsi dan {nIsland} pulau</dd>
              <dt>Data PM2.5 lengkap</dt><dd className="num">{av.filter((a) => a.tier === "utama").length} stasiun (≥ 75% hari memiliki data)</dd>
              <dt>Rumah sakit</dt><dd className="num">{nHosp} RS, masing-masing dipetakan ke satu stasiun</dd>
              <dt>Parameter</dt><dd>PM2.5, PM10, SO₂, NO₂, O₃, CO, suhu, kelembapan, kecepatan dan arah angin, tujuh indikator kasus RS</dd>
            </dl>
          </div>
        </div>
      </Section>

      <Section kicker="Pengolahan" title="Dari file mentah ke dashboard">
        <ol className="tiles" style={{ listStyle: "none", padding: 0, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {[["1", "Standardisasi", "Nama kolom, angka, satuan, dan koreksi jam disamakan."], ["2", "Kualitas data", "Nilai bermasalah ditandai, tidak dihapus."], ["3", "Grid jam", `${ds.meta.pipeline.hoursPerStation.toLocaleString("id-ID")} jam per stasiun, tanpa pengisian nilai kosong.`], ["4", "Agregasi", "Rata-rata harian butuh ≥ 18 jam data; bulanan ≥ 75% hari."], ["5", "Dashboard", "Semua angka dihitung ulang di browser dari rata-rata harian."]].map(([k, t, d]) => (
            <li key={k} className="tile" style={{ paddingRight: 16 }}><span className="tile__n">{k}</span><h3>{t}</h3><p>{d}</p></li>
          ))}
        </ol>
        <p className="panel__foot">Validasi otomatis pipeline: {Object.entries(val).map(([k, n]) => `${n} ${k}`).join(", ")}{val.FAIL ? "" : ", 0 FAIL"}.</p>
      </Section>

      <Section kicker="Definisi" title="KPI utama">
        <dl className="dl" style={{ gridTemplateColumns: "minmax(160px, 260px) 1fr", gap: "14px 28px", fontSize: 15, maxWidth: 980 }}>
          {KEY_KPI.map(([n, d]) => <Fragment key={n}><dt style={{ color: "var(--text)", fontWeight: 700 }}>{n}</dt><dd className="muted">{d}</dd></Fragment>)}
        </dl>
      </Section>

      <Section kicker="Baku mutu" title="Standar yang digunakan" lede="PP 22/2021 dan WHO 2021 dinilai terpisah. Rata-rata harian hanya dibandingkan dengan baku 24 jam, dan rata-rata tahunan hanya untuk tahun kalender lengkap.">
        <div className="table-wrap" style={{ maxWidth: 720 }}>
          <table className="data">
            <thead><tr><th>Polutan</th><th>Waktu rata-rata</th><th className="r">PP 22/2021</th><th className="r">WHO 2021</th></tr></thead>
            <tbody>{(["pm25", "pm10"] as const).flatMap((p) => ["24h", "annual"].map((per) => (
              <tr key={p + per}><td><b>{VAR_META[p].short}</b></td><td>{per === "24h" ? "24 jam" : "Tahunan"}</td>
                <td className="r num">{fmt(ds.meta.standards.PP22_2021.limits[p]?.[per], 0)}</td><td className="r num">{fmt(ds.meta.standards.WHO_2021.limits[p]?.[per], 0)}</td></tr>)))}</tbody>
          </table>
        </div>
        <p className="panel__foot">µg/m³. Nilai gas ada di lampiran teknis dan tab Baku Mutu di Analytics.</p>
      </Section>

      <Section kicker="Keterbatasan" title="Yang perlu diingat">
        <ol className="cols-2" style={{ paddingLeft: 20, margin: 0 }}>
          {KEY_LIMITS.map(([t, d]) => <li key={t} style={{ breakInside: "avoid", marginBottom: 14, color: "var(--muted)" }}><b style={{ color: "var(--text)" }}>{t}.</b> {d}</li>)}
        </ol>
      </Section>

      <Section kicker="Lampiran teknis" title="Detail untuk penelusuran">
        <More title="Kualitas data dan aturan agregasi">
          <div className="grid">
            <div className="c-6 prose">
              <h3>Nilai yang dipakai</h3>
              <p>Nilai jam dipakai bila label QC asli <strong>VALID</strong> dan tidak ada tanda penggugur: nilai pengganti berulang (SENTINEL), di luar batas fisik (PM &gt; 5.000), negatif, nilai identik ≥ 24 jam (STUCK), PM2.5 &gt; PM10, kosong, gagal dibaca, serta baris dengan cap waktu tidak valid, duplikat, atau di luar periode.</p>
              <h3>Agregasi</h3>
              <ul>
                <li><strong>Harian</strong>: rata-rata jam bila ≥ {ds.meta.rules.dailyMinHours} dari 24 jam tersedia.</li>
                <li><strong>Mingguan dan bulanan</strong>: dihitung bila ≥ {ds.meta.rules.monthlyRepresentativePct}% hari tersedia.</li>
                <li><strong>8 jam</strong>: rata-rata bergerak dengan ≥ {ds.meta.rules.rolling8MinHours} jam data.</li>
                <li><strong>Tahunan</strong>: tahun kalender lengkap, ≥ {ds.meta.rules.annualMinPctDays}% hari dan tiap kuartal ≥ {ds.meta.rules.annualMinQuarterPctDays}%.</li>
                <li>Nilai kosong tidak diisi dan tidak dianggap nol.</li>
              </ul>
            </div>
            <div className="c-6 prose">
              <h3>Kelengkapan stasiun</h3>
              <ul><li><strong>Lengkap</strong>: ≥ {ds.meta.rules.tierUtamaPct}% hari.</li><li><strong>Terbatas</strong>: {ds.meta.rules.tierTerbatasPct}–{ds.meta.rules.tierUtamaPct}%, dipakai dengan catatan.</li><li><strong>Kurang</strong>: &lt; {ds.meta.rules.tierTerbatasPct}%, tidak masuk agregat.</li><li><strong>Dikecualikan</strong>: JMB-02.</li></ul>
              <h3>Data kembar</h3>
              <p>Stasiun dengan persentil P5–P95 berselisih ≤ 3% dikelompokkan per variabel. Agregat memakai satu wakil per kelompok (data terlengkap). Pilihan "Tampilkan stasiun kembar" menghitung semua stasiun.</p>
              <h3>Konversi gas</h3>
              <p>Metode utama molar: µg/m³ = ppm × M / 24,45 × 1000 (25 °C, 1 atm). Faktor ×1000 hanya untuk uji kepekaan.</p>
            </div>
          </div>
        </More>

        <More title="Kamus KPI lengkap" hint={`${KPI_DEFS.length} definisi, src/lib/kpi.ts`}>
          <div className="table-wrap"><table className="data">
            <thead><tr><th>Kode</th><th>KPI</th><th>Definisi</th><th>Sumber</th><th>Keterbatasan</th></tr></thead>
            <tbody>{KPI_DEFS.map((k) => <tr key={k.id}><td>{k.id}</td><td className="wrap" style={{ minWidth: 160 }}><b>{k.name}</b></td><td className="wrap">{k.definition}</td><td className="wrap muted" style={{ minWidth: 140 }}>{k.source}</td><td className="wrap muted">{k.limitation}</td></tr>)}</tbody>
          </table></div>
        </More>

        <More title="Nilai baku mutu lengkap">
          <div className="grid">
            {(["PP22_2021", "WHO_2021"] as const).map((k) => { const d = ds.meta.standards[k]; return (
              <div key={k} className="c-6">
                <h3 className="panel__title">{d.source}</h3>
                <p className="panel__sub">{d.note}</p>
                <table className="data"><thead><tr><th>Polutan</th><th>Waktu</th><th className="r">µg/m³</th></tr></thead>
                  <tbody>{POLLUTANTS.flatMap((p) => Object.entries(d.limits[p] ?? {}).map(([per, v]) => <tr key={p + per}><td>{VAR_META[p].short}</td><td>{per}</td><td className="r num">{fmt(v, 0)}</td></tr>))}</tbody></table>
              </div>); })}
          </div>
        </More>

        <More title="Keterbatasan lainnya">
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            {MORE_LIMITS.map(([t, d]) => <li key={t} style={{ marginBottom: 10, color: "var(--muted)" }}><b style={{ color: "var(--text)" }}>{t}.</b> {d}</li>)}
          </ol>
        </More>

        <More title="Katalog insight" hint={insights ? `${insights.catalog.length} temuan, periode penuh` : undefined}>
          {!insights ? <p className="muted">Memuat…</p> : insights.catalog.map((i) => (
            <details key={i.id} style={{ borderBottom: "1px solid var(--line)", padding: "12px 0" }}>
              <summary style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 12, alignItems: "baseline" }}>
                <span className="serif" style={{ color: "var(--teal)", fontStyle: "italic" }}>{i.id}</span><b>{i.temuan}</b>
              </summary>
              <dl className="dl" style={{ marginLeft: 60, fontSize: 14 }}>
                <dt>Bukti</dt><dd>{i.bukti}</dd><dt>Interpretasi</dt><dd>{i.interpretasi}</dd><dt>Rekomendasi</dt><dd>{i.rekomendasi}</dd><dt>Keyakinan</dt><dd>{i.keyakinan}</dd><dt>Sumber</dt><dd className="muted">{i.sumber}</dd>
              </dl>
            </details>
          ))}
        </More>

        <More title="Register uji statistik" hint={insights ? `${insights.tests.length} uji` : undefined}>
          {insights && (
            <div className="table-wrap"><table className="data">
              <thead><tr><th>ID</th><th>Pertanyaan</th><th>Uji</th><th>Unit · n</th><th>Hasil</th><th>Effect size</th></tr></thead>
              <tbody>{insights.tests.map((t) => <tr key={String(t.id)}><td>{String(t.id)}</td><td className="wrap">{String(t.pertanyaan)}</td><td className="wrap">{String(t.uji)}</td><td className="wrap muted">{String(t.unit)} · {String(t.n)}</td><td className="wrap">{String(t.hasil)}</td><td className="wrap">{String(t.effect_size)}</td></tr>)}</tbody>
            </table></div>
          )}
        </More>

        <More title="Log keputusan metodologis" hint="4 November 2026">
          {insights && <MiniMarkdown text={insights.decisionLog} />}
        </More>
      </Section>
    </>
  );
}
