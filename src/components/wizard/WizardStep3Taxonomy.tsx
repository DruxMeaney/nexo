"use client";

import { useMemo } from "react";
import { useProtocolDraft } from "@/components/wizard/ProtocolDraftProvider";
import { TaxonomyBuilder } from "@/components/wizard/TaxonomyBuilder";
import { ValidationNotice } from "@/components/wizard/ValidationNotice";
import { findIncompleteTermIds } from "@/lib/protocol/draft";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type {
  ProtocolDraft,
  ProtocolVariable,
  TaxonomyNode
} from "@/lib/protocol/types";

interface Props {
  t: Dictionary;
  errors: string[];
}

type VariableSlot = "variableA" | "variableB";

export function WizardStep3Taxonomy({ t, errors }: Props) {
  const { draft, updateDraft } = useProtocolDraft();

  const incompleteA = useMemo(
    () => findIncompleteTermIds(draft.variableA.nodes),
    [draft.variableA.nodes]
  );
  const incompleteB = useMemo(
    () => findIncompleteTermIds(draft.variableB.nodes),
    [draft.variableB.nodes]
  );
  const aHasContainerError =
    errors.includes("taxonomy.a_needs_terms") ||
    errors.includes("taxonomy.a_incomplete_term");
  const bHasContainerError =
    errors.includes("taxonomy.b_needs_terms") ||
    errors.includes("taxonomy.b_incomplete_term");

  function changeTreeFor(slot: VariableSlot) {
    return (updater: (tree: TaxonomyNode[]) => TaxonomyNode[]) =>
      updateDraft((current: ProtocolDraft) => ({
        ...current,
        [slot]: { ...current[slot], nodes: updater(current[slot].nodes) }
      }));
  }

  function replaceVariable(slot: VariableSlot) {
    return (next: ProtocolVariable) =>
      updateDraft((current: ProtocolDraft) => ({
        ...current,
        [slot]: next
      }));
  }

  return (
    <div className="step-section">
      <header className="step-heading">
        <span className="step-number" aria-hidden="true">
          3
        </span>
        <div>
          <h3>{t.wizard.taxonomy.sectionTitle}</h3>
          <p>{t.wizard.taxonomy.sectionCopy}</p>
        </div>
      </header>

      <ValidationNotice t={t} errors={errors} />

      <div className="taxonomy-grid">
        <TaxonomyBuilder
          variable={draft.variableA}
          onChangeTree={changeTreeFor("variableA")}
          onReplaceVariable={replaceVariable("variableA")}
          importButtonLabel={t.wizard.taxonomy.importVariableA}
          incompleteIds={incompleteA}
          containerInvalid={aHasContainerError}
          t={t}
        />
        <TaxonomyBuilder
          variable={draft.variableB}
          onChangeTree={changeTreeFor("variableB")}
          onReplaceVariable={replaceVariable("variableB")}
          importButtonLabel={t.wizard.taxonomy.importVariableB}
          incompleteIds={incompleteB}
          containerInvalid={bHasContainerError}
          t={t}
        />
      </div>
    </div>
  );
}
