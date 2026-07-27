# NEXO — webapp UI kit

A high-fidelity, cosmetic recreation of the **NEXO** product surface — the local-first
systematic-review miner. This is the single NEXO product (marketing landing + application in one
connected flow), so it lives as one UI kit.

Open **`index.html`** for the interactive click-through:

`Landing → Comenzar → (Crear/Cargar protocolo) → Ejecutar (live run) → Resultados`

## Screens

| Component | File | Notes |
| --- | --- | --- |
| Topbar / footer / brand | `AppShell.jsx`, `icons.jsx` | Sticky blurred topbar, lucide `Network` brand mark, ES/EN toggle |
| **Landing** | `Landing.jsx` | Dark forest hero over a procedural association-network figure; method, privacy, outputs |
| **Start** | `StartScreen.jsx` | Two welcome cards (new vs load protocol) + tip note |
| **Runner** | `Runner.jsx` | Path picker, **interactive fake pipeline run** — progressing status steps + live log + completion CTAs |
| **Results** | `Results.jsx` | Metric cards, tabbed Figuras/Tablas/Reportes/JSON, CSV preview, methodological notice |

## Components & primitives

- `Icon` — lucide glyphs inlined (no CDN dependency), brand-tinted, 2px rounded stroke.
- `Brand` — the NEXO lockup (icon-in-well + wordmark).
- Buttons (`.button` / `.button-secondary` / `.button-ghost` / `.icon-button`), `.badge`,
  `.card` / `.panel`, `.metric`, `.tab`, `.field` + `.path-picker`, `.welcome-card`,
  `.run-status` + `.status-item` + `.log-box`, `.figure-card`, `.table-preview`.
- `FigureSVG` / `HeroFigure` — procedural scientific charts (network, heatmap, bubble, bars)
  standing in for the pipeline's real generated SVGs.

## Conventions

- **Spanish-first** copy, lifted verbatim from the product's bilingual dictionary.
- **Editorial typography:** Newsreader (serif display + metric numerals), Hanken Grotesk (UI/body),
  JetBrains Mono (paths, logs, data) — a sophisticated elevation of the product's shipped Inter.
- Palette and component values follow the product's `src/app/globals.css`, with refined spacing,
  underline tabs, section index numerals, hairline-rule eyebrows, and warm-paper premium surfaces.
- Styling is in `styles.css`; tokens mirror the root `colors_and_type.css`.

## Fidelity caveats

This kit reproduces the **look and feel**, not the engine. The pipeline run, file system access,
Python backend, and protocol designer wizard are faked or omitted. The 7-step protocol designer
(`/protocolo/nuevo`) is represented by its entry card only — see the product source under
`src/components/wizard/` to recreate it at full fidelity.
