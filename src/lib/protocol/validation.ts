/**
 * Per-step validation for a protocol draft.
 *
 * Each validator returns a list of error IDs (strings). The UI resolves the
 * IDs to localised messages — this module knows nothing about translations,
 * which keeps it pure and testable.
 *
 * The wizard uses these results to:
 *   - disable the "Next step" button when the current step or any earlier
 *     one has errors
 *   - block clicks on future step indicators when an earlier step is invalid
 *   - render an inline error list at the top of each step
 *   - block saving from the summary step
 *
 * Every step is re-validated on every render, so breaking an earlier step
 * after having reached a later one is caught immediately. Going back to fix
 * things is always allowed.
 */

import { ANALYSIS_BOUNDS } from "./defaults";
import { countTerms } from "./draft";
import type {
  ProtocolDraft,
  ProtocolVariable,
  TaxonomyNode,
  WizardStepId
} from "./types";
import { SECTION_IDS } from "./types";

export interface StepValidation {
  /** Stable error identifiers; the UI maps these to dictionary keys. */
  errors: string[];
  /** True when `errors.length === 0`. Cached here for convenience. */
  isValid: boolean;
}

/* --------------------- Per-step validators --------------------- */

function validateIdentity(draft: ProtocolDraft): string[] {
  const errors: string[] = [];
  if (draft.identity.name.trim().length === 0) {
    errors.push("identity.name_required");
  }
  return errors;
}

function validateVariables(draft: ProtocolDraft): string[] {
  const errors: string[] = [];
  if (!variableHasName(draft.variableA)) errors.push("variables.a_name_required");
  if (!variableHasName(draft.variableB)) errors.push("variables.b_name_required");
  return errors;
}

function variableHasName(variable: ProtocolVariable): boolean {
  return (
    variable.metadata.displayNameEs.trim().length > 0 ||
    variable.metadata.displayNameEn.trim().length > 0
  );
}

function validateTaxonomy(draft: ProtocolDraft): string[] {
  const errors: string[] = [];
  const aTerms = countTerms(draft.variableA.nodes);
  const bTerms = countTerms(draft.variableB.nodes);
  if (aTerms === 0) errors.push("taxonomy.a_needs_terms");
  if (bTerms === 0) errors.push("taxonomy.b_needs_terms");
  if (hasIncompleteTerm(draft.variableA.nodes)) errors.push("taxonomy.a_incomplete_term");
  if (hasIncompleteTerm(draft.variableB.nodes)) errors.push("taxonomy.b_incomplete_term");
  if (hasInvalidPattern(draft.variableA.nodes)) errors.push("taxonomy.a_invalid_pattern");
  if (hasInvalidPattern(draft.variableB.nodes)) errors.push("taxonomy.b_invalid_pattern");
  if (hasUnlabeledCategory(draft.variableA.nodes)) errors.push("taxonomy.a_unlabeled_category");
  if (hasUnlabeledCategory(draft.variableB.nodes)) errors.push("taxonomy.b_unlabeled_category");
  return errors;
}

/**
 * A term is incomplete when it has no labels in either language, or when it
 * has no regex patterns. These would silently produce zero mentions, which
 * is almost certainly not what the user wants.
 */
function hasIncompleteTerm(nodes: TaxonomyNode[]): boolean {
  for (const node of nodes) {
    if (node.kind === "term") {
      const hasLabel = node.labelEs.trim().length > 0 || node.labelEn.trim().length > 0;
      const hasPatterns = node.patterns.length > 0;
      if (!hasLabel || !hasPatterns) return true;
    } else if (hasIncompleteTerm(node.children)) {
      return true;
    }
  }
  return false;
}

/**
 * Python-only regex syntax that `new RegExp()` rejects even though the
 * pipeline compiles it without complaint: inline flags `(?i)` / `(?im)`,
 * scoped flags `(?s:...)`, named groups `(?P<x>...)` / backreferences
 * `(?P=x)` and comments `(?#...)`.
 *
 * A pattern using any of these must NOT be reported as broken — the two
 * dialects simply differ, and blocking it would make a perfectly runnable
 * protocol unsaveable from the wizard.
 */
const PYTHON_ONLY_SYNTAX = /\(\?(?:P[<=]|#|[aiLmsux]+[):])/;

/**
 * Patterns that neither JavaScript nor Python can compile (an unclosed
 * group, a dangling quantifier…). The pipeline drops such a pattern and, if
 * it was the term's only one, drops the whole term from the lexicon — so the
 * wizard has to catch it before the protocol is saved.
 */
export function findInvalidPatterns(patterns: string[]): string[] {
  return patterns.filter((pattern) => {
    try {
      new RegExp(pattern);
      return false;
    } catch {
      return !PYTHON_ONLY_SYNTAX.test(pattern);
    }
  });
}

function hasInvalidPattern(nodes: TaxonomyNode[]): boolean {
  for (const node of nodes) {
    if (node.kind === "term") {
      if (findInvalidPatterns(node.patterns).length > 0) return true;
    } else if (hasInvalidPattern(node.children)) {
      return true;
    }
  }
  return false;
}

/**
 * A category with children but no label in either language becomes an empty
 * grouping key in the pipeline, indistinguishable from "no category at all"
 * in every summary, CSV column and figure. An empty category with no
 * children is still allowed: the user may be about to fill it in.
 */
function hasUnlabeledCategory(nodes: TaxonomyNode[]): boolean {
  for (const node of nodes) {
    if (node.kind !== "category") continue;
    const hasLabel = node.labelEs.trim().length > 0 || node.labelEn.trim().length > 0;
    if (!hasLabel && node.children.length > 0) return true;
    if (hasUnlabeledCategory(node.children)) return true;
  }
  return false;
}

function validateCues(_draft: ProtocolDraft): string[] {
  // Defaults are always valid. Empty cue lists are allowed (the user may
  // intentionally disable a family) but we warn them in the UI; they don't
  // block progress.
  return [];
}

/**
 * Declared range for a section weight. The shipped profiles span -5…7
 * (defaults.ts SECTION_WEIGHT_PROFILES), so this leaves room for hand-tuned
 * values while still catching a field that was cleared or fat-fingered.
 */
export const SECTION_WEIGHT_BOUNDS = { min: -10, max: 10 } as const;

function validateSections(draft: ProtocolDraft): string[] {
  // Missing headers are tolerated (a section may be detected by position),
  // but every weight must exist and be an integer inside the declared range:
  // the weight feeds `mention_score` directly, so a silent 0 changes results.
  const errors: string[] = [];
  const { weights } = draft.sections;
  let invalid = false;
  let outOfRange = false;
  for (const sectionId of SECTION_IDS) {
    const weight = weights[sectionId];
    if (typeof weight !== "number" || !Number.isInteger(weight)) {
      invalid = true;
      continue;
    }
    if (!withinBounds(weight, SECTION_WEIGHT_BOUNDS)) outOfRange = true;
  }
  if (invalid) errors.push("sections.weight_invalid");
  if (outOfRange) errors.push("sections.weight_out_of_range");
  return errors;
}

function validateParameters(draft: ProtocolDraft): string[] {
  const errors: string[] = [];
  const { analysis } = draft;
  if (!withinBounds(analysis.contextRadius, ANALYSIS_BOUNDS.contextRadius)) {
    errors.push("parameters.context_radius_out_of_range");
  }
  if (!withinBounds(analysis.kwicRadius, ANALYSIS_BOUNDS.kwicRadius)) {
    errors.push("parameters.kwic_radius_out_of_range");
  }
  if (!withinBounds(analysis.relationDistance, ANALYSIS_BOUNDS.relationDistance)) {
    errors.push("parameters.relation_distance_out_of_range");
  }
  if (!withinBounds(analysis.kmeansK, ANALYSIS_BOUNDS.kmeansK)) {
    errors.push("parameters.k_out_of_range");
  }
  if (!withinBounds(analysis.validationSampleSize, ANALYSIS_BOUNDS.validationSampleSize)) {
    errors.push("parameters.sample_out_of_range");
  }
  return errors;
}

function withinBounds(value: number, bounds: { min: number; max: number }): boolean {
  return Number.isFinite(value) && value >= bounds.min && value <= bounds.max;
}

/* --------------------- Public API --------------------- */

const VALIDATORS: Record<WizardStepId, (draft: ProtocolDraft) => string[]> = {
  identity: validateIdentity,
  variables: validateVariables,
  taxonomy: validateTaxonomy,
  cues: validateCues,
  sections: validateSections,
  parameters: validateParameters,
  // Summary step is read-only; it inherits validity from prior steps via the
  // wizard shell's `maxReachableStep`, so we never block it from inside here.
  summary: () => []
};

export function validateStep(stepId: WizardStepId, draft: ProtocolDraft): StepValidation {
  const errors = VALIDATORS[stepId](draft);
  return { errors, isValid: errors.length === 0 };
}

/**
 * Validate every step. Useful for the wizard shell to know which future
 * steps are reachable: a step `i` is reachable iff all steps `< i` are valid.
 */
export function validateAll(draft: ProtocolDraft): Record<WizardStepId, StepValidation> {
  return Object.fromEntries(
    (Object.keys(VALIDATORS) as WizardStepId[]).map((stepId) => [
      stepId,
      validateStep(stepId, draft)
    ])
  ) as Record<WizardStepId, StepValidation>;
}

/**
 * Return the index of the latest step the user is allowed to jump to: the
 * first invalid step, or the last step when everything validates. The user
 * can always go back; this only constrains forward jumps.
 */
export function maxReachableStep(
  draft: ProtocolDraft,
  steps: readonly WizardStepId[]
): number {
  for (let i = 0; i < steps.length; i += 1) {
    const validation = validateStep(steps[i], draft);
    if (!validation.isValid) return i;
  }
  return steps.length - 1;
}
