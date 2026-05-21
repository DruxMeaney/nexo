/**
 * Serialization between the in-memory `ProtocolVariable` and on-disk JSON.
 *
 * Two formats are accepted on import:
 *
 *   Legacy (`review_miner_contaminants.json` / `review_miner_diseases.json`):
 *     {
 *       "version": "1.0",
 *       "description": "...",
 *       "entities": [
 *         { "id", "label_es", "label_en", "category", "patterns": [...], "generic": false }
 *       ]
 *     }
 *   On import the flat `entities` array is converted into a 2-level tree:
 *   each distinct `category` string becomes a category node; each entity
 *   becomes a term under its category.
 *
 *   New (v2):
 *     {
 *       "version": "2.0",
 *       "metadata": { "displayNameEs", "displayNameEn", "mode" },
 *       "taxonomy": [TaxonomyNode, ...]
 *     }
 *   This preserves arbitrary depth and the user's display names.
 *
 * Export always emits v2 (the pipeline gets a flattened view through a
 * helper below — Phase 5 swaps that in).
 */

import {
  createCategoryNode,
  createTermNode,
  generateNodeId
} from "./draft";
import type {
  ProtocolVariable,
  TaxonomyMode,
  TaxonomyNode,
  TermNode
} from "./types";

/* --------------------- Export (v2) --------------------- */

export interface VariableExportV2 {
  version: "2.0";
  metadata: {
    displayNameEs: string;
    displayNameEn: string;
    mode: TaxonomyMode;
  };
  taxonomy: TaxonomyNode[];
}

export function variableToJsonV2(variable: ProtocolVariable): VariableExportV2 {
  return {
    version: "2.0",
    metadata: { ...variable.metadata },
    taxonomy: variable.nodes
  };
}

/* --------------------- Import --------------------- */

interface LegacyEntity {
  id?: string;
  label_es?: string;
  label_en?: string;
  category?: string;
  patterns?: string[];
  generic?: boolean;
}

interface LegacyFile {
  version?: string;
  description?: string;
  entities?: LegacyEntity[];
}

interface NewFile {
  version?: string;
  metadata?: {
    displayNameEs?: string;
    displayNameEn?: string;
    mode?: TaxonomyMode;
  };
  taxonomy?: unknown;
}

/**
 * Parse a JSON string and return a `ProtocolVariable`. Throws if the file is
 * neither a v2 file nor a recognisable legacy file.
 *
 * `fallbackDisplayName` is used when the source file has no metadata of its
 * own (legacy files don't carry display names).
 */
export function variableFromJson(
  json: string,
  fallbackDisplayNameEs = "",
  fallbackDisplayNameEn = ""
): ProtocolVariable {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (cause) {
    throw new Error("invalid_json");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid_structure");
  }

  const candidate = parsed as LegacyFile & NewFile;

  // v2 detection: presence of `taxonomy` key.
  if (Array.isArray(candidate.taxonomy)) {
    const nodes = candidate.taxonomy.map(sanitizeNode).filter((n): n is TaxonomyNode => n != null);
    return {
      metadata: {
        displayNameEs: candidate.metadata?.displayNameEs ?? fallbackDisplayNameEs,
        displayNameEn: candidate.metadata?.displayNameEn ?? fallbackDisplayNameEn,
        mode: candidate.metadata?.mode ?? inferMode(nodes)
      },
      nodes
    };
  }

  // Legacy detection: presence of `entities` array.
  if (Array.isArray(candidate.entities)) {
    const nodes = legacyEntitiesToTree(candidate.entities);
    return {
      metadata: {
        displayNameEs: fallbackDisplayNameEs,
        displayNameEn: fallbackDisplayNameEn,
        mode: inferMode(nodes)
      },
      nodes
    };
  }

  throw new Error("unknown_format");
}

/**
 * Convert a flat list of legacy entities into a 2-level tree:
 *   - one category node per distinct `category` string
 *   - one term node per entity under its category
 *
 * Entities with an empty/missing category land in a synthesised "Sin
 * categoría" (or "Uncategorised") group when needed. The display label is
 * intentionally neutral; the user can rename it in the wizard.
 */
function legacyEntitiesToTree(entities: LegacyEntity[]): TaxonomyNode[] {
  const byCategory = new Map<string, TermNode[]>();
  const orderedCategories: string[] = [];
  for (const entity of entities) {
    const term = legacyEntityToTerm(entity);
    if (!term) continue;
    const category = (entity.category ?? "").trim() || "__no_category__";
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
      orderedCategories.push(category);
    }
    byCategory.get(category)!.push(term);
  }

  // If every entity shared no category, return a flat list.
  if (orderedCategories.length === 1 && orderedCategories[0] === "__no_category__") {
    return byCategory.get("__no_category__")!;
  }

  const result: TaxonomyNode[] = [];
  for (const category of orderedCategories) {
    const terms = byCategory.get(category)!;
    if (category === "__no_category__") {
      // Keep these at the root level as ungrouped terms.
      result.push(...terms);
      continue;
    }
    result.push({
      ...createCategoryNode(category, category),
      children: terms
    });
  }
  return result;
}

function legacyEntityToTerm(entity: LegacyEntity): TermNode | null {
  if (typeof entity !== "object" || entity == null) return null;
  const labelEs = (entity.label_es ?? "").toString();
  const labelEn = (entity.label_en ?? "").toString();
  if (!labelEs && !labelEn) return null;
  const patterns = Array.isArray(entity.patterns)
    ? entity.patterns.filter((p): p is string => typeof p === "string")
    : [];
  return {
    id: entity.id || generateNodeId(),
    kind: "term",
    labelEs,
    labelEn,
    patterns,
    generic: Boolean(entity.generic)
  };
}

/* --------------------- Sanitizers --------------------- */

function sanitizeNode(raw: unknown): TaxonomyNode | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<TaxonomyNode> & { children?: unknown };
  const id = typeof candidate.id === "string" && candidate.id ? candidate.id : generateNodeId();
  const labelEs = typeof candidate.labelEs === "string" ? candidate.labelEs : "";
  const labelEn = typeof candidate.labelEn === "string" ? candidate.labelEn : "";
  if (candidate.kind === "term") {
    const patternsRaw = (candidate as TermNode).patterns;
    const patterns = Array.isArray(patternsRaw)
      ? patternsRaw.filter((p): p is string => typeof p === "string")
      : [];
    return {
      id,
      kind: "term",
      labelEs,
      labelEn,
      patterns,
      generic: Boolean((candidate as TermNode).generic)
    };
  }
  if (candidate.kind === "category") {
    const children = Array.isArray(candidate.children)
      ? candidate.children.map(sanitizeNode).filter((n): n is TaxonomyNode => n != null)
      : [];
    return { id, kind: "category", labelEs, labelEn, children };
  }
  return null;
}

function inferMode(nodes: TaxonomyNode[]): TaxonomyMode {
  return nodes.some((n) => n.kind === "category") ? "hierarchical" : "flat";
}
