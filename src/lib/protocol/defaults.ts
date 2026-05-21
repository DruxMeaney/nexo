/**
 * Default values for every configurable piece of the protocol.
 *
 * These mirror the hardcoded constants in the Python pipeline. Keeping them
 * here in one place lets the wizard:
 *   - prefill new protocols with sensible defaults
 *   - offer per-family "reset to defaults" buttons
 *   - show a baseline profile users can compare their edits against
 *
 * Sources:
 *   - cues: review_miner/extract.py, review_miner/classify.py, review_miner/relations.py
 *   - sections: review_miner/sections.py, review_miner/publication_extensions.py (SECTION_PROFILES)
 *   - parameters: review_miner/publication_pipeline.py argparse defaults
 *
 * The strings are stored without enclosing slashes (they are JavaScript regex
 * source strings). The pipeline compiles them case-insensitively. The wizard
 * does NOT validate that each line is a syntactically valid regex — it
 * preserves whatever the user types and lets the pipeline complain on run.
 */

import type {
  AnalysisParams,
  CuePack,
  SectionConfig,
  SectionId,
  SectionProfileId
} from "./types";
import { SECTION_IDS } from "./types";

/* --------------------- Cue defaults --------------------- */

export const DEFAULT_CUES: CuePack = {
  // extract.py — EXPOSURE_CUES
  exposure: [
    "\\b(exposed|exposure|treated|treatment|administered|administration)\\b",
    "\\b(dose|doses|dosage|concentration|concentrations|levels?|measured|measurement)\\b",
    "\\b(drinking\\s+water|well[-\\s]?water|waterborne|contaminated\\s+water|contaminated\\s+drinking\\s+water)\\b",
    "\\b(serum|urine|urinary|blood|brain|groups?|control\\s+group|oral|gavage|ad\\s+libitum)\\b",
    "\\b(expos(?:ición|iciones))\\b",
    "\\b(ensayo|grupo|control|tratad[oa]s?|expuest[oa]s?|concentraci[oó]n|dosis)\\b"
  ],
  // extract.py — DOSE_CUES
  dose: [
    "\\b\\d+(?:[\\.,]\\d+)?\\s*(mg/l|ug/l|µg/l|μg/l|ng/l|ppm|ppb|mg/kg|µm|μm|um|nm|g/l|mg/kg/day)\\b",
    "\\b(ng/l|µg/l|μg/l|mg/l|ppm|ppb|mg/kg|µm|μm|mg/kg/day)\\b"
  ],
  // extract.py — ASSOCIATION_CUES
  association: [
    "\\b(associated\\s+with|association\\s+between|increased\\s+risk|decreased\\s+risk|higher\\s+risk)\\b",
    "\\b(odds\\s+ratio|hazard\\s+ratio|relative\\s+risk|risk\\s+of|correlated\\s+with|linked\\s+to)\\b",
    "\\b(induced|induces|caused|causes|elicits|evokes|impairs|alters|attenuates)\\b",
    "\\b(asociad[oa]\\s+con|asociaci[oó]n\\s+entre|mayor\\s+riesgo|riesgo\\s+de|correlacionad[oa])\\b"
  ],
  // relations.py — STRONG_ASSOCIATION
  strongAssociation: [
    "\\b(increased\\s+risk|decreased\\s+risk|higher\\s+risk|hazard\\s+ratio|odds\\s+ratio|relative\\s+risk)\\b",
    "\\b(significant(?:ly)?|associated\\s+with|association\\s+between|induced|induces|elicits|evokes|impairs)\\b",
    "\\b(mayor\\s+riesgo|riesgo\\s+elevado|asociad[oa]\\s+con|significativ[oa])\\b"
  ],
  // extract.py — SPECULATIVE_CUES
  speculative: [
    "\\b(may|might|could|suggests?|potential|hypothesis|hypothesized|possible|plausible)\\b",
    "\\b(podr[ií]a|sugiere|potencial|hip[oó]tesis|posible|plausible)\\b"
  ],
  // extract.py — NEGATION_CUES
  negation: [
    "\\b(not associated|no association|not significant|failed to find|without association)\\b",
    "\\b(no se asoci[oó]|sin asociaci[oó]n|no significativo|no hubo asociaci[oó]n)\\b"
  ],
  // classify.py — REVIEW_CUES
  review: [
    "\\b(review|systematic review|narrative review|meta[-\\s]?analysis)\\b",
    "\\b(revisi[oó]n|metaan[aá]lisis)\\b"
  ],
  // classify.py — HUMAN_CUES
  human: [
    "\\b(human|humans|patients?|participants?|cohort|case[-\\s]?control|population)\\b",
    "\\b(epidemiological|epidemiologic|registry|biobank)\\b",
    "\\b(pacientes?|participantes?|cohorte|poblaci[oó]n|epidemiol[oó]gic[oa])\\b"
  ],
  // classify.py — IN_VIVO_CUES
  inVivo: [
    "\\b(in vivo|mouse|mice|rat|rats|murine|zebrafish|danio rerio|larvae|larval|animal model)\\b",
    "\\b(rat[oó]n|rata|pez cebra|modelo animal)\\b"
  ],
  // classify.py — IN_VITRO_CUES
  inVitro: [
    "\\b(in vitro|cell line|cells|culture|cultured|sh-sy5y|pc12|neuroblastoma)\\b",
    "\\b(c[eé]lulas?|cultivo celular|l[ií]nea celular)\\b"
  ]
};

/* --------------------- Section defaults --------------------- */

/**
 * Section header detection regexes. Mirror sections.py SECTION_HEADERS.
 *
 * `title` has no header pattern: the pipeline synthesises it as the segment
 * before the first detected section. `other` is a catch-all bucket for any
 * text that didn't fall under another section. Both are kept in the config
 * because they receive weights.
 */
export const DEFAULT_SECTION_HEADERS: Record<SectionId, string[]> = {
  title: [],
  abstract: ["(?im)^\\s*(abstract|resumen)\\b"],
  introduction: [
    "(?im)^\\s*(\\d+[\\.\\)]?\\s*)?(introduction|introducci[oó]n|background|antecedentes)\\b"
  ],
  methods: [
    "(?im)^\\s*(\\d+[\\.\\)]?\\s*)?((materials?\\s+and\\s+methods?)|(methods?)|(methodology))\\b",
    "(?im)^\\s*(\\d+[\\.\\)]?\\s*)?((experimental\\s+procedures?)|(study\\s+population)|(participants?\\s+and\\s+methods?))\\b",
    "(?im)^\\s*(\\d+[\\.\\)]?\\s*)?((materiales\\s+y\\s+m[eé]todos)|(m[eé]todos))\\b"
  ],
  results: ["(?im)^\\s*(\\d+[\\.\\)]?\\s*)?(results?|resultados)\\b"],
  discussion: ["(?im)^\\s*(\\d+[\\.\\)]?\\s*)?(discussion|discusi[oó]n)\\b"],
  conclusion: ["(?im)^\\s*(\\d+[\\.\\)]?\\s*)?(conclusions?|conclusiones?)\\b"],
  references: ["(?im)^\\s*(references|referencias|bibliography|literature\\s+cited)\\b"],
  other: []
};

/**
 * Section weight presets, mirroring publication_extensions.py SECTION_PROFILES.
 * `baseline_current` matches the live section_weight() function in sections.py.
 */
export const SECTION_WEIGHT_PROFILES: Record<SectionProfileId, Record<SectionId, number>> = {
  baseline_current: {
    title: 5,
    abstract: 4,
    methods: 6,
    results: 5,
    discussion: 2,
    conclusion: 2,
    introduction: 1,
    references: -3,
    other: 1
  },
  conservative_evidence: {
    title: 3,
    abstract: 3,
    methods: 7,
    results: 6,
    discussion: 1,
    conclusion: 1,
    introduction: 0,
    references: -5,
    other: 0
  },
  neutral_counting: {
    title: 1,
    abstract: 1,
    methods: 1,
    results: 1,
    discussion: 1,
    conclusion: 1,
    introduction: 1,
    references: 0,
    other: 1
  },
  central_sections_only: {
    title: 1,
    abstract: 1,
    methods: 1,
    results: 1,
    discussion: 0,
    conclusion: 0,
    introduction: 0,
    references: -1,
    other: 0
  }
};

export function defaultSectionConfig(): SectionConfig {
  return {
    headers: cloneRecord(DEFAULT_SECTION_HEADERS),
    weights: { ...SECTION_WEIGHT_PROFILES.baseline_current },
    activeProfile: "baseline_current"
  };
}

/* --------------------- Analysis parameter defaults --------------------- */

export const DEFAULT_ANALYSIS_PARAMS: AnalysisParams = {
  contextRadius: 260,
  kwicRadius: 160,
  relationDistance: 900,
  kmeansK: 4,
  validationSampleSize: 200
};

/**
 * Safe bounds shown in the UI. The pipeline doesn't enforce these, but the
 * wizard does — values outside the range are flagged in validation.
 */
export const ANALYSIS_BOUNDS = {
  contextRadius: { min: 40, max: 1200, step: 10 },
  kwicRadius: { min: 20, max: 600, step: 10 },
  relationDistance: { min: 100, max: 3000, step: 50 },
  kmeansK: { min: 2, max: 12, step: 1 },
  validationSampleSize: { min: 20, max: 1000, step: 10 }
} as const;

/* --------------------- Helpers --------------------- */

export function defaultCues(): CuePack {
  return Object.fromEntries(
    (Object.keys(DEFAULT_CUES) as Array<keyof CuePack>).map((key) => [key, [...DEFAULT_CUES[key]]])
  ) as CuePack;
}

export function defaultAnalysisParams(): AnalysisParams {
  return { ...DEFAULT_ANALYSIS_PARAMS };
}

function cloneRecord(record: Record<SectionId, string[]>): Record<SectionId, string[]> {
  return Object.fromEntries(
    SECTION_IDS.map((id) => [id, [...(record[id] ?? [])]])
  ) as Record<SectionId, string[]>;
}
