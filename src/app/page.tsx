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
            <h1>{t.common.brand}</h1>
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
        </section>

        <section id="metodo" className="section">
          <div className="section-heading">
            <div>
              <p className="eyebrow" style={{ color: "var(--teal-dark)" }}>
                {t.landing.methodEyebrow}
              </p>
              <h2>{t.landing.methodTitle}</h2>
              <p>{t.landing.methodCopy}</p>
            </div>
          </div>
          <div className="info-grid">
            <article className="card">
              <FileText size={24} color="var(--teal-dark)" />
              <h3>{t.landing.cardCorpusTitle}</h3>
              <p>{t.landing.cardCorpusCopy}</p>
            </article>
            <article className="card">
              <Table2 size={24} color="var(--rust)" />
              <h3>{t.landing.cardExtractTitle}</h3>
              <p>{t.landing.cardExtractCopy}</p>
            </article>
            <article className="card">
              <BarChart3 size={24} color="var(--blue)" />
              <h3>{t.landing.cardVisualTitle}</h3>
              <p>{t.landing.cardVisualCopy}</p>
            </article>
          </div>
        </section>

        <section className="section compact">
          <div className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow" style={{ color: "var(--teal-dark)" }}>
                  {t.landing.privacyEyebrow}
                </p>
                <h2>{t.landing.privacyTitle}</h2>
                <p>{t.landing.privacyCopy}</p>
              </div>
              <ShieldCheck size={42} color="var(--olive)" />
            </div>
            <div className="info-grid">
              <div>
                <span className="badge">{t.landing.badgeLocal}</span>
                <p style={{ marginTop: 10 }}>{t.landing.badgeLocalCopy}</p>
              </div>
              <div>
                <span className="badge">{t.landing.badgeTraceable}</span>
                <p style={{ marginTop: 10 }}>{t.landing.badgeTraceableCopy}</p>
              </div>
              <div>
                <span className="badge">{t.landing.badgeDownloadable}</span>
                <p style={{ marginTop: 10 }}>{t.landing.badgeDownloadableCopy}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section compact">
          <div className="section-heading">
            <div>
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
