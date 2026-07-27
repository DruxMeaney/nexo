/* NEXO UI kit — Landing screen (/). Editorial v2. */

function Landing({ go }) {
  return (
    <main>
      <section className="hero">
        <HeroFigure />
        <div className="hero-content">
          <p className="eyebrow">Minería de literatura · evidencia trazable</p>
          <h1>De PDFs a <em>evidencia auditable</em>.</h1>
          <p className="hero-copy">
            NEXO es una interfaz local-first para ejecutar el pipeline de minería de literatura:
            revisa PDFs científicos, extrae menciones auditables, explora asociaciones textuales y
            prepara salidas listas para tablas, figuras y reportes.
          </p>
          <div className="hero-actions">
            <button className="button" onClick={() => go("start")}>Comenzar revisión<Icon name="arrow-right" size={18} /></button>
            <button className="button-secondary" onClick={() => go("results")}>Ver resultados existentes</button>
          </div>
        </div>
        <div className="hero-meta">
          <div className="hero-meta-inner">
            <span><Icon name="shield-check" size={14} color="#a7d0c6" /> Local-first</span>
            <span>Variable A <b>↔</b> Variable B</span>
            <span>PRISMA · evidencia textual</span>
            <span><b>·docx</b> + <b>·csv</b> + <b>·zip</b></span>
          </div>
        </div>
      </section>

      <section id="metodo" className="section">
        <div className="section-heading">
          <div>
            <span className="section-index">01 — Método</span>
            <p className="eyebrow dark">PRISMA + evidencia textual</p>
            <h2>De PDFs a resultados auditables</h2>
            <p>La app envuelve un pipeline Python para convertir artículos en tablas, figuras, archivos JSON, visual analytics y un reporte Word con advertencias metodológicas.</p>
          </div>
        </div>
        <div className="info-grid">
          <article className="card lift">
            <span className="card-ic"><Icon name="file-text" size={22} /></span>
            <h3>Corpus científico</h3>
            <p>Procesa carpetas locales con PDFs, TXT o MD y conserva metadatos como título, año, DOI y extracción.</p>
          </article>
          <article className="card lift">
            <span className="card-ic" style={{ background: "#f7ebe3", color: "var(--rust)" }}><Icon name="table-2" size={22} /></span>
            <h3>Extracción contextual</h3>
            <p>Detecta tus dos variables de estudio, secciones del artículo, pistas de exposición, asociación, dosis y negación.</p>
          </article>
          <article className="card lift">
            <span className="card-ic" style={{ background: "#e8eff6", color: "var(--blue)" }}><Icon name="bar-chart-3" size={22} /></span>
            <h3>Visualización científica</h3>
            <p>Expone figuras SVG, matrices, redes, tablas de validación y resúmenes para auditoría manual.</p>
          </article>
        </div>
      </section>

      <div className="rule"></div>

      <section className="section">
        <div className="section-heading">
          <div>
            <span className="section-index">02 — Privacidad</span>
            <p className="eyebrow dark">Arquitectura local-first</p>
            <h2>Privacidad antes que <em className="nx-em" style={{ fontStyle: "italic" }}>comodidad falsa</em></h2>
            <p>Vercel puede alojar la interfaz, pero un navegador desplegado en la nube no puede leer libremente tus carpetas locales. Para proteger PDFs privados, el procesamiento real corre en tu máquina mediante el backend local de Next.js.</p>
          </div>
          <Icon name="shield-check" size={46} color="var(--olive)" />
        </div>
        <div className="info-grid">
          <div className="card">
            <span className="badge">Local</span>
            <p className="muted" style={{ marginTop: 14, lineHeight: 1.6 }}>Lectura de carpetas y ejecución del pipeline Python en la máquina.</p>
          </div>
          <div className="card">
            <span className="badge">Trazable</span>
            <p className="muted" style={{ marginTop: 14, lineHeight: 1.6 }}>Cada relación conserva evidencia textual y nivel de confianza.</p>
          </div>
          <div className="card">
            <span className="badge">Descargable</span>
            <p className="muted" style={{ marginTop: 14, lineHeight: 1.6 }}>Tablas, imágenes, JSON, Word y paquete ZIP desde la vista de resultados.</p>
          </div>
        </div>
      </section>

      <div className="rule"></div>

      <section className="section">
        <div className="section-heading">
          <div>
            <span className="section-index">03 — Salidas</span>
            <h2>Salidas esperadas</h2>
            <p>Las salidas están pensadas para construir una revisión sistemática: tablas auditables, figuras, plantillas de validación manual y documentos descriptivos sin prometer causalidad.</p>
          </div>
          <Icon name="file-archive" size={42} color="var(--rust)" />
        </div>
      </section>
    </main>
  );
}

Object.assign(window, { Landing });
