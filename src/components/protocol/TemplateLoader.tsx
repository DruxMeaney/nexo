"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  PROTOCOL_TEMPLATES,
  findTemplate,
  type ProtocolTemplate
} from "@/lib/protocol/templates";
import type { Locale } from "@/lib/protocol/types";

const STORAGE_KEY = "nexo.protocol-draft.v1";

interface Props {
  locale: Locale;
  t: {
    title: string;
    copy: string;
    loadCta: string;
  };
}

/**
 * Three template cards inside /comenzar. Clicking a card serialises that
 * template into the wizard's localStorage key and routes the user to the
 * designer where everything is pre-populated.
 *
 * The localised tagline + name come from the template definition itself;
 * the surrounding panel chrome (title, hint, button label) is passed in
 * from the parent server component so we keep i18n centralised there.
 */
export function TemplateLoader({ locale, t }: Props) {
  const router = useRouter();

  function loadTemplate(template: ProtocolTemplate) {
    const draft = template.build();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* private mode or quota — the wizard will just open empty, still navigates */
    }
    router.push(`/protocolo/nuevo?template=${encodeURIComponent(template.id)}`);
  }

  return (
    <section className="template-loader">
      <header className="template-loader-header">
        <span className="template-loader-icon" aria-hidden="true">
          <Sparkles size={20} />
        </span>
        <div>
          <h3>{t.title}</h3>
          <p>{t.copy}</p>
        </div>
      </header>
      <div className="template-grid">
        {PROTOCOL_TEMPLATES.map((tpl) => {
          const name = locale === "es" ? tpl.nameEs : tpl.nameEn;
          const tagline = locale === "es" ? tpl.taglineEs : tpl.taglineEn;
          return (
            <article key={tpl.id} className={`template-card template-accent-${tpl.accent}`}>
              <h4>{name}</h4>
              <p>{tagline}</p>
              <button
                type="button"
                className="button-secondary"
                onClick={() => loadTemplate(tpl)}
              >
                {t.loadCta}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Re-export the lookup helper for the wizard page (so it can read the URL flag). */
export { findTemplate };
