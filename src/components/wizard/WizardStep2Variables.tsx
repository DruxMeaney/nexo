"use client";

import { useProtocolDraft } from "@/components/wizard/ProtocolDraftProvider";
import { ValidationNotice } from "@/components/wizard/ValidationNotice";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type {
  ProtocolDraft,
  ProtocolVariable,
  TaxonomyMode
} from "@/lib/protocol/types";

interface Props {
  t: Dictionary;
  errors: string[];
}

type VariableSlot = "variableA" | "variableB";

/**
 * Wizard step 2 — Variables.
 *
 * Two parallel cards (Variable A and Variable B) where the user types the
 * display names in both languages and picks the taxonomy mode (flat vs
 * hierarchical).
 *
 * Switching from hierarchical to flat does NOT delete existing category
 * nodes; the next step shows a notice if there are categories under a
 * flat-marked variable, and the user can still delete them manually. We
 * preserve data on accidental mode flips.
 */
export function WizardStep2Variables({ t, errors }: Props) {
  const { draft, updateDraft } = useProtocolDraft();
  const aInvalid = errors.includes("variables.a_name_required");
  const bInvalid = errors.includes("variables.b_name_required");

  function setVariableMetadata(slot: VariableSlot, patch: Partial<ProtocolVariable["metadata"]>) {
    updateDraft((current: ProtocolDraft) => ({
      ...current,
      [slot]: {
        ...current[slot],
        metadata: { ...current[slot].metadata, ...patch }
      }
    }));
  }

  return (
    <div className="step-section">
      <header className="step-heading">
        <span className="step-number" aria-hidden="true">
          2
        </span>
        <div>
          <h3>{t.wizard.variables.sectionTitle}</h3>
          <p>{t.wizard.variables.sectionCopy}</p>
        </div>
      </header>

      <ValidationNotice t={t} errors={errors} />

      <div className="variable-grid">
        <VariableCard
          t={t}
          title={t.wizard.variables.variableA}
          variable={draft.variableA}
          placeholderEs="Ej. Contaminantes"
          placeholderEn="e.g. Contaminants"
          onChange={(patch) => setVariableMetadata("variableA", patch)}
          slot="A"
          nameInvalid={aInvalid}
        />
        <VariableCard
          t={t}
          title={t.wizard.variables.variableB}
          variable={draft.variableB}
          placeholderEs="Ej. Enfermedades"
          placeholderEn="e.g. Diseases"
          onChange={(patch) => setVariableMetadata("variableB", patch)}
          slot="B"
          nameInvalid={bInvalid}
        />
      </div>
    </div>
  );
}

interface VariableCardProps {
  t: Dictionary;
  title: string;
  variable: ProtocolVariable;
  placeholderEs: string;
  placeholderEn: string;
  onChange: (patch: Partial<ProtocolVariable["metadata"]>) => void;
  slot: "A" | "B";
  nameInvalid: boolean;
}

function VariableCard({
  t,
  title,
  variable,
  placeholderEs,
  placeholderEn,
  onChange,
  slot,
  nameInvalid
}: VariableCardProps) {
  const { metadata } = variable;
  const idPrefix = `var-${slot.toLowerCase()}`;
  const invalidClass = nameInvalid ? " is-invalid" : "";
  return (
    <article className="variable-card">
      <header className="variable-card-header">
        <span className="variable-slot-badge">{slot}</span>
        <h4>{title}</h4>
      </header>
      <div className="form-grid">
        <div className={`field${invalidClass}`}>
          <label htmlFor={`${idPrefix}-es`}>{t.wizard.variables.fieldDisplayNameEs}</label>
          <input
            id={`${idPrefix}-es`}
            type="text"
            value={metadata.displayNameEs}
            placeholder={placeholderEs}
            onChange={(e) => onChange({ displayNameEs: e.target.value })}
          />
        </div>
        <div className={`field${invalidClass}`}>
          <label htmlFor={`${idPrefix}-en`}>{t.wizard.variables.fieldDisplayNameEn}</label>
          <input
            id={`${idPrefix}-en`}
            type="text"
            value={metadata.displayNameEn}
            placeholder={placeholderEn}
            onChange={(e) => onChange({ displayNameEn: e.target.value })}
          />
        </div>
        <div className="field full">
          <span className="field-label-static">{t.wizard.variables.fieldMode}</span>
          <div className="mode-toggle">
            <ModeOption
              checked={metadata.mode === "hierarchical"}
              title={t.wizard.variables.modeHierarchical}
              hint={t.wizard.variables.modeHierarchicalHint}
              name={`${idPrefix}-mode`}
              value="hierarchical"
              onSelect={(value) => onChange({ mode: value })}
            />
            <ModeOption
              checked={metadata.mode === "flat"}
              title={t.wizard.variables.modeFlat}
              hint={t.wizard.variables.modeFlatHint}
              name={`${idPrefix}-mode`}
              value="flat"
              onSelect={(value) => onChange({ mode: value })}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function ModeOption({
  checked,
  title,
  hint,
  name,
  value,
  onSelect
}: {
  checked: boolean;
  title: string;
  hint: string;
  name: string;
  value: TaxonomyMode;
  onSelect: (value: TaxonomyMode) => void;
}) {
  return (
    <label className={`mode-option${checked ? " active" : ""}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
      />
      <span>
        <strong>{title}</strong>
        <span className="mode-option-hint">{hint}</span>
      </span>
    </label>
  );
}
