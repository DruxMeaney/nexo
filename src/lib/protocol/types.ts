/**
 * Type definitions for a protocol draft in the wizard.
 *
 * The wizard manipulates an in-memory `ProtocolDraft`. Persistence happens in
 * two places:
 *   - `localStorage` while the user is mid-wizard (so a refresh doesn't lose work)
 *   - a folder of JSON files on disk once the user saves the protocol (Phase 4)
 *
 * The on-disk JSON format used for each variable is described in
 * `src/lib/protocol/format.ts`. It is intentionally backward-compatible with
 * the legacy `review_miner_contaminants.json` / `review_miner_diseases.json`
 * format: the loader accepts either the new `taxonomy` shape or the old
 * `entities` shape.
 */

export type Locale = "es" | "en";

export type CorpusLanguage = "es" | "en" | "bilingual";

export type TaxonomyMode = "flat" | "hierarchical";

/**
 * Step 1 — Identity metadata.
 */
export interface ProtocolIdentity {
  name: string;
  description: string;
  author: string;
  corpusLanguage: CorpusLanguage;
}

/**
 * Step 2 — Per-variable metadata: how the user names it and how its taxonomy
 * is shaped (just terms vs. categories with terms inside).
 */
export interface VariableMetadata {
  displayNameEs: string;
  displayNameEn: string;
  mode: TaxonomyMode;
}

/**
 * Step 3 — A single node in the taxonomy tree.
 *
 * Two kinds:
 *   - `category`: an internal node that groups other nodes. It can hold
 *     children of either kind. It has no regex patterns.
 *   - `term`: a leaf that the pipeline will search for in articles. It has
 *     regex patterns and a `generic` flag (the existing pipeline downweights
 *     mentions of generic terms).
 *
 * Order is implicit by array position. To reorder siblings we simply move
 * them within `children` (or within the root `nodes` array of a variable).
 */
export interface TermNode {
  id: string;
  kind: "term";
  labelEs: string;
  labelEn: string;
  patterns: string[];
  generic: boolean;
}

export interface CategoryNode {
  id: string;
  kind: "category";
  labelEs: string;
  labelEn: string;
  children: TaxonomyNode[];
}

export type TaxonomyNode = TermNode | CategoryNode;

/**
 * A complete variable: how the user labels it + its taxonomy tree.
 *
 * In flat mode `nodes` is expected to contain only `term` entries (the UI
 * enforces this). In hierarchical mode `nodes` can contain either kind at
 * any depth.
 */
export interface ProtocolVariable {
  metadata: VariableMetadata;
  nodes: TaxonomyNode[];
}

/* --------------------- Step 4 — Cues --------------------- */

/**
 * Identifiers for every regex cue family the pipeline uses. The first six
 * are "mention scoring" cues — applied to the context window around each
 * mention to adjust its weight. The last four are "study kind" cues —
 * applied to the title + first portion of the article text to classify
 * the study type (review, human, in vivo, in vitro).
 *
 * Keep this list aligned with the Python pipeline's hardcoded regexes:
 *   - review_miner/extract.py (exposure, dose, association, speculative, negation)
 *   - review_miner/relations.py (strongAssociation)
 *   - review_miner/classify.py (review, human, inVivo, inVitro)
 */
export const CUE_FAMILY_IDS = [
  "exposure",
  "dose",
  "association",
  "strongAssociation",
  "speculative",
  "negation",
  "review",
  "human",
  "inVivo",
  "inVitro"
] as const;

export type CueFamilyId = (typeof CUE_FAMILY_IDS)[number];

/**
 * Mention-scoring cues. Each family is a list of regex strings (no flags;
 * the pipeline applies them case-insensitively).
 */
export type CuePack = Record<CueFamilyId, string[]>;

/* --------------------- Step 5 — Sections --------------------- */

/**
 * Standard IMRaD section identifiers plus `title` and `other`. The order is
 * the canonical reading order of a paper, used to drive the UI presentation.
 *
 * `other` is the catch-all for text outside any detected section. `title` is
 * synthesised as the segment before the first explicit section header.
 */
export const SECTION_IDS = [
  "title",
  "abstract",
  "introduction",
  "methods",
  "results",
  "discussion",
  "conclusion",
  "references",
  "other"
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

/**
 * Predefined section weight presets, mirroring the Python pipeline's
 * `SECTION_PROFILES` constant in publication_extensions.py.
 */
export const SECTION_PROFILE_IDS = [
  "baseline_current",
  "conservative_evidence",
  "neutral_counting",
  "central_sections_only"
] as const;

export type SectionProfileId = (typeof SECTION_PROFILE_IDS)[number];

export interface SectionConfig {
  /** Header detection regexes per section. Empty array = section disabled. */
  headers: Record<SectionId, string[]>;
  /** Numeric weight per section. Negative weights penalise the section. */
  weights: Record<SectionId, number>;
  /** Last applied profile name, just for UX (so we can highlight it). */
  activeProfile: SectionProfileId | "custom";
}

/* --------------------- Step 6 — Analysis parameters --------------------- */

export interface AnalysisParams {
  /** Characters on each side of every mention stored as evidence context. */
  contextRadius: number;
  /** Characters on each side of the keyword in KWIC concordances. */
  kwicRadius: number;
  /** Max character distance between Variable A and B mentions for a relation. */
  relationDistance: number;
  /** K for K-Means in visual analytics. */
  kmeansK: number;
  /** Rows per stratum in the manual validation samples. */
  validationSampleSize: number;
}

/* --------------------- Top-level draft --------------------- */

export interface ProtocolDraft {
  /** Bump only on breaking shape changes. The provider rehydrates missing fields. */
  draftVersion: 1;
  identity: ProtocolIdentity;
  variableA: ProtocolVariable;
  variableB: ProtocolVariable;
  cues: CuePack;
  sections: SectionConfig;
  analysis: AnalysisParams;
}

/**
 * Step IDs for the wizard. Keep this list ordered — it drives the progress
 * bar, the prev/next navigation, and the localStorage key per draft.
 */
export const WIZARD_STEPS = [
  "identity",
  "variables",
  "taxonomy",
  "cues",
  "sections",
  "parameters",
  "summary"
] as const;
export type WizardStepId = (typeof WIZARD_STEPS)[number];
