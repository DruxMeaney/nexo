"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Lock, RotateCcw, Save } from "lucide-react";
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
import { FirstVisitHint } from "@/components/wizard/FirstVisitHint";
import {
  maxReachableStep,
  validateAll,
  type StepValidation
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
  // Gate on cumulative validity, never on the current step alone: steps
  // `cues` and `sections` used to let a broken step 0-2 through because their
  // own validators pass, which is how an unusable protocol reached Save.
  const canGoNext = !isLast && reachable >= stepIndex + 1;

  // Earlier steps that are invalid right now. Non-empty means the draft
  // cannot be saved, whatever step the user is standing on.
  const blockingSteps = useMemo(
    () => WIZARD_STEPS.filter((step, idx) => idx < stepIndex && !validations[step].isValid),
    [validations, stepIndex]
  );

  function goPrev() {
    setStepIndex((current) => Math.max(0, current - 1));
  }
  function goNext() {
    if (!canGoNext) return;
    setStepIndex((current) => Math.min(WIZARD_STEPS.length - 1, current + 1));
  }
  function goTo(target: WizardStepId, targetIndex: number) {
    // Always allow going back. Forward jumps stop at the first invalid step,
    // so no jump can ever skip over a step that still has errors.
    if (targetIndex <= stepIndex || targetIndex <= reachable) {
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
      <FirstVisitHint
        t={{
          title: t.wizard.firstVisitTitle,
          bulletAutosave: t.wizard.firstVisitAutosave,
          bulletImport: t.wizard.firstVisitImport,
          bulletTemplate: t.wizard.firstVisitTemplate,
          dismissAria: t.wizard.firstVisitDismiss
        }}
      />
      <ol className="wizard-progress" aria-label={t.newProtocol.stepsLabel}>
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
          const locked = idx > stepIndex && idx > reachable;
          return (
            <li key={step} className={`wizard-progress-step wizard-progress-${status}`}>
              <button
                type="button"
                className="wizard-progress-button"
                onClick={() => goTo(step, idx)}
                aria-current={status === "current" ? "step" : undefined}
                aria-disabled={locked || undefined}
                disabled={locked}
                title={t.wizard.stepDescriptions[step]}
              >
                <span className="wizard-progress-index" aria-hidden="true">
                  {status === "done" ? (
                    <Check size={12} />
                  ) : locked ? (
                    <Lock size={11} />
                  ) : (
                    idx + 1
                  )}
                </span>
                <span className="wizard-progress-label">{t.wizard.steps[step]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="wizard-progress-caption">
        <span className="muted">
          {t.newProtocol.stepIndicator
            .replace("{current}", String(stepIndex + 1))
            .replace("{total}", String(WIZARD_STEPS.length))}
          {" · "}
        </span>
        {t.wizard.stepDescriptions[currentStep]}
      </p>

      <section className="wizard-body">
        {!hydrated ? (
          <div className="panel" style={{ padding: 24, color: "var(--muted)" }}>
            {t.common.loading}
          </div>
        ) : (
          <>
            {blockingSteps.length > 0 ? (
              <BlockedStepsNotice
                t={t}
                steps={blockingSteps}
                validations={validations}
                onGoTo={goTo}
                isSummary={currentStep === "summary"}
              />
            ) : null}
            {/* The summary is where the protocol gets saved, so it is hidden
                entirely while an earlier step is invalid: the notice above
                lists what to fix and links back to it. */}
            {currentStep === "summary" && blockingSteps.length > 0 ? null : currentStep ===
              "identity" ? (
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
          </>
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

/**
 * Lists the earlier steps that still have errors, with a button that jumps
 * back to each one. Rendered whenever the user is standing on a step later
 * than a broken one — which is possible by editing a step after having
 * reached a later one.
 */
function BlockedStepsNotice({
  t,
  steps,
  validations,
  onGoTo,
  isSummary
}: {
  t: Dictionary;
  steps: WizardStepId[];
  validations: Record<WizardStepId, StepValidation>;
  onGoTo: (target: WizardStepId, targetIndex: number) => void;
  isSummary: boolean;
}) {
  return (
    <div className="validation-notice" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <div>
        <strong>{isSummary ? t.wizard.blockedSummaryTitle : t.wizard.blockedTitle}</strong>
        <p style={{ margin: "4px 0 0" }}>{t.wizard.blockedCopy}</p>
        <ul>
          {steps.map((step) => (
            <li key={step}>
              <strong>{t.wizard.steps[step]}</strong>
              {" — "}
              {validations[step].errors
                .map(
                  (code) =>
                    t.validation.messages[
                      code as keyof Dictionary["validation"]["messages"]
                    ] ?? code
                )
                .join(" ")}{" "}
              <button
                type="button"
                className="button-ghost"
                onClick={() => onGoTo(step, WIZARD_STEPS.indexOf(step))}
              >
                {t.wizard.blockedGoToStep.replace("{step}", t.wizard.steps[step])}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
