import fs from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import type {
  ResultFile,
  ResultsProtocolInfo,
  ResultsSummary,
  TablePreview
} from "@/lib/types";
import { assertReadablePath, DEFAULT_OUTPUT_DIR, resolveUserPath, toDisplayPath } from "./project";

const FIGURE_EXTENSIONS = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp"]);
const TABLE_EXTENSIONS = new Set([".csv", ".xlsx", ".xls"]);

/**
 * Descriptions of the files the pipeline writes.
 *
 * `{a}` and `{b}` are replaced with the display names of the protocol's two
 * variables (read from `review_miner_results.json`), so the captions describe
 * whatever pair the protocol declares instead of the old hardcoded
 * contaminant/disease domain. Outputs without a protocol block fall back to the
 * neutral "variable A" / "variable B" labels.
 */
const DESCRIPTIONS: Record<string, string> = {
  articles: "Corpus procesado, metadatos extraidos y estado de extraccion de texto.",
  mentions: "Menciones auditables de {a} y {b} con seccion, frase y contexto.",
  entity_summaries: "Resumen por articulo y entidad, con rol, confianza y evidencia textual.",
  relations: "Relaciones {a}-{b} sustentadas por proximidad textual.",
  systematic_review_table: "Tabla consolidada para revision sistematica y auditoria manual.",
  heatmap_asociaciones: "Matriz de categorias de {a} frente a categorias de {b}.",
  tipo_estudio: "Distribucion del corpus por tipo de estudio inferido.",
  nivel_asociacion: "Conteo de relaciones por nivel de asociacion textual.",
  association_network: "Red exploratoria de pares {a}-{b} reportados.",
  top_association_pairs: "Pares de asociacion mas frecuentes con evidencia cercana.",
  category_association_heatmap: "Heatmap avanzado por categorias de {a} y {b}.",
  association_by_section: "Relaciones distribuidas por seccion del articulo.",
  cluster_sizes: "Tamanos de clusters del analisis exploratorio K-Means.",
  kmeans_cluster_map: "Mapa K-Means para triage exploratorio de articulos.",
  publication_pipeline_tables: "Libro Excel con tablas extendidas del pipeline publicable.",
  review_miner_results: "Resultados principales del pipeline en formato Excel o JSON.",
  reporte_revision_nexo: "Reporte Word con resumen ejecutivo, metodo y referencias a figuras."
};

const FALLBACK_DESCRIPTION = "Archivo generado por el pipeline de mineria y visualizacion.";
const FREQUENCY_DESCRIPTION = "Frecuencia de deteccion de {v} en el corpus.";
const BUBBLE_DESCRIPTION = "Burbujas de pares {a}-{b} por frecuencia y peso.";

const DEFAULT_VARIABLE_A = "variable A";
const DEFAULT_VARIABLE_B = "variable B";

type VariableNames = { a: string; b: string };

/**
 * Same slug rule the Python side uses for figure filenames
 * (`review_miner/visualize.py::_slug`): NFD, drop accents, non-alphanumeric
 * runs to "_", lowercase.
 */
function slugifyVariable(value: string) {
  const cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return cleaned || "variable";
}

function variableNames(protocol?: ResultsProtocolInfo): VariableNames {
  return {
    a: protocol?.variableA?.trim() || DEFAULT_VARIABLE_A,
    b: protocol?.variableB?.trim() || DEFAULT_VARIABLE_B
  };
}

function fileDescription(filePath: string, names: VariableNames) {
  const stem = path.basename(filePath, path.extname(filePath));
  const template = DESCRIPTIONS[stem] || dynamicDescription(stem, names);
  return template.split("{a}").join(names.a).split("{b}").join(names.b);
}

/**
 * Figure names that embed the variable slugs: `frecuencia_<slug>.svg` (one per
 * variable) and `bubble_<slug_a>_<slug_b>.svg`. When both display names slugify
 * to the same value the Python side prefixes them with `a_` / `b_`.
 */
function dynamicDescription(stem: string, names: VariableNames) {
  let slugA = slugifyVariable(names.a);
  let slugB = slugifyVariable(names.b);
  if (slugA === slugB) {
    slugA = `a_${slugA}`;
    slugB = `b_${slugB}`;
  }
  if (stem === `frecuencia_${slugA}`) return FREQUENCY_DESCRIPTION.split("{v}").join("{a}");
  if (stem === `frecuencia_${slugB}`) return FREQUENCY_DESCRIPTION.split("{v}").join("{b}");
  if (stem.startsWith("frecuencia_")) return FREQUENCY_DESCRIPTION.split("{v}").join("la variable");
  if (stem.startsWith("bubble_")) return BUBBLE_DESCRIPTION;
  return FALLBACK_DESCRIPTION;
}

async function walkFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return walkFiles(full);
      }
      if (entry.isFile()) {
        return [full];
      }
      return [];
    })
  );
  return files.flat();
}

async function toResultFile(root: string, filePath: string, names: VariableNames): Promise<ResultFile> {
  const stat = await fs.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  let kind: ResultFile["kind"] = "other";
  if (FIGURE_EXTENSIONS.has(ext)) kind = "figure";
  if (TABLE_EXTENSIONS.has(ext)) kind = "table";
  if (ext === ".docx") kind = "report";
  if (ext === ".zip") kind = "package";
  if (ext === ".json") kind = "json";
  return {
    name: path.basename(filePath),
    path: filePath,
    relativePath: path.relative(root, filePath),
    size: stat.size,
    kind,
    description: fileDescription(filePath, names)
  };
}

async function countCsvRows(filePath: string) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true
    });
    return parsed.data.length;
  } catch {
    return 0;
  }
}

async function countExtractableArticles(filePath: string) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true
    });
    return parsed.data.filter((row) => String(row.text_extractable || "").toLowerCase() === "si").length;
  } catch {
    return 0;
  }
}

export async function summarizeResults(outputDir?: string | null): Promise<ResultsSummary> {
  const root = resolveUserPath(outputDir, DEFAULT_OUTPUT_DIR);
  assertReadablePath(root);
  const protocolInfo = await readProtocolInfo(root);
  const names = variableNames(protocolInfo);
  const files = await walkFiles(root);
  const resultFiles = await Promise.all(files.map((file) => toResultFile(root, file, names)));
  const figures = resultFiles.filter((file) => file.kind === "figure").sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const tables = resultFiles.filter((file) => file.kind === "table").sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const reports = resultFiles.filter((file) => file.kind === "report").sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const packages = resultFiles.filter((file) => file.kind === "package").sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const jsonFiles = resultFiles.filter((file) => file.kind === "json").sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const articlesCsv = path.join(root, "articles.csv");
  const mentionsCsv = path.join(root, "mentions.csv");
  const relationsCsv = path.join(root, "relations.csv");
  const stats = await fs.stat(root).catch(() => null);

  return {
    outputDir: root,
    generatedAt: stats?.mtime.toISOString(),
    protocol: protocolInfo,
    metrics: {
      articles: await countCsvRows(articlesCsv),
      extractableArticles: await countExtractableArticles(articlesCsv),
      mentions: await countCsvRows(mentionsCsv),
      relations: await countCsvRows(relationsCsv),
      figures: figures.length,
      tables: tables.length
    },
    figures,
    tables,
    reports,
    packages,
    jsonFiles
  };
}

/**
 * Read the `protocol` block from `review_miner_results.json` if present.
 *
 * The protocol-driven pipeline writes that block on every run, so any new
 * output folder will carry the display names. Older outputs lacking the
 * block return ``undefined`` and the UI falls back to generic labels.
 */
async function readProtocolInfo(root: string): Promise<ResultsProtocolInfo | undefined> {
  try {
    const raw = await fs.readFile(path.join(root, "review_miner_results.json"), "utf8");
    const parsed = JSON.parse(raw) as { protocol?: { name?: string; variable_a?: string; variable_b?: string } };
    const block = parsed.protocol;
    if (!block) return undefined;
    return {
      name: block.name ?? "",
      variableA: block.variable_a ?? "",
      variableB: block.variable_b ?? ""
    };
  } catch {
    return undefined;
  }
}

export async function previewTable(filePath: string): Promise<TablePreview> {
  const resolved = resolveUserPath(filePath, filePath);
  assertReadablePath(resolved);
  if (path.extname(resolved).toLowerCase() !== ".csv") {
    return { file: toDisplayPath(resolved), headers: [], rows: [] };
  }
  const text = await fs.readFile(resolved, "utf8");
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    preview: 25,
    skipEmptyLines: true
  });
  const headers = parsed.meta.fields || [];
  const rows = parsed.data.map((row) =>
    Object.fromEntries(headers.map((header) => [header, String(row[header] ?? "").slice(0, 500)]))
  );
  return { file: toDisplayPath(resolved), headers, rows };
}
