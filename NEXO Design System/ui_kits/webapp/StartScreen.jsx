/* NEXO UI kit — Start screen (/comenzar). */

function StartScreen({ go }) {
  return (
    <main>
      <section className="page-title">
        <p className="eyebrow dark">Paso 1 de tu revisión</p>
        <h1>¿Cómo quieres comenzar?</h1>
        <p>Un protocolo guarda todas las decisiones de tu revisión: las dos variables que buscas, sus términos y categorías, las ventanas de contexto, las pistas léxicas, los pesos por sección del artículo y los parámetros de análisis. Puedes diseñar uno nuevo o cargar uno que ya hayas guardado antes.</p>
      </section>

      <section className="section">
        <div className="welcome-grid">
          <article className="welcome-card">
            <div className="welcome-card-icon welcome-card-icon-new" aria-hidden="true"><Icon name="sparkles" size={28} /></div>
            <p className="eyebrow dark">Empieza desde cero</p>
            <h2>Diseñar un nuevo protocolo</h2>
            <p>Te guiamos paso a paso para definir tus dos variables, sus términos, las pistas léxicas y los parámetros de análisis. Al final podrás guardar el protocolo como una carpeta reutilizable.</p>
            <button className="button welcome-card-cta" onClick={() => go("runner")}>Crear protocolo<Icon name="arrow-right" size={18} /></button>
          </article>

          <article className="welcome-card">
            <div className="welcome-card-icon welcome-card-icon-load" aria-hidden="true"><Icon name="folder-open" size={28} /></div>
            <p className="eyebrow" style={{ color: "var(--rust)" }}>Continúa una revisión existente</p>
            <h2>Cargar un protocolo guardado</h2>
            <p>Si ya tienes una carpeta de protocolo, cárgala y solo selecciona la carpeta con tus PDFs para volver a ejecutar la extracción sobre un corpus actualizado.</p>
            <button className="button-secondary welcome-card-cta" onClick={() => go("runner")}>Cargar protocolo<Icon name="arrow-right" size={18} /></button>
          </article>
        </div>

        <aside className="welcome-tip" role="note">
          <Icon name="lightbulb" size={20} />
          <p>Cada paso del diseñador permite, además, importar piezas sueltas de otro protocolo (solo las variables, solo las pistas, solo las secciones). Nada se reescribe sin necesidad.</p>
        </aside>
      </section>
    </main>
  );
}

Object.assign(window, { StartScreen });
