"use client";

import { useProtocolDraft } from "@/components/wizard/ProtocolDraftProvider";
import { ValidationNotice } from "@/components/wizard/ValidationNotice";
import { ANALYSIS_BOUNDS } from "@/lib/protocol/defaults";
import type { AnalysisParams } from "@/lib/protocol/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface Props {
  t: Dictionary;
  errors: string[];
}

type ParamKey = keyof AnalysisParams;

const CONTEXT_PARAMS: ParamKey[] = ["contextRadius", "kwicRadius"];
const RELATION_PARAMS: ParamKey[] = ["relationDistance"];
const ANALYSIS_PARAMS: ParamKey[] = ["kmeansK", "validationSampleSize"];

/**
 * Step 6 — Numeric pipeline parameters.
 *
 * Three groups:
 *   - text windows (context_radius, kwic_radius)
 *   - relation distance
 *   - exploratory analysis (k, sample_size)
 *
 * Each parameter shows a slider + a numeric input. Both are bound to the
 * same draft field, so editing either keeps them in sync. Validation in
 * `validation.ts` flags values outside ANALYSIS_BOUNDS.
 */
export function WizardStep6Parameters({ t, errors }: Props) {
  const { draft, updateDraft } = useProtocolDraft();

  function setParam(key: ParamKey, value: number) {
    updateDraft((current) => ({
      ...current,
      analysis: { ...current.analysis, [key]: value }
    }));
  }

  return (
    <div className="step-section">
      <header className="step-heading">
        <span className="step-number" aria-hidden="true">
          6
        </span>
        <div>
          <h3>{t.wizard.parameters.sectionTitle}</h3>
          <p>{t.wizard.parameters.sectionCopy}</p>
        </div>
      </header>

      <ValidationNotice t={t} errors={errors} />

      <ParameterGroup
        title={t.wizard.parameters.groupContextTitle}
        description={t.wizard.parameters.groupContextCopy}
        keys={CONTEXT_PARAMS}
        params={draft.analysis}
        onChange={setParam}
        t={t}
      />

      <ParameterGroup
        title={t.wizard.parameters.groupRelationTitle}
        description={t.wizard.parameters.groupRelationCopy}
        keys={RELATION_PARAMS}
        params={draft.analysis}
        onChange={setParam}
        t={t}
      />

      <ParameterGroup
        title={t.wizard.parameters.groupAnalysisTitle}
        description={t.wizard.parameters.groupAnalysisCopy}
        keys={ANALYSIS_PARAMS}
        params={draft.analysis}
        onChange={setParam}
        t={t}
      />
    </div>
  );
}

function ParameterGroup({
  title,
  description,
  keys,
  params,
  onChange,
  t
}: {
  title: string;
  description: string;
  keys: ParamKey[];
  params: AnalysisParams;
  onChange: (key: ParamKey, value: number) => void;
  t: Dictionary;
}) {
  return (
    <section className="parameter-group">
      <header className="parameter-group-header">
        <h4>{title}</h4>
        <p className="help-text">{description}</p>
      </header>
      <div className="parameter-grid">
        {keys.map((key) => (
          <ParameterField
            key={key}
            paramKey={key}
            value={params[key]}
            onChange={(value) => onChange(key, value)}
            t={t}
          />
        ))}
      </div>
    </section>
  );
}

function ParameterField({
  paramKey,
  value,
  onChange,
  t
}: {
  paramKey: ParamKey;
  value: number;
  onChange: (value: number) => void;
  t: Dictionary;
}) {
  const bounds = ANALYSIS_BOUNDS[paramKey];
  const labels = t.wizard.parameters.fields[paramKey];
  const out = value < bounds.min || value > bounds.max;
  return (
    <div className={`parameter-field${out ? " parameter-out-of-range" : ""}`}>
      <label htmlFor={`param-${paramKey}`} className="parameter-label">
        <strong>{labels.label}</strong>
        <span className="parameter-bounds">
          {bounds.min}–{bounds.max}
        </span>
      </label>
      <div className="parameter-controls">
        <input
          type="range"
          id={`param-${paramKey}`}
          value={value}
          min={bounds.min}
          max={bounds.max}
          step={bounds.step}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
        />
        <input
          type="number"
          value={value}
          min={bounds.min}
          max={bounds.max}
          step={bounds.step}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
          className="parameter-number"
        />
      </div>
      <p className="help-text">{labels.hint}</p>
    </div>
  );
}
