"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BarChart3, Download, FileArchive, FileText, RefreshCw, Table2 } from "lucide-react";
import type { ResultFile, ResultsSummary, TablePreview } from "@/lib/types";

function fileUrl(route: "view" | "download" | "table", filePath: string) {
  return `/api/files/${route}?path=${encodeURIComponent(filePath)}`;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortName(file: ResultFile) {
  return file.relativePath.replaceAll("_", " ");
}

export function ResultsClient({ initialOutputDir }: { initialOutputDir?: string }) {
  const [outputDir, setOutputDir] = useState(initialOutputDir || "");
  const [summary, setSummary] = useState<ResultsSummary | null>(null);
  const [selectedTab, setSelectedTab] = useState<"figures" | "tables" | "reports" | "json">("figures");
  const [selectedTable, setSelectedTable] = useState<ResultFile | null>(null);
  const [preview, setPreview] = useState<TablePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadResults(customOutputDir = outputDir) {
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const params = customOutputDir ? `?outputDir=${encodeURIComponent(customOutputDir)}` : "";
      const response = await fetch(`/api/results${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los resultados.");
      setSummary(data);
      setOutputDir(data.outputDir);
      const firstCsv = data.tables.find((file: ResultFile) => file.name.endsWith(".csv")) || null;
      setSelectedTable(firstCsv);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los resultados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadResults(initialOutputDir || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOutputDir]);

  useEffect(() => {
    if (!selectedTable || !selectedTable.name.endsWith(".csv")) {
      setPreview(null);
      return;
    }
    fetch(fileUrl("table", selectedTable.path))
      .then((response) => response.json())
      .then((data) => setPreview(data))
      .catch(() => setPreview(null));
  }, [selectedTable]);

  const tableFiles = useMemo(() => summary?.tables || [], [summary]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {summary?.protocol &&
      (summary.protocol.name || summary.protocol.variableA || summary.protocol.variableB) ? (
        <aside className="results-protocol-banner" role="note">
          <div>
            <p className="eyebrow" style={{ color: "var(--teal-dark)", margin: 0 }}>
              Protocolo activo en este análisis
            </p>
            <h3 style={{ margin: "4px 0 6px" }}>
              {summary.protocol.name || "(protocolo sin nombre)"}
            </h3>
            <p className="muted" style={{ margin: 0 }}>
              Variable A: <strong>{summary.protocol.variableA || "—"}</strong>
              {" · "}
              Variable B: <strong>{summary.protocol.variableB || "—"}</strong>
            </p>
          </div>
        </aside>
      ) : null}
      <div className="panel">
        <div className="section-heading" style={{ marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0 }}>Carpeta de resultados</h3>
            <p>Usa la salida mas reciente del pipeline o pega una carpeta generada previamente.</p>
          </div>
          <button className="button-secondary" onClick={() => loadResults()} disabled={loading}>
            <RefreshCw size={17} />
            Actualizar
          </button>
        </div>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="outputDirResults">Ruta de salida</label>
            <input id="outputDirResults" value={outputDir} onChange={(event) => setOutputDir(event.target.value)} />
          </div>
        </div>
        {error ? (
          <div className="notice" style={{ marginTop: 14, borderColor: "rgba(156, 47, 47, 0.28)", background: "#fff0ee" }}>
            <AlertTriangle size={20} />
            <div>
              <strong>Error</strong>
              {error}
            </div>
          </div>
        ) : null}
      </div>

      {summary ? (
        <>
          <div className="metric-grid">
            <div className="card metric">
              <strong>{summary.metrics.articles}</strong>
              <span>Articulos</span>
            </div>
            <div className="card metric">
              <strong>{summary.metrics.mentions}</strong>
              <span>Menciones</span>
            </div>
            <div className="card metric">
              <strong>{summary.metrics.relations}</strong>
              <span>Relaciones</span>
            </div>
            <div className="card metric">
              <strong>{summary.metrics.figures}</strong>
              <span>Figuras</span>
            </div>
          </div>

          <div className="panel">
            <div className="tabs" role="tablist" aria-label="Secciones de resultados">
              <button
                className={`tab ${selectedTab === "figures" ? "active" : ""}`}
                onClick={() => setSelectedTab("figures")}
              >
                Figuras
              </button>
              <button className={`tab ${selectedTab === "tables" ? "active" : ""}`} onClick={() => setSelectedTab("tables")}>
                Tablas
              </button>
              <button
                className={`tab ${selectedTab === "reports" ? "active" : ""}`}
                onClick={() => setSelectedTab("reports")}
              >
                Reportes
              </button>
              <button className={`tab ${selectedTab === "json" ? "active" : ""}`} onClick={() => setSelectedTab("json")}>
                JSON
              </button>
            </div>

            {selectedTab === "figures" ? (
              <div className="figure-grid">
                {summary.figures.map((figure) => (
                  <article className="figure-card" key={figure.path}>
                    <div>
                      <span className="badge">{figure.relativePath.split("/")[0]}</span>
                      <h3 style={{ marginTop: 10 }}>{shortName(figure)}</h3>
                      <p>{figure.description}</p>
                    </div>
                    <div className="figure-frame">
                      <img src={fileUrl("view", figure.path)} alt={figure.description} />
                    </div>
                    <a className="button-secondary" href={fileUrl("download", figure.path)}>
                      <Download size={17} />
                      Descargar imagen
                    </a>
                  </article>
                ))}
              </div>
            ) : null}

            {selectedTab === "tables" ? (
              <div className="result-grid">
                <aside>
                  <div className="file-list">
                    {tableFiles.map((table) => (
                      <button
                        className="table-row"
                        key={table.path}
                        onClick={() => setSelectedTable(table)}
                        style={{
                          border: 0,
                          borderBottom: "1px solid #eef1ec",
                          textAlign: "left",
                          background: selectedTable?.path === table.path ? "#e9f5f2" : "white",
                          cursor: "pointer"
                        }}
                      >
                        <span>
                          <strong>{table.name}</strong>
                          <br />
                          <span className="muted">{table.description}</span>
                        </span>
                        <span className="muted">{formatSize(table.size)}</span>
                      </button>
                    ))}
                  </div>
                </aside>
                <div>
                  {selectedTable ? (
                    <div style={{ display: "grid", gap: 12 }}>
                      <div className="section-heading" style={{ marginBottom: 0 }}>
                        <div>
                          <h3 style={{ margin: 0 }}>{selectedTable.name}</h3>
                          <p>{selectedTable.description}</p>
                        </div>
                        <a className="button-secondary" href={fileUrl("download", selectedTable.path)}>
                          <Download size={17} />
                          Descargar
                        </a>
                      </div>
                      {preview?.headers.length ? (
                        <div className="table-preview">
                          <table>
                            <thead>
                              <tr>
                                {preview.headers.map((header) => (
                                  <th key={header}>{header}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {preview.rows.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                  {preview.headers.map((header) => (
                                    <td key={header}>{row[header]}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="help-text">La vista previa solo esta disponible para CSV.</p>
                      )}
                    </div>
                  ) : (
                    <p className="help-text">Selecciona una tabla.</p>
                  )}
                </div>
              </div>
            ) : null}

            {selectedTab === "reports" ? (
              <div className="info-grid">
                {summary.reports.map((report) => (
                  <article className="card" key={report.path}>
                    <FileText size={24} color="var(--teal-dark)" />
                    <h3>{report.name}</h3>
                    <p>{report.description}</p>
                    <div style={{ height: 12 }} />
                    <a className="button-secondary" href={fileUrl("download", report.path)}>
                      <Download size={17} />
                      Descargar Word
                    </a>
                  </article>
                ))}
                {summary.packages.map((item) => (
                  <article className="card" key={item.path}>
                    <FileArchive size={24} color="var(--rust)" />
                    <h3>{item.name}</h3>
                    <p>Paquete completo con tablas, figuras, JSON y reporte.</p>
                    <div style={{ height: 12 }} />
                    <a className="button" href={fileUrl("download", item.path)}>
                      <Download size={17} />
                      Descargar paquete
                    </a>
                  </article>
                ))}
                {!summary.reports.length && !summary.packages.length ? (
                  <p className="help-text">Todavia no hay reporte Word ni paquete ZIP en esta carpeta.</p>
                ) : null}
              </div>
            ) : null}

            {selectedTab === "json" ? (
              <div className="info-grid">
                {summary.jsonFiles.map((file) => (
                  <article className="card" key={file.path}>
                    <BarChart3 size={24} color="var(--blue)" />
                    <h3>{file.name}</h3>
                    <p>{file.description}</p>
                    <div style={{ height: 12 }} />
                    <a className="button-secondary" href={fileUrl("download", file.path)}>
                      <Download size={17} />
                      Descargar JSON
                    </a>
                  </article>
                ))}
              </div>
            ) : null}
          </div>

          <div className="notice">
            <AlertTriangle size={20} />
            <div>
              <strong>Interpretacion metodologica</strong>
              Una relacion visible aqui significa evidencia textual cercana dentro del corpus procesado. La lectura
              PRISMA y la evaluacion de calidad siguen siendo responsabilidad del equipo revisor.
            </div>
          </div>
        </>
      ) : (
        <div className="panel">
          <p className="help-text">Cargando resultados...</p>
        </div>
      )}

      <div>
        <Link className="button-secondary" href="/analizador">
          Volver al analizador
        </Link>
      </div>
    </div>
  );
}
