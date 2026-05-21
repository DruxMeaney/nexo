import { AppShell } from "@/components/AppShell";
import { AnalyzerClient } from "@/components/AnalyzerClient";

export default function AnalyzerPage() {
  return (
    <AppShell>
      <main>
        <div className="page-title">
          <p className="eyebrow" style={{ color: "var(--teal-dark)" }}>
            Pipeline local
          </p>
          <h1>Analizador de evidencia</h1>
          <p>
            Selecciona o valida una carpeta de articulos, ejecuta el pipeline publicable y conserva una salida completa
            con tablas, figuras, reporte Word y paquete descargable.
          </p>
        </div>
        <section className="section compact">
          <AnalyzerClient />
        </section>
      </main>
    </AppShell>
  );
}
