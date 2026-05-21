import fs from "node:fs/promises";
import path from "node:path";

export const PROJECT_ROOT = path.resolve(/* turbopackIgnore: true */ process.cwd());

export const DEFAULT_INPUT_DIR = path.join(PROJECT_ROOT, "Articulos");
export const DEFAULT_OUTPUT_DIR = path.join(PROJECT_ROOT, "outputs", "review_miner_publication");
export const DEFAULT_WEB_RUNS_DIR = path.join(PROJECT_ROOT, "outputs", "webapp_runs");
export const DEFAULT_METADATA = [
  path.join(PROJECT_ROOT, "ArticulosTotales.xlsx"),
  path.join(PROJECT_ROOT, "Base de articulos completa.xlsx")
].join(",");
export const DEFAULT_CONTAMINANTS = path.join(PROJECT_ROOT, "config", "review_miner_contaminants.json");
export const DEFAULT_DISEASES = path.join(PROJECT_ROOT, "config", "review_miner_diseases.json");
export const DEFAULT_PROTOCOLS_DIR = path.join(PROJECT_ROOT, "config", "protocols");

export function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

export function assertLocalProcessingAllowed() {
  if (isVercelRuntime()) {
    throw new Error(
      "El procesamiento local esta deshabilitado en Vercel. Ejecuta la app localmente para leer carpetas y procesar PDFs privados."
    );
  }
}

export function resolveUserPath(value: string | undefined | null, fallback: string) {
  const raw = value?.trim() || fallback;
  return path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(/* turbopackIgnore: true */ PROJECT_ROOT, raw);
}

export function toDisplayPath(filePath: string) {
  const relative = path.relative(PROJECT_ROOT, filePath);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative || ".";
  }
  return filePath;
}

export function isInsideProject(filePath: string) {
  const resolved = path.resolve(filePath);
  const relative = path.relative(PROJECT_ROOT, resolved);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function assertProjectFile(filePath: string) {
  if (!isInsideProject(filePath)) {
    throw new Error("Solo se pueden exponer archivos ubicados dentro del proyecto local.");
  }
}

export async function pathExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function createRunOutputDir() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(DEFAULT_WEB_RUNS_DIR, stamp);
}
