# NEXO — Design System

> **NEXO · "Minería de datos para revisiones."**
> A local-first web application for conducting **systematic literature reviews** of scientific
> literature, powered by an auditable NLP pipeline.

This repository is a **design system**: a set of brand foundations, color and type tokens,
iconography rules, reusable UI kit components, and recreations of NEXO's core product screens.
It exists so a design agent can build new screens, marketing pages, decks, or prototypes that
look and feel like the real NEXO product.

---

## 1. Product context

NEXO is a **local-first Next.js web app** that wraps a generic Python pipeline (`review_miner`).
The pipeline takes **any pair of variables** — contaminants/diseases, drugs/adverse-effects,
species/ecosystems — defined as a reusable *protocol*, and turns a folder of scientific PDFs into:

- **Auditable mentions** of each variable, with surrounding textual evidence (KWIC concordances)
- **Relations** between the two variables, each carrying evidence and a confidence level
- **Figures** (association networks, heatmaps, bubble charts — SVG)
- **Tables** (CSV / Excel / JSON) and a **Word report** with an executive summary
- A downloadable **ZIP package** of the complete analysis

The defining ethos is **traceability over convenience and scientific honesty over hype**:

- It is *local-first* — real PDF processing runs on the user's own machine (`npm run dev`),
  not in the cloud, to protect private/copyrighted corpora. Vercel only hosts the informational
  interface.
- It is explicitly humble about what it produces. The product repeats its **guardrails**
  everywhere: *a mention is not an association; a co-occurrence is not causation; every
  reported relation must be checked against its textual evidence.* The tool **supports** a
  PRISMA-style systematic review; it does not replace screening, eligibility, quality
  appraisal, or critical reading.

### The product surface (single product, several screens)

NEXO is a **single web product**. Its key screens form one connected flow:

| Screen | Route | Purpose |
| --- | --- | --- |
| **Landing** | `/` | Dark forest hero over a real pipeline figure; method, privacy, outputs |
| **Start** | `/comenzar` | Choose: design a new protocol, or load a saved one |
| **Protocol designer** | `/protocolo/nuevo` | 7-step wizard (Identity → Variables → Taxonomy → Cues → Sections → Parameters → Summary) |
| **Load protocol** | `/protocolo/cargar` | List of saved protocols to edit or run |
| **Runner** | `/ejecutar` | Pick a PDF folder, run the pipeline, watch a live log |
| **Results** | `/resultados` | Metrics, figures, table previews, reports, JSON downloads |

Because there is one product, this design system contains **one UI kit** (`ui_kits/webapp/`)
covering the marketing/landing surface *and* the application surface.

### Sources

This design system was built by reading the product source directly. The reader can explore
these further to build higher-fidelity designs:

- **GitHub repo:** `https://github.com/DruxMeaney/nexo` (branch `main`)
  - Design tokens & all component CSS: `src/app/globals.css`
  - Brand strings / copy (bilingual ES + EN): `src/lib/i18n/dictionaries.ts`
  - Screens: `src/app/page.tsx`, `src/app/comenzar/page.tsx`, `src/app/ejecutar/page.tsx`
  - Shell & components: `src/components/AppShell.tsx`, `ResultsClient.tsx`, `run/ProtocolRunner.tsx`
- **Live interface:** `https://nexo-flame.vercel.app`

Imported source files are kept under `src/` in this project for reference. The reader is
encouraged to browse the GitHub repository to recreate screens not covered here at full fidelity.

---

## 2. Content fundamentals — voice & copy

NEXO's voice is **scientific, precise, and quietly self-aware**. It speaks Spanish first
(the product is bilingual ES/EN; Spanish is the default locale) to a research audience.

- **Language:** Spanish-first. Build in Spanish unless told otherwise; an English mirror exists
  for every string. Brand name is always **NEXO** (all caps).
- **Person:** Addresses the user directly with informal Spanish **"tú"** — *"¿Cómo quieres
  comenzar?"*, *"Selecciona la carpeta con tus PDFs"*. Warm but never chatty.
- **Casing:** Sentence case for headings and body. The **eyebrow kicker** is the only
  uppercased element (`text-transform: uppercase`, `letter-spacing: 0.08em`). Brand is uppercase.
- **Tone:** Methodical and reassuring. Copy explains *why* before *what* — e.g. the privacy
  section is titled *"Privacidad antes que comodidad falsa"* (privacy before false convenience).
- **Scientific guardrails are part of the voice.** The product never overclaims. Recurrent
  phrasing: *"Una mención no equivale a asociación. Una co-ocurrencia no equivale a causalidad."*
  Results carry a standing methodological note that PRISMA reading remains the team's responsibility.
- **No emoji. No exclamation hype.** Tone is calm, declarative, occasionally instructive
  ("tip" notes use a lightbulb icon, not "💡").
- **Concrete over abstract.** Examples are domain-specific: *"Contaminantes → Metales pesados →
  Plomo"*, *"mg/L, µg/L, ppm"*, *"odds ratio, hazard ratio"*.

**Example copy (verbatim, ES):**
- Eyebrow: *"Revisión sistemática, minería de literatura y evidencia trazable"*
- Hero copy: *"Una interfaz local-first para ejecutar el pipeline de minería de literatura:
  revisa PDFs científicos, extrae menciones auditables, explora asociaciones textuales…"*
- Card: *"Detecta tus dos variables de estudio, secciones del artículo, pistas de exposición,
  asociación, dosis y negación."*
- Badge trio: **Local · Trazable · Descargable**

---

## 3. Visual foundations

The aesthetic is **scientific minimalism with an earthy, forest-laboratory palette**.
Warm off-white paper, near-black forest-green ink, and a teal/olive/rust accent family that
reads as natural-sciences rather than tech-startup. No purple gradients, no glassmorphism trends.

### Color
- **Canvas** is a warm off-white `#f7f8f5`, never pure white. **Surfaces** (cards, inputs) are
  pure white `#ffffff` and lift slightly off the canvas.
- **Ink** is `#18201c` — a near-black with a green undertone. Secondary text is `#5d675f`.
- **Primary accent** is teal `#0f6f6a` / `#0a4d4a` (buttons use the darker). Secondary warm accent
  is **rust** `#a84c24` (used for "load existing / continue" flows and warm icon wells).
  **Olive** `#627c35` signals success/privacy; **blue** `#315f8a` tags data/JSON.
- Accents are almost always paired with a **soft tint fill** behind them: teal on `#e9f5f2`,
  rust on `#f9ece4`, olive on `#eaf4df`.

### Type — editorial pairing
> **Note:** the shipped product uses **Inter** for everything. This design system *elevates* that
> into a more sophisticated, journal-like pairing. Both are documented; the kits use the new one.

- **Newsreader** (serif) for **all display & headings** — a literary, scholarly serif evoking
  scientific journals, fitting for a *literature-review* instrument. Run at weight **400–500**
  (never heavy), tight leading, `letter-spacing: -0.02em` on big sizes, with **italic** for
  editorial emphasis inside running heads (*"evidencia auditable"*, *"comodidad falsa"*).
- **Hanken Grotesk** (humanist grotesque) for **UI chrome, labels & body** — cleaner and warmer
  than Inter; weights 400 (body), 500 (lead/nav), 600 (buttons, labels, eyebrows), 700 (table heads).
- **JetBrains Mono** for **paths, regex, slugs, job IDs, live logs, section-index numerals and
  metric numbers** — anything machine-facing.
- **Display sizing:** hero `clamp(3.4rem, 9vw, 7.2rem)` at `line-height: 0.94`; section titles
  `clamp(2.1rem, 4vw, 3.1rem)`. **Metric figures** are set in Newsreader (~2.7rem) for a typeset feel.
- **Eyebrows** are small (`0.72rem`), uppercase, generously tracked (`0.14em`), prefixed with a
  **short hairline rule**; sections carry a mono **index numeral** (`01 — Método`).
- The serif/sans/mono contrast — *serif headlines, grotesque UI, mono data* — is the core of the
  system's sophistication. (Legacy: the product's Inter-only stack ran heavy, 650–780, no tracking.)

### Spacing & layout
- Content is centered in a **`min(1180px, calc(100% - 32px))`** column. Sections get `68px`
  vertical padding (`38px` compact).
- Generous, even **`16px` gaps** in grids; cards padded `18–22px`.
- Layouts are **CSS grid first** — 3-up info grids, 4-up metric grids, 2-col form grids, a
  fixed `320px + 1fr` results split. Everything collapses to one column under 900px.
- A **sticky, blurred topbar** (`backdrop-filter: blur(16px)` over translucent canvas).

### Backgrounds & imagery
- The app body is **flat warm paper** — no textures, patterns, or decorative gradients on
  content surfaces.
- The **hero** is the one bold moment: a dark forest-green canvas `#0d1816` with a **real
  pipeline figure** (association network / heatmap SVG) bled full behind it at `opacity: 0.72`,
  darkened by a left-to-right + bottom protection gradient so white text stays legible.
- "Premium" panels (runner header, save panel, results banner) use a **subtle white→mint vertical
  gradient** `linear-gradient(180deg, #ffffff 0%, #f3faf7 100%)` with a teal-tinted border —
  the *only* gradients in the system.
- Imagery vibe: the product's own output figures — clean scientific SVG charts on near-white,
  cool teal/blue data marks. No photography in the app chrome.

### Borders, corners, elevation
- **Hairline borders** `1px solid #d9dfd8` define nearly everything; NEXO is border-led, not
  shadow-led.
- **Corner radii:** inputs/buttons/chips `7px`, cards/panels/badges-as-box `8px`, welcome cards
  & premium headers `12px`, pills/badges/toggles `999px`. Brand mark `8px`.
- **Shadows are restrained.** Cards rest on `0 1px 0 rgba(24,32,28,0.03)` (a near-flat seam).
  Interactive rows/cards lift on hover to `0 14px 38px` → `0 28px 80px`. The big ambient
  `--shadow` `0 24px 70px rgba(24,32,28,0.12)` is reserved for welcome cards.
- **Accent left-borders** appear deliberately: metric cards have a `3px` teal left border;
  taxonomy nodes use `3px` teal (category) or rust (term) left borders to encode meaning.

### Motion & states
- Motion is **subtle and functional**, `~140–160ms ease` transitions.
- **Hover:** links get a teal-tinted wash + ink color; secondary buttons gain a teal-tinted
  border and `#f5fbf8` fill; cards/rows **translateY(-2px)** and deepen their shadow.
- **Press/active:** primary button darkens (`#0a4d4a` → `#073b38`). No shrink/scale on press.
- **Focus:** a `2px` teal ring `outline: 2px solid rgba(15,111,106,0.2)` plus a teal border.
- **Loading:** lucide `Loader2` spun via a `0.9s linear infinite` `spin` keyframe.
- **Disabled:** `opacity: 0.58`, `cursor: not-allowed`.
- No bounces, no parallax, no entrance animations. `scroll-behavior: smooth`.

### Transparency & blur
- Used sparingly and only on the **topbar** (translucent canvas + 16px blur) and the **hero
  protection gradients**. Content cards are fully opaque.

---

## 4. Iconography

NEXO uses **[lucide-react](https://lucide.dev)** exclusively — a single, consistent line-icon
set. No emoji, no unicode glyphs as icons, no custom illustration set, no PNG icons.

- **Style:** Lucide's signature **2px stroke, rounded line icons**, no fills. Sizes run
  `15–28px` inline, up to `38–42px` for section feature icons.
- **Coloring:** icons are tinted with the accent vars — `var(--teal-dark)` for primary/method,
  `var(--rust)` for warm/output, `var(--blue)` for data/JSON, `var(--olive)` for success/privacy.
- **The brand "logo"** is itself an icon: the lucide **`Network`** glyph (`strokeWidth 2.1`) in a
  `34px` rounded-square well (`#f4faf7` fill, teal-tinted border) beside the **NEXO** wordmark.
  There is **no separate logo image file** in the product — recreate the mark from the icon.

**Icons seen in the product (recreate from CDN lucide):**
`Network` (brand), `ArrowRight`, `ArrowLeft`, `PlayCircle`, `Play`, `FlaskConical`, `Sparkles`,
`FolderOpen`, `Lightbulb`, `FileText`, `Table2`, `BarChart3`, `FileArchive`, `ShieldCheck`,
`AlertTriangle`, `CheckCircle2`, `Download`, `RefreshCw`, `Loader2`, `ExternalLink`.

For recreations, load lucide from CDN (`https://unpkg.com/lucide@latest`) and call
`lucide.createIcons()`, or inline the specific SVGs. **Match the 2px rounded-stroke style** and
tint with the brand accent vars. See `assets/iconography.html` for the rendered set.

> **Substitution note:** there are no raster logos or bespoke illustrations in the NEXO source to
> copy — the brand is built entirely from lucide icons + type + color. This design system therefore
> recreates the brand mark from the lucide `Network` icon rather than importing an image asset.

---

## 5. Index / manifest

Root files in this design system:

| File | What it is |
| --- | --- |
| `README.md` | This document — context, voice, visual foundations, iconography, index |
| `colors_and_type.css` | All color + type CSS variables and semantic type classes |
| `SKILL.md` | Agent-Skill manifest so this folder works as a Claude Code skill |
| `assets/` | Brand mark recreation + iconography reference |
| `preview/` | Design-system cards rendered in the Design System tab |
| `ui_kits/webapp/` | The NEXO product UI kit (landing + app screens, JSX components) |
| `src/` | Imported product source files (reference only — read these for fidelity) |

**UI kits**
- `ui_kits/webapp/` — the single NEXO product surface. See its `README.md` for the component
  list and `index.html` for the interactive click-through.

There are **no slide templates** in the NEXO source, so no `slides/` folder is created.

---

## 6. Caveats

- **Typography** is a curated editorial selection — **Newsreader** (serif display),
  **Hanken Grotesk** (UI/body) and **JetBrains Mono** (data) — all from Google Fonts, no font files
  needed. This is a deliberate, sophisticated *elevation* of the product's shipped Inter-only stack;
  if you need pixel-fidelity to the live app instead, swap the families back to Inter.
- The brand mark is **reconstructed from the lucide `Network` icon** because the product ships no
  image logo. If a true logo file exists elsewhere, drop it in `assets/` and update references.
- UI-kit screens are **cosmetic high-fidelity recreations**, not the real app — interactions are
  faked (no real pipeline, file system, or Python backend).
