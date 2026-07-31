/**
 * Curated example protocols.
 *
 * Each template is a complete `ProtocolDraft` ready to drop into the wizard.
 * Clicking a template card in `/comenzar` writes the draft to `localStorage`
 * and routes the user to `/protocolo/nuevo`, where the provider rehydrates
 * the in-memory state with the example. The user can then explore every
 * step of the wizard with realistic content — far more efficient than a
 * walkthrough tutorial.
 *
 * Each template covers a different two-variable domain to signal that NEXO
 * is generic: contaminants/diseases, drugs/adverse events, species/ecosystems.
 *
 * Cues, sections, and analysis params come from the regular defaults, so
 * the templates only need to provide identity + variables.
 *
 * Pattern hygiene: the pipeline compiles every pattern case-insensitively
 * (review_miner/protocol.py `_compile_patterns`), so a bare two-letter
 * chemical symbol such as `\bpb\b` also matches "PB" (phosphate buffer) and
 * "pb" (base pairs), and `\bcd\b` matches "CD" (circular dichroism, Crohn's
 * disease, cluster of differentiation). Those hits are scored exactly like a
 * genuine mention. Symbols are therefore only searched together with the
 * context that makes them unambiguous — an oxidation state or a measurement
 * word — and short abbreviations that are also ordinary words are anchored
 * the same way.
 */

import { createEmptyDraft } from "./draft";
import type { ProtocolDraft, TaxonomyNode } from "./types";

export interface ProtocolTemplate {
  id: string;
  /** Short ES name shown on the template card. */
  nameEs: string;
  /** Short EN name shown on the template card. */
  nameEn: string;
  /** Spanish one-liner that explains the domain. */
  taglineEs: string;
  /** English one-liner that explains the domain. */
  taglineEn: string;
  /** Visual accent color for the card (matches the CSS palette). */
  accent: "teal" | "rust" | "olive";
  build: () => ProtocolDraft;
}

/* --------------------- Builders --------------------- */

function term(
  id: string,
  labelEs: string,
  labelEn: string,
  patterns: string[]
): TaxonomyNode {
  return { id, kind: "term", labelEs, labelEn, patterns, generic: false };
}

function category(
  id: string,
  labelEs: string,
  labelEn: string,
  children: TaxonomyNode[]
): TaxonomyNode {
  return { id, kind: "category", labelEs, labelEn, children };
}

/**
 * Patterns for a two-letter element symbol, each anchored to context that an
 * unrelated abbreviation would not carry: an oxidation state (`Pb(II)`,
 * `Cd2+`) or a measurement word next to it (`Hg exposure`, `niveles de Cd`).
 * A bare `\bpb\b` is never emitted — see the note at the top of the file.
 */
function symbolPatterns(symbol: string): string[] {
  return [
    `\\b${symbol}\\s*\\(?\\s*(?:ii|2\\s*\\+)\\s*\\)?`,
    `\\b${symbol}\\s+(?:exposure|concentrations?|levels?|poisoning|toxicity)\\b`,
    `\\b(?:exposici[oó]n|concentraci[oó]n|niveles|intoxicaci[oó]n)\\s+(?:de\\s+)?${symbol}\\b`
  ];
}

function buildContaminantsDiseases(): ProtocolDraft {
  const draft = createEmptyDraft();
  draft.identity = {
    name: "Contaminantes y enfermedades neurodegenerativas",
    description:
      "Revisión sistemática sobre contaminantes ambientales en agua asociados a enfermedades neurodegenerativas en poblaciones humanas y modelos animales.",
    author: "Plantilla NEXO",
    corpusLanguage: "bilingual"
  };
  draft.variableA.metadata = {
    displayNameEs: "Contaminantes",
    displayNameEn: "Contaminants",
    mode: "hierarchical"
  };
  draft.variableA.nodes = [
    category("metales_pesados", "Metales pesados", "Heavy metals", [
      // "lead" is also an ordinary English verb: the lookahead drops the
      // "may lead to …" construction without losing "lead exposure".
      term("plomo", "Plomo", "Lead", [
        "\\bplomo\\b",
        "\\blead\\b(?!\\s+(?:to|author|investigator))",
        ...symbolPatterns("pb")
      ]),
      term("cadmio", "Cadmio", "Cadmium", [
        "\\bcadmio\\b",
        "\\bcadmium\\b",
        ...symbolPatterns("cd")
      ]),
      // Arsenic's symbol ("As") is deliberately not searched: it is an
      // English word, so under case-insensitive matching it would flood the
      // lexicon with false positives.
      term("arsenico", "Arsénico", "Arsenic", ["\\bars[eé]nico\\b", "\\barsenic\\b"]),
      term("mercurio", "Mercurio", "Mercury", [
        "\\bmercurio\\b",
        "\\bmercury\\b",
        ...symbolPatterns("hg")
      ]),
      term("manganeso", "Manganeso", "Manganese", ["\\bmanganeso\\b", "\\bmanganese\\b"])
    ]),
    category("pesticidas", "Pesticidas", "Pesticides", [
      term("paraquat", "Paraquat", "Paraquat", ["\\bparaquat\\b"]),
      term("rotenona", "Rotenona", "Rotenone", ["\\brotenona\\b", "\\brotenone\\b"]),
      term("glifosato", "Glifosato", "Glyphosate", ["\\bglifosato\\b", "\\bglyphosate\\b"])
    ])
  ];
  draft.variableB.metadata = {
    displayNameEs: "Enfermedades neurodegenerativas",
    displayNameEn: "Neurodegenerative diseases",
    mode: "flat"
  };
  draft.variableB.nodes = [
    term("alzheimer", "Alzheimer", "Alzheimer's disease", [
      "\\balzheimer'?s?\\b",
      "\\benfermedad de alzheimer\\b"
    ]),
    term("parkinson", "Parkinson", "Parkinson's disease", [
      "\\bparkinson'?s?\\b",
      "\\benfermedad de parkinson\\b",
      "\\bparkinsonism(?:o)?\\b"
    ]),
    // "ELA" alone also matches the Portuguese pronoun and surnames, so the
    // abbreviation is only accepted where Spanish text actually places it:
    // introduced in parentheses or preceded by an article/preposition.
    term("ela", "Esclerosis lateral amiotrófica", "Amyotrophic lateral sclerosis", [
      "\\bamyotrophic lateral sclerosis\\b",
      "\\besclerosis lateral amiotr[oó]fica\\b",
      "\\bals\\b",
      "\\(\\s*ela\\s*\\)",
      "\\b(?:la|de|con)\\s+ela\\b"
    ]),
    term("demencia", "Demencia", "Dementia", ["\\bdemencia\\b", "\\bdementia\\b"]),
    term("huntington", "Huntington", "Huntington's disease", [
      "\\bhuntington'?s?\\b",
      "\\benfermedad de huntington\\b"
    ])
  ];
  return draft;
}

function buildDrugsAdverseEvents(): ProtocolDraft {
  const draft = createEmptyDraft();
  draft.identity = {
    name: "Antidepresivos y eventos adversos",
    description:
      "Plantilla de ejemplo para una revisión sobre fármacos antidepresivos y sus eventos adversos reportados en ensayos clínicos.",
    author: "Plantilla NEXO",
    corpusLanguage: "bilingual"
  };
  draft.variableA.metadata = {
    displayNameEs: "Antidepresivos",
    displayNameEn: "Antidepressants",
    mode: "hierarchical"
  };
  draft.variableA.nodes = [
    category("ssri", "ISRS", "SSRI", [
      term("fluoxetina", "Fluoxetina", "Fluoxetine", ["\\bfluoxetin[ea]\\b", "\\bprozac\\b"]),
      term("sertralina", "Sertralina", "Sertraline", ["\\bsertralin[ea]\\b", "\\bzoloft\\b"]),
      term("paroxetina", "Paroxetina", "Paroxetine", ["\\bparoxetin[ea]\\b", "\\bpaxil\\b"])
    ]),
    category("snri", "IRSN", "SNRI", [
      term("venlafaxina", "Venlafaxina", "Venlafaxine", ["\\bvenlafaxin[ea]\\b", "\\beffexor\\b"]),
      term("duloxetina", "Duloxetina", "Duloxetine", ["\\bduloxetin[ea]\\b", "\\bcymbalta\\b"])
    ])
  ];
  draft.variableB.metadata = {
    displayNameEs: "Eventos adversos",
    displayNameEn: "Adverse events",
    mode: "hierarchical"
  };
  draft.variableB.nodes = [
    category("sexual", "Sexuales", "Sexual", [
      term("disfuncion_erectil", "Disfunción eréctil", "Erectile dysfunction", [
        "\\bdisfunci[oó]n er[eé]ctil\\b",
        "\\berectile dysfunction\\b"
      ]),
      term("libido_baja", "Disminución de libido", "Decreased libido", [
        "\\b(disminuci[oó]n|baja).{0,8}libido\\b",
        "\\bdecreased libido\\b"
      ])
    ]),
    category("gastrointestinal", "Gastrointestinales", "Gastrointestinal", [
      term("nausea", "Náusea", "Nausea", ["\\bn[aá]use[ea]\\b", "\\bnausea\\b"]),
      term("diarrea", "Diarrea", "Diarrhea", ["\\bdiarrea\\b", "\\bdiarrhea\\b"])
    ]),
    category("cardio", "Cardiovasculares", "Cardiovascular", [
      term("qt_prolongation", "Prolongación QT", "QT prolongation", [
        "\\bqt prolongation\\b",
        "\\bprolongaci[oó]n.{0,3}qt\\b"
      ])
    ])
  ];
  return draft;
}

function buildSpeciesEcosystems(): ProtocolDraft {
  const draft = createEmptyDraft();
  draft.identity = {
    name: "Especies invasoras y ecosistemas afectados",
    description:
      "Plantilla de ejemplo para una revisión sobre especies invasoras y los ecosistemas donde se reporta su impacto.",
    author: "Plantilla NEXO",
    corpusLanguage: "bilingual"
  };
  draft.variableA.metadata = {
    displayNameEs: "Especies invasoras",
    displayNameEn: "Invasive species",
    mode: "hierarchical"
  };
  draft.variableA.nodes = [
    category("plantas", "Plantas", "Plants", [
      term("eichhornia", "Lirio acuático", "Water hyacinth", [
        "\\beichhornia crassipes\\b",
        "\\blirio acu[aá]tico\\b",
        "\\bwater hyacinth\\b"
      ]),
      term("kudzu", "Kudzu", "Kudzu", ["\\bkudzu\\b", "\\bpueraria\\b"])
    ]),
    category("peces", "Peces", "Fish", [
      term("tilapia", "Tilapia", "Tilapia", ["\\btilapia\\b", "\\boreochromis\\b"]),
      term("pez_leon", "Pez león", "Lionfish", ["\\bpez le[oó]n\\b", "\\blionfish\\b", "\\bpterois\\b"])
    ])
  ];
  draft.variableB.metadata = {
    displayNameEs: "Ecosistemas",
    displayNameEn: "Ecosystems",
    mode: "flat"
  };
  draft.variableB.nodes = [
    term("manglares", "Manglares", "Mangroves", ["\\bmanglar(es)?\\b", "\\bmangrove(s)?\\b"]),
    term("arrecifes", "Arrecifes de coral", "Coral reefs", [
      "\\barrecifes? (de )?coral(es)?\\b",
      "\\bcoral reefs?\\b"
    ]),
    term("humedales", "Humedales", "Wetlands", ["\\bhumedal(es)?\\b", "\\bwetlands?\\b"]),
    term("rios", "Ríos y cuerpos de agua dulce", "Freshwater rivers and bodies", [
      // The lookahead keeps place names out (affiliations, study sites).
      "\\br[ií]os?\\b(?!\\s+(?:de\\s+janeiro|grande|negro))",
      "\\bfreshwater\\b",
      "\\blake(s)?\\b",
      "\\blago(s)?\\b"
    ])
  ];
  return draft;
}

/* --------------------- Public registry --------------------- */

export const PROTOCOL_TEMPLATES: ProtocolTemplate[] = [
  {
    id: "contaminants-neurodegeneration",
    nameEs: "Contaminantes ↔ enfermedades neurodegenerativas",
    nameEn: "Contaminants ↔ neurodegenerative diseases",
    taglineEs:
      "Metales pesados y pesticidas frente a Alzheimer, Parkinson, ELA. Listo para correrse con tu corpus PRISMA.",
    taglineEn:
      "Heavy metals and pesticides vs. Alzheimer, Parkinson, ALS. Ready to run on your PRISMA corpus.",
    accent: "teal",
    build: buildContaminantsDiseases
  },
  {
    id: "antidepressants-adverse-events",
    nameEs: "Antidepresivos ↔ eventos adversos",
    nameEn: "Antidepressants ↔ adverse events",
    taglineEs:
      "ISRS e IRSN frente a eventos sexuales, gastrointestinales y cardíacos descritos en ensayos clínicos.",
    taglineEn:
      "SSRIs and SNRIs vs. sexual, gastrointestinal and cardiac adverse events reported in clinical trials.",
    accent: "rust",
    build: buildDrugsAdverseEvents
  },
  {
    id: "invasive-species-ecosystems",
    nameEs: "Especies invasoras ↔ ecosistemas",
    nameEn: "Invasive species ↔ ecosystems",
    taglineEs:
      "Plantas y peces invasores frente a manglares, arrecifes de coral, humedales y agua dulce.",
    taglineEn:
      "Invasive plants and fish vs. mangroves, coral reefs, wetlands and freshwater.",
    accent: "olive",
    build: buildSpeciesEcosystems
  }
];

export function findTemplate(id: string): ProtocolTemplate | undefined {
  return PROTOCOL_TEMPLATES.find((tpl) => tpl.id === id);
}
