"use client";

import { useProtocolDraft } from "@/components/wizard/ProtocolDraftProvider";
import { ValidationNotice } from "@/components/wizard/ValidationNotice";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { CorpusLanguage } from "@/lib/protocol/types";

interface Props {
  t: Dictionary;
  errors: string[];
}

/**
 * Wizard step 1 — Identity.
 *
 * Pure form. Reads & writes the `identity` slice of the draft. No API calls,
 * no persistence concerns (the provider handles localStorage on every change).
 */
export function WizardStep1Identity({ t, errors }: Props) {
  const { draft, updateDraft } = useProtocolDraft();
  const { identity } = draft;
  const nameInvalid = errors.includes("identity.name_required");

  function setField<K extends keyof typeof identity>(key: K, value: (typeof identity)[K]) {
    updateDraft((current) => ({
      ...current,
      identity: { ...current.identity, [key]: value }
    }));
  }

  return (
    <div className="step-section">
      <header className="step-heading">
        <span className="step-number" aria-hidden="true">
          1
        </span>
        <div>
          <h3>{t.wizard.identity.sectionTitle}</h3>
          <p>{t.wizard.stepDescriptions.identity}</p>
        </div>
      </header>

      <ValidationNotice t={t} errors={errors} />

      <div className="form-grid">
        <div className={`field full${nameInvalid ? " is-invalid" : ""}`}>
          <label htmlFor="protocol-name">{t.wizard.identity.fieldName}</label>
          <input
            id="protocol-name"
            type="text"
            value={identity.name}
            placeholder={t.wizard.identity.fieldNamePlaceholder}
            onChange={(e) => setField("name", e.target.value)}
          />
          <p className="help-text">{t.wizard.identity.fieldNameHint}</p>
        </div>

        <div className="field full">
          <label htmlFor="protocol-description">
            {t.wizard.identity.fieldDescription}
          </label>
          <textarea
            id="protocol-description"
            value={identity.description}
            placeholder={t.wizard.identity.fieldDescriptionPlaceholder}
            onChange={(e) => setField("description", e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="protocol-author">{t.wizard.identity.fieldAuthor}</label>
          <input
            id="protocol-author"
            type="text"
            value={identity.author}
            placeholder={t.wizard.identity.fieldAuthorPlaceholder}
            onChange={(e) => setField("author", e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="protocol-language">{t.wizard.identity.fieldLanguage}</label>
          <select
            id="protocol-language"
            value={identity.corpusLanguage}
            onChange={(e) => setField("corpusLanguage", e.target.value as CorpusLanguage)}
          >
            <option value="es">{t.wizard.identity.languageEs}</option>
            <option value="en">{t.wizard.identity.languageEn}</option>
            <option value="bilingual">{t.wizard.identity.languageBilingual}</option>
          </select>
          <p className="help-text">{t.wizard.identity.fieldLanguageHint}</p>
        </div>
      </div>
    </div>
  );
}
