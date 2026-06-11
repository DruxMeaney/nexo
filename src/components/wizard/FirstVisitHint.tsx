"use client";

import { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";

const HINT_KEY = "nexo.wizard-hint-dismissed.v1";

interface Props {
  t: {
    title: string;
    bulletAutosave: string;
    bulletImport: string;
    bulletTemplate: string;
    dismissAria: string;
  };
}

/**
 * Dismissible banner shown on the user's first wizard visit.
 *
 * Stores a single boolean in `localStorage` once dismissed, so the hint
 * never re-appears. SSR-safe: starts hidden and only flips visible after
 * the first client render, avoiding hydration mismatches.
 */
export function FirstVisitHint({ t }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(HINT_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* private mode — the hint will reappear next session, acceptable */
    }
    setVisible(false);
  }

  return (
    <aside className="first-visit-hint" role="note">
      <span className="first-visit-hint-icon" aria-hidden="true">
        <Lightbulb size={18} />
      </span>
      <div>
        <strong>{t.title}</strong>
        <ul>
          <li>{t.bulletAutosave}</li>
          <li>{t.bulletImport}</li>
          <li>{t.bulletTemplate}</li>
        </ul>
      </div>
      <button
        type="button"
        className="first-visit-hint-close"
        onClick={dismiss}
        aria-label={t.dismissAria}
      >
        <X size={16} />
      </button>
    </aside>
  );
}
