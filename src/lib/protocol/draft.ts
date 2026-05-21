/**
 * Pure utilities for building and mutating a `ProtocolDraft`.
 *
 * All mutation helpers return new objects rather than mutating in place, so
 * React state setters can call them directly without tearing references.
 *
 * Tree mutation is by node `id`. Helpers walk the tree once, find the target,
 * and rebuild the path back to the root. This is O(N) per edit, which is more
 * than fast enough for protocols of any realistic size (hundreds of terms).
 */

import {
  defaultAnalysisParams,
  defaultCues,
  defaultSectionConfig
} from "./defaults";
import type {
  AnalysisParams,
  CategoryNode,
  CuePack,
  ProtocolDraft,
  ProtocolVariable,
  SectionConfig,
  TaxonomyNode,
  TermNode
} from "./types";

/* --------------------- ID generation --------------------- */

/**
 * Generate a short slug-friendly ID. Crypto.randomUUID() is too long for
 * comfortable display; we take the first 8 hex chars and prefix with `n_`.
 *
 * The user can override the ID through the UI if they want a stable slug
 * like `lead` or `alzheimers_disease`.
 */
export function generateNodeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `n_${crypto.randomUUID().split("-")[0]}`;
  }
  return `n_${Math.random().toString(36).slice(2, 10)}`;
}

/* --------------------- Empty factories --------------------- */

export function createEmptyVariable(displayNameEs = "", displayNameEn = ""): ProtocolVariable {
  return {
    metadata: {
      displayNameEs,
      displayNameEn,
      mode: "hierarchical"
    },
    nodes: []
  };
}

export function createEmptyDraft(): ProtocolDraft {
  return {
    draftVersion: 1,
    identity: {
      name: "",
      description: "",
      author: "",
      corpusLanguage: "bilingual"
    },
    variableA: createEmptyVariable(),
    variableB: createEmptyVariable(),
    cues: defaultCues(),
    sections: defaultSectionConfig(),
    analysis: defaultAnalysisParams()
  };
}

/**
 * Take whatever is in localStorage and produce a draft that has every field
 * populated. Older drafts (saved before Phase 3 fields existed) get the new
 * defaults instead of being discarded.
 *
 * Drafts with the wrong shape (wrong `draftVersion`, non-objects) return a
 * fresh empty draft.
 */
export function rehydrateDraft(stored: unknown): ProtocolDraft {
  const empty = createEmptyDraft();
  if (!stored || typeof stored !== "object") return empty;
  const candidate = stored as Partial<ProtocolDraft>;
  if (candidate.draftVersion !== 1) return empty;
  return {
    draftVersion: 1,
    identity: { ...empty.identity, ...(candidate.identity ?? {}) },
    variableA: candidate.variableA ?? empty.variableA,
    variableB: candidate.variableB ?? empty.variableB,
    cues: mergeCues(empty.cues, candidate.cues),
    sections: mergeSections(empty.sections, candidate.sections),
    analysis: { ...empty.analysis, ...(candidate.analysis ?? {}) }
  };
}

function mergeCues(base: CuePack, override: Partial<CuePack> | undefined): CuePack {
  if (!override) return base;
  const out = { ...base } as CuePack;
  for (const key of Object.keys(base) as Array<keyof CuePack>) {
    const incoming = override[key];
    if (Array.isArray(incoming)) {
      out[key] = incoming.filter((value): value is string => typeof value === "string");
    }
  }
  return out;
}

function mergeSections(base: SectionConfig, override: Partial<SectionConfig> | undefined): SectionConfig {
  if (!override) return base;
  return {
    headers: { ...base.headers, ...(override.headers ?? {}) },
    weights: { ...base.weights, ...(override.weights ?? {}) },
    activeProfile: override.activeProfile ?? base.activeProfile
  };
}

/** Re-export for callers that want the analysis defaults directly. */
export type { AnalysisParams };

export function createTermNode(labelEs = "", labelEn = ""): TermNode {
  return {
    id: generateNodeId(),
    kind: "term",
    labelEs,
    labelEn,
    patterns: [],
    generic: false
  };
}

export function createCategoryNode(labelEs = "", labelEn = ""): CategoryNode {
  return {
    id: generateNodeId(),
    kind: "category",
    labelEs,
    labelEn,
    children: []
  };
}

/* --------------------- Tree walkers --------------------- */

/**
 * Recursively map every node in the tree. The mapper can return a new node
 * (shallow or deep clone is up to the caller) and the result preserves the
 * original tree shape.
 *
 * Returns `null` if a node should be removed.
 */
export function mapNodes(
  nodes: TaxonomyNode[],
  mapper: (node: TaxonomyNode) => TaxonomyNode | null
): TaxonomyNode[] {
  const out: TaxonomyNode[] = [];
  for (const node of nodes) {
    let mapped = mapper(node);
    if (mapped == null) continue;
    if (mapped.kind === "category") {
      mapped = { ...mapped, children: mapNodes(mapped.children, mapper) };
    }
    out.push(mapped);
  }
  return out;
}

export function findNode(nodes: TaxonomyNode[], id: string): TaxonomyNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.kind === "category") {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/* --------------------- Tree mutations --------------------- */

/**
 * Apply a patch to the node with the given id. The patch is shallow merged.
 *
 * Type-preserving: if the node is a category, only category-compatible fields
 * are allowed; if it's a term, only term-compatible. We accept a partial of
 * the union and rely on the caller to pass valid shape.
 */
export function updateNode(
  nodes: TaxonomyNode[],
  id: string,
  patch: Partial<TaxonomyNode>
): TaxonomyNode[] {
  return mapNodes(nodes, (node) => {
    if (node.id !== id) return node;
    return { ...node, ...patch } as TaxonomyNode;
  });
}

/**
 * Remove a node (and all its descendants) from the tree.
 */
export function removeNode(nodes: TaxonomyNode[], id: string): TaxonomyNode[] {
  return mapNodes(nodes, (node) => (node.id === id ? null : node));
}

/**
 * Insert `newNode` as the last child of the category identified by
 * `parentId`. If `parentId` is `null`, insert at the root.
 *
 * Returns the unchanged tree if `parentId` is set but the parent is not a
 * category (terms cannot have children).
 */
export function insertNode(
  nodes: TaxonomyNode[],
  parentId: string | null,
  newNode: TaxonomyNode
): TaxonomyNode[] {
  if (parentId == null) {
    return [...nodes, newNode];
  }
  let inserted = false;
  const out = mapNodes(nodes, (node) => {
    if (node.id === parentId && node.kind === "category") {
      inserted = true;
      return { ...node, children: [...node.children, newNode] };
    }
    return node;
  });
  return inserted ? out : nodes;
}

/**
 * Move a node up or down within its sibling list.
 *
 * `direction` is `-1` (up) or `+1` (down). If the node is already at the
 * boundary, the tree is returned unchanged.
 */
export function moveNode(
  nodes: TaxonomyNode[],
  id: string,
  direction: -1 | 1
): TaxonomyNode[] {
  // Try root level first.
  const rootIdx = nodes.findIndex((n) => n.id === id);
  if (rootIdx >= 0) return swapAt(nodes, rootIdx, direction);

  // Otherwise descend.
  return mapNodes(nodes, (node) => {
    if (node.kind !== "category") return node;
    const idx = node.children.findIndex((n) => n.id === id);
    if (idx < 0) return node;
    return { ...node, children: swapAt(node.children, idx, direction) };
  });
}

function swapAt<T>(arr: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= arr.length) return arr;
  const copy = arr.slice();
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

/* --------------------- Variable-level helpers --------------------- */

export function updateVariableNodes(
  variable: ProtocolVariable,
  updater: (nodes: TaxonomyNode[]) => TaxonomyNode[]
): ProtocolVariable {
  return { ...variable, nodes: updater(variable.nodes) };
}

/* --------------------- Counting / validation helpers --------------------- */

export function countTerms(nodes: TaxonomyNode[]): number {
  let total = 0;
  for (const node of nodes) {
    if (node.kind === "term") total += 1;
    else total += countTerms(node.children);
  }
  return total;
}

export function countCategories(nodes: TaxonomyNode[]): number {
  let total = 0;
  for (const node of nodes) {
    if (node.kind === "category") {
      total += 1 + countCategories(node.children);
    }
  }
  return total;
}

/**
 * The wizard considers a variable "ready" when it has at least one term and
 * the user has named it in both languages.
 */
export function isVariableReady(variable: ProtocolVariable): boolean {
  const hasName = variable.metadata.displayNameEs.trim().length > 0 || variable.metadata.displayNameEn.trim().length > 0;
  const hasTerms = countTerms(variable.nodes) > 0;
  return hasName && hasTerms;
}

/**
 * Walk the tree and return the ids of every term node that the UI should
 * flag as incomplete: missing both labels, or with no regex patterns. Used
 * by the wizard to paint those nodes in red so the user sees exactly which
 * row blocks the "Next step" button.
 *
 * Categories are never returned: they don't carry patterns themselves and
 * an empty category is allowed (the user is in the middle of editing).
 */
export function findIncompleteTermIds(nodes: TaxonomyNode[]): Set<string> {
  const out = new Set<string>();
  collectIncomplete(nodes, out);
  return out;
}

function collectIncomplete(nodes: TaxonomyNode[], out: Set<string>): void {
  for (const node of nodes) {
    if (node.kind === "term") {
      const hasLabel = node.labelEs.trim().length > 0 || node.labelEn.trim().length > 0;
      const hasPatterns = node.patterns.length > 0;
      if (!hasLabel || !hasPatterns) out.add(node.id);
    } else {
      collectIncomplete(node.children, out);
    }
  }
}
