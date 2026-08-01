import fs from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import type {
  ResultFile,
  ResultsProtocolInfo,
  ResultsSummary,
  TablePreview
} from "@/lib/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { assertReadablePath, DEFAULT_OUTPUT_DIR, resolveUserPath, toDisplayPath } from "./project";

const FIGURE_EXTENSIONS = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp"]);
const TABLE_EXTENSIONS = new Set([".csv", ".xlsx", ".xls"]);

/**
 * Captions for the files the pipeline writes come from the active dictionary
 * (`t.results.fileDescriptions`), keyed by file stem.
 *
 * They used to be Spanish literals in this module, which meant an English UI
 * showed Spanish captions under every figure and table — the one place the
 * language toggle could not reach, because this code runs server-side in the
 * `/api/results` handler rather than in a component.
 *
 * `{a}` and `{b}` are replaced with the display names of the protocol's two
 * variables (read from `review_miner_results.json`), so a caption describes
 * whatever pair the protocol declares instead of a hardcoded domain. Outputs
 * with no protocol block fall back to the dictionary's neutral labels.
 */
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

function variableNames(t: Dictionary, protocol?: ResultsProtocolInfo): VariableNames {
  return {
    a: protocol?.variableA?.trim() || t.results.variableAFallback,
    b: protocol?.variableB?.trim() || t.results.variableBFallback
  };
}

function fileDescription(filePath: string, names: VariableNames, t: Dictionary) {
  const stem = path.basename(filePath, path.extname(filePath));
  const descriptions: Record<string, string> = t.results.fileDescriptions;
  const template = descriptions[stem] || dynamicDescription(stem, names, t);
  return template.split("{a}").join(names.a).split("{b}").join(names.b);
}

/**
 * Figure names that embed the variable slugs: `frecuencia_<slug>.svg` (one per
 * variable) and `bubble_<slug_a>_<slug_b>.svg`. When both display names slugify
 * to the same value the Python side prefixes them with `a_` / `b_`.
 */
function dynamicDescription(stem: string, names: VariableNames, t: Dictionary) {
  const frequency = t.results.fileDescriptionFrequency;
  let slugA = slugifyVariable(names.a);
  let slugB = slugifyVariable(names.b);
  if (slugA === slugB) {
    slugA = `a_${slugA}`;
    slugB = `b_${slugB}`;
  }
  if (stem === `frecuencia_${slugA}`) return frequency.split("{v}").join("{a}");
  if (stem === `frecuencia_${slugB}`) return frequency.split("{v}").join("{b}");
  if (stem.startsWith("frecuencia_")) {
    return frequency.split("{v}").join(t.results.fileDescriptionVariableGeneric);
  }
  if (stem.startsWith("bubble_")) return t.results.fileDescriptionBubble;
  return t.results.fileDescriptionFallback;
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

async function toResultFile(
  root: string,
  filePath: string,
  names: VariableNames,
  t: Dictionary
): Promise<ResultFile> {
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
    description: fileDescription(filePath, names, t)
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

export async function summarizeResults(outputDir: string | null | undefined, t: Dictionary): Promise<ResultsSummary> {
  const root = resolveUserPath(outputDir, DEFAULT_OUTPUT_DIR);
  assertReadablePath(root);
  const protocolInfo = await readProtocolInfo(root);
  const names = variableNames(t, protocolInfo);
  const files = await walkFiles(root);
  const resultFiles = await Promise.all(files.map((file) => toResultFile(root, file, names, t)));
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
