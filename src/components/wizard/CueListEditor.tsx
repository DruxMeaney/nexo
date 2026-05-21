"use client";

import { useRef, useState } from "react";
import { RotateCcw, Upload } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface Props {
  /** Heading shown above the textarea (e.g. "Exposure"). */
  title: string;
  /** Short explanation of what this list does. */
  description: string;
  /** Current list of regex patterns (one per element). */
  value: string[];
  onChange: (next: string[]) => void;
  /** The default values used by the "reset" button. */
  defaults: string[];
  /** Dictionary for action labels. */
  t: Dictionary;
}

/**
 * Reusable editor for any list of regex strings. Used by the cues step and
 * the sections step (for header detection patterns).
 *
 * The actual state of the list is owned by the parent. This component just
 * provides a textarea, a reset-to-defaults button, and a JSON import button
 * (the file should contain a top-level JSON array of strings or an object
 * with a `patterns` array).
 *
 * Empty trimmed lines are filtered out on change, so the user can blank the
 * field to disable the family.
 */
export function CueListEditor({
  title,
  description,
  value,
  onChange,
  defaults,
  t
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function applyText(raw: string) {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    onChange(lines);
  }

  function onReset() {
    onChange([...defaults]);
    setImportError(null);
  }

  function onImportClick() {
    setImportError(null);
    fileInputRef.current?.click();
  }

  async function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const patterns = extractPatternsFromJson(parsed);
      if (patterns.length === 0) {
        setImportError(t.wizard.importErrorUnknownFormat);
        return;
      }
      onChange(patterns);
    } catch {
      setImportError(t.wizard.importErrorInvalidJson);
    }
  }

  const isEmpty = value.length === 0;

  return (
    <div className="cue-list">
      <header className="cue-list-header">
        <div>
          <h5>{title}</h5>
          <p className="help-text" style={{ marginTop: 4 }}>
            {description}
          </p>
        </div>
        <div className="cue-list-actions">
          <button
            type="button"
            className="button-ghost"
            onClick={onImportClick}
            title={t.wizard.importJsonHint}
          >
            <Upload size={14} />
            {t.wizard.cues.importList}
          </button>
          <button type="button" className="button-ghost" onClick={onReset}>
            <RotateCcw size={14} />
            {t.wizard.cues.resetToDefault}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={onFileSelected}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      </header>

      <textarea
        value={value.join("\n")}
        onChange={(e) => applyText(e.target.value)}
        rows={Math.max(3, Math.min(8, value.length + 1))}
        spellCheck={false}
        className="cue-list-textarea"
      />
      <p className="help-text">{t.wizard.cues.listLineHint}</p>

      {isEmpty ? (
        <p className="cue-list-warning">{t.wizard.cues.listEmptyWarning}</p>
      ) : null}
      {importError ? (
        <p className="cue-list-warning is-error">{importError}</p>
      ) : null}
    </div>
  );
}

/**
 * Accept either:
 *   - a top-level JSON array of strings, or
 *   - a JSON object with a `patterns` array,
 *   - or a JSON object whose values are arrays of strings (we flatten them).
 */
function extractPatternsFromJson(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload.filter((value): value is string => typeof value === "string");
  }
  if (payload && typeof payload === "object") {
    const candidate = payload as Record<string, unknown>;
    if (Array.isArray(candidate.patterns)) {
      return candidate.patterns.filter(
        (value): value is string => typeof value === "string"
      );
    }
    const flat: string[] = [];
    for (const value of Object.values(candidate)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string") flat.push(item);
        }
      }
    }
    if (flat.length > 0) return flat;
  }
  return [];
}
