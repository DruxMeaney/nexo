import { AppShell } from "@/components/AppShell";
import { ResultsClient } from "@/components/ResultsClient";

type ResultsPageProps = {
  searchParams?: Promise<{
    outputDir?: string;
  }>;
};

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const params = searchParams ? await searchParams : {};
  return (
    <AppShell>
      <main>
        <div className="page-title">
          <p className="eyebrow" style={{ color: "var(--teal-dark)" }}>
            Resultados
          </p>
          <h1>Visualizador de evidencia</h1>
          <p>
            Navega figuras, tablas, documentos Word y paquetes descargables generados por el pipeline. La vista prioriza
            trazabilidad y revision manual sobre conclusiones automaticas.
          </p>
        </div>
        <section className="section compact">
          <ResultsClient initialOutputDir={params.outputDir} />
        </section>
      </main>
    </AppShell>
  );
}
