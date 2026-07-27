/**
 * Genera "Parametros_NLP_NEXO.docx": inventario completo de los parametros
 * con peso del modelo de NLP de NEXO (review_miner / src/lib/protocol).
 *
 * Fuentes de los valores:
 *   - Lexico:        config/review_miner_contaminants.json, config/review_miner_diseases.json
 *   - Pesos seccion: src/lib/protocol/defaults.ts (SECTION_WEIGHT_PROFILES),
 *                    review_miner/publication_extensions.py (SECTION_PROFILES),
 *                    review_miner/protocol.py (DEFAULT_SECTION_WEIGHTS)
 *   - Cues:          src/lib/protocol/defaults.ts (DEFAULT_CUES)
 *   - Pesos mencion: review_miner/classify.py (mention_score)
 *   - Relaciones:    review_miner/relations.py (build_relations)
 *   - Evidencia/rol: review_miner/publication_extensions.py, review_miner/visual_analytics.py
 *   - Umbrales:      review_miner/classify.py (_assign_role, _confidence), relations.py
 *   - Analisis:      src/lib/protocol/defaults.ts (DEFAULT_ANALYSIS_PARAMS, ANALYSIS_BOUNDS)
 */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, TableOfContents, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak
} = require("docx");

/* ------------------------- constantes de estilo ------------------------- */

const CONTENT_W = 9360;            // US Letter, margenes 1"
const HEADER_FILL = "176B87";      // azul NEXO
const SUBHEAD_FILL = "D5E8F0";
const ZEBRA_FILL = "F2F7FA";
const POS_FILL = "E3F2E3";         // verde claro: peso positivo
const NEG_FILL = "FBE4E4";         // rojo claro: peso negativo
const MONO = "Consolas";

const thin = { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" };
const cellBorders = { top: thin, bottom: thin, left: thin, right: thin };

/* ------------------------------ helpers --------------------------------- */

function h1(text, { pageBreak = false } = {}) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: pageBreak, children: [new TextRun(text)] });
}
function h2(text, { pageBreak = false } = {}) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: pageBreak, children: [new TextRun(text)] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 276 },
    children: [new TextRun({ text, ...opts })]
  });
}
function runs(children, opts = {}) {
  return new Paragraph({ spacing: { after: 120, line: 276 }, children, ...opts });
}
function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 60 },
    children: typeof text === "string" ? [new TextRun(text)] : text
  });
}
function caption(text) {
  return new Paragraph({
    spacing: { before: 60, after: 160 },
    children: [new TextRun({ text, italics: true, size: 18, color: "555555" })]
  });
}

function headerCell(text, width) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 19 })] })]
  });
}

// content: string | TextRun[] | Paragraph[]
function bodyCell(content, width, opts = {}) {
  let children;
  if (Array.isArray(content) && content[0] instanceof Paragraph) {
    children = content;
  } else if (Array.isArray(content)) {
    children = [new Paragraph({ children: content })];
  } else {
    children = [new Paragraph({ children: [new TextRun({ text: String(content), size: opts.size || 19 })] })];
  }
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 50, bottom: 50, left: 110, right: 110 },
    verticalAlign: VerticalAlign.CENTER,
    children
  });
}

// patterns -> array of Paragraphs (one regex per line, monospace)
function patternParas(patterns) {
  return patterns.map((pat, i) =>
    new Paragraph({
      spacing: { after: i === patterns.length - 1 ? 0 : 20 },
      children: [new TextRun({ text: pat, font: MONO, size: 16 })]
    })
  );
}

// weight cell with color by sign
function weightCell(value, width) {
  const num = typeof value === "number" ? value : parseFloat(value);
  let fill;
  if (!isNaN(num)) {
    if (num > 0) fill = POS_FILL;
    else if (num < 0) fill = NEG_FILL;
  }
  const text = typeof value === "number" ? (value > 0 ? `+${value}` : `${value}`) : String(value);
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 50, bottom: 50, left: 110, right: 110 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 19 })]
    })]
  });
}

/**
 * buildTable(headers, widths, rows)
 *   headers: string[]
 *   widths:  number[] (suman CONTENT_W)
 *   rows:    array de filas; cada celda es:
 *            - {w:n} -> weightCell
 *            - {pat:[...]} -> patrones monospace
 *            - string | TextRun[] | Paragraph[] -> bodyCell
 */
function buildTable(headers, widths, rows, { zebra = true } = {}) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((t, i) => headerCell(t, widths[i]))
  });
  const bodyRows = rows.map((cells, r) => {
    const fill = zebra && r % 2 === 1 ? ZEBRA_FILL : undefined;
    return new TableRow({
      children: cells.map((c, i) => {
        if (c && typeof c === "object" && "w" in c && !(c instanceof TextRun)) {
          return weightCell(c.w, widths[i]);
        }
        if (c && typeof c === "object" && "pat" in c) {
          return bodyCell(patternParas(c.pat), widths[i], { fill });
        }
        return bodyCell(c, widths[i], { fill });
      })
    });
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...bodyRows]
  });
}

/* =======================================================================
   DATOS
   ======================================================================= */

// --- Variable A: contaminantes (config/review_miner_contaminants.json) ---
const CONTAMINANTS = [
  ["plomo", "lead", "Metales pesados", false, ["\\bplomo\\b", "\\bpb\\b", "\\blead\\s+(acetate|exposure|poisoning|levels?|concentrations?|contamination|compounds?|neurotoxicity|intoxication|treatment)\\b"]],
  ["cadmio", "cadmium", "Metales pesados", false, ["\\bcadmio\\b", "\\bcadmium\\b", "\\bcd\\b", "\\bcdcl\\s*2\\b", "\\bcdcl2\\b"]],
  ["aluminio", "aluminum/aluminium", "Metales pesados", false, ["\\baluminio\\b", "\\baluminum\\b", "\\baluminium\\b"]],
  ["arsénico", "arsenic", "Metales pesados", false, ["\\bars[eé]nico\\b", "\\barsenic\\b", "\\binorganic arsenic\\b", "\\bas\\s*-?mixture\\b"]],
  ["mercurio", "mercury", "Metales pesados", false, ["\\bmercurio\\b", "\\bmercury\\b", "\\bmethylmercury\\b", "\\bmetilmercurio\\b", "\\bhg\\b"]],
  ["manganeso", "manganese", "Metales pesados", false, ["\\bmanganeso\\b", "\\bmanganese\\b", "\\bmn\\b"]],
  ["cobre", "copper", "Metales pesados", false, ["\\bcobre\\b", "\\bcopper\\b", "\\bcu\\b", "\\bcuso\\s*4\\b", "\\bcuso4\\b"]],
  ["cromo", "chromium", "Metales pesados", false, ["\\bcromo\\b", "\\bchromium\\b", "\\bcr\\b"]],
  ["níquel", "nickel", "Metales pesados", false, ["\\bn[ií]quel\\b", "\\bnickel\\b"]],
  ["zinc", "zinc", "Metales pesados", false, ["\\bzinc\\b", "\\bzn\\b"]],
  ["selenio", "selenium", "Metales pesados", false, ["\\bselenio\\b", "\\bselenium\\b"]],
  ["uranio", "uranium", "Metales pesados", false, ["\\buranio\\b", "\\buranium\\b", "\\bdepleted uranium\\b"]],
  ["metales pesados (genérico)", "heavy metals", "Metales pesados", true, ["\\bheavy metals?\\b", "\\bmetales pesados?\\b", "\\bpotentially toxic elements?\\b", "\\bpte?s\\b"]],
  ["paraquat", "paraquat", "Pesticidas", false, ["\\bparaquat\\b"]],
  ["atrazina", "atrazine", "Pesticidas", false, ["\\batrazina\\b", "\\batrazine\\b"]],
  ["glifosato", "glyphosate", "Pesticidas", false, ["\\bglifosato\\b", "\\bglyphosate\\b", "\\baminomethylphosphonic acid\\b", "\\bampa\\b"]],
  ["mancozeb", "mancozeb", "Pesticidas", false, ["\\bmancozeb\\b"]],
  ["diclorvos", "dichlorvos", "Pesticidas", false, ["\\bdiclorvos\\b", "\\bdichlorvos\\b"]],
  ["diazinón", "diazinon", "Pesticidas", false, ["\\bdiazin[oó]n\\b", "\\bdiazinon\\b"]],
  ["clorpirifos", "chlorpyrifos", "Pesticidas", false, ["\\bclorpirif[oó]s\\b", "\\bchlorpyrifos\\b"]],
  ["triadimefon", "triadimefon", "Pesticidas", false, ["\\btriadimefon\\b"]],
  ["pesticidas/plaguicidas (genérico)", "pesticides", "Pesticidas", true, ["\\bpesticides?\\b", "\\bplaguicidas?\\b", "\\bherbicides?\\b", "\\bherbicidas?\\b", "\\bfungicides?\\b", "\\borganophosphates?\\b", "\\borganofosforados?\\b"]],
  ["PAH (genérico)", "PAH", "Contaminantes orgánicos persistentes", true, ["\\bpahs?\\b", "\\bpolycyclic aromatic hydrocarbons?\\b", "\\bhidrocarburos arom[aá]ticos polic[ií]clicos\\b"]],
  ["benzo[a]pireno", "benzo[a]pyrene", "Contaminantes orgánicos persistentes", false, ["\\bbenzo\\s*\\[?a\\]?\\s*pyrene\\b", "\\bbenzo\\s*\\[?a\\]?\\s*pireno\\b", "\\bbenzopyrene\\b", "\\bbap\\b"]],
  ["bifenilos policlorados (PCB)", "PCB", "Contaminantes orgánicos persistentes", false, ["\\bpcbs?\\b", "\\bpolychlorinated biphenyls?\\b", "\\bbifenilos policlorados\\b"]],
  ["dioxinas", "dioxins", "Contaminantes orgánicos persistentes", false, ["\\bdioxinas?\\b", "\\bdioxins?\\b", "\\btcdd\\b"]],
  ["contaminantes orgánicos persistentes (genérico)", "persistent organic pollutants", "Contaminantes orgánicos persistentes", true, ["\\bpersistent organic pollutants?\\b", "\\bcontaminantes org[aá]nicos persistentes\\b", "\\bpops?\\b"]],
  ["microplásticos", "microplastics", "Microplásticos", false, ["\\bmicropl[aá]sticos?\\b", "\\bmicroplastics?\\b"]],
  ["nanoplásticos", "nanoplastics", "Microplásticos", false, ["\\bnanopl[aá]sticos?\\b", "\\bnanoplastics?\\b", "\\bpolystyrene nanoplastics?\\b", "\\bpolystyrene nanoparticles?\\b"]],
  ["material particulado (genérico)", "particulate matter", "Material particulado", true, ["\\bmaterial particulado\\b", "\\bparticulate matter\\b", "\\bpm\\s*2\\.?5\\b", "\\bpm\\s*10\\b", "\\bultrafine particles?\\b"]],
  ["contaminación atmosférica (genérico)", "air pollution", "Contaminantes atmosféricos", true, ["\\bair pollution\\b", "\\bambient air pollution\\b", "\\bcontaminaci[oó]n atmosf[eé]rica\\b", "\\bnitrogen dioxide\\b", "\\bno2\\b", "\\bozone\\b", "\\bo3\\b", "\\bsulfur dioxide\\b", "\\bso2\\b"]],
  ["solventes (genérico)", "solvents", "Solventes", true, ["\\bsolvents?\\b", "\\bsolventes?\\b", "\\btoluene\\b", "\\btolueno\\b", "\\btrichloroethylene\\b", "\\btricloroetileno\\b", "\\bbenzene\\b", "\\bbenceno\\b"]],
  ["PFAS", "PFAS", "Otros contaminantes relevantes", false, ["\\bpfas\\b", "\\bpfos\\b", "\\bpfoa\\b", "\\bpfhxs\\b", "\\bperfluoroalkyl\\b", "\\bperfluoroalkylated\\b"]],
  ["BMAA", "BMAA", "Otros contaminantes relevantes", false, ["\\bbmaa\\b", "\\bβ\\s*-?n\\s*-?methylamino\\s*-?l\\s*-?alanine\\b", "\\bbeta\\s*-?n\\s*-?methylamino\\s*-?l\\s*-?alanine\\b", "\\bβ\\s*-?methylamino\\s*-?l\\s*-?alanine\\b"]],
  ["microcistina", "microcystin", "Otros contaminantes relevantes", false, ["\\bmicrocistina\\b", "\\bmicrocystin\\b", "\\bmc\\s*-?lr\\b"]],
  ["cianotoxinas (genérico)", "cyanotoxins", "Otros contaminantes relevantes", true, ["\\bcianotoxinas?\\b", "\\bcyanotoxins?\\b", "\\bcyanobacteria\\b", "\\bcianobacterias\\b", "\\bdinoflagellates?\\b"]],
  ["piridinio de furosemida", "furosemide pyridinium", "Otros contaminantes relevantes", false, ["\\bfurosemida\\b", "\\bfurosemide\\b", "\\bpyridinium\\b", "\\bpiridinio\\b"]],
  ["bisfenol A", "bisphenol A", "Otros contaminantes relevantes", false, ["\\bbisphenol a\\b", "\\bbisfenol a\\b", "\\bbpa\\b"]],
  ["mezcla ambiental (genérico)", "environmental mixture", "Otros contaminantes relevantes", true, ["\\bleachate\\b", "\\blixiviado\\b", "\\bwastewater\\b", "\\bcontaminated drinking water\\b", "\\bcontaminated water\\b", "\\bmezcla de contaminantes\\b"]]
];

// --- Variable B: enfermedades (config/review_miner_diseases.json) ---
const DISEASES = [
  ["Alzheimer", "Alzheimer's disease", "Alzheimer", ["\\balzheimer'?s?\\b", "\\benfermedad de alzheimer\\b", "\\bad\\b", "\\bamyloid\\b", "\\bamiloide\\b", "\\btau\\b"]],
  ["Parkinson", "Parkinson's disease", "Parkinson", ["\\bparkinson'?s?\\b", "\\benfermedad de parkinson\\b", "\\bparkinsonism\\b", "\\bparkinsonismo\\b", "\\bdopaminergic\\b", "\\bdopamin[eé]rgic[ao]s?\\b"]],
  ["esclerosis lateral amiotrófica", "amyotrophic lateral sclerosis", "Esclerosis lateral amiotrófica", ["\\bamyotrophic lateral sclerosis\\b", "\\besclerosis lateral amiotr[oó]fica\\b", "\\bals\\b", "\\bela\\b", "\\bmotor neuron disease\\b", "\\bmotoneuron disease\\b"]],
  ["Huntington", "Huntington's disease", "Huntington", ["\\bhuntington'?s?\\b", "\\benfermedad de huntington\\b"]],
  ["demencia", "dementia", "Demencia", ["\\bdementia\\b", "\\bdemencia\\b", "\\bvascular dementia\\b", "\\bdemencia vascular\\b", "\\bmixed dementia\\b", "\\bdemencia mixta\\b"]],
  ["deterioro cognitivo", "cognitive impairment", "Deterioro cognitivo", ["\\bcognitive impairment\\b", "\\bdeterioro cognitivo\\b", "\\bmild cognitive impairment\\b", "\\bmci\\b", "\\bneuropsychological functioning\\b", "\\bmemory impairment\\b"]],
  ["esclerosis múltiple", "multiple sclerosis", "Otras enfermedades detectadas", ["\\bmultiple sclerosis\\b", "\\besclerosis m[uú]ltiple\\b", "\\bdemyelinating\\b", "\\bdesmielinizaci[oó]n\\b"]],
  ["neurodegeneración general", "general neurodegeneration", "Enfermedades neurodegenerativas generales", ["\\bneurodegenerative diseases?\\b", "\\bneurodegeneraci[oó]n\\b", "\\bneurodegenerative disorders?\\b", "\\bneurotoxicity\\b", "\\bneurotoxicidad\\b"]]
];

// --- Pesos por seccion (defaults.ts SECTION_WEIGHT_PROFILES) ---
const SECTION_ORDER = ["title", "abstract", "introduction", "methods", "results", "discussion", "conclusion", "references", "other"];
const SECTION_ES = {
  title: "title — título", abstract: "abstract — resumen", introduction: "introduction — introducción",
  methods: "methods — métodos", results: "results — resultados", discussion: "discussion — discusión",
  conclusion: "conclusion — conclusión", references: "references — referencias", other: "other — texto sin clasificar"
};
const SECTION_PROFILES = {
  baseline_current:        { title:5, abstract:4, introduction:1, methods:6, results:5, discussion:2, conclusion:2, references:-3, other:1 },
  conservative_evidence:   { title:3, abstract:3, introduction:0, methods:7, results:6, discussion:1, conclusion:1, references:-5, other:0 },
  neutral_counting:        { title:1, abstract:1, introduction:1, methods:1, results:1, discussion:1, conclusion:1, references:0,  other:1 },
  central_sections_only:   { title:1, abstract:1, introduction:0, methods:1, results:1, discussion:0, conclusion:0, references:-1, other:0 }
};

// --- Cues (defaults.ts DEFAULT_CUES) ---
const CUES = {
  exposure: [
    "\\b(exposed|exposure|treated|treatment|administered|administration)\\b",
    "\\b(dose|doses|dosage|concentration|concentrations|levels?|measured|measurement)\\b",
    "\\b(drinking\\s+water|well[-\\s]?water|waterborne|contaminated\\s+water|contaminated\\s+drinking\\s+water)\\b",
    "\\b(serum|urine|urinary|blood|brain|groups?|control\\s+group|oral|gavage|ad\\s+libitum)\\b",
    "\\b(expos(?:ición|iciones))\\b",
    "\\b(ensayo|grupo|control|tratad[oa]s?|expuest[oa]s?|concentraci[oó]n|dosis)\\b"
  ],
  dose: [
    "\\b\\d+(?:[\\.,]\\d+)?\\s*(mg/l|ug/l|µg/l|μg/l|ng/l|ppm|ppb|mg/kg|µm|μm|um|nm|g/l|mg/kg/day)\\b",
    "\\b(ng/l|µg/l|μg/l|mg/l|ppm|ppb|mg/kg|µm|μm|mg/kg/day)\\b"
  ],
  association: [
    "\\b(associated\\s+with|association\\s+between|increased\\s+risk|decreased\\s+risk|higher\\s+risk)\\b",
    "\\b(odds\\s+ratio|hazard\\s+ratio|relative\\s+risk|risk\\s+of|correlated\\s+with|linked\\s+to)\\b",
    "\\b(induced|induces|caused|causes|elicits|evokes|impairs|alters|attenuates)\\b",
    "\\b(asociad[oa]\\s+con|asociaci[oó]n\\s+entre|mayor\\s+riesgo|riesgo\\s+de|correlacionad[oa])\\b"
  ],
  speculative: [
    "\\b(may|might|could|suggests?|potential|hypothesis|hypothesized|possible|plausible)\\b",
    "\\b(podr[ií]a|sugiere|potencial|hip[oó]tesis|posible|plausible)\\b"
  ],
  negation: [
    "\\b(not associated|no association|not significant|failed to find|without association)\\b",
    "\\b(no se asoci[oó]|sin asociaci[oó]n|no significativo|no hubo asociaci[oó]n)\\b"
  ]
};
const CUE_KIND = {
  strongAssociation: [
    "\\b(increased\\s+risk|decreased\\s+risk|higher\\s+risk|hazard\\s+ratio|odds\\s+ratio|relative\\s+risk)\\b",
    "\\b(significant(?:ly)?|associated\\s+with|association\\s+between|induced|induces|elicits|evokes|impairs)\\b",
    "\\b(mayor\\s+riesgo|riesgo\\s+elevado|asociad[oa]\\s+con|significativ[oa])\\b"
  ],
  review: [
    "\\b(review|systematic review|narrative review|meta[-\\s]?analysis)\\b",
    "\\b(revisi[oó]n|metaan[aá]lisis)\\b"
  ],
  human: [
    "\\b(human|humans|patients?|participants?|cohort|case[-\\s]?control|population)\\b",
    "\\b(epidemiological|epidemiologic|registry|biobank)\\b",
    "\\b(pacientes?|participantes?|cohorte|poblaci[oó]n|epidemiol[oó]gic[oa])\\b"
  ],
  inVivo: [
    "\\b(in vivo|mouse|mice|rat|rats|murine|zebrafish|danio rerio|larvae|larval|animal model)\\b",
    "\\b(rat[oó]n|rata|pez cebra|modelo animal)\\b"
  ],
  inVitro: [
    "\\b(in vitro|cell line|cells|culture|cultured|sh-sy5y|pc12|neuroblastoma)\\b",
    "\\b(c[eé]lulas?|cultivo celular|l[ií]nea celular)\\b"
  ]
};

// --- Headers de seccion (defaults.ts DEFAULT_SECTION_HEADERS) ---
const SECTION_HEADERS = {
  abstract: ["(?im)^\\s*(abstract|resumen)\\b"],
  introduction: ["(?im)^\\s*(\\d+[\\.\\)]?\\s*)?(introduction|introducci[oó]n|background|antecedentes)\\b"],
  methods: [
    "(?im)^\\s*(\\d+[\\.\\)]?\\s*)?((materials?\\s+and\\s+methods?)|(methods?)|(methodology))\\b",
    "(?im)^\\s*(\\d+[\\.\\)]?\\s*)?((experimental\\s+procedures?)|(study\\s+population)|(participants?\\s+and\\s+methods?))\\b",
    "(?im)^\\s*(\\d+[\\.\\)]?\\s*)?((materiales\\s+y\\s+m[eé]todos)|(m[eé]todos))\\b"
  ],
  results: ["(?im)^\\s*(\\d+[\\.\\)]?\\s*)?(results?|resultados)\\b"],
  discussion: ["(?im)^\\s*(\\d+[\\.\\)]?\\s*)?(discussion|discusi[oó]n)\\b"],
  conclusion: ["(?im)^\\s*(\\d+[\\.\\)]?\\s*)?(conclusions?|conclusiones?)\\b"],
  references: ["(?im)^\\s*(references|referencias|bibliography|literature\\s+cited)\\b"]
};

/* =======================================================================
   CONTENIDO DEL DOCUMENTO
   ======================================================================= */

const children = [];

/* ---- Portada ---- */
children.push(
  new Paragraph({ spacing: { before: 1600, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "NEXO", bold: true, size: 64, color: HEADER_FILL })] }),
  new Paragraph({ spacing: { after: 80 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Minería de datos para revisiones sistemáticas", size: 22, color: "555555" })] }),
  new Paragraph({ spacing: { before: 600, after: 120 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Parámetros del modelo de NLP", bold: true, size: 44 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Inventario completo de parámetros y sus pesos", size: 26, color: "333333" })] }),
  new Paragraph({ spacing: { before: 40 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Revisión de contaminantes en agua y neurodegeneración", size: 22, color: "555555" })] }),
  new Paragraph({ spacing: { before: 1200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Generado el 4 de junio de 2026", size: 20, color: "777777" })] })
);

/* ---- Indice ---- */
children.push(
  h1("Contenido", { pageBreak: true }),
  new TableOfContents("Contenido", { hyperlink: true, headingStyleRange: "1-3" })
);

/* ---- 1. Como leer este documento ---- */
children.push(h1("1. Cómo leer este documento", { pageBreak: true }));
children.push(p("Este documento inventaría todos los parámetros que dan forma al modelo de NLP de NEXO y, para cada uno, indica a qué grupo pertenece, qué tipo de parámetro es y —cuando aplica— qué peso tiene."));
children.push(runs([
  new TextRun({ text: "El modelo es basado en reglas auditables, no una red neuronal. ", bold: true }),
  new TextRun("Cada \"peso\" es un número fijo y explícito definido en el código, no un valor aprendido. Esto permite revisar, justificar y modificar cada decisión del algoritmo.")
]));
children.push(p("El cálculo procede en capas. Conviene leerlas en este orden:"));
children.push(bullet([new TextRun({ text: "Grupo 1 — Las palabras (léxico). ", bold: true }), new TextRun("Qué términos se buscan en cada artículo. Variable A = contaminantes; Variable B = enfermedades. No llevan peso individual, salvo la marca \"genérico\" (penaliza −1).")]));
children.push(bullet([new TextRun({ text: "Grupo 2 — El lugar donde aparecen (secciones). ", bold: true }), new TextRun("Cada mención hereda el peso de la sección donde cae (título, métodos, resultados, referencias…).")]));
children.push(bullet([new TextRun({ text: "Grupo 3 — El contexto de la palabra (cues). ", bold: true }), new TextRun("Palabras cercanas (±260 caracteres) que suman o restan puntos: dosis, exposición, asociación, especulación, negación.")]));
children.push(bullet([new TextRun({ text: "Capas de agregación. ", bold: true }), new TextRun("Relaciones A↔B, peso de evidencia (fuerza × confianza) y pesos de rol que combinan todo lo anterior.")]));
children.push(bullet([new TextRun({ text: "Umbrales y parámetros de análisis. ", bold: true }), new TextRun("Los cortes numéricos que convierten un score en una etiqueta, y los radios/constantes de configuración.")]));
children.push(runs([
  new TextRun({ text: "Convención de color en las tablas: ", italics: true, size: 19 }),
  new TextRun({ text: "verde", bold: true, color: "2E7D32", size: 19 }),
  new TextRun({ text: " = peso positivo (sube el score); ", italics: true, size: 19 }),
  new TextRun({ text: "rojo", bold: true, color: "C62828", size: 19 }),
  new TextRun({ text: " = peso negativo (lo baja).", italics: true, size: 19 })
]));
children.push(runs([
  new TextRun({ text: "Advertencia metodológica. ", bold: true }),
  new TextRun("Estos pesos son una escala operativa del pipeline, no una escala clínica universal validada. Deben reportarse como una decisión metodológica auditable y, de publicarse, acompañarse de un análisis de sensibilidad.")
]));

/* ---- 2. Tabla maestra ---- */
children.push(h1("2. Resumen: los grupos de parámetros de un vistazo"));
children.push(p("Vista panorámica de todos los grupos. Las secciones siguientes los detallan uno a uno."));
children.push(buildTable(
  ["Grupo de parámetros", "Tipo", "¿Lleva peso?", "Dónde se define"],
  [3000, 2600, 1860, 1900],
  [
    ["Léxico Variable A y B (palabras buscadas)", "Patrones regex", "No (salvo \"genérico\" = −1)", "config/review_miner_*.json"],
    ["Pesos por sección", "Entero por sección", "Sí (−5 a +7)", "defaults.ts · sections.py"],
    ["Cues de contexto (nivel mención)", "Listas regex + peso", "Sí (−2 a +5)", "defaults.ts · classify.py"],
    ["Cues de tipo de estudio / asociación fuerte", "Listas regex", "Indirecto (clasifican)", "defaults.ts · classify.py"],
    ["Bonos de relación A↔B", "Entero", "Sí (−4 a +4)", "relations.py"],
    ["Peso de evidencia (fuerza × confianza)", "Multiplicadores", "Sí (0.0 a 3.0)", "publication_extensions.py"],
    ["Pesos de rol", "Multiplicador por rol", "Sí (0.2 a 3.0)", "visual_analytics.py"],
    ["Umbrales de decisión", "Cortes numéricos", "No (clasifican)", "classify.py · relations.py"],
    ["Parámetros de análisis", "Enteros configurables", "No", "defaults.ts"]
  ]
));

/* ---- 3. Grupo 1: lexico ---- */
children.push(h1("3. Grupo 1 — Las palabras (léxico)", { pageBreak: true }));
children.push(p("Son los términos que el algoritmo busca dentro del texto de cada artículo. Cada entrada es una o varias expresiones regulares (regex) evaluadas sin distinguir mayúsculas/minúsculas. La búsqueda es bilingüe (español e inglés)."));
children.push(runs([
  new TextRun({ text: "Tipo de parámetro: ", bold: true }), new TextRun("patrón de búsqueda (regex). "),
  new TextRun({ text: "¿Peso? ", bold: true }), new TextRun("Las palabras en sí no llevan peso; lo que pesa es dónde aparecen (Grupo 2) y su contexto (Grupo 3). La única excepción es la marca "),
  new TextRun({ text: "\"genérico\"", italics: true }), new TextRun(": un término amplio (p. ej. \"metales pesados\", \"pesticidas\") resta "),
  new TextRun({ text: "−1", bold: true }), new TextRun(" al score de su mención, porque es menos específico que un compuesto nombrado.")
]));

children.push(h2("3.1 Variable A — Contaminantes (39 términos)"));
children.push(caption("Categoría = familia del contaminante. \"Genérico\" indica si el término resta −1 por ser inespecífico."));
children.push(buildTable(
  ["Término (ES)", "Categoría", "Genérico (−1)", "Patrones (regex)"],
  [1850, 1750, 1060, 4700],
  CONTAMINANTS.map(([es, en, cat, gen, pats]) => [
    [new TextRun({ text: es, bold: true, size: 19 }), new TextRun({ text: en, break: 1, size: 16, color: "777777" })],
    cat,
    gen ? { w: -1 } : "No",
    { pat: pats }
  ])
));

children.push(h2("3.2 Variable B — Enfermedades y desenlaces (8 términos)", { pageBreak: true }));
children.push(caption("Ninguna entrada de la Variable B está marcada como genérica."));
children.push(buildTable(
  ["Término (ES)", "Categoría", "Patrones (regex)"],
  [2100, 2400, 4860],
  DISEASES.map(([es, en, cat, pats]) => [
    [new TextRun({ text: es, bold: true, size: 19 }), new TextRun({ text: en, break: 1, size: 16, color: "777777" })],
    cat,
    { pat: pats }
  ])
));

/* ---- 4. Grupo 2: secciones ---- */
children.push(h1("4. Grupo 2 — El lugar donde aparecen (pesos por sección)", { pageBreak: true }));
children.push(p("El algoritmo divide cada artículo en secciones (título, resumen, introducción, métodos, resultados, discusión, conclusión, referencias) y le asigna a cada mención el peso de la sección donde cae. La idea: una mención en métodos o resultados es mejor evidencia de que el contaminante se estudió de verdad, mientras que una en referencias casi no aporta (peso negativo)."));
children.push(runs([
  new TextRun({ text: "Tipo de parámetro: ", bold: true }), new TextRun("entero por sección. "),
  new TextRun({ text: "¿Peso? ", bold: true }), new TextRun("Sí — este ES el peso. El perfil activo por defecto es "),
  new TextRun({ text: "baseline_current", font: MONO, size: 18 }), new TextRun(".")
]));

children.push(h2("4.1 Pesos del perfil activo (baseline_current)"));
children.push(buildTable(
  ["Sección", "Peso", "Interpretación"],
  [3000, 1200, 5160],
  [
    ["methods — métodos", { w: 6 }, "Máxima evidencia: aquí se describe la exposición/ensayo."],
    ["title — título", { w: 5 }, "Si aparece en el título, suele ser el foco del estudio."],
    ["results — resultados", { w: 5 }, "Hallazgos medidos directamente."],
    ["abstract — resumen", { w: 4 }, "Síntesis de lo más importante del artículo."],
    ["discussion — discusión", { w: 2 }, "Relevante, pero puede mezclar antecedentes."],
    ["conclusion — conclusión", { w: 2 }, "Cierre interpretativo."],
    ["introduction — introducción", { w: 1 }, "A menudo solo contexto/antecedentes."],
    ["other — texto sin clasificar", { w: 1 }, "Texto que no cayó en ninguna sección."],
    ["references — referencias", { w: -3 }, "Penaliza: aparecer solo en la bibliografía no es evidencia."]
  ]
));

children.push(h2("4.2 Los cuatro perfiles de pesos disponibles"));
children.push(p("NEXO incluye perfiles alternativos para análisis de sensibilidad. Cambiar de perfil permite ver qué tan robustos son los resultados ante otra ponderación."));
children.push(buildTable(
  ["Sección", "baseline_current (activo)", "conservative_evidence", "neutral_counting", "central_sections_only"],
  [2400, 1840, 1840, 1640, 1640],
  SECTION_ORDER.map(s => [
    SECTION_ES[s],
    { w: SECTION_PROFILES.baseline_current[s] },
    { w: SECTION_PROFILES.conservative_evidence[s] },
    { w: SECTION_PROFILES.neutral_counting[s] },
    { w: SECTION_PROFILES.central_sections_only[s] }
  ])
));
children.push(caption("baseline_current = pesos en producción. conservative_evidence = exige más métodos/resultados. neutral_counting = conteo plano (todo pesa 1). central_sections_only = solo cuentan secciones centrales."));
children.push(runs([
  new TextRun({ text: "Secciones centrales: ", bold: true }), new TextRun({ text: "title, abstract, methods, results", font: MONO, size: 18 }),
  new TextRun(". "), new TextRun({ text: "Secciones informativas: ", bold: true }),
  new TextRun({ text: "las 4 centrales + discussion + conclusion", font: MONO, size: 18 }),
  new TextRun(". Estos conjuntos se usan en los umbrales de clasificación (sección 8).")
]));

children.push(h2("4.3 Cómo se detecta cada sección (patrones de encabezado)"));
children.push(p("Las secciones se localizan buscando estos encabezados al inicio de línea. El \"título\" es el bloque previo al primer encabezado detectado; \"other\" es el resto."));
children.push(buildTable(
  ["Sección", "Patrones de encabezado (regex)"],
  [2100, 7260],
  Object.entries(SECTION_HEADERS).map(([sec, pats]) => [SECTION_ES[sec], { pat: pats }])
));

/* ---- 5. Grupo 3: cues ---- */
children.push(h1("5. Grupo 3 — El contexto de la palabra (cues)", { pageBreak: true }));
children.push(p("Alrededor de cada mención el algoritmo abre una ventana de contexto (±260 caracteres) y revisa si aparecen \"cues\": palabras o frases que indican exposición, dosis, asociación, especulación o negación. Cada familia de cues que se active modifica el score de esa mención."));

children.push(h2("5.1 Peso de cada familia de cue (a nivel de mención)"));
children.push(caption("Se suma al peso de sección de la mención. Fuente: classify.py → mention_score()."));
children.push(buildTable(
  ["Familia de cue", "Peso", "Qué señala"],
  [2400, 1200, 5760],
  [
    ["dose — dosis/unidades", { w: 5 }, "Concentraciones medidas (mg/L, ppm, µg/L…): evidencia experimental fuerte."],
    ["exposure — exposición", { w: 4 }, "Lenguaje de exposición/tratamiento/medición."],
    ["association — asociación", { w: 2 }, "Asociación estadística o causal (riesgo, OR, HR…)."],
    ["speculative — especulativo", { w: -1 }, "Lenguaje tentativo (may, could, podría, hipótesis)."],
    ["negation — negación", { w: -2 }, "Niega la relación (\"no association\", \"sin asociación\")."],
    ["genérico (marca del léxico)", { w: -1 }, "La mención es de un término genérico, no de un compuesto nombrado."]
  ]
));

children.push(h2("5.2 Patrones de cada familia de cue (las palabras)"));
children.push(p("Estas son las listas de palabras/frases que disparan cada familia. Son bilingües y se evalúan sin distinguir mayúsculas."));
children.push(buildTable(
  ["Familia", "Peso", "Patrones (regex)"],
  [1700, 900, 6760],
  [
    ["exposure", { w: 4 }, { pat: CUES.exposure }],
    ["dose", { w: 5 }, { pat: CUES.dose }],
    ["association", { w: 2 }, { pat: CUES.association }],
    ["speculative", { w: -1 }, { pat: CUES.speculative }],
    ["negation", { w: -2 }, { pat: CUES.negation }]
  ]
));

children.push(h2("5.3 Cues que clasifican (sin peso directo en la mención)"));
children.push(p("Estas familias no suman puntos a la mención: sirven para decidir el tipo de estudio del artículo (revisión, humano, in vivo, in vitro) y para calificar la fuerza de las relaciones A↔B (asociación fuerte)."));
children.push(buildTable(
  ["Familia", "Para qué se usa", "Patrones (regex)"],
  [1700, 2100, 5560],
  [
    ["strong_association", "Marca \"asociación fuerte\" en relaciones (sección 6).", { pat: CUE_KIND.strongAssociation }],
    ["review", "Detecta revisiones / metaanálisis.", { pat: CUE_KIND.review }],
    ["human", "Estudio epidemiológico / en humanos.", { pat: CUE_KIND.human }],
    ["in_vivo", "Modelo animal (in vivo).", { pat: CUE_KIND.inVivo }],
    ["in_vitro", "Cultivo celular (in vitro).", { pat: CUE_KIND.inVitro }]
  ]
));

/* ---- 6. Relaciones ---- */
children.push(h1("6. Capa de agregación — relaciones entre Variable A y B", { pageBreak: true }));
children.push(p("Cuando una mención de contaminante (A) y una de enfermedad (B) están cerca en el texto (misma oración o dentro de 900 caracteres), el algoritmo crea una \"relación\" y la puntúa. El score de la relación parte de la suma de los scores de ambas menciones y luego aplica bonos según el contexto compartido."));
children.push(runs([
  new TextRun({ text: "Fórmula base: ", bold: true }),
  new TextRun({ text: "score_relación = mention_score(A) + mention_score(B) + bonos", font: MONO, size: 18 })
]));
children.push(buildTable(
  ["Bono / penalización en la relación", "Peso", "Condición"],
  [3600, 1200, 4560],
  [
    ["association", { w: 4 }, "Hay cue de asociación en la evidencia compartida."],
    ["strong_association", { w: 4 }, "Hay cue de asociación fuerte (se suma además del anterior)."],
    ["speculative", { w: -2 }, "El vínculo está en lenguaje especulativo."],
    ["negation", { w: -4 }, "La evidencia niega la relación."]
  ]
));
children.push(caption("Fuente: relations.py → build_relations(). El par con mayor score por cada combinación (A,B) es el que se conserva."));
children.push(h2("6.1 Etiqueta de asociación resultante"));
children.push(buildTable(
  ["Etiqueta", "Cuándo se asigna"],
  [3000, 6360],
  [
    ["asociacion_fuerte", "Hay cue de asociación fuerte y no especulativo, en sección central o de resultados."],
    ["asociacion_debil", "Hay cue de asociación (o asociación fuerte fuera de secciones centrales)."],
    ["mencion_especulativa", "Solo hay lenguaje especulativo."],
    ["sin_evidencia_suficiente", "No hay evidencia, o hay negación."]
  ]
));

/* ---- 7. Peso de evidencia y roles ---- */
children.push(h1("7. Peso de evidencia y pesos de rol", { pageBreak: true }));
children.push(p("Para agregar resultados por categoría y dibujar las figuras (burbujas, redes), cada relación se resume en un único \"peso de evidencia\" que combina su fuerza y su confianza."));
children.push(runs([
  new TextRun({ text: "Peso de evidencia = fuerza × confianza", bold: true, font: MONO, size: 20 })
], { alignment: AlignmentType.CENTER }));

children.push(h2("7.1 Peso por fuerza de asociación"));
children.push(caption("Fuente: ASSOCIATION_WEIGHT (publication_extensions.py, visual_analytics.py)."));
children.push(buildTable(
  ["Fuerza de asociación", "Peso"],
  [6360, 3000],
  [
    ["asociacion_fuerte", { w: 3.0 }],
    ["asociacion_debil", { w: 2.0 }],
    ["mencion_especulativa", { w: 1.0 }],
    ["sin_evidencia_suficiente", { w: 0.0 }]
  ]
));

children.push(h2("7.2 Peso por nivel de confianza"));
children.push(caption("Fuente: CONFIDENCE_WEIGHT. Aplica tanto a relaciones como a entidades."));
children.push(buildTable(
  ["Nivel de confianza", "Peso"],
  [6360, 3000],
  [["Alta", { w: 3.0 }], ["Media", { w: 2.0 }], ["Baja", { w: 1.0 }]]
));

children.push(h2("7.3 Peso por rol de la entidad"));
children.push(p("Para puntuar el papel de un contaminante o enfermedad dentro de un artículo, cada rol (sección 8.1) tiene su propio multiplicador."));
children.push(caption("Fuente: ROLE_WEIGHT (visual_analytics.py)."));
children.push(buildTable(
  ["Rol de la entidad", "Peso"],
  [6360, 3000],
  [
    ["role_primary_focus — foco principal", { w: 3.0 }],
    ["role_probable_focus — foco probable", { w: 2.5 }],
    ["role_secondary_variable — variable secundaria", { w: 2.0 }],
    ["role_intro_discussion_only — solo intro/discusión", { w: 0.5 }],
    ["role_unclear — no determinado", { w: 0.5 }],
    ["role_review_mention — mención en revisión", { w: 0.3 }],
    ["role_bibliographic_only — solo bibliográfico", { w: 0.2 }]
  ]
));

/* ---- 8. Umbrales ---- */
children.push(h1("8. Umbrales de decisión (clasificación)", { pageBreak: true }));
children.push(p("Los umbrales convierten un score numérico en una etiqueta legible. No son \"pesos\" que se sumen, sino cortes que se evalúan en orden (la primera condición que se cumple gana)."));

children.push(h2("8.1 Rol de la entidad en el artículo"));
children.push(caption("Fuente: classify.py → _assign_role(). \"directos\" = menciones con cue de exposición o dosis."));
children.push(buildTable(
  ["Rol asignado", "Condición (en orden de evaluación)"],
  [3200, 6160],
  [
    ["role_review_mention", "El artículo es una revisión o síntesis."],
    ["role_bibliographic_only", "Todas las menciones están en referencias."],
    ["role_primary_focus", "Centrales > 0  Y  score ≥ 16  Y  cues directos > 0."],
    ["role_probable_focus", "Centrales > 0  Y  (cues directos > 0  O  cues de asociación > 0)."],
    ["role_secondary_variable", "Centrales > 0  Y  score ≥ 8."],
    ["role_intro_discussion_only", "Hay menciones en secciones informativas."],
    ["role_unclear", "Cualquier otro caso."]
  ]
));

children.push(h2("8.2 Confianza de la entidad"));
children.push(caption("Fuente: classify.py → _confidence()."));
children.push(buildTable(
  ["Confianza", "Condición"],
  [3200, 6160],
  [
    ["Alta", "score ≥ 18  Y  centrales > 0  Y  cues directos > 0."],
    ["Media", "score ≥ 8  Y  centrales > 0."],
    ["Baja", "Cualquier otro caso."]
  ]
));

children.push(h2("8.3 Confianza de la relación A↔B"));
children.push(caption("Fuente: relations.py → _relation_confidence()."));
children.push(buildTable(
  ["Confianza", "Condición"],
  [3200, 6160],
  [
    ["Alta", "asociación fuerte  Y  sección central  Y  score ≥ 12."],
    ["Media", "asociación (fuerte o débil)  Y  score ≥ 6."],
    ["Baja", "Cualquier otro caso."]
  ]
));

/* ---- 9. Parametros de analisis ---- */
children.push(h1("9. Parámetros de análisis (configurables, sin peso)", { pageBreak: true }));
children.push(p("Controlan cómo se mide el contexto y cómo se agrupan los resultados. No son pesos, pero sí parámetros del modelo que afectan los resultados; por eso se documentan. La columna \"Rango\" indica los límites que el asistente de configuración (wizard) considera seguros."));
children.push(caption("Fuente: defaults.ts → DEFAULT_ANALYSIS_PARAMS y ANALYSIS_BOUNDS."));
children.push(buildTable(
  ["Parámetro", "Valor por defecto", "Rango (mín–máx)", "Qué controla"],
  [2500, 1500, 1700, 3660],
  [
    ["contextRadius", "260", "40 – 1200", "Caracteres a cada lado de la mención para detectar cues."],
    ["kwicRadius", "160", "20 – 600", "Ventana de la concordancia KWIC (auditoría manual)."],
    ["relationDistance", "900", "100 – 3000", "Distancia máxima (caracteres) para emparejar A con B."],
    ["kmeansK", "4", "2 – 12", "Número de grupos (clusters) en el análisis K-Means."],
    ["validationSampleSize", "200", "20 – 1000", "Tamaño de la muestra para validación manual."]
  ]
));

/* ---- 10. Nota de fuentes ---- */
children.push(h1("10. Nota de fuentes y trazabilidad"));
children.push(p("Todos los valores de este documento se transcribieron directamente del código del proyecto. La fuente única de verdad de los pesos es el archivo de configuración del wizard, que replica las constantes del pipeline en Python:"));
children.push(bullet([new TextRun({ text: "Léxico (Grupo 1): ", bold: true }), new TextRun({ text: "config/review_miner_contaminants.json", font: MONO, size: 18 }), new TextRun(", "), new TextRun({ text: "config/review_miner_diseases.json", font: MONO, size: 18 })]));
children.push(bullet([new TextRun({ text: "Pesos de sección (Grupo 2): ", bold: true }), new TextRun({ text: "src/lib/protocol/defaults.ts", font: MONO, size: 18 }), new TextRun(", "), new TextRun({ text: "review_miner/sections.py", font: MONO, size: 18 }), new TextRun(", "), new TextRun({ text: "review_miner/publication_extensions.py", font: MONO, size: 18 })]));
children.push(bullet([new TextRun({ text: "Cues (Grupo 3): ", bold: true }), new TextRun({ text: "src/lib/protocol/defaults.ts → DEFAULT_CUES", font: MONO, size: 18 })]));
children.push(bullet([new TextRun({ text: "Pesos de mención: ", bold: true }), new TextRun({ text: "review_miner/classify.py → mention_score()", font: MONO, size: 18 })]));
children.push(bullet([new TextRun({ text: "Relaciones, evidencia y roles: ", bold: true }), new TextRun({ text: "review_miner/relations.py, publication_extensions.py, visual_analytics.py", font: MONO, size: 18 })]));
children.push(p("Si en el futuro se editan los pesos desde el wizard de NEXO, este documento debe regenerarse para reflejar los nuevos valores.", { italics: true }));

/* =======================================================================
   ENSAMBLADO
   ======================================================================= */

const doc = new Document({
  creator: "NEXO",
  title: "Parámetros del modelo de NLP — NEXO",
  description: "Inventario completo de parámetros con peso del modelo de NLP de NEXO",
  styles: {
    default: { document: { run: { font: "Arial", size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: "Arial", color: "176B87" },
        paragraph: { spacing: { before: 260, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 25, bold: true, font: "Arial", color: "0F4C5C" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: "Arial", color: "333333" },
        paragraph: { spacing: { before: 160, after: 100 }, outlineLevel: 2 } }
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 600, hanging: 280 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1140, hanging: 280 } } } }
      ] }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "176B87", space: 4 } },
        children: [new TextRun({ text: "NEXO · Parámetros del modelo de NLP", size: 16, color: "777777" })]
      })] })
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Página ", size: 16, color: "777777" }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "777777" }),
          new TextRun({ text: " de ", size: 16, color: "777777" }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "777777" })]
      })] })
    },
    children
  }]
});

const outPath = path.join(__dirname, "..", "Parametros_NLP_NEXO.docx");
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outPath, buffer);
  console.log("OK:", outPath, `(${(buffer.length / 1024).toFixed(1)} KB)`);
});
