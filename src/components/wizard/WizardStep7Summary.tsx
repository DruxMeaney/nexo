"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FolderOutput, Play, Save, Sparkles } from "lucide-react";
import { useProtocolDraft } from "@/components/wizard/ProtocolDraftProvider";
import { ValidationNotice } from "@/components/wizard/ValidationNotice";
import { countCategories, countTerms } from "@/lib/protocol/draft";
import { slugifyName } from "@/lib/protocol/folder";
import type { CueFamilyId } from "@/lib/protocol/types";
import { pickLabel, type Dictionary } from "@/lib/i18n/dictionaries";
import { pluralize } from "@/lib/i18n/format";

interface Props {
  t: Dictionary;
  errors: string[];
}

interface SaveSuccess {
  slug: string;
  folder: string;
  files: string[];
}

const CUE_FAMILY_LIST: CueFamilyId[] = [
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
];

/**
 * Step 7 — Summary and save.
 *
 * Shows a read-only digest of the draft (every other step), then a save
 * widget that POSTs to /api/protocol/save-folder. The widget lets the user:
 *   - tweak the destination slug (auto-derived from the protocol name)
 *   - toggle overwrite-on-conflict
 *   - see success (folder + file list) or error inline
 *
 * No validation is enforced here: if any prior step is invalid the wizard
 * shell prevents reaching this step.
 */
export function WizardStep7Summary({ t, errors }: Props) {
  const { draft } = useProtocolDraft();
  const [slug, setSlug] = useState(() => slugifyName(draft.identity.name));
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SaveSuccess | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSave() {
    setBusy(true);
    setErrorMsg(null);
    setResult(null);
    try {
      const response = await fetch("/api/protocol/save-folder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft, slug: slug || undefined, overwrite })
      });
      const payload = (await response.json()) as
        | SaveSuccess
        | { error: string };
      if (!response.ok) {
        const code = "error" in payload ? payload.error : "error";
        if (code === "already_exists") {
          setErrorMsg(t.wizard.summary.errorAlreadyExists);
        } else {
          setErrorMsg(`${t.wizard.summary.errorSaveFailed} (${code})`);
        }
        return;
      }
      setResult(payload as SaveSuccess);
    } catch (cause) {
      setErrorMsg(
        cause instanceof Error
          ? `${t.wizard.summary.errorSaveFailed} (${cause.message})`
          : t.wizard.summary.errorSaveFailed
      );
    } finally {
      setBusy(false);
    }
  }

  const aCategories = countCategories(draft.variableA.nodes);
  const aTerms = countTerms(draft.variableA.nodes);
  const bCategories = countCategories(draft.variableB.nodes);
  const bTerms = countTerms(draft.variableB.nodes);

  return (
    <div className="step-section">
      <header className="step-heading">
        <span className="step-number" aria-hidden="true">
          7
        </span>
        <div>
          <h3>{t.wizard.summary.sectionTitle}</h3>
          <p>{t.wizard.summary.sectionCopy}</p>
        </div>
      </header>

      <ValidationNotice t={t} errors={errors} />

      <div className="summary-grid">
        <SummaryCard
          title={t.wizard.summary.identityCardTitle}
          icon={<Sparkles size={20} />}
        >
          <p style={{ marginTop: 0 }}>
            <strong>{draft.identity.name || "—"}</strong>
          </p>
          {draft.identity.description ? (
            <p>
              <span className="muted">{t.wizard.summary.descriptionLabel}:</span>{" "}
              {draft.identity.description}
            </p>
          ) : null}
          {draft.identity.author ? (
            <p className="muted">
              {t.wizard.summary.authorLabel}: {draft.identity.author}
            </p>
          ) : null}
          <p className="muted">
            {t.wizard.summary.languageLabel}:{" "}
            {draft.identity.corpusLanguage === "es"
              ? t.wizard.identity.languageEs
              : draft.identity.corpusLanguage === "en"
              ? t.wizard.identity.languageEn
              : t.wizard.identity.languageBilingual}
          </p>
        </SummaryCard>

        <SummaryCard
          title={t.wizard.summary.variablesCardTitle}
          icon={<FolderOutput size={20} />}
        >
          <VariableSummaryRow
            slot="A"
            displayNameEs={draft.variableA.metadata.displayNameEs}
            displayNameEn={draft.variableA.metadata.displayNameEn}
            categories={aCategories}
            terms={aTerms}
            t={t}
          />
          <VariableSummaryRow
            slot="B"
            displayNameEs={draft.variableB.metadata.displayNameEs}
            displayNameEn={draft.variableB.metadata.displayNameEn}
            categories={bCategories}
            terms={bTerms}
            t={t}
          />
        </SummaryCard>

        <SummaryCard title={t.wizard.summary.scoringCardTitle}>
          <ul className="summary-list">
            {CUE_FAMILY_LIST.map((family) => (
              <li key={family}>
                <strong>{t.wizard.cues.families[family].name}</strong>
                <span className="muted"> · {draft.cues[family].length}</span>
              </li>
            ))}
          </ul>
        </SummaryCard>

        <SummaryCard title={t.wizard.summary.sectionsCardTitle}>
          <p className="muted" style={{ marginTop: 0 }}>
            {draft.sections.activeProfile === "custom"
              ? t.wizard.sections.customLabel
              : t.wizard.sections[
                  draft.sections.activeProfile === "baseline_current"
                    ? "profileBaseline"
                    : draft.sections.activeProfile === "conservative_evidence"
                    ? "profileConservative"
                    : draft.sections.activeProfile === "neutral_counting"
                    ? "profileNeutral"
                    : "profileCentralOnly"
                ]}
          </p>
          <ul className="summary-list">
            {Object.entries(draft.sections.weights).map(([id, weight]) => (
              <li key={id}>
                <strong>
                  {t.wizard.sections.names[id as keyof typeof t.wizard.sections.names]}
                </strong>
                <span className="muted"> · {weight}</span>
              </li>
            ))}
          </ul>
        </SummaryCard>

        <SummaryCard title={t.wizard.summary.parametersCardTitle}>
          <ul className="summary-list">
            <li>
              <strong>{t.wizard.parameters.fields.contextRadius.label}</strong>
              <span className="muted"> · {draft.analysis.contextRadius}</span>
            </li>
            <li>
              <strong>{t.wizard.parameters.fields.kwicRadius.label}</strong>
              <span className="muted"> · {draft.analysis.kwicRadius}</span>
            </li>
            <li>
              <strong>{t.wizard.parameters.fields.relationDistance.label}</strong>
              <span className="muted"> · {draft.analysis.relationDistance}</span>
            </li>
            <li>
              <strong>{t.wizard.parameters.fields.kmeansK.label}</strong>
              <span className="muted"> · {draft.analysis.kmeansK}</span>
            </li>
            <li>
              <strong>
                {t.wizard.parameters.fields.validationSampleSize.label}
              </strong>
              <span className="muted">
                {" "}
                · {draft.analysis.validationSampleSize}
              </span>
            </li>
          </ul>
        </SummaryCard>
      </div>

      <section className="save-panel">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="save-slug">{t.wizard.summary.slugLabel}</label>
            <input
              id="save-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              spellCheck={false}
            />
            <p className="help-text">{t.wizard.summary.slugHint}</p>
          </div>
          <label className="check-row" style={{ alignSelf: "end" }}>
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            <span>
              {t.wizard.summary.overwriteLabel}{" "}
              <span className="muted">— {t.wizard.summary.overwriteHint}</span>
            </span>
          </label>
        </div>

        <div className="save-actions">
          <button
            type="button"
            className="button"
            onClick={onSave}
            disabled={busy || !slug}
          >
            <Save size={16} />
            {busy ? t.wizard.summary.savingLabel : t.wizard.summary.saveButton}
          </button>
        </div>

        {errorMsg ? (
          <div className="notice notice-danger" role="alert">
            <strong>{t.wizard.summary.errorSaveFailed}</strong>
            <p style={{ margin: 0 }}>{errorMsg}</p>
          </div>
        ) : null}

        {result ? (
          <div className="save-result" role="status">
            <CheckCircle2 size={22} color="var(--olive)" />
            <div>
              <strong>{t.wizard.summary.savedLabel}</strong>
              <p style={{ margin: "4px 0 0" }} className="mono">
                {t.wizard.summary.savedFolder} <span>{result.folder}</span>
              </p>
              <p style={{ margin: "8px 0 0" }} className="muted">
                {t.wizard.summary.savedFiles} {result.files.length}
              </p>
              <p style={{ margin: "8px 0 0" }}>{t.wizard.summary.nextSteps}</p>
              <div className="save-result-cta">
                <Link
                  className="button"
                  href={`/ejecutar?protocol=${encodeURIComponent(result.slug)}`}
                >
                  <Play size={16} />
                  {t.loadProtocol.runAction}
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  icon,
  children
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="summary-card">
      <header>
        {icon}
        <h4>{title}</h4>
      </header>
      <div>{children}</div>
    </article>
  );
}

function VariableSummaryRow({
  slot,
  displayNameEs,
  displayNameEn,
  categories,
  terms,
  t
}: {
  slot: "A" | "B";
  displayNameEs: string;
  displayNameEn: string;
  categories: number;
  terms: number;
  t: Dictionary;
}) {
  // Solo uno de los dos nombres es obligatorio: se muestra el del idioma
  // activo y, si está vacío, el del otro idioma.
  const label = pickLabel(t.localeCode, displayNameEs, displayNameEn) || "—";
  return (
    <div className="summary-variable-row">
      <span className="variable-slot-badge">{slot}</span>
      <div>
        <strong>{label}</strong>
        <p className="muted" style={{ margin: 0 }}>
          {pluralize(categories, t.wizard.summary.countCategories, t.wizard.summary.countCategoriesSingular)}
          {" · "}
          {pluralize(terms, t.wizard.summary.countTerms, t.wizard.summary.countTermsSingular)}
        </p>
      </div>
    </div>
  );
}
