import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { getJobStore } from "./jobs";

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

/**
 * Resolve `filePath` physically (following symlinks).
 *
 * `fs.realpathSync` fails when the path does not exist yet (a file about to be
 * written), so we walk up to the nearest existing ancestor, resolve that, and
 * re-append the missing tail. The result is always an absolute path.
 */
function realPath(filePath: string) {
  const absolute = path.resolve(filePath);
  const missing: string[] = [];
  let current = absolute;
  for (;;) {
    try {
      return path.join(fsSync.realpathSync(current), ...missing.slice().reverse());
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return absolute;
      missing.push(path.basename(current));
      current = parent;
    }
  }
}

/** Physical containment: `child` is `parent` itself or lives under it. */
function isInsideDirectory(child: string, parent: string) {
  const relative = path.relative(realPath(parent), realPath(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function isInsideProject(filePath: string) {
  return isInsideDirectory(filePath, PROJECT_ROOT);
}

export function assertProjectFile(filePath: string) {
  if (!isInsideProject(filePath)) {
    throw new Error("Solo se pueden exponer archivos ubicados dentro del proyecto local.");
  }
}

/**
 * Directories that must never serve as an output folder, because granting
 * read-back on them would expose most of the machine. A run may write to an
 * external drive or the Desktop, but never to a root that *contains* the
 * user's data at large.
 */
function isTooBroadForOutput(dir: string) {
  const resolved = realPath(dir);
  const parsed = path.parse(resolved);

  // The filesystem root itself, or a volume root.
  if (resolved === parsed.root) return true;

  // The home directory itself (a subfolder of it is fine).
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home && realPath(home) === resolved) return true;

  // Any ancestor of the project — reading it would expose the project's
  // siblings and everything above them.
  if (isInsideDirectory(PROJECT_ROOT, resolved) && !isInsideDirectory(resolved, PROJECT_ROOT)) {
    return true;
  }

  // Well-known system trees.
  const systemRoots = ["/etc", "/usr", "/bin", "/sbin", "/var", "/System", "/Library", "/private/etc"];
  return systemRoots.some((root) => isInsideDirectory(resolved, root));
}

/**
 * Guard applied when a job is created. Rejecting a dangerous `outputDir` at
 * the source is what keeps `isReadablePath` safe: the job store is the
 * allowlist, so nothing unvalidated may ever enter it.
 */
export function assertSafeOutputDir(dir: string) {
  if (isTooBroadForOutput(dir)) {
    throw new Error(
      "La carpeta de salida es demasiado amplia. Elige una carpeta especifica para los resultados, no la raiz del sistema ni tu carpeta personal."
    );
  }
}

/**
 * Paths the app may read back for the user.
 *
 * The runners accept an output folder outside the project (an external drive,
 * the Desktop), so restricting reads to the project would make a completed run
 * permanently invisible. The rule is therefore: inside the project, or inside
 * an output folder this process itself *ran* against.
 *
 * Three conditions keep that from becoming an arbitrary-read primitive:
 *   1. `assertSafeOutputDir` rejects over-broad roots before a job is stored,
 *   2. only jobs that actually started executing count — a queued job carries
 *      unexecuted caller input and must not widen the read surface,
 *   3. the breadth test is re-applied here, so a job stored by older code (or
 *      a future caller that forgets the guard) still cannot open the machine.
 *
 * Containment is physical: symlinks are resolved before comparing.
 */
export function isReadablePath(filePath: string) {
  if (isInsideProject(filePath)) return true;
  for (const job of getJobStore().values()) {
    if (!job.outputDir) continue;
    if (job.status === "queued") continue;
    if (isTooBroadForOutput(job.outputDir)) continue;
    if (isInsideDirectory(filePath, job.outputDir)) return true;
  }
  return false;
}

export function assertReadablePath(filePath: string) {
  if (!isReadablePath(filePath)) {
    throw new Error(
      "Solo se pueden exponer archivos del proyecto local o carpetas de salida generadas por esta sesion."
    );
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
