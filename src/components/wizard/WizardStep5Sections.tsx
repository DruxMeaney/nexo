"use client";

import { useEffect, useState } from "react";
import { useProtocolDraft } from "@/components/wizard/ProtocolDraftProvider";
import { CueListEditor } from "@/components/wizard/CueListEditor";
import { ValidationNotice } from "@/components/wizard/ValidationNotice";
import {
  DEFAULT_SECTION_HEADERS,
  SECTION_WEIGHT_PROFILES
} from "@/lib/protocol/defaults";
import {
  SECTION_IDS,
  SECTION_PROFILE_IDS,
  type SectionId,
  type SectionProfileId
} from "@/lib/protocol/types";
import { SECTION_WEIGHT_BOUNDS } from "@/lib/protocol/validation";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface Props {
  t: Dictionary;
  errors: string[];
}

// Narrow the lookup keys to those whose dictionary value is a string, so the
// option label is typed as `string` instead of the union of all wizard.sections
// values (which includes the nested `names` and `notes` objects).
const PROFILE_LABEL_KEYS = {
  baseline_current: "profileBaseline",
  conservative_evidence: "profileConservative",
  neutral_counting: "profileNeutral",
  central_sections_only: "profileCentralOnly"
} as const satisfies Record<
  SectionProfileId,
  "profileBaseline" | "profileConservative" | "profileNeutral" | "profileCentralOnly"
>;

/**
 * Step 5 — Section detection and weights.
 *
 * Two controls per section:
 *   - regex patterns that detect where the section starts (via CueListEditor)
 *   - a numeric weight applied to mentions inside the section
 *
 * Plus a top-level "weight profile" selector that snaps every weight back to
 * a known preset (mirrors the Python pipeline's SECTION_PROFILES). The
 * selector switches to "Custom" the moment any weight diverges from the
 * active profile.
 */
export function WizardStep5Sections({ t, errors }: Props) {
  const { draft, updateDraft } = useProtocolDraft();

  function applyProfile(profileId: SectionProfileId) {
    const weights = SECTION_WEIGHT_PROFILES[profileId];
    updateDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        weights: { ...weights },
        activeProfile: profileId
      }
    }));
  }

  function updateWeight(sectionId: SectionId, value: number) {
    updateDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        weights: { ...current.sections.weights, [sectionId]: value },
        activeProfile: "custom"
      }
    }));
  }

  function updateHeaders(sectionId: SectionId, patterns: string[]) {
    updateDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        headers: { ...current.sections.headers, [sectionId]: patterns }
      }
    }));
  }

  const { sections } = draft;

  return (
    <div className="step-section">
      <header className="step-heading">
        <span className="step-number" aria-hidden="true">
          5
        </span>
        <div>
          <h3>{t.wizard.sections.sectionTitle}</h3>
          <p>{t.wizard.sections.sectionCopy}</p>
        </div>
      </header>

      <ValidationNotice t={t} errors={errors} />

      <div className="section-profile-row">
        <label className="field" style={{ maxWidth: 360 }}>
          <span className="field-label-static">
            {t.wizard.sections.profileLabel}
          </span>
          <select
            value={sections.activeProfile}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "custom") return;
              applyProfile(value as SectionProfileId);
            }}
          >
            {SECTION_PROFILE_IDS.map((profileId) => (
              <option key={profileId} value={profileId}>
                {t.wizard.sections[PROFILE_LABEL_KEYS[profileId]]}
              </option>
            ))}
            <option value="custom" disabled>
              {t.wizard.sections.customLabel}
            </option>
          </select>
          <p className="help-text">{t.wizard.sections.profileHint}</p>
        </label>
      </div>

      <table className="section-weights-table">
        <thead>
          <tr>
            <th scope="col">{t.wizard.sections.sectionColumn}</th>
            <th scope="col" style={{ width: 120 }}>
              {t.wizard.sections.weightColumn}
            </th>
            <th scope="col">{t.wizard.sections.headersColumn}</th>
          </tr>
        </thead>
        <tbody>
          {SECTION_IDS.map((sectionId) => {
            const hasHeaders = sectionId !== "title" && sectionId !== "other";
            const note =
              sectionId === "title"
                ? t.wizard.sections.notes.title
                : sectionId === "other"
                ? t.wizard.sections.notes.other
                : null;
            return (
              <tr key={sectionId}>
                <th scope="row">
                  <span className="section-row-name">
                    {t.wizard.sections.names[sectionId]}
                  </span>
                  {note ? <p className="help-text">{note}</p> : null}
                </th>
                <td>
                  <SectionWeightInput
                    value={sections.weights[sectionId]}
                    onCommit={(weight) => updateWeight(sectionId, weight)}
                    label={t.wizard.sections.names[sectionId]}
                    hint={t.wizard.sections.weightHint
                      .replace("{min}", String(SECTION_WEIGHT_BOUNDS.min))
                      .replace("{max}", String(SECTION_WEIGHT_BOUNDS.max))}
                  />
                </td>
                <td>
                  {hasHeaders ? (
                    <CueListEditor
                      title={t.wizard.sections.headersColumn}
                      description={t.wizard.sections.headersHint}
                      value={sections.headers[sectionId] ?? []}
                      defaults={DEFAULT_SECTION_HEADERS[sectionId] ?? []}
                      onChange={(patterns) => updateHeaders(sectionId, patterns)}
                      t={t}
                    />
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Numeric editor for one section weight.
 *
 * The typed text lives in local state and is only committed to the draft
 * when it parses to an integer: clearing the field (or typing a lone "-")
 * used to write 0 into the draft on that keystroke, and 0 is a legitimate
 * weight, so nothing downstream could tell the accident from an intent.
 * The last committed value is restored on blur when the field is left
 * unparseable.
 */
function SectionWeightInput({
  value,
  onCommit,
  label,
  hint
}: {
  value: number;
  onCommit: (weight: number) => void;
  label: string;
  hint: string;
}) {
  const [text, setText] = useState(() => String(value));

  // Follow the draft when the weight changes elsewhere (profile selector,
  // import, reset), but never while the user is mid-edit on this field.
  useEffect(() => {
    setText((current) => (Number.parseInt(current, 10) === value ? current : String(value)));
  }, [value]);

  function onChange(raw: string) {
    setText(raw);
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && String(parsed) === raw.trim()) onCommit(parsed);
  }

  return (
    <input
      type="number"
      value={text}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setText(String(value))}
      step={1}
      min={SECTION_WEIGHT_BOUNDS.min}
      max={SECTION_WEIGHT_BOUNDS.max}
      className="section-weight-input"
      aria-label={label}
      title={hint}
    />
  );
}
