"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Download, FileArchive, FileText, RefreshCw } from "lucide-react";
import type { ResultFile, ResultsSummary, TablePreview } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";

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

type KindKey = keyof Dictionary["results"]["kind"];

function kindLabel(kind: ResultFile["kind"], t: Dictionary): string {
  return t.results.kind[kind as KindKey] ?? t.results.kind.other;
}

interface Props {
  initialOutputDir?: string;
  t: Dictionary;
}

export function ResultsClient({ initialOutputDir, t }: Props) {
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
      if (!response.ok) throw new Error(data.error || t.results.errorTitle);
      setSummary(data);
      setOutputDir(data.outputDir);
      const firstCsv = data.tables.find((file: ResultFile) => file.name.endsWith(".csv")) || null;
      setSelectedTable(firstCsv);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t.results.errorTitle);
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
              {t.results.protocolBanner}
            </p>
            <h3 style={{ margin: "4px 0 6px" }}>
              {summary.protocol.name || t.results.protocolUnnamed}
            </h3>
            <p className="muted" style={{ margin: 0 }}>
              {t.results.variableALabel}{" "}
              <strong>{summary.protocol.variableA || "—"}</strong>
              {" · "}
              {t.results.variableBLabel}{" "}
              <strong>{summary.protocol.variableB || "—"}</strong>
            </p>
          </div>
        </aside>
      ) : null}
      <div className="panel">
        <div className="section-heading" style={{ marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0 }}>{t.results.folderPanelTitle}</h3>
            <p>{t.results.folderPanelHint}</p>
          </div>
          <button className="button-secondary" onClick={() => loadResults()} disabled={loading}>
            <RefreshCw size={17} />
            {t.results.refreshAction}
          </button>
        </div>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="outputDirResults">{t.results.pathLabel}</label>
            <input id="outputDirResults" value={outputDir} onChange={(event) => setOutputDir(event.target.value)} />
          </div>
        </div>
        {error ? (
          <div className="notice" style={{ marginTop: 14, borderColor: "rgba(156, 47, 47, 0.28)", background: "#fff0ee" }}>
            <AlertTriangle size={20} />
            <div>
              <strong>{t.results.errorTitle}</strong>
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
              <span>{t.results.metricArticles}</span>
            </div>
            <div className="card metric">
              <strong>{summary.metrics.mentions}</strong>
              <span>{t.results.metricMentions}</span>
            </div>
            <div className="card metric">
              <strong>{summary.metrics.relations}</strong>
              <span>{t.results.metricRelations}</span>
            </div>
            <div className="card metric">
              <strong>{summary.metrics.figures}</strong>
              <span>{t.results.metricFigures}</span>
            </div>
          </div>

          <div className="panel">
            <div className="tabs" role="tablist">
              <button
                className={`tab ${selectedTab === "figures" ? "active" : ""}`}
                onClick={() => setSelectedTab("figures")}
              >
                {t.results.tabFigures}
              </button>
              <button className={`tab ${selectedTab === "tables" ? "active" : ""}`} onClick={() => setSelectedTab("tables")}>
                {t.results.tabTables}
              </button>
              <button
                className={`tab ${selectedTab === "reports" ? "active" : ""}`}
                onClick={() => setSelectedTab("reports")}
              >
                {t.results.tabReports}
              </button>
              <button className={`tab ${selectedTab === "json" ? "active" : ""}`} onClick={() => setSelectedTab("json")}>
                {t.results.tabJson}
              </button>
            </div>

            {selectedTab === "figures" ? (
              summary.figures.length === 0 ? (
                <p className="help-text">{t.results.noFigures}</p>
              ) : (
                <div className="figure-grid">
                  {summary.figures.map((figure) => (
                    <article className="figure-card" key={figure.path}>
                      <div>
                        <span className="badge">{kindLabel(figure.kind, t)}</span>
                        <h3 style={{ marginTop: 10 }}>{shortName(figure)}</h3>
                        <p>{figure.description}</p>
                      </div>
                      <div className="figure-frame">
                        <img src={fileUrl("view", figure.path)} alt={figure.description} />
                      </div>
                      <a className="button-secondary" href={fileUrl("download", figure.path)}>
                        <Download size={17} />
                        {t.results.downloadImage}
                      </a>
                    </article>
                  ))}
                </div>
              )
            ) : null}

            {selectedTab === "tables" ? (
              tableFiles.length === 0 ? (
                <p className="help-text">{t.results.noTables}</p>
              ) : (
                <div className="result-grid">
                  <aside>
                    <div className="file-list">
                      {tableFiles.map((table) => (
                        <button
                          className={`table-row ${selectedTable?.path === table.path ? "active" : ""}`}
                          key={table.path}
                          onClick={() => setSelectedTable(table)}
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
                            {t.results.downloadTable}
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
                        ) : null}
                      </div>
                    ) : (
                      <p className="help-text">{t.results.noTablePreview}</p>
                    )}
                  </div>
                </div>
              )
            ) : null}

            {selectedTab === "reports" ? (
              summary.reports.length === 0 && summary.packages.length === 0 ? (
                <p className="help-text">{t.results.noReports}</p>
              ) : (
                <div className="info-grid">
                  {summary.reports.map((report) => (
                    <article className="card" key={report.path}>
                      <span className="card-ic">
                        <FileText size={22} />
                      </span>
                      <h3>{report.name}</h3>
                      <p>{report.description}</p>
                      <div style={{ height: 12 }} />
                      <a className="button-secondary" href={fileUrl("download", report.path)}>
                        <Download size={17} />
                        {t.results.downloadReport}
                      </a>
                    </article>
                  ))}
                  {summary.packages.map((item) => (
                    <article className="card" key={item.path}>
                      <span className="card-ic" style={{ background: "#f7ebe3", color: "var(--rust)" }}>
                        <FileArchive size={22} />
                      </span>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <div style={{ height: 12 }} />
                      <a className="button" href={fileUrl("download", item.path)}>
                        <Download size={17} />
                        {t.results.downloadTable}
                      </a>
                    </article>
                  ))}
                </div>
              )
            ) : null}

            {selectedTab === "json" ? (
              summary.jsonFiles.length === 0 ? (
                <p className="help-text">{t.results.noJson}</p>
              ) : (
                <div className="info-grid">
                  {summary.jsonFiles.map((file) => (
                    <article className="card" key={file.path}>
                      <span className="card-ic" style={{ background: "#e8eff6", color: "var(--blue)" }}>
                        <BarChart3 size={22} />
                      </span>
                      <h3>{file.name}</h3>
                      <p>{file.description}</p>
                      <div style={{ height: 12 }} />
                      <a className="button-secondary" href={fileUrl("download", file.path)}>
                        <Download size={17} />
                        {t.results.downloadJson}
                      </a>
                    </article>
                  ))}
                </div>
              )
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
