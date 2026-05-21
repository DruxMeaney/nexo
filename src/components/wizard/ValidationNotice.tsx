"use client";

import { AlertTriangle } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface Props {
  t: Dictionary;
  errors: string[];
}

type ValidationMessageKey = keyof Dictionary["validation"]["messages"];

/**
 * Reusable inline error list for a wizard step. Renders nothing when there
 * are no errors, so each step can include it unconditionally.
 */
export function ValidationNotice({ t, errors }: Props) {
  if (errors.length === 0) return null;
  return (
    <div className="validation-notice" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <div>
        <strong>{t.validation.sectionTitle}</strong>
        <ul>
          {errors.map((code) => {
            const message =
              t.validation.messages[code as ValidationMessageKey] ?? code;
            return <li key={code}>{message}</li>;
          })}
        </ul>
      </div>
    </div>
  );
}
