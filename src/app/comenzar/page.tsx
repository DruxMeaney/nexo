import Link from "next/link";
import { ArrowRight, FolderOpen, Sparkles, Lightbulb } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getDictionary } from "@/lib/i18n/server";

export default async function StartPage() {
  const t = await getDictionary();
  return (
    <AppShell>
      <main>
        <section className="page-title">
          <p className="eyebrow" style={{ color: "var(--teal-dark)" }}>
            {t.start.eyebrow}
          </p>
          <h1>{t.start.title}</h1>
          <p>{t.start.copy}</p>
        </section>

        <section className="section">
          <div className="welcome-grid">
            <article className="welcome-card">
              <div className="welcome-card-icon welcome-card-icon-new" aria-hidden="true">
                <Sparkles size={28} />
              </div>
              <p className="eyebrow" style={{ color: "var(--teal-dark)" }}>
                {t.start.newCardEyebrow}
              </p>
              <h2>{t.start.newCardTitle}</h2>
              <p>{t.start.newCardCopy}</p>
              <Link className="button welcome-card-cta" href="/protocolo/nuevo">
                {t.start.newCardCta}
                <ArrowRight size={18} />
              </Link>
            </article>

            <article className="welcome-card">
              <div className="welcome-card-icon welcome-card-icon-load" aria-hidden="true">
                <FolderOpen size={28} />
              </div>
              <p className="eyebrow" style={{ color: "var(--rust)" }}>
                {t.start.loadCardEyebrow}
              </p>
              <h2>{t.start.loadCardTitle}</h2>
              <p>{t.start.loadCardCopy}</p>
              <Link className="button-secondary welcome-card-cta" href="/protocolo/cargar">
                {t.start.loadCardCta}
                <ArrowRight size={18} />
              </Link>
            </article>
          </div>

          <aside className="welcome-tip" role="note">
            <Lightbulb size={20} aria-hidden="true" />
            <p>{t.start.tip}</p>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}
