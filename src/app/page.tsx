import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { ArrowRight, BarChart3, FileArchive, FileText, ShieldCheck, Table2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getDictionary } from "@/lib/i18n/server";
import { PROJECT_ROOT } from "@/lib/server/project";

function existingHeroFigure() {
  const candidates = [
    path.join(PROJECT_ROOT, "outputs/review_miner_publication/visual_analytics/advanced_figures/association_network.svg"),
    path.join(PROJECT_ROOT, "outputs/review_miner_publication/visual_analytics/advanced_figures/bubble_contaminant_disease.svg"),
    path.join(PROJECT_ROOT, "outputs/review_miner_publication/figures/heatmap_asociaciones.svg")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

const heroFigure = existingHeroFigure();

export default async function Home() {
  const t = await getDictionary();
  return (
    <AppShell>
      <main>
        <section className="hero">
          <img
            className="hero-visual"
            src={`/api/files/view?path=${encodeURIComponent(heroFigure)}`}
            alt={t.landing.heroImageAlt}
          />
          <div className="hero-content">
            <p className="eyebrow">{t.landing.eyebrow}</p>
            <h1>
              {t.landing.heroTitlePrefix} <em>{t.landing.heroTitleEmphasis}</em>
            </h1>
            <p className="hero-copy">{t.landing.heroCopy}</p>
            <div className="hero-actions">
              <Link className="button" href="/comenzar">
                {t.landing.ctaStart}
                <ArrowRight size={18} />
              </Link>
              <Link className="button-secondary" href="/resultados">
                {t.landing.ctaResults}
              </Link>
            </div>
          </div>
          <div className="hero-meta" aria-hidden="true">
            <div className="hero-meta-inner">
              <span>
                <ShieldCheck size={14} color="#a7d0c6" />
                {t.landing.heroMetaLocal}
              </span>
              <span>{t.landing.heroMetaVariables}</span>
              <span>{t.landing.heroMetaEvidence}</span>
              <span>{t.landing.heroMetaOutputs}</span>
            </div>
          </div>
        </section>

        <section id="metodo" className="section">
          <div className="section-heading">
            <div>
              <span className="section-index">01 — Método</span>
              <p className="eyebrow dark">{t.landing.methodEyebrow}</p>
              <h2>{t.landing.methodTitle}</h2>
              <p>{t.landing.methodCopy}</p>
            </div>
          </div>
          <div className="info-grid">
            <article className="card lift">
              <span className="card-ic">
                <FileText size={22} />
              </span>
              <h3>{t.landing.cardCorpusTitle}</h3>
              <p>{t.landing.cardCorpusCopy}</p>
            </article>
            <article className="card lift">
              <span className="card-ic" style={{ background: "#f7ebe3", color: "var(--rust)" }}>
                <Table2 size={22} />
              </span>
              <h3>{t.landing.cardExtractTitle}</h3>
              <p>{t.landing.cardExtractCopy}</p>
            </article>
            <article className="card lift">
              <span className="card-ic" style={{ background: "#e8eff6", color: "var(--blue)" }}>
                <BarChart3 size={22} />
              </span>
              <h3>{t.landing.cardVisualTitle}</h3>
              <p>{t.landing.cardVisualCopy}</p>
            </article>
          </div>
        </section>

        <div className="rule" />

        <section className="section">
          <div className="section-heading">
            <div>
              <span className="section-index">02 — Privacidad</span>
              <p className="eyebrow dark">{t.landing.privacyEyebrow}</p>
              <h2>{t.landing.privacyTitle}</h2>
              <p>{t.landing.privacyCopy}</p>
            </div>
            <ShieldCheck size={46} color="var(--olive)" />
          </div>
          <div className="info-grid">
            <div className="card">
              <span className="badge">{t.landing.badgeLocal}</span>
              <p style={{ marginTop: 14 }}>{t.landing.badgeLocalCopy}</p>
            </div>
            <div className="card">
              <span className="badge">{t.landing.badgeTraceable}</span>
              <p style={{ marginTop: 14 }}>{t.landing.badgeTraceableCopy}</p>
            </div>
            <div className="card">
              <span className="badge">{t.landing.badgeDownloadable}</span>
              <p style={{ marginTop: 14 }}>{t.landing.badgeDownloadableCopy}</p>
            </div>
          </div>
        </section>

        <div className="rule" />

        <section className="section">
          <div className="section-heading">
            <div>
              <span className="section-index">03 — Salidas</span>
              <h2>{t.landing.outputsTitle}</h2>
              <p>{t.landing.outputsCopy}</p>
            </div>
            <FileArchive size={38} color="var(--rust)" />
          </div>
        </section>
      </main>
    </AppShell>
  );
}
