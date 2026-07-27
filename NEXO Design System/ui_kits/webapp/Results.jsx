/* NEXO UI kit — Results (/resultados). Tabs: figures / tables / reports / json. */

const FIGURES = [
  { dir: "visual_analytics", name: "association network", desc: "Red de asociaciones entre contaminantes y enfermedades.", kind: "network" },
  { dir: "visual_analytics", name: "bubble contaminant disease", desc: "Frecuencia de co-ocurrencia por par de variables.", kind: "bubble" },
  { dir: "figures", name: "heatmap asociaciones", desc: "Matriz de fuerza de asociación textual.", kind: "heat" },
  { dir: "figures", name: "menciones por seccion", desc: "Distribución de menciones por sección IMRaD.", kind: "bars" },
];

const TABLES = [
  { name: "systematic_review_table.csv", desc: "Tabla de revisión sistemática lista para PRISMA.", size: "412 KB" },
  { name: "relations.csv", desc: "Relaciones A↔B con evidencia textual y confianza.", size: "286 KB" },
  { name: "mentions.csv", desc: "Menciones individuales con concordancia KWIC.", size: "1.2 MB" },
  { name: "entity_summaries.csv", desc: "Resumen por término detectado.", size: "64 KB" },
];

const PREVIEW = {
  headers: ["contaminante", "enfermedad", "n_menciones", "confianza", "evidencia"],
  rows: [
    ["Plomo (Pb)", "Alzheimer", "34", "fuerte", "…lead exposure was significantly associated with…"],
    ["Arsénico", "Parkinson", "21", "media", "…arsenic levels correlated with motor decline…"],
    ["Mercurio", "Deterioro cognitivo", "18", "media", "…mercury accumulation may contribute to…"],
    ["BPA", "Neurodesarrollo", "12", "débil", "…BPA exposure suggests a possible link…"],
  ],
};

function Results({ go }) {
  const [tab, setTab] = React.useState("figures");
  const [selected, setSelected] = React.useState(TABLES[0].name);

  return (
    <main>
      <section className="page-title">
        <p className="eyebrow dark">Resultados del análisis</p>
        <h1>Resultados</h1>
      </section>

      <section className="section" style={{ paddingTop: 8, display: "grid", gap: 18 }}>
        <aside className="results-protocol-banner" role="note">
          <div>
            <p className="eyebrow dark" style={{ margin: 0 }}>Protocolo activo en este análisis</p>
            <h3 style={{ margin: "4px 0 6px", fontSize: "1.2rem" }}>Contaminantes y enfermedades neurodegenerativas</h3>
            <p className="muted" style={{ margin: 0 }}>Variable A: <strong>Contaminantes</strong> · Variable B: <strong>Enfermedades</strong></p>
          </div>
        </aside>

        <div className="metric-grid">
          {[["128", "Artículos"], ["3 472", "Menciones"], ["614", "Relaciones"], ["22", "Figuras"]].map(([n, l]) => (
            <div className="card metric" key={l}><strong>{n}</strong><span>{l}</span></div>
          ))}
        </div>

        <div className="panel">
          <div className="tabs" role="tablist">
            {[["figures", "Figuras"], ["tables", "Tablas"], ["reports", "Reportes"], ["json", "JSON"]].map(([k, l]) => (
              <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>

          {tab === "figures" && (
            <div className="figure-grid">
              {FIGURES.map((f) => (
                <article className="figure-card" key={f.name}>
                  <div>
                    <span className="badge">{f.dir}</span>
                    <h3 style={{ marginTop: 10 }}>{f.name}</h3>
                    <p className="muted" style={{ fontSize: ".88rem", lineHeight: 1.4 }}>{f.desc}</p>
                  </div>
                  <div className="figure-frame"><FigureSVG kind={f.kind} /></div>
                  <button className="button-secondary"><Icon name="download" size={17} />Descargar imagen</button>
                </article>
              ))}
            </div>
          )}

          {tab === "tables" && (
            <div className="result-grid">
              <aside>
                <div className="file-list">
                  {TABLES.map((t) => (
                    <button key={t.name} className={`table-row ${selected === t.name ? "active" : ""}`} onClick={() => setSelected(t.name)}>
                      <span><strong>{t.name}</strong><br /><span className="muted" style={{ fontSize: ".82rem" }}>{t.desc}</span></span>
                      <span className="muted">{t.size}</span>
                    </button>
                  ))}
                </div>
              </aside>
              <div style={{ display: "grid", gap: 12 }}>
                <div className="section-heading" style={{ marginBottom: 0 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{selected}</h3>
                    <p className="muted" style={{ margin: 0 }}>{TABLES.find((t) => t.name === selected)?.desc}</p>
                  </div>
                  <button className="button-secondary"><Icon name="download" size={17} />Descargar</button>
                </div>
                <div className="table-preview">
                  <table>
                    <thead><tr>{PREVIEW.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {PREVIEW.rows.map((r, i) => (
                        <tr key={i}>{r.map((c, j) => <td key={j} className={j === 4 ? "muted" : ""}>{c}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === "reports" && (
            <div className="info-grid">
              <article className="card">
                <span className="card-ic"><Icon name="file-text" size={22} /></span>
                <h3 className="mono" style={{ fontFamily: "var(--mono)", fontSize: ".95rem" }}>reporte_revision_nexo.docx</h3>
                <p>Resumen ejecutivo, método y referencias a figuras.</p>
                <div style={{ height: 14 }} />
                <button className="button-secondary"><Icon name="download" size={17} />Descargar Word</button>
              </article>
              <article className="card">
                <span className="card-ic" style={{ background: "#f7ebe3", color: "var(--rust)" }}><Icon name="file-archive" size={22} /></span>
                <h3 className="mono" style={{ fontFamily: "var(--mono)", fontSize: ".95rem" }}>nexo_analysis.zip</h3>
                <p>Paquete completo con tablas, figuras, JSON y reporte.</p>
                <div style={{ height: 14 }} />
                <button className="button"><Icon name="download" size={17} />Descargar paquete</button>
              </article>
            </div>
          )}

          {tab === "json" && (
            <div className="info-grid">
              {["relations.json", "entity_summaries.json", "run_manifest.json"].map((n) => (
                <article className="card" key={n}>
                  <span className="card-ic" style={{ background: "#e8eff6", color: "var(--blue)" }}><Icon name="bar-chart-3" size={22} /></span>
                  <h3 className="mono" style={{ fontFamily: "var(--mono)", fontSize: ".95rem" }}>{n}</h3>
                  <p>Salida estructurada para reanálisis programático.</p>
                  <div style={{ height: 14 }} />
                  <button className="button-secondary"><Icon name="download" size={17} />Descargar JSON</button>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="notice">
          <Icon name="alert-triangle" size={20} color="#b87813" />
          <div>
            <strong>Interpretación metodológica</strong>
            Una relación visible aquí significa evidencia textual cercana dentro del corpus procesado. La lectura PRISMA y la evaluación de calidad siguen siendo responsabilidad del equipo revisor.
          </div>
        </div>

        <div>
          <button className="button-secondary" onClick={() => go("runner")}>Volver al analizador</button>
        </div>
      </section>
    </main>
  );
}

/* Small scientific figure recreations rendered as SVG (stand-ins for pipeline output). */
function FigureSVG({ kind }) {
  if (kind === "heat") {
    const cells = [];
    const rng = mulberry(11);
    for (let y = 0; y < 7; y++) for (let x = 0; x < 9; x++) {
      const v = rng();
      cells.push(<rect key={`${x}-${y}`} x={20 + x * 34} y={14 + y * 26} width="32" height="24"
        fill={`rgba(15,111,106,${0.12 + v * 0.78})`} />);
    }
    return <svg viewBox="0 0 340 210" style={{ width: "100%" }}>{cells}</svg>;
  }
  if (kind === "bars") {
    const rng = mulberry(5);
    const bars = [];
    for (let i = 0; i < 8; i++) {
      const h = 30 + rng() * 130;
      bars.push(<rect key={i} x={26 + i * 38} y={180 - h} width="26" height={h} rx="3"
        fill={["#0f6f6a", "#627c35", "#a84c24", "#315f8a"][i % 4]} />);
    }
    return <svg viewBox="0 0 340 200" style={{ width: "100%" }}><line x1="18" y1="180" x2="330" y2="180" stroke="#d9dfd8" />{bars}</svg>;
  }
  if (kind === "bubble") {
    const rng = mulberry(23);
    const b = [];
    for (let i = 0; i < 18; i++) b.push(<circle key={i} cx={30 + rng() * 280} cy={20 + rng() * 160} r={5 + rng() * 26}
      fill={["#4fb3aa", "#9bc46b", "#cf8a5e"][i % 3]} fillOpacity="0.55" />);
    return <svg viewBox="0 0 340 200" style={{ width: "100%" }}>{b}</svg>;
  }
  // network
  const rng = mulberry(3);
  const nodes = [];
  for (let i = 0; i < 16; i++) nodes.push({ x: 30 + rng() * 280, y: 18 + rng() * 164, r: 4 + rng() * 9 });
  const lines = [];
  for (let i = 0; i < 18; i++) { const a = Math.floor(rng() * 16), c = Math.floor(rng() * 16); if (a !== c) lines.push([a, c]); }
  return (
    <svg viewBox="0 0 340 200" style={{ width: "100%" }}>
      <g stroke="#7fbfb8" strokeOpacity="0.5">{lines.map(([a, c], i) => <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[c].x} y2={nodes[c].y} />)}</g>
      {nodes.map((n, i) => <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={["#0f6f6a", "#627c35", "#a84c24"][i % 3]} fillOpacity="0.9" />)}
    </svg>
  );
}

Object.assign(window, { Results });
