/* NEXO UI kit — Runner (/ejecutar). Interactive fake pipeline run. */

const RUN_STEPS = [
  { key: "validate", label: "Validación del corpus" },
  { key: "pipeline", label: "Minería y análisis contextual" },
  { key: "report", label: "Reporte Word" },
  { key: "package", label: "Paquete descargable" },
];

const LOG_LINES = [
  "[validate] Escaneando carpeta de PDFs… 128 archivos .pdf detectados",
  "[validate] Metadatos cargados (título, año, DOI) — OK",
  "[pipeline] Extrayendo secciones IMRaD por artículo…",
  "[pipeline] Buscando menciones · Variable A: Contaminantes (214 términos)",
  "[pipeline] Buscando menciones · Variable B: Enfermedades (96 términos)",
  "[pipeline] 3 472 menciones · construyendo relaciones A↔B…",
  "[pipeline] K-Means k=5 · figuras avanzadas generadas",
  "[report] Redactando reporte_revision_nexo.docx…",
  "[package] Comprimiendo nexo_analysis.zip — listo.",
];

function Runner({ go }) {
  const [inputDir, setInputDir] = React.useState("/Users/lab/Articulos");
  const [outputDir, setOutputDir] = React.useState("");
  const [status, setStatus] = React.useState("idle"); // idle | running | completed
  const [stepIndex, setStepIndex] = React.useState(-1);
  const [log, setLog] = React.useState([]);
  const logRef = React.useRef(null);

  React.useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  function run() {
    if (!inputDir) return;
    setStatus("running");
    setStepIndex(0);
    setLog([]);
    let li = 0;
    const logTimer = setInterval(() => {
      setLog((prev) => (li < LOG_LINES.length ? [...prev, LOG_LINES[li++]] : prev));
      if (li >= LOG_LINES.length) clearInterval(logTimer);
    }, 420);
    let si = 0;
    const stepTimer = setInterval(() => {
      si += 1;
      if (si >= RUN_STEPS.length) {
        clearInterval(stepTimer);
        setStepIndex(RUN_STEPS.length);
        setStatus("completed");
      } else {
        setStepIndex(si);
      }
    }, 1000);
  }

  const pillClass = status === "running" ? "run-status-pill-running"
    : status === "completed" ? "run-status-pill-completed" : "";
  const pillText = status === "running" ? "En ejecución" : status === "completed" ? "Completado" : "En cola";

  return (
    <main>
      <section className="page-title">
        <p className="eyebrow" style={{ color: "var(--rust)" }}>Ejecución del pipeline</p>
        <h1>Ejecutar con esta revisión</h1>
        <p>Selecciona la carpeta con tus PDFs y, opcionalmente, una carpeta de salida. La app correrá el pipeline completo con la configuración de este protocolo y te llevará a los resultados al terminar.</p>
        <button className="button-ghost" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => go("start")}>
          <Icon name="arrow-left" size={15} />Volver al listado
        </button>
      </section>

      <section className="section">
        <div className="runner">
          <div className="runner-header">
            <p className="eyebrow dark" style={{ margin: 0 }}>Protocolo activo</p>
            <h2>Contaminantes y enfermedades neurodegenerativas</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Revisión sistemática sobre contaminantes ambientales en agua asociados a enfermedades neurodegenerativas.
            </p>
            <div className="runner-variables">
              <div><span className="badge">Variable A</span><span>Contaminantes · 214 términos</span></div>
              <div><span className="badge">Variable B</span><span>Enfermedades · 96 términos</span></div>
              <div className="mono muted">Contexto 240 · Distancia A↔B 400 · K-Means k=5</div>
            </div>
          </div>

          <div className="runner-form">
            <div className="field">
              <label>Carpeta con PDFs</label>
              <div className="path-picker">
                <button className="icon-button"><Icon name="folder-open" size={18} /></button>
                <input value={inputDir} onChange={(e) => setInputDir(e.target.value)} placeholder="Ej. /Users/.../Articulos" />
              </div>
              <span className="help-text">Apunta a la carpeta local donde están los PDFs. Solo se procesan .pdf, .txt y .md.</span>
            </div>
            <div className="field">
              <label>Carpeta de salida (opcional)</label>
              <div className="path-picker">
                <button className="icon-button"><Icon name="folder-open" size={18} /></button>
                <input value={outputDir} onChange={(e) => setOutputDir(e.target.value)} placeholder="Por defecto: outputs/webapp_runs/<timestamp>" />
              </div>
            </div>
            <div className="runner-actions">
              <button className="button" onClick={run} disabled={status === "running"}>
                {status === "running"
                  ? (<><Icon name="loader-2" size={17} className="spin" />Iniciando…</>)
                  : (<><Icon name="play" size={17} />Ejecutar pipeline</>)}
              </button>
            </div>
          </div>

          {status !== "idle" && (
            <div className="run-status">
              <div className="run-status-header">
                <div>
                  <h4>Pipeline en ejecución</h4>
                  <span className="mono muted">ID de ejecución · run_2406_a1f9</span>
                </div>
                <span className={`run-status-pill ${pillClass}`}>{pillText}</span>
              </div>

              <div className="status-list">
                {RUN_STEPS.map((s, i) => {
                  const state = i < stepIndex ? "completed" : i === stepIndex && status === "running" ? "running"
                    : stepIndex >= RUN_STEPS.length ? "completed" : "";
                  return (
                    <div key={s.key} className={`status-item ${state}`}>
                      <span className="status-dot">
                        {state === "completed" ? <Icon name="check-circle-2" size={16} />
                          : state === "running" ? <Icon name="loader-2" size={16} className="spin" />
                          : <span style={{ width: 8, height: 8, borderRadius: 999, background: "currentColor", display: "block" }} />}
                      </span>
                      <div>
                        <strong>{s.label}</strong><br />
                        <span>{state === "completed" ? "Listo" : state === "running" ? "Ejecutando" : "Pendiente"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <h4>Registro en vivo</h4>
                <div className="log-box" ref={logRef}>
                  {log.length ? log.join("\n") : "Aún no hay registros."}
                </div>
              </div>

              {status === "completed" && (
                <div className="run-status-cta">
                  <button className="button" onClick={() => go("results")}><Icon name="bar-chart-3" size={17} />Ver resultados</button>
                  <button className="button-secondary"><Icon name="download" size={17} />Descargar reporte Word</button>
                  <button className="button-secondary"><Icon name="file-archive" size={17} />Descargar paquete ZIP</button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

Object.assign(window, { Runner });
