/**
 * Serialize a ProtocolDraft to a folder-shaped file map, and rebuild a draft
 * from that map.
 *
 * Folder layout (one JSON per concern, so users can swap individual pieces).
 * The layout is fixed: `review_miner/protocol.py` reads these exact paths, so
 * protocol.json describes the run but never redirects the loader anywhere.
 *
 *   {slug}/
 *     protocol.json                 ← identity + analysis params
 *     variables/
 *       variable_a.json             ← full v2 variable export
 *       variable_b.json
 *     cues/
 *       exposure.json
 *       dose.json
 *       association.json
 *       strong_association.json
 *       speculative.json
 *       negation.json
 *       review.json
 *       human.json
 *       in_vivo.json
 *       in_vitro.json
 *     sections.json                 ← headers + weights + active profile
 *
 * The keys returned by `draftToFolder()` are POSIX-style relative paths. The
 * server-side API turns them into platform paths when writing.
 */

import { createEmptyDraft, rehydrateDraft } from "./draft";
import { variableFromJson, variableToJsonV2 } from "./format";
import type {
  CueFamilyId,
  CuePack,
  ProtocolDraft,
  SectionConfig
} from "./types";
import { CUE_FAMILY_IDS } from "./types";

export const PROTOCOL_FILE = "protocol.json";
export const SECTIONS_FILE = "sections.json";

/* --------------------- Slug generation --------------------- */

/**
 * Derive a folder-safe slug from the protocol name. Accents are stripped via
 * NFD, runs of non-alphanumeric chars become single hyphens, and the result
 * is truncated to 60 chars. Falls back to a timestamp slug when the name is
 * empty or yields only separators.
 */
export function slugifyName(name: string): string {
  const normalised = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (normalised) return normalised;
  const stamp = new Date().toISOString().replace(/[:.TZ-]/g, "").slice(0, 14);
  return `protocol-${stamp}`;
}

/* --------------------- Cue filename map --------------------- */

const CUE_FILENAMES: Record<CueFamilyId, string> = {
  exposure: "exposure.json",
  dose: "dose.json",
  association: "association.json",
  strongAssociation: "strong_association.json",
  speculative: "speculative.json",
  negation: "negation.json",
  review: "review.json",
  human: "human.json",
  inVivo: "in_vivo.json",
  inVitro: "in_vitro.json"
};

function cueFamilyFromFilename(filename: string): CueFamilyId | null {
  for (const family of CUE_FAMILY_IDS) {
    if (CUE_FILENAMES[family] === filename) return family;
  }
  return null;
}

/* --------------------- protocol.json shape --------------------- */

export interface ProtocolManifest {
  version: "1.0";
  savedAt: string;
  draftVersion: 1;
  identity: ProtocolDraft["identity"];
  analysis: ProtocolDraft["analysis"];
}

/* --------------------- Serializer --------------------- */

/**
 * Convert a draft into a `{ path: JSON object }` map. The server iterates the
 * map and writes one file per entry. The map is intentionally not nested —
 * keys carry the full relative path, so the API code stays simple.
 */
export function draftToFolder(draft: ProtocolDraft): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  out["variables/variable_a.json"] = variableToJsonV2(draft.variableA);
  out["variables/variable_b.json"] = variableToJsonV2(draft.variableB);

  for (const family of CUE_FAMILY_IDS) {
    out[`cues/${CUE_FILENAMES[family]}`] = {
      id: family,
      patterns: draft.cues[family]
    };
  }

  out[SECTIONS_FILE] = {
    activeProfile: draft.sections.activeProfile,
    weights: draft.sections.weights,
    headers: draft.sections.headers
  } satisfies Omit<SectionConfig, never> & Pick<SectionConfig, "activeProfile">;

  // No file index here: the Python loader hardcodes the layout above, so an
  // index inside protocol.json could only ever contradict what actually runs.
  const manifest: ProtocolManifest = {
    version: "1.0",
    savedAt: new Date().toISOString(),
    draftVersion: draft.draftVersion,
    identity: draft.identity,
    analysis: draft.analysis
  };
  out[PROTOCOL_FILE] = manifest;

  return out;
}

/* --------------------- Deserializer --------------------- */

/**
 * Rebuild a draft from a file map. Missing files are tolerated — they fall
 * back to defaults — so a user can ship a folder with only `variables/*` or
 * only `cues/*` if they want to import partial state.
 *
 * The function never throws: a missing or corrupt file is recorded in the
 * returned warnings array, the file is ignored, and the rest is loaded. Every
 * warning must be shown, because the fallback the wizard applies is not the
 * one the pipeline applies.
 */
export interface FolderLoadResult {
  draft: ProtocolDraft;
  /**
   * Files the loader could not use, each prefixed with the reason:
   *   `missing:cues/negation.json`  — the file is not in the folder
   *   `invalid:cues/negation.json`  — the file is there but unusable
   *
   * In both cases that slice of the draft fell back to the defaults, which
   * the Python pipeline does NOT do (a missing cue file leaves the family
   * empty there), so every entry has to reach the user.
   */
  warnings: string[];
}

export function folderToDraft(files: Record<string, unknown>): FolderLoadResult {
  const base = createEmptyDraft();
  const warnings: string[] = [];

  // protocol.json — identity, analysis params, draftVersion.
  const manifest = readProtocolFile(files[PROTOCOL_FILE], warnings);
  if (manifest) {
    base.identity = { ...base.identity, ...manifest.identity };
    base.analysis = { ...base.analysis, ...manifest.analysis };
  }

  // variables/*.json
  const variableA = readVariableFile(files["variables/variable_a.json"], warnings, "variable_a");
  if (variableA) base.variableA = variableA;
  const variableB = readVariableFile(files["variables/variable_b.json"], warnings, "variable_b");
  if (variableB) base.variableB = variableB;

  // cues/*.json
  for (const family of CUE_FAMILY_IDS) {
    const key = `cues/${CUE_FILENAMES[family]}`;
    const patterns = readCueFile(files[key], warnings, key);
    if (patterns) {
      base.cues[family] = patterns;
    }
  }

  // sections.json
  const sections = readSectionsFile(files[SECTIONS_FILE], warnings);
  if (sections) {
    base.sections = {
      headers: { ...base.sections.headers, ...sections.headers },
      weights: { ...base.sections.weights, ...sections.weights },
      activeProfile: sections.activeProfile ?? base.sections.activeProfile
    };
  }

  // Run a rehydration pass to fill any holes left by partial files.
  return { draft: rehydrateDraft(base), warnings };
}

function readProtocolFile(value: unknown, warnings: string[]): ProtocolManifest | null {
  if (value === undefined) {
    warnings.push(`missing:${PROTOCOL_FILE}`);
    return null;
  }
  if (!value || typeof value !== "object") {
    warnings.push(`invalid:${PROTOCOL_FILE}`);
    return null;
  }
  return value as ProtocolManifest;
}

function readVariableFile(
  value: unknown,
  warnings: string[],
  label: string
): ProtocolDraft["variableA"] | null {
  const key = `variables/${label}.json`;
  if (value === undefined) {
    warnings.push(`missing:${key}`);
    return null;
  }
  if (!value || typeof value !== "object") {
    warnings.push(`invalid:${key}`);
    return null;
  }
  try {
    const json = JSON.stringify(value);
    return variableFromJson(json);
  } catch {
    warnings.push(`invalid:${key}`);
    return null;
  }
}

function readCueFile(value: unknown, warnings: string[], key: string): string[] | null {
  if (value === undefined) {
    // The family is simply not in the folder. The wizard will show the
    // default list for it, the pipeline would run with none — say so.
    warnings.push(`missing:${key}`);
    return null;
  }
  if (!value || typeof value !== "object") {
    warnings.push(`invalid:${key}`);
    return null;
  }
  const candidate = value as { patterns?: unknown };
  if (Array.isArray(candidate.patterns)) {
    return candidate.patterns.filter((item): item is string => typeof item === "string");
  }
  if (Array.isArray(value)) {
    return (value as unknown[]).filter((item): item is string => typeof item === "string");
  }
  warnings.push(`invalid:${key}`);
  return null;
}

function readSectionsFile(value: unknown, warnings: string[]): Partial<SectionConfig> | null {
  if (value === undefined) {
    warnings.push(`missing:${SECTIONS_FILE}`);
    return null;
  }
  if (!value || typeof value !== "object") {
    warnings.push(`invalid:${SECTIONS_FILE}`);
    return null;
  }
  const candidate = value as Partial<SectionConfig>;
  // Trust the shape — the rehydrateDraft pass below will sanitize.
  if (candidate.weights || candidate.headers || candidate.activeProfile) {
    return candidate;
  }
  warnings.push(`invalid:${SECTIONS_FILE}`);
  return null;
}

/* --------------------- Helpers --------------------- */

/** List all relative paths produced by `draftToFolder` for a given draft. */
export function listFolderFilenames(draft: ProtocolDraft): string[] {
  return Object.keys(draftToFolder(draft));
}

/** Re-export the cue family ↔ filename map for callers that need it. */
export { CUE_FILENAMES, cueFamilyFromFilename };

/** Type guard used by the API loader when parsing on the server. */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Lightweight summary used by the protocol list view. */
export interface ProtocolListItem {
  slug: string;
  name: string;
  description: string;
  author: string;
  savedAt: string;
}

/**
 * Read just the identity + savedAt from a parsed `protocol.json`. Used by
 * the GET /api/protocol/list route so we don't load every cue/section file.
 */
export function extractListItem(
  slug: string,
  manifest: unknown
): ProtocolListItem | null {
  if (!isJsonObject(manifest)) return null;
  const identity = manifest.identity;
  if (!isJsonObject(identity)) return null;
  const savedAt = typeof manifest.savedAt === "string" ? manifest.savedAt : "";
  return {
    slug,
    name: typeof identity.name === "string" ? identity.name : slug,
    description: typeof identity.description === "string" ? identity.description : "",
    author: typeof identity.author === "string" ? identity.author : "",
    savedAt
  };
}

/** Cue family → filename map exported for tests / debugging. */
export const cueFilenamesByFamily: Readonly<Record<CueFamilyId, string>> = CUE_FILENAMES;
/** Cue family list re-exported for convenience. */
export { CUE_FAMILY_IDS };
export type { CuePack, CueFamilyId };
