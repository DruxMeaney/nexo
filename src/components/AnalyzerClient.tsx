"use client";

import { useEffect, useMemo, useState } from "react";
import type { InputHTMLAttributes } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  Database,
  FileJson,
  FileSearch,
  FolderOpen,
  GitBranch,
  HelpCircle,
  Layers3,
  Loader2,
  Play,
  Plus,
  Save,
  Settings2,
  Trash2,
  XCircle
} from "lucide-react";
import type { LexiconDocument, LexiconEntityDraft, PipelineJob, ReviewProtocol, ScanResult } from "@/lib/types";

type ProjectInfo = {
  defaultInputDir: string;
  defaultOutputDir: string;
  defaultWebRunsDir: string;
  defaultMetadata: string;
  defaultContaminants: string;
  defaultDiseases: string;
  defaultProtocolsDir: string;
  isVercel: boolean;
};

type DirectoryInputProps = InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
};

type Branch = "contaminants" | "diseases";

const DEFAULT_CONTAMINANTS: LexiconDocument = {
  version: "1.0",
  description: "Controlled bilingual lexicon for environmental contaminants in scientific literature.",
  entities: []
};

const DEFAULT_DISEASES: LexiconDocument = {
  version: "1.0",
  description: "Controlled bilingual lexicon for neurodegenerative diseases and related outcomes.",
  entities: []
};

const INTERNAL_SECTIONS = [
  "titulo",
  "resumen",
  "introduccion",
  "metodos",
  "resultados",
  "discusion",
  "conclusiones",
  "referencias"
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function stepIcon(status: string) {
  if (status === "completed") return <CheckCircle2 size={18} />;
  if (status === "failed") return <XCircle size={18} />;
  if (status === "running") return <Loader2 size={18} className="spin" />;
  return <Circle size={18} />;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function splitCategory(entity: LexiconEntityDraft) {
  const path = [entity.type, entity.subtype, entity.subsubtype].filter(Boolean) as string[];
  if (path.length) return path;
  return String(entity.category || "")
    .split(">")
    .map((item) => item.trim())
    .filter(Boolean);
}

function categoryFrom(type: string, subtype: string, subsubtype: string) {
  return [type, subtype, subsubtype].map((item) => item.trim()).filter(Boolean).join(" > ");
}

function normalizeLexicon(payload: LexiconDocument, fallback: LexiconDocument): LexiconDocument {
  return {
    version: payload?.version || fallback.version,
    description: payload?.description || fallback.description,
    entities: (payload?.entities || []).map((entity) => {
      const parts = splitCategory(entity);
      return {
        id: entity.id || slugify(entity.label_en || entity.label_es || "termino"),
        label_es: entity.label_es || "",
        label_en: entity.label_en || "",
        category: entity.category || parts.join(" > "),
        type: entity.type || parts[0] || entity.category || "",
        subtype: entity.subtype || parts[1] || "",
        subsubtype: entity.subsubtype || parts[2] || "",
        generic: Boolean(entity.generic),
        patterns: Array.isArray(entity.patterns) ? entity.patterns : []
      };
    })
  };
}

function pipelineLexicon(lexicon: LexiconDocument): LexiconDocument {
  return {
    version: lexicon.version || "1.0",
    description: lexicon.description || "",
    entities: lexicon.entities.map((entity) => ({
      id: entity.id,
      label_es: entity.label_es,
      label_en: entity.label_en,
      category: entity.category || categoryFrom(entity.type || "", entity.subtype || "", entity.subsubtype || ""),
      type: entity.type,
      subtype: entity.subtype,
      subsubtype: entity.subsubtype,
      generic: Boolean(entity.generic),
      patterns: entity.patterns.filter(Boolean)
    }))
  };
}

function branchTitle(branch: Branch) {
  return branch === "contaminants" ? "Variable A: contaminantes" : "Variable B: enfermedades";
}

function branchPreset(branch: Branch) {
  return branch === "contaminants" ? "contaminants" : "diseases";
}

function emptyDraft(branch: Branch): LexiconEntityDraft {
  return {
    id: "",
    label_es: "",
    label_en: "",
    category: "",
    type: branch === "contaminants" ? "Contaminantes" : "Enfermedades neurodegenerativas",
    subtype: "",
    subsubtype: "",
    generic: false,
    patterns: []
  };
}

function LexiconTree({ lexicon }: { lexicon: LexiconDocument }) {
  const grouped = new Map<string, Map<string, Map<string, LexiconEntityDraft[]>>>();
  for (const entity of lexicon.entities) {
    const [type = "Sin tipo", subtype = "Sin subtipo", subsubtype = "Terminos"] = splitCategory(entity);
    if (!grouped.has(type)) grouped.set(type, new Map());
    const subtypes = grouped.get(type)!;
    if (!subtypes.has(subtype)) subtypes.set(subtype, new Map());
    const subsubtypes = subtypes.get(subtype)!;
    if (!subsubtypes.has(subsubtype)) subsubtypes.set(subsubtype, []);
    subsubtypes.get(subsubtype)!.push(entity);
  }

  return (
    <div className="tree-panel">
      {[...grouped.entries()].slice(0, 12).map(([type, subtypes]) => (
        <div className="tree-node" key={type}>
          <div className="tree-title">
            <Layers3 size={16} />
            <strong>{type}</strong>
          </div>
          {[...subtypes.entries()].map(([subtype, subsubtypes]) => (
            <div className="tree-branch" key={subtype}>
              <div className="tree-title muted">
                <ChevronRight size={14} />
                {subtype}
              </div>
              {[...subsubtypes.entries()].map(([subsubtype, entities]) => (
                <div className="tree-leaf" key={subsubtype}>
                  <span className="badge">{subsubtype}</span>
                  <span>{entities.length} terminos</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function AnalyzerClient() {
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [inputDir, setInputDir] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [metadata, setMetadata] = useState("");
  const [contaminantsPath, setContaminantsPath] = useState("");
  const [diseasesPath, setDiseasesPath] = useState("");
  const [protocolPath, setProtocolPath] = useState("");
  const [protocolName, setProtocolName] = useState("Revision contaminantes y neurodegeneracion");
  const [protocolDescription, setProtocolDescription] = useState(
    "Protocolo local-first para extraer menciones, contexto y relaciones textuales entre dos ramas de terminos."
  );
  const [contextRadius, setContextRadius] = useState(260);
  const [relationDistance, setRelationDistance] = useState(900);
  const [k, setK] = useState(4);
  const [sampleSize, setSampleSize] = useState(200);
  const [kwicRadius, setKwicRadius] = useState(160);
  const [runAdvancedVisuals, setRunAdvancedVisuals] = useState(true);
  const [contaminantsLexicon, setContaminantsLexicon] = useState<LexiconDocument>(DEFAULT_CONTAMINANTS);
  const [diseasesLexicon, setDiseasesLexicon] = useState<LexiconDocument>(DEFAULT_DISEASES);
  const [activeBranch, setActiveBranch] = useState<Branch>("contaminants");
  const [draft, setDraft] = useState<LexiconEntityDraft>(emptyDraft("contaminants"));
  const [filter, setFilter] = useState("");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [browserFiles, setBrowserFiles] = useState<File[]>([]);
  const [job, setJob] = useState<PipelineJob | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/project")
      .then((response) => response.json())
      .then(async (data: ProjectInfo) => {
        setProject(data);
        setInputDir(data.defaultInputDir);
        setOutputDir("");
        setMetadata(data.defaultMetadata);
        setContaminantsPath(data.defaultContaminants);
        setDiseasesPath(data.defaultDiseases);
        await Promise.all([loadLexicon("contaminants", data.defaultContaminants), loadLexicon("diseases", data.defaultDiseases)]);
      })
      .catch(() => setError("No se pudo leer la configuracion del proyecto."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!job || (job.status !== "running" && job.status !== "queued")) return;
    const interval = setInterval(async () => {
      const response = await fetch(`/api/pipeline/status?jobId=${encodeURIComponent(job.id)}`);
      if (response.ok) setJob(await response.json());
    }, 1800);
    return () => clearInterval(interval);
  }, [job]);

  useEffect(() => {
    setDraft(emptyDraft(activeBranch));
    setFilter("");
  }, [activeBranch]);

  const activeLexicon = activeBranch === "contaminants" ? contaminantsLexicon : diseasesLexicon;
  const activePath = activeBranch === "contaminants" ? contaminantsPath : diseasesPath;
  const browserPdfCount = useMemo(
    () => browserFiles.filter((file) => file.name.toLowerCase().endsWith(".pdf")).length,
    [browserFiles]
  );

  const filteredEntities = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return activeLexicon.entities.slice(0, 80);
    return activeLexicon.entities
      .filter((entity) =>
        [entity.id, entity.label_es, entity.label_en, entity.category, entity.type, entity.subtype, entity.subsubtype]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      )
      .slice(0, 80);
  }, [activeLexicon, filter]);

  const directoryInputProps: DirectoryInputProps = {
    type: "file",
    multiple: true,
    accept: "application/pdf",
    webkitdirectory: "",
    directory: ""
  };

  function setLexicon(branch: Branch, lexicon: LexiconDocument) {
    if (branch === "contaminants") setContaminantsLexicon(lexicon);
    else setDiseasesLexicon(lexicon);
  }

  function setLexiconPath(branch: Branch, path: string) {
    if (branch === "contaminants") setContaminantsPath(path);
    else setDiseasesPath(path);
  }

  async function openLocalDialog(mode: "folder" | "file" | "save", title: string, defaultPath?: string, defaultName?: string) {
    const response = await fetch("/api/local/dialog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, title, defaultPath, defaultName })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo abrir el selector local.");
    return data.path as string;
  }

  async function pickFolder(target: "input" | "output") {
    setError("");
    try {
      const selected = await openLocalDialog(
        "folder",
        target === "input" ? "Selecciona la carpeta con articulos PDF" : "Selecciona la carpeta donde se guardara el analisis",
        target === "input" ? inputDir : outputDir || project?.defaultWebRunsDir
      );
      if (target === "input") setInputDir(selected);
      else setOutputDir(selected);
    } catch (dialogError) {
      setError(dialogError instanceof Error ? dialogError.message : "No se pudo seleccionar la carpeta.");
    }
  }

  async function pickJsonPath(branch: Branch) {
    setError("");
    try {
      const selected = await openLocalDialog("file", `Carga la base JSON para ${branchTitle(branch)}`, activePath || project?.defaultProtocolsDir);
      await loadLexicon(branch, selected);
    } catch (dialogError) {
      setError(dialogError instanceof Error ? dialogError.message : "No se pudo cargar la base JSON.");
    }
  }

  async function loadLexicon(branch: Branch, path?: string) {
    const response = await fetch("/api/lexicon/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, preset: branchPreset(branch) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo cargar el lexico.");
    const normalized = normalizeLexicon(data.payload, branch === "contaminants" ? DEFAULT_CONTAMINANTS : DEFAULT_DISEASES);
    setLexicon(branch, normalized);
    setLexiconPath(branch, data.path);
    setNotice(`Base cargada: ${data.path}`);
  }

  async function saveLexicon(branch: Branch, saveAs = false) {
    setError("");
    try {
      const lexicon = branch === "contaminants" ? contaminantsLexicon : diseasesLexicon;
      const currentPath = branch === "contaminants" ? contaminantsPath : diseasesPath;
      const selectedPath = saveAs
        ? await openLocalDialog(
            "save",
            `Guardar base JSON de ${branchTitle(branch)}`,
            project?.defaultProtocolsDir,
            branch === "contaminants" ? "base_variable_a_contaminantes.json" : "base_variable_b_enfermedades.json"
          )
        : currentPath;
      const response = await fetch("/api/lexicon/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: selectedPath,
          payload: pipelineLexicon(lexicon),
          defaultName: branch === "contaminants" ? "base_variable_a" : "base_variable_b"
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar la base.");
      setLexiconPath(branch, data.path);
      setNotice(`Base guardada: ${data.path}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la base.");
    }
  }

  async function saveWorkingLexicon(branch: Branch) {
    const lexicon = branch === "contaminants" ? contaminantsLexicon : diseasesLexicon;
    const response = await fetch("/api/lexicon/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: pipelineLexicon(lexicon),
        defaultName: `${protocolName}_${branch === "contaminants" ? "variable_a" : "variable_b"}`
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo guardar la base de trabajo.");
    setLexiconPath(branch, data.path);
    return data.path as string;
  }

  function addEntity() {
    const category = categoryFrom(draft.type || "", draft.subtype || "", draft.subsubtype || "") || draft.category;
    const labelEs = draft.label_es.trim();
    const labelEn = draft.label_en.trim();
    const patterns = draft.patterns.map((pattern) => pattern.trim()).filter(Boolean);
    if (!labelEs || !labelEn || !category || patterns.length === 0) {
      setError("Para agregar un termino necesitas etiqueta ES, etiqueta EN, tipo/categoria y al menos un patron.");
      return;
    }
    const entity: LexiconEntityDraft = {
      ...draft,
      id: draft.id.trim() || slugify(labelEn || labelEs),
      label_es: labelEs,
      label_en: labelEn,
      category,
      patterns
    };
    const next = {
      ...activeLexicon,
      entities: [...activeLexicon.entities.filter((item) => item.id !== entity.id), entity]
    };
    setLexicon(activeBranch, next);
    setDraft(emptyDraft(activeBranch));
    setError("");
    setNotice(`Termino agregado a ${branchTitle(activeBranch)}.`);
  }

  function removeEntity(id: string) {
    const next = {
      ...activeLexicon,
      entities: activeLexicon.entities.filter((entity) => entity.id !== id)
    };
    setLexicon(activeBranch, next);
  }

  async function scanFolder() {
    setBusy(true);
    setError("");
    setScan(null);
    try {
      const response = await fetch("/api/pipeline/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputDir })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo escanear la carpeta.");
      setScan(data);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "No se pudo escanear la carpeta.");
    } finally {
      setBusy(false);
    }
  }

  function buildProtocol(): ReviewProtocol {
    const now = new Date().toISOString();
    return {
      version: "1.0",
      name: protocolName,
      description: protocolDescription,
      createdAt: now,
      updatedAt: now,
      inputDir,
      outputDir,
      metadata,
      contaminantsLexiconPath: contaminantsPath,
      diseasesLexiconPath: diseasesPath,
      contaminantsLexicon: pipelineLexicon(contaminantsLexicon),
      diseasesLexicon: pipelineLexicon(diseasesLexicon),
      parameters: {
        contextRadius,
        kwicRadius,
        relationDistance,
        k,
        sampleSize,
        runAdvancedVisuals
      }
    };
  }

  async function saveProtocol(saveAs = false) {
    setError("");
    try {
      const selectedPath =
        saveAs || !protocolPath
          ? await openLocalDialog("save", "Guardar protocolo maestro", project?.defaultProtocolsDir, "protocolo_revision.json")
          : protocolPath;
      const response = await fetch("/api/protocols/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedPath, protocol: buildProtocol() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar el protocolo.");
      setProtocolPath(data.path);
      setNotice(`Protocolo guardado: ${data.path}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el protocolo.");
    }
  }

  async function loadProtocol() {
    setError("");
    try {
      const selected = await openLocalDialog("file", "Carga un protocolo completo", project?.defaultProtocolsDir);
      const response = await fetch("/api/protocols/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selected })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo cargar el protocolo.");
      const protocol = data.payload as ReviewProtocol;
      setProtocolPath(data.path);
      setProtocolName(protocol.name || "Revision cientifica");
      setProtocolDescription(protocol.description || "");
      setInputDir(protocol.inputDir || inputDir);
      setOutputDir(protocol.outputDir || outputDir);
      setMetadata(protocol.metadata || metadata);
      setContextRadius(protocol.parameters?.contextRadius || 260);
      setKwicRadius(protocol.parameters?.kwicRadius || 160);
      setRelationDistance(protocol.parameters?.relationDistance || 900);
      setK(protocol.parameters?.k || 4);
      setSampleSize(protocol.parameters?.sampleSize || 200);
      setRunAdvancedVisuals(protocol.parameters?.runAdvancedVisuals !== false);
      if (protocol.contaminantsLexicon) setContaminantsLexicon(normalizeLexicon(protocol.contaminantsLexicon, DEFAULT_CONTAMINANTS));
      if (protocol.diseasesLexicon) setDiseasesLexicon(normalizeLexicon(protocol.diseasesLexicon, DEFAULT_DISEASES));
      if (protocol.contaminantsLexiconPath) setContaminantsPath(protocol.contaminantsLexiconPath);
      if (protocol.diseasesLexiconPath) setDiseasesPath(protocol.diseasesLexiconPath);
      setNotice(`Protocolo cargado: ${data.path}`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el protocolo.");
    }
  }

  async function runPipeline() {
    setBusy(true);
    setError("");
    try {
      const [runContaminantsPath, runDiseasesPath] = await Promise.all([
        saveWorkingLexicon("contaminants"),
        saveWorkingLexicon("diseases")
      ]);
      const response = await fetch("/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputDir,
          outputDir: outputDir || undefined,
          metadata,
          contaminants: runContaminantsPath,
          diseases: runDiseasesPath,
          k,
          sampleSize,
          kwicRadius,
          contextRadius,
          relationDistance,
          runAdvancedVisuals
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo iniciar el pipeline.");
      setJob(data);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "No se pudo iniciar el pipeline.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="analyzer-workspace">
      {error ? (
        <div className="notice" style={{ borderColor: "rgba(156, 47, 47, 0.28)", background: "#fff0ee" }}>
          <AlertTriangle size={20} />
          <div>
            <strong>Error</strong>
            {error}
          </div>
        </div>
      ) : null}
      {notice ? (
        <div className="notice" style={{ borderColor: "rgba(15, 111, 106, 0.25)", background: "#eef8f5" }}>
          <CheckCircle2 size={20} />
          <div>
            <strong>Listo</strong>
            {notice}
          </div>
        </div>
      ) : null}

      <section className="panel protocol-hero">
        <div>
          <p className="eyebrow" style={{ color: "var(--teal-dark)", marginBottom: 8 }}>
            Protocolo reutilizable
          </p>
          <h3>Define una revision una vez, ejecútala muchas veces</h3>
          <p>
            Guarda las dos bases de terminos, las ventanas de contexto, el criterio de relacion y los parametros de
            salida. Despues solo cambias la carpeta de PDFs o la salida y vuelves a correr el pipeline.
          </p>
        </div>
        <div className="protocol-actions">
          <button className="button-secondary" type="button" onClick={loadProtocol} disabled={project?.isVercel}>
            <FileJson size={17} />
            Cargar protocolo
          </button>
          <button className="button" type="button" onClick={() => saveProtocol(true)} disabled={project?.isVercel}>
            <Save size={17} />
            Crear protocolo
          </button>
        </div>
      </section>

      <section className="panel step-section">
        <div className="step-heading">
          <span className="step-number">1</span>
          <div>
            <h3>Corpus de articulos</h3>
            <p>Selecciona la carpeta con PDFs y valida que el corpus visible sea el esperado.</p>
          </div>
        </div>
        {project?.isVercel ? (
          <div className="notice">
            <AlertTriangle size={20} />
            <div>
              <strong>Selector local no disponible en Vercel</strong>
              Ejecuta `npm run dev` para abrir dialogos del sistema operativo y procesar PDFs privados.
            </div>
          </div>
        ) : null}
        <div className="path-grid">
          <div className="path-picker">
            <button className="icon-button" type="button" onClick={() => pickFolder("input")} title="Buscar carpeta de PDFs">
              <FolderOpen size={20} />
            </button>
            <input aria-label="Ruta de la carpeta de PDFs" value={inputDir} onChange={(event) => setInputDir(event.target.value)} />
          </div>
          <button className="button-secondary" type="button" onClick={scanFolder} disabled={busy || !inputDir}>
            <FileSearch size={17} />
            Validar carpeta
          </button>
        </div>
        <div className="upload-strip">
          <div>
            <strong>Vista de apoyo del navegador</strong>
            <p className="help-text">
              Este selector confirma visualmente archivos PDF, pero la ejecucion usa la ruta local anterior para no subir
              documentos.
            </p>
          </div>
          <label className="button-secondary">
            <FolderOpen size={17} />
            Previsualizar carpeta
            <input
              {...directoryInputProps}
              style={{ display: "none" }}
              onChange={(event) => setBrowserFiles(Array.from(event.target.files || []))}
            />
          </label>
        </div>
        <p className="help-text">
          PDFs visibles por navegador: <strong>{browserPdfCount}</strong>
        </p>
        {scan ? (
          <>
            <div className="metric-grid" style={{ margin: "16px 0" }}>
              <div className="card metric">
                <strong>{scan.pdfFiles.length}</strong>
                <span>PDFs validos</span>
              </div>
              <div className="card metric">
                <strong>{scan.rejectedFiles.length}</strong>
                <span>Otros archivos</span>
              </div>
              <div className="card metric">
                <strong>{scan.totalFiles}</strong>
                <span>Archivos totales</span>
              </div>
              <div className="card metric">
                <strong>{scan.pdfFiles.length ? "OK" : "0"}</strong>
                <span>Estado corpus</span>
              </div>
            </div>
            <div className="file-list" aria-label="PDFs detectados">
              {scan.pdfFiles.slice(0, 80).map((file) => (
                <div className="file-row" key={file.relativePath}>
                  <span className="mono">{file.relativePath}</span>
                  <span className="muted">{formatSize(file.size)}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="panel step-section">
        <div className="step-heading">
          <span className="step-number">2</span>
          <div>
            <h3>Dos ramas de terminos a relacionar</h3>
            <p>
              Construye o carga las bases JSON. Cada rama permite tipo, subtipo y subsubtipo; el pipeline lo conserva como
              categoria jerarquica compatible con los archivos actuales.
            </p>
          </div>
        </div>
        <div className="branch-tabs">
          <button className={`tab ${activeBranch === "contaminants" ? "active" : ""}`} onClick={() => setActiveBranch("contaminants")}>
            <Database size={16} />
            Variable A
          </button>
          <button className={`tab ${activeBranch === "diseases" ? "active" : ""}`} onClick={() => setActiveBranch("diseases")}>
            <BookOpen size={16} />
            Variable B
          </button>
        </div>
        <div className="path-grid">
          <div className="path-picker">
            <button className="icon-button" type="button" onClick={() => pickJsonPath(activeBranch)} title="Cargar base JSON">
              <FileJson size={20} />
            </button>
            <input aria-label="Ruta de base JSON" value={activePath} readOnly />
          </div>
          <button className="button-secondary" type="button" onClick={() => saveLexicon(activeBranch, true)}>
            <Save size={17} />
            Guardar base como
          </button>
        </div>
        <div className="lexicon-layout">
          <div className="panel-subtle">
            <div className="section-heading" style={{ marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>{branchTitle(activeBranch)}</h3>
                <p>{activeLexicon.entities.length} terminos definidos.</p>
              </div>
              <GitBranch size={26} color="var(--teal-dark)" />
            </div>
            <LexiconTree lexicon={activeLexicon} />
          </div>
          <div className="panel-subtle">
            <h3>Agregar termino</h3>
            <p>Usa expresiones regulares simples; por ejemplo `\bparaquat\b` o `\balzheimer'?s?\b`.</p>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <div className="field">
                <label>Tipo</label>
                <input value={draft.type || ""} onChange={(event) => setDraft({ ...draft, type: event.target.value })} />
              </div>
              <div className="field">
                <label>Subtipo</label>
                <input value={draft.subtype || ""} onChange={(event) => setDraft({ ...draft, subtype: event.target.value })} />
              </div>
              <div className="field">
                <label>Subsubtipo</label>
                <input value={draft.subsubtype || ""} onChange={(event) => setDraft({ ...draft, subsubtype: event.target.value })} />
              </div>
              <div className="field">
                <label>ID interno</label>
                <input
                  placeholder="se genera si lo dejas vacio"
                  value={draft.id}
                  onChange={(event) => setDraft({ ...draft, id: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Etiqueta ES</label>
                <input value={draft.label_es} onChange={(event) => setDraft({ ...draft, label_es: event.target.value })} />
              </div>
              <div className="field">
                <label>Etiqueta EN</label>
                <input value={draft.label_en} onChange={(event) => setDraft({ ...draft, label_en: event.target.value })} />
              </div>
              <div className="field full">
                <label>Patrones, uno por linea</label>
                <textarea
                  value={draft.patterns.join("\n")}
                  onChange={(event) => setDraft({ ...draft, patterns: event.target.value.split(/\r?\n/) })}
                  rows={5}
                  placeholder={"\\btermino\\b\n\\bsinonimo\\b"}
                />
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={Boolean(draft.generic)}
                  onChange={(event) => setDraft({ ...draft, generic: event.target.checked })}
                />
                Termino generico o familia amplia
              </label>
            </div>
            <button className="button" type="button" onClick={addEntity} style={{ marginTop: 14 }}>
              <Plus size={17} />
              Agregar a la rama
            </button>
          </div>
        </div>
        <div className="panel-subtle">
          <div className="section-heading" style={{ marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Biblioteca de terminos</h3>
              <p>Filtra, revisa y elimina elementos antes de guardar el JSON.</p>
            </div>
            <input
              className="compact-input"
              placeholder="Filtrar terminos"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>
          <div className="term-list">
            {filteredEntities.map((entity) => (
              <div className="term-row" key={entity.id}>
                <div>
                  <strong>{entity.label_es}</strong>
                  <span className="muted"> / {entity.label_en}</span>
                  <p className="help-text">
                    {entity.category} · {entity.patterns.length} patrones
                  </p>
                </div>
                <button className="icon-button danger" type="button" title="Eliminar termino" onClick={() => removeEntity(entity.id)}>
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel step-section">
        <div className="step-heading">
          <span className="step-number">3</span>
          <div>
            <h3>Contexto, secciones y relaciones</h3>
            <p>Define cuanto texto se conserva alrededor de cada palabra y que distancia permite proponer relaciones.</p>
          </div>
        </div>
        <div className="section-chip-grid">
          {INTERNAL_SECTIONS.map((section) => (
            <span className="section-chip" key={section}>
              {section}
            </span>
          ))}
        </div>
        <div className="form-grid" style={{ marginTop: 18 }}>
          <div className="field">
            <label>Caracteres de contexto por mencion</label>
            <input type="number" min={80} max={1600} value={contextRadius} onChange={(event) => setContextRadius(Number(event.target.value))} />
            <span className="help-text">Se guarda a cada lado de la palabra encontrada para auditar evidencia.</span>
          </div>
          <div className="field">
            <label>Radio KWIC</label>
            <input type="number" min={40} max={800} value={kwicRadius} onChange={(event) => setKwicRadius(Number(event.target.value))} />
            <span className="help-text">Ventana izquierda/derecha en la concordancia Keyword-in-Context.</span>
          </div>
          <div className="field">
            <label>Distancia maxima para relacion</label>
            <input
              type="number"
              min={100}
              max={3000}
              value={relationDistance}
              onChange={(event) => setRelationDistance(Number(event.target.value))}
            />
            <span className="help-text">Si dos terminos quedan mas lejos, no se propone relacion textual.</span>
          </div>
          <div className="field">
            <label>Visual analytics</label>
            <select
              value={runAdvancedVisuals ? "yes" : "no"}
              onChange={(event) => setRunAdvancedVisuals(event.target.value === "yes")}
            >
              <option value="yes">Incluir figuras avanzadas</option>
              <option value="no">Omitir figuras avanzadas</option>
            </select>
          </div>
        </div>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <div className="field">
            <label>Clusters K-Means</label>
            <input type="number" min={1} max={12} value={k} onChange={(event) => setK(Number(event.target.value))} />
          </div>
          <div className="field">
            <label>Muestra para validacion manual</label>
            <input type="number" min={20} max={2000} value={sampleSize} onChange={(event) => setSampleSize(Number(event.target.value))} />
          </div>
        </div>
      </section>

      <section className="panel step-section">
        <div className="step-heading">
          <span className="step-number">4</span>
          <div>
            <h3>Salida y ejecucion</h3>
            <p>El algoritmo limpiara texto extraido por PDF, detectara secciones, contara terminos, construira relaciones y exportara resultados.</p>
          </div>
        </div>
        <div className="path-grid">
          <div className="path-picker">
            <button className="icon-button" type="button" onClick={() => pickFolder("output")} title="Buscar carpeta de salida">
              <FolderOpen size={20} />
            </button>
            <input
              aria-label="Ruta de salida"
              placeholder={project ? `${project.defaultWebRunsDir}/fecha-ejecucion` : "outputs/webapp_runs/..."}
              value={outputDir}
              onChange={(event) => setOutputDir(event.target.value)}
            />
          </div>
          <button className="button-secondary" type="button" onClick={() => saveProtocol(false)} disabled={project?.isVercel}>
            <Save size={17} />
            Guardar parametros
          </button>
        </div>
        <div className="form-grid" style={{ marginTop: 16 }}>
          <div className="field">
            <label>Nombre del protocolo</label>
            <input value={protocolName} onChange={(event) => setProtocolName(event.target.value)} />
          </div>
          <div className="field">
            <label>Metadatos opcionales</label>
            <input value={metadata} onChange={(event) => setMetadata(event.target.value)} />
          </div>
          <div className="field full">
            <label>Descripcion</label>
            <textarea value={protocolDescription} onChange={(event) => setProtocolDescription(event.target.value)} rows={3} />
          </div>
        </div>
        <div className="pipeline-map">
          {[
            ["PDF", "Lectura y limpieza con pypdf"],
            ["Secciones", "Titulo, resumen, metodos, resultados y discusion"],
            ["Lexicos", "Busca patrones de las dos ramas"],
            ["Contexto", "Guarda evidencia textual auditable"],
            ["Relaciones", "Cruza terminos cercanos con pistas linguisticas"],
            ["Exportacion", "CSV, Excel, JSON, figuras, Word y ZIP"]
          ].map(([title, text]) => (
            <div className="pipeline-node" key={title}>
              <Settings2 size={17} />
              <strong>{title}</strong>
              <span>{text}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          <button className="button" type="button" onClick={runPipeline} disabled={busy || !inputDir || project?.isVercel}>
            <Play size={17} />
            Ejecutar pipeline
          </button>
          {job?.status === "completed" ? (
            <Link className="button-secondary" href={`/resultados?outputDir=${encodeURIComponent(job.outputDir)}`}>
              Ver resultados
            </Link>
          ) : null}
        </div>
      </section>

      <section className="panel step-section">
        <div className="step-heading">
          <span className="step-number">5</span>
          <div>
            <h3>Consola de ejecucion</h3>
            <p>Los pasos invisibles del pipeline se reportan aqui mientras se ejecuta el algoritmo.</p>
          </div>
        </div>
        <div className="status-list">
          {(job?.steps || []).map((step) => (
            <div className={`status-item ${step.status}`} key={step.id}>
              <span className="status-dot">{stepIcon(step.status)}</span>
              <div>
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </div>
            </div>
          ))}
          {!job ? (
            <div className="status-item">
              <span className="status-dot">
                <HelpCircle size={18} />
              </span>
              <div>
                <strong>Sin ejecucion activa</strong>
                <p>Cuando ejecutes el pipeline veras validacion, mineria, reporte y empaquetado.</p>
              </div>
            </div>
          ) : null}
        </div>
        {job ? (
          <>
            <div style={{ height: 14 }} />
            <div className="log-box mono">{job.logs.length ? job.logs.join("\n") : "Esperando salida del proceso..."}</div>
          </>
        ) : null}
      </section>
    </div>
  );
}
