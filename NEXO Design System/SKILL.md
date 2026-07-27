---
name: nexo-design
description: Use this skill to generate well-branded interfaces and assets for NEXO, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

NEXO is a local-first web app for systematic literature reviews powered by an auditable NLP
pipeline. Its aesthetic is scientific minimalism with an earthy forest palette (warm off-white
paper, near-black forest-green ink, teal/olive/rust accents), Inter run heavy, lucide line icons,
border-led surfaces, and a Spanish-first, methodologically humble voice.

Key files:
- `README.md` — product context, content/voice rules, visual foundations, iconography, manifest
- `colors_and_type.css` — color + type CSS variables and semantic type classes
- `preview/` — design-system specimen cards (colors, type, spacing, components)
- `assets/` — brand mark recreation + lucide iconography reference
- `ui_kits/webapp/` — interactive recreation of the NEXO product (landing + app screens, JSX)
- `src/` — imported product source (read for pixel-level fidelity)

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create
static HTML files for the user to view. If working on production code, copy assets and read the
rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or
design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_
production code, depending on the need. Default to Spanish copy unless told otherwise.
