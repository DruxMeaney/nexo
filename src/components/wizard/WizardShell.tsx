"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lock, RotateCcw, Save } from "lucide-react";
import {
  ProtocolDraftProvider,
  useProtocolDraft
} from "@/components/wizard/ProtocolDraftProvider";
import { WizardStep1Identity } from "@/components/wizard/WizardStep1Identity";
import { WizardStep2Variables } from "@/components/wizard/WizardStep2Variables";
import { WizardStep3Taxonomy } from "@/components/wizard/WizardStep3Taxonomy";
import { WizardStep4Cues } from "@/components/wizard/WizardStep4Cues";
import { WizardStep5Sections } from "@/components/wizard/WizardStep5Sections";
import { WizardStep6Parameters } from "@/components/wizard/WizardStep6Parameters";
import { WizardStep7Summary } from "@/components/wizard/WizardStep7Summary";
import {
  maxReachableStep,
  validateAll
} from "@/lib/protocol/validation";
import { WIZARD_STEPS, type WizardStepId } from "@/lib/protocol/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface WizardShellProps {
  t: Dictionary;
}

/**
 * Top-level wizard container. Holds the active step and renders the matching
 * step component. State for the protocol draft lives in `ProtocolDraftProvider`.
 *
 * The shell intentionally lives in a client component so we can swap steps
 * without a route change.
 */
export function WizardShell({ t }: WizardShellProps) {
  return (
    <ProtocolDraftProvider>
      <WizardShellInner t={t} />
    </ProtocolDraftProvider>
  );
}

function WizardShellInner({ t }: WizardShellProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const { draft, hydrated, savedAt, resetDraft } = useProtocolDraft();

  // Validate every step on every render. Cheap (O(N) over a small draft) and
  // it keeps the indicators always in sync with the form contents.
  const validations = useMemo(() => validateAll(draft), [draft]);
  const reachable = useMemo(
    () => maxReachableStep(draft, WIZARD_STEPS),
    [draft]
  );

  const currentStep = WIZARD_STEPS[stepIndex];
  const currentValidation = validations[currentStep];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === WIZARD_STEPS.length - 1;
  const canGoNext = currentValidation.isValid && !isLast;

  function goPrev() {
    setStepIndex((current) => Math.max(0, current - 1));
  }
  function goNext() {
    if (!canGoNext) return;
    setStepIndex((current) => Math.min(WIZARD_STEPS.length - 1, current + 1));
  }
  function goTo(target: WizardStepId, targetIndex: number) {
    // Always allow going back. Forward jumps are clamped to `reachable + 1`
    // (you can jump to the next-after-last-valid, but not beyond).
    const maxAllowed = Math.min(reachable + 1, WIZARD_STEPS.length - 1);
    if (targetIndex <= stepIndex || targetIndex <= maxAllowed) {
      setStepIndex(WIZARD_STEPS.indexOf(target));
    }
  }
  function onReset() {
    if (window.confirm(t.wizard.resetConfirm)) {
      resetDraft();
      setStepIndex(0);
    }
  }

  return (
    <div className="wizard">
      <ol className="wizard-steps" aria-label={t.newProtocol.stepsLabel}>
        {WIZARD_STEPS.map((step, idx) => {
          const validation = validations[step];
          const status =
            idx < stepIndex
              ? validation.isValid
                ? "done"
                : "warn"
              : idx === stepIndex
              ? "current"
              : "todo";
          const maxAllowed = Math.min(reachable + 1, WIZARD_STEPS.length - 1);
          const locked = idx > stepIndex && idx > maxAllowed;
          return (
            <li key={step} className={`wizard-step wizard-step-${status}`}>
              <button
                type="button"
                className="wizard-step-button"
                onClick={() => goTo(step, idx)}
                aria-current={status === "current" ? "step" : undefined}
                aria-disabled={locked || undefined}
                disabled={locked}
              >
                <span className="wizard-step-index" aria-hidden="true">
                  {status === "done" ? (
                    <Check size={14} />
                  ) : locked ? (
                    <Lock size={13} />
                  ) : (
                    idx + 1
                  )}
                </span>
                <span className="wizard-step-label">{t.wizard.steps[step]}</span>
              </button>
              <p className="wizard-step-description">
                {t.wizard.stepDescriptions[step]}
              </p>
            </li>
          );
        })}
      </ol>

      <section className="wizard-body">
        {!hydrated ? (
          <div className="panel" style={{ padding: 24, color: "var(--muted)" }}>
            {t.common.loading}
          </div>
        ) : currentStep === "identity" ? (
          <WizardStep1Identity t={t} errors={currentValidation.errors} />
        ) : currentStep === "variables" ? (
          <WizardStep2Variables t={t} errors={currentValidation.errors} />
        ) : currentStep === "taxonomy" ? (
          <WizardStep3Taxonomy t={t} errors={currentValidation.errors} />
        ) : currentStep === "cues" ? (
          <WizardStep4Cues t={t} errors={currentValidation.errors} />
        ) : currentStep === "sections" ? (
          <WizardStep5Sections t={t} errors={currentValidation.errors} />
        ) : currentStep === "parameters" ? (
          <WizardStep6Parameters t={t} errors={currentValidation.errors} />
        ) : (
          <WizardStep7Summary t={t} errors={currentValidation.errors} />
        )}
      </section>

      <footer className="wizard-footer">
        <div className="wizard-footer-meta">
          {savedAt ? (
            <span className="wizard-saved">
              <Save size={14} aria-hidden="true" /> {t.wizard.draftSaved}
            </span>
          ) : null}
          <button type="button" className="button-ghost" onClick={onReset}>
            <RotateCcw size={15} />
            {t.wizard.reset}
          </button>
        </div>
        <div className="wizard-footer-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={goPrev}
            disabled={isFirst}
          >
            <ArrowLeft size={16} />
            {t.wizard.navPrev}
          </button>
          <button
            type="button"
            className="button"
            onClick={goNext}
            disabled={!canGoNext}
            title={canGoNext ? undefined : t.validation.next}
          >
            {isLast ? t.wizard.navFinish : t.wizard.navNext}
            <ArrowRight size={16} />
          </button>
        </div>
      </footer>
    </div>
  );
}
