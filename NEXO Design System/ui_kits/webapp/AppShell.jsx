/* NEXO UI kit — AppShell (topbar + footer) and the hero association-network figure. */

function Topbar({ go, current }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Brand onClick={() => go("landing")} />
        <nav className="nav" aria-label="Navegación principal">
          <a onClick={() => go("landing")}>Método</a>
          <a onClick={() => go("results")}>Resultados</a>
          <a onClick={() => go("start")}><Icon name="play-circle" size={17} />Comenzar</a>
          <span className="locale-toggle" style={{ display: "inline-flex", alignItems: "center", gap: 2, marginLeft: 6, padding: "4px 6px", border: "1px solid var(--line)", borderRadius: 999, background: "#fff" }}>
            <button style={lt(true)}>ES</button>
            <button style={lt(false)}>EN</button>
          </span>
        </nav>
      </div>
    </header>
  );
}

function lt(active) {
  return {
    minWidth: 28, minHeight: 26, padding: "0 6px", border: 0, borderRadius: 999,
    background: active ? "var(--teal-dark)" : "transparent", color: active ? "#fff" : "var(--muted)",
    fontSize: ".78rem", fontWeight: 720, letterSpacing: ".04em", cursor: "pointer",
  };
}

function Footer({ go }) {
  return (
    <footer className="site-footer">
      <div className="section">
        <div className="footer-grid">
          <div>
            <p className="eyebrow dark">Revisión sistemática asistida</p>
            <h2>Minería auditable, <em className="nx-em" style={{ fontStyle: "italic" }}>lectura humana al centro</em></h2>
            <p>La app distingue menciones, co-ocurrencias y asociaciones textuales. No afirma causalidad ni sustituye la evaluación crítica de los artículos.</p>
          </div>
          <button className="button-secondary" onClick={() => go("start")}>
            <Icon name="flask-conical" size={17} />Comenzar revisión<Icon name="arrow-right" size={17} />
          </button>
        </div>
      </div>
    </footer>
  );
}

/* Procedural association-network figure — stands in for the pipeline-generated SVG
   the real product bleeds behind the hero. Deterministic layout. */
function HeroFigure() {
  const W = 1180, H = 760;
  const nodes = React.useMemo(() => {
    const rng = mulberry(42);
    const arr = [];
    const N = 46;
    for (let i = 0; i < N; i++) {
      arr.push({
        x: 80 + rng() * (W - 160),
        y: 60 + rng() * (H - 120),
        r: 3 + rng() * 9,
        c: ["#4fb3aa", "#7fd3c9", "#9bc46b", "#cf8a5e", "#6fa3cc"][Math.floor(rng() * 5)],
      });
    }
    return arr;
  }, []);
  const edges = React.useMemo(() => {
    const rng = mulberry(7);
    const e = [];
    for (let i = 0; i < nodes.length; i++) {
      const links = 1 + Math.floor(rng() * 2);
      for (let k = 0; k < links; k++) {
        const j = Math.floor(rng() * nodes.length);
        if (j !== i) e.push([i, j, 0.1 + rng() * 0.4]);
      }
    }
    return e;
  }, [nodes]);
  return (
    <svg className="hero-visual" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g stroke="#7fd3c9">
        {edges.map(([a, b, o], i) => (
          <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} strokeOpacity={o} strokeWidth="1" />
        ))}
      </g>
      <g>
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={n.c} fillOpacity="0.92" />
        ))}
      </g>
    </svg>
  );
}

function mulberry(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

Object.assign(window, { Topbar, Footer, HeroFigure });
