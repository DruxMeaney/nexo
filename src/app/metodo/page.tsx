import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookText,
  FileArchive,
  FileText,
  Network,
  Workflow
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getDictionary } from "@/lib/i18n/server";

export default async function MetodoPage() {
  const t = await getDictionary();
  return (
    <AppShell showFooterCta={false}>
      <main>
        <div className="page-header-compact">
          <div>
            <p className="eyebrow" style={{ color: "var(--teal-dark)", margin: 0 }}>
              {t.method.eyebrow}
            </p>
            <h1 className="page-header-compact-title">{t.method.title}</h1>
          </div>
          <Link href="/" className="button-ghost">
            <ArrowLeft size={15} />
            {t.method.backToStart}
          </Link>
        </div>

        <section className="section section-tight">
          <p style={{ maxWidth: 780 }}>{t.method.copy}</p>
        </section>

        <section className="section">
          <header className="method-section-head">
            <Workflow size={24} color="var(--teal-dark)" />
            <div>
              <h2>{t.method.diagramTitle}</h2>
              <p>{t.method.diagramCopy}</p>
            </div>
          </header>
          <ol className="method-stages">
            {t.method.stages.map((stage, idx) => (
              <li key={stage.title} className="method-stage">
                <span className="method-stage-num" aria-hidden="true">
                  {idx + 1}
                </span>
                <h3>{stage.title.replace(/^\d+\.\s*/, "")}</h3>
                <p>{stage.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section">
          <header className="method-section-head">
            <BookText size={24} color="var(--rust)" />
            <h2 style={{ margin: 0 }}>{t.method.glossaryTitle}</h2>
          </header>
          <dl className="glossary">
            {t.method.glossary.map((entry) => (
              <div key={entry.term} className="glossary-row">
                <dt>{entry.term}</dt>
                <dd>{entry.desc}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="section">
          <header className="method-section-head">
            <FileArchive size={24} color="var(--olive)" />
            <h2 style={{ margin: 0 }}>{t.method.outputsTitle}</h2>
          </header>
          <div className="info-grid">
            {t.method.outputItems.map((item, idx) => (
              <article className="card lift" key={item.title}>
                <span
                  className="card-ic"
                  style={
                    idx === 1
                      ? { background: "#f7ebe3", color: "var(--rust)" }
                      : idx === 2
                      ? { background: "#e8eff6", color: "var(--blue)" }
                      : undefined
                  }
                >
                  {idx === 0 ? <FileText size={22} /> : idx === 1 ? <Network size={22} /> : <FileArchive size={22} />}
                </span>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="panel" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ margin: 0, fontSize: "1.04rem" }}>
              <strong>{t.start.title}</strong>
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="button" href="/comenzar">
                {t.method.ctaStart}
                <ArrowRight size={16} />
              </Link>
              <Link className="button-secondary" href="/resultados">
                {t.method.ctaViewResults}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
