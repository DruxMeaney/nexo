#!/usr/bin/env node
/**
 * Higiene lexica de las plantillas de protocolo integradas.
 *
 * `src/lib/protocol/templates.ts` es lo primero que corre cualquier persona que
 * abre NEXO: al hacer clic en una tarjeta de plantilla se carga un protocolo
 * completo y se ejecuta el pipeline con el. Si un patron de esas plantillas no
 * encuentra nada, el usuario no ve un error — ve cero menciones y concluye que
 * su corpus no habla del tema. La auditoria documento exactamente esa falla en
 * el unico protocolo que se distribuia en `config/protocols/`
 * (`smoke-protocol-double-escaped-regexes`): los patrones venian doblemente
 * escapados (`\\\\bplomo\\\\b` en vez de `\\bplomo\\b`), asi que el motor
 * buscaba una diagonal invertida literal y el pipeline extraia 0 menciones de
 * cualquier corpus. Este chequeo protege a las plantillas integradas de esa
 * misma clase de error.
 *
 * QUE SE VERIFICA
 * ---------------
 *   1. COMPILACION      Todo patron compila como expresion regular.
 *   2. DOBLE ESCAPE     Ningun patron contiene una diagonal invertida escapada
 *                       (`\\\\`). Ninguna plantilla necesita buscar una
 *                       diagonal literal, asi que su presencia significa que el
 *                       patron paso una vez de mas por un serializador.
 *   3. ALCANZABILIDAD   Cada termino se encuentra a si mismo: alguno de sus
 *                       patrones casa con su etiqueta en espanol y alguno casa
 *                       con su etiqueta en ingles. Un termino que no puede
 *                       encontrar su propio nombre esta muerto.
 *   4. MUESTRAS         Frases representativas, escritas como aparecerian en un
 *                       resumen real, con la lista exacta de terminos que deben
 *                       encontrarse (`expect`) y de terminos que NO deben
 *                       encontrarse (`reject`).
 *
 * El punto 4 es el que fija el endurecimiento reciente contra falsos positivos:
 * los simbolos de dos letras (pb, cd, hg) se compilan sin distinguir
 * mayusculas, asi que un `\\bpb\\b` desnudo tambien casa con "PB" (buffer de
 * fosfatos) o "CD" (dicroismo circular). Las muestras negativas de abajo fallan
 * si alguien vuelve a introducir el patron desnudo, y las positivas fallan si
 * alguien "arregla" el falso positivo rompiendo "Pb(II)" o "lead exposure".
 *
 * NOTA SOBRE EL MOTOR: el pipeline compila estos mismos patrones en Python
 * (`review_miner/protocol.py::_compile_patterns`, con `re.IGNORECASE`). Aqui se
 * compilan con `RegExp` y la bandera `i`. Los patrones de las plantillas usan
 * solo construcciones comunes a ambos motores (`\\b`, clases, alternancias,
 * cuantificadores, lookahead negativo), asi que la equivalencia se sostiene;
 * cualquier patron que se aparte de ese subconjunto debe verificarse tambien
 * del lado de Python.
 *
 * Salida: codigo 0 si todo pasa, 1 al primer grupo de fallos.
 *
 * Uso: node scripts/check-templates.mjs
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES_FILE = path.join(REPO_ROOT, "src/lib/protocol/templates.ts");

/* --------------------- Carga del modulo TypeScript --------------------- */

/**
 * Los patrones no estan escritos uno por uno en el archivo: `symbolPatterns()`
 * genera tres por cada simbolo quimico. Leerlos con una expresion regular sobre
 * el texto fuente perderia justo los que mas importan, asi que hay que cargar
 * el modulo de verdad.
 *
 * Se transpila con el compilador de TypeScript (ya es dependencia de
 * desarrollo; no se agrega ningun paquete) y se ejecuta en un pequeno cargador
 * CommonJS que solo resuelve importaciones relativas dentro del repositorio.
 * Cualquier importacion externa es un error: estas plantillas deben ser datos
 * puros. Es la diferencia entre ejecutar un modulo con semantica de modulo y
 * hacer `eval` sobre un trozo de texto recortado a mano.
 */
const moduleCache = new Map();

function loadTypeScriptModule(absPath) {
  if (moduleCache.has(absPath)) return moduleCache.get(absPath);

  const source = readFileSync(absPath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: absPath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      verbatimModuleSyntax: false
    }
  });

  const moduleObject = { exports: {} };
  // Se registra antes de ejecutar para tolerar ciclos de importacion.
  moduleCache.set(absPath, moduleObject.exports);

  const localRequire = (specifier) => {
    if (!specifier.startsWith(".")) {
      throw new Error(
        `${path.relative(REPO_ROOT, absPath)} importa \`${specifier}\`. ` +
          `Las plantillas deben depender solo de modulos locales.`
      );
    }
    const base = path.resolve(path.dirname(absPath), specifier);
    for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      try {
        readFileSync(candidate);
      } catch {
        continue;
      }
      return loadTypeScriptModule(candidate);
    }
    throw new Error(`No se pudo resolver \`${specifier}\` desde ${absPath}.`);
  };

  const factory = vm.runInThisContext(
    `(function (exports, require, module, __filename, __dirname) {\n${outputText}\n})`,
    { filename: absPath }
  );
  factory(moduleObject.exports, localRequire, moduleObject, absPath, path.dirname(absPath));

  moduleCache.set(absPath, moduleObject.exports);
  return moduleObject.exports;
}

/* --------------------- Muestras representativas --------------------- */

/**
 * Frases escritas como aparecen en un resumen real. `expect` lista los ids de
 * termino que la frase DEBE activar; `reject` los que NO debe activar.
 *
 * Los ids se validan contra la plantilla antes de usarse: si alguien renombra
 * un termino, la muestra no queda silenciosamente vacia — el chequeo falla.
 */
const SAMPLES = [
  /* ---- contaminantes <-> enfermedades neurodegenerativas ---- */
  {
    templateId: "contaminants-neurodegeneration",
    label: "exposicion a plomo en ingles",
    text: "Chronic lead exposure in early childhood was associated with dementia in later life.",
    expect: ["plomo", "demencia"],
    reject: ["cadmio", "mercurio"]
  },
  {
    templateId: "contaminants-neurodegeneration",
    label: "estado de oxidacion Pb(II)",
    text: "Blood Pb(II) burden was quantified by ICP-MS in the Parkinson's disease cohort.",
    expect: ["plomo", "parkinson"],
    reject: ["cadmio", "arsenico"]
  },
  {
    templateId: "contaminants-neurodegeneration",
    label: "Cd2+ y niveles de Cd en espanol",
    text: "Se midieron los niveles de Cd en orina y la concentracion de Cd2+ en agua de pozo.",
    expect: ["cadmio"],
    reject: ["plomo", "mercurio"]
  },
  {
    templateId: "contaminants-neurodegeneration",
    label: "exposicion a Hg y ELA entre parentesis",
    text:
      "Hg exposure through fish consumption was examined in patients with amyotrophic lateral sclerosis (ELA).",
    expect: ["mercurio", "ela"],
    reject: ["plomo", "cadmio"]
  },
  {
    templateId: "contaminants-neurodegeneration",
    label: "pesticidas y Alzheimer en espanol",
    text:
      "La exposicion a paraquat y glifosato se asocio con la enfermedad de Alzheimer en modelos animales.",
    expect: ["paraquat", "glifosato", "alzheimer"],
    reject: ["rotenona", "huntington"]
  },
  // --- Muestras negativas: el motivo por el que los simbolos van anclados ---
  {
    templateId: "contaminants-neurodegeneration",
    label: "PB = buffer de fosfatos (no es plomo)",
    text: "Sections were rinsed three times in PB (phosphate buffer, 0.1 M, pH 7.4) before mounting.",
    expect: [],
    reject: ["plomo"]
  },
  {
    templateId: "contaminants-neurodegeneration",
    label: "CD = dicroismo circular / cumulo de diferenciacion (no es cadmio)",
    text: "Circular dichroism (CD) spectra and CD4+ counts were recorded for every sample.",
    expect: [],
    reject: ["cadmio"]
  },
  {
    templateId: "contaminants-neurodegeneration",
    label: "HG como abreviatura no relacionada (no es mercurio)",
    text: "The HG cell line and the hg mutant were cultured under identical conditions.",
    expect: [],
    reject: ["mercurio"]
  },
  {
    templateId: "contaminants-neurodegeneration",
    label: "\"lead\" como verbo ingles (no es plomo)",
    text: "These findings may lead to new hypotheses about protein aggregation.",
    expect: [],
    reject: ["plomo"]
  },

  /* ---- antidepresivos <-> eventos adversos ---- */
  {
    templateId: "antidepressants-adverse-events",
    label: "ISRS y eventos sexuales en ingles",
    text:
      "Patients receiving fluoxetine or sertraline reported erectile dysfunction and decreased libido.",
    expect: ["fluoxetina", "sertralina", "disfuncion_erectil", "libido_baja"],
    reject: ["paroxetina", "duloxetina", "nausea"]
  },
  {
    templateId: "antidepressants-adverse-events",
    label: "IRSN, nombre comercial y QT en espanol",
    text:
      "La venlafaxina (Effexor) y la duloxetina se asociaron con nausea, diarrea y prolongacion QT.",
    expect: ["venlafaxina", "duloxetina", "nausea", "diarrea", "qt_prolongation"],
    reject: ["fluoxetina", "libido_baja"]
  },

  /* ---- especies invasoras <-> ecosistemas ---- */
  {
    templateId: "invasive-species-ecosystems",
    label: "especies y ecosistemas en ingles",
    text:
      "Lionfish (Pterois volitans) invasion has reduced fish biomass across Caribbean coral reefs and mangroves.",
    expect: ["pez_leon", "arrecifes", "manglares"],
    reject: ["tilapia", "humedales", "rios"]
  },
  {
    templateId: "invasive-species-ecosystems",
    label: "lirio acuatico en humedales y rios",
    text:
      "El lirio acuatico (Eichhornia crassipes) cubrio humedales y rios del altiplano, desplazando a la tilapia.",
    expect: ["eichhornia", "humedales", "rios", "tilapia"],
    reject: ["kudzu", "manglares"]
  },
  {
    templateId: "invasive-species-ecosystems",
    label: "\"Rio de Janeiro\" es un topónimo, no un cuerpo de agua",
    text: "Samples were processed at the Federal University of Rio de Janeiro.",
    expect: [],
    reject: ["rios"]
  }
];

/* --------------------- Utilidades --------------------- */

function flattenTerms(nodes, trail = []) {
  const terms = [];
  for (const node of nodes ?? []) {
    if (node.kind === "category") {
      terms.push(...flattenTerms(node.children, [...trail, node.labelEs]));
    } else {
      terms.push({ node, trail });
    }
  }
  return terms;
}

function compilePattern(pattern) {
  // `i` reproduce el `re.IGNORECASE` incondicional del pipeline.
  return new RegExp(pattern, "i");
}

/* --------------------- Chequeo --------------------- */

function main() {
  const failures = [];
  const fail = (where, message) => failures.push({ where, message });

  const { PROTOCOL_TEMPLATES, findTemplate } = loadTypeScriptModule(TEMPLATES_FILE);

  if (!Array.isArray(PROTOCOL_TEMPLATES) || PROTOCOL_TEMPLATES.length === 0) {
    console.error("ERROR: `PROTOCOL_TEMPLATES` esta vacio o no es un arreglo.");
    return 1;
  }

  const built = new Map();
  let patternCount = 0;
  let termCount = 0;

  for (const template of PROTOCOL_TEMPLATES) {
    const draft = template.build();
    const terms = [
      ...flattenTerms(draft.variableA.nodes).map((t) => ({ ...t, slot: "A" })),
      ...flattenTerms(draft.variableB.nodes).map((t) => ({ ...t, slot: "B" }))
    ];
    built.set(template.id, { template, draft, terms });

    if (terms.length === 0) fail(template.id, "la plantilla no define ningun termino.");

    const seenIds = new Set();
    for (const { node, slot } of terms) {
      termCount += 1;
      const where = `${template.id} / ${slot} / ${node.id}`;

      if (seenIds.has(`${slot}:${node.id}`)) {
        fail(where, "id de termino duplicado dentro de la misma variable.");
      }
      seenIds.add(`${slot}:${node.id}`);

      const patterns = node.patterns ?? [];
      if (patterns.length === 0) {
        fail(where, "termino sin ningun patron: nunca puede encontrarse.");
        continue;
      }

      const compiled = [];
      for (const pattern of patterns) {
        patternCount += 1;

        // 1. Compilacion.
        let regex;
        try {
          regex = compilePattern(pattern);
        } catch (error) {
          fail(where, `el patron \`${pattern}\` no compila: ${error.message}`);
          continue;
        }
        compiled.push(regex);

        // 2. Doble escape (la falla documentada en la auditoria).
        if (pattern.includes("\\\\")) {
          fail(
            where,
            `el patron \`${pattern}\` contiene una diagonal invertida escapada ` +
              `(\\\\): esta doblemente escapado y buscara una diagonal literal.`
          );
        }

        if (pattern.trim() === "") {
          fail(where, "patron vacio.");
        }
      }

      // 3. Alcanzabilidad: el termino debe encontrar su propio nombre.
      for (const [lang, label] of [
        ["labelEs", node.labelEs],
        ["labelEn", node.labelEn]
      ]) {
        if (!label) {
          fail(where, `falta \`${lang}\`.`);
          continue;
        }
        if (!compiled.some((regex) => regex.test(label))) {
          fail(
            where,
            `ningun patron casa con su propia etiqueta ${lang} ("${label}"): ` +
              `el termino no puede encontrarse a si mismo.`
          );
        }
      }
    }
  }

  // 4. Muestras representativas.
  let sampleAssertions = 0;
  for (const sample of SAMPLES) {
    const entry = built.get(sample.templateId);
    if (!entry) {
      fail(`muestra "${sample.label}"`, `plantilla desconocida \`${sample.templateId}\`.`);
      continue;
    }

    const byId = new Map(entry.terms.map(({ node }) => [node.id, node]));
    const matched = new Set();
    for (const [id, node] of byId) {
      const hits = (node.patterns ?? []).some((pattern) => {
        try {
          return compilePattern(pattern).test(sample.text);
        } catch {
          return false; // ya reportado arriba como error de compilacion
        }
      });
      if (hits) matched.add(id);
    }

    for (const id of [...sample.expect, ...sample.reject]) {
      if (!byId.has(id)) {
        // Sin esta guarda, un renombrado dejaria la muestra sin efecto.
        fail(
          `muestra "${sample.label}"`,
          `el id \`${id}\` ya no existe en \`${sample.templateId}\`: ` +
            `actualiza la muestra o el id fue renombrado por error.`
        );
      }
    }

    for (const id of sample.expect) {
      sampleAssertions += 1;
      if (byId.has(id) && !matched.has(id)) {
        fail(
          `muestra "${sample.label}"`,
          `se esperaba encontrar \`${id}\` y ningun patron caso con:\n      "${sample.text}"`
        );
      }
    }
    for (const id of sample.reject) {
      sampleAssertions += 1;
      if (byId.has(id) && matched.has(id)) {
        fail(
          `muestra "${sample.label}"`,
          `falso positivo: \`${id}\` caso con una frase que no lo menciona:\n      "${sample.text}"`
        );
      }
    }
  }

  // Cobertura: cada plantilla del registro necesita al menos una muestra.
  for (const template of PROTOCOL_TEMPLATES) {
    if (!SAMPLES.some((sample) => sample.templateId === template.id)) {
      fail(template.id, "plantilla sin ninguna muestra representativa en este chequeo.");
    }
    if (typeof findTemplate === "function" && findTemplate(template.id) !== template) {
      fail(template.id, "`findTemplate` no devuelve la plantilla registrada con ese id.");
    }
  }

  console.log(`Plantillas: ${path.relative(REPO_ROOT, TEMPLATES_FILE)}`);
  console.log(
    `  ${PROTOCOL_TEMPLATES.length} plantillas, ${termCount} terminos, ` +
      `${patternCount} patrones, ${sampleAssertions} aserciones de muestra.`
  );

  if (failures.length === 0) {
    console.log("OK: patrones compilan, sin doble escape, terminos alcanzables y muestras correctas.");
    return 0;
  }

  console.error("");
  console.error(`FALLO: ${failures.length} problema(s) en las plantillas integradas.`);
  for (const { where, message } of failures) {
    console.error(`  [${where}]\n    ${message}`);
  }
  return 1;
}

process.exit(main());
