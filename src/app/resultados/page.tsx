import { AppShell } from "@/components/AppShell";
import { ResultsClient } from "@/components/ResultsClient";
import { getDictionary } from "@/lib/i18n/server";

type ResultsPageProps = {
  searchParams?: Promise<{
    outputDir?: string;
  }>;
};

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const params: { outputDir?: string } = searchParams ? await searchParams : {};
  const t = await getDictionary();
  return (
    <AppShell showFooterCta={false}>
      <main>
        <div className="page-title">
          <p className="eyebrow" style={{ color: "var(--teal-dark)" }}>
            {t.results.eyebrow}
          </p>
          <h1>{t.results.title}</h1>
          <p>{t.results.copy}</p>
        </div>
        <section className="section compact">
          <ResultsClient initialOutputDir={params.outputDir} t={t} />
        </section>
      </main>
    </AppShell>
  );
}
