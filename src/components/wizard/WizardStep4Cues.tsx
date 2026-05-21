"use client";

import { useProtocolDraft } from "@/components/wizard/ProtocolDraftProvider";
import { CueListEditor } from "@/components/wizard/CueListEditor";
import { ValidationNotice } from "@/components/wizard/ValidationNotice";
import { DEFAULT_CUES } from "@/lib/protocol/defaults";
import type { CueFamilyId } from "@/lib/protocol/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface Props {
  t: Dictionary;
  errors: string[];
}

const SCORING_FAMILIES: CueFamilyId[] = [
  "exposure",
  "dose",
  "association",
  "strongAssociation",
  "speculative",
  "negation"
];

const STUDY_FAMILIES: CueFamilyId[] = ["review", "human", "inVivo", "inVitro"];

/**
 * Step 4 — Lexical cues.
 *
 * Two groups of regex lists:
 *   - mention-scoring cues (applied to the context window around each mention)
 *   - study-kind cues (applied to the article title and beginning)
 *
 * Each family delegates to <CueListEditor> for editing, reset, and JSON
 * import. The step itself does no validation (empty lists are tolerated:
 * the user may intentionally disable a family).
 */
export function WizardStep4Cues({ t, errors }: Props) {
  const { draft, updateDraft } = useProtocolDraft();

  function setCueFamily(family: CueFamilyId, next: string[]) {
    updateDraft((current) => ({
      ...current,
      cues: { ...current.cues, [family]: next }
    }));
  }

  return (
    <div className="step-section">
      <header className="step-heading">
        <span className="step-number" aria-hidden="true">
          4
        </span>
        <div>
          <h3>{t.wizard.cues.sectionTitle}</h3>
          <p>{t.wizard.cues.sectionCopy}</p>
        </div>
      </header>

      <ValidationNotice t={t} errors={errors} />

      <CueGroup
        title={t.wizard.cues.groupScoringTitle}
        description={t.wizard.cues.groupScoringCopy}
        families={SCORING_FAMILIES}
        cues={draft.cues}
        onChange={setCueFamily}
        t={t}
      />

      <CueGroup
        title={t.wizard.cues.groupStudyTitle}
        description={t.wizard.cues.groupStudyCopy}
        families={STUDY_FAMILIES}
        cues={draft.cues}
        onChange={setCueFamily}
        t={t}
      />
    </div>
  );
}

function CueGroup({
  title,
  description,
  families,
  cues,
  onChange,
  t
}: {
  title: string;
  description: string;
  families: CueFamilyId[];
  cues: Record<CueFamilyId, string[]>;
  onChange: (family: CueFamilyId, next: string[]) => void;
  t: Dictionary;
}) {
  return (
    <section className="cue-group">
      <header className="cue-group-header">
        <h4>{title}</h4>
        <p className="help-text">{description}</p>
      </header>
      <div className="cue-grid">
        {families.map((family) => {
          const meta = t.wizard.cues.families[family];
          return (
            <CueListEditor
              key={family}
              title={meta.name}
              description={meta.description}
              value={cues[family]}
              defaults={DEFAULT_CUES[family]}
              onChange={(next) => onChange(family, next)}
              t={t}
            />
          );
        })}
      </div>
    </section>
  );
}
