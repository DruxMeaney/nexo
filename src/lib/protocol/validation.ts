/**
 * Per-step validation for a protocol draft.
 *
 * Each validator returns a list of error IDs (strings). The UI resolves the
 * IDs to localised messages — this module knows nothing about translations,
 * which keeps it pure and testable.
 *
 * The wizard uses these results to:
 *   - disable the "Next step" button when the current step has errors
 *   - block clicks on future step indicators when an earlier step is invalid
 *   - render an inline error list at the top of each step
 *
 * Past steps are NOT re-validated when the user is on a later step — the
 * wizard always allows going back to fix things.
 */

import { ANALYSIS_BOUNDS } from "./defaults";
import { countTerms } from "./draft";
import type {
  ProtocolDraft,
  ProtocolVariable,
  TaxonomyNode,
  WizardStepId
} from "./types";

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

function validateCues(_draft: ProtocolDraft): string[] {
  // Defaults are always valid. Empty cue lists are allowed (the user may
  // intentionally disable a family) but we warn them in the UI; they don't
  // block progress.
  return [];
}

function validateSections(_draft: ProtocolDraft): string[] {
  // Same logic: section weights have defaults, missing headers are tolerated.
  return [];
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
 * Return the index of the latest step the user is allowed to jump to. The
 * user can always go back; this only constrains forward jumps.
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
