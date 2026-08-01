#!/usr/bin/env node
/**
 * Paridad estructural de los diccionarios bilingues.
 *
 * `src/lib/i18n/dictionaries.ts` es la unica fuente de verdad de los textos de
 * la interfaz y su contrato es que `es` y `en` tienen exactamente la misma
 * forma: las mismas llaves, anidadas igual, con el mismo tipo de valor y —
 * cuando el valor es un arreglo — la misma longitud. Una llave que existe solo
 * en un idioma no rompe la compilacion (el tipo `Dictionary` se deriva de
 * `dictionaries.es`, asi que un `en` incompleto pasa `tsc` sin ruido) pero si
 * rompe la interfaz en tiempo de ejecucion: el componente lee `t.algo.otro` y
 * recibe `undefined`. Un arreglo mas corto en un idioma es peor todavia, porque
 * las listas de la pagina de metodo se renderizan por indice y la version corta
 * simplemente pierde pasos sin avisar.
 *
 * COMO SE EXTRAEN LAS LLAVES
 * --------------------------
 * La version previa de este chequeo cortaba el archivo con `indexOf`/`slice` y
 * pasaba el trozo resultante a `eval`. Eso es fragil (cualquier `} as const;`
 * dentro de un texto mueve el corte) e inseguro (ejecuta el archivo completo).
 * Aqui se usa el analizador sintactico del propio TypeScript —ya presente como
 * dependencia de desarrollo, no se agrega ningun paquete— para leer el AST y
 * recorrer el literal de objeto `dictionaries` sin ejecutar una sola linea del
 * modulo. El recorrido es deliberadamente estricto: si aparece una construccion
 * que no sea un literal plano (un spread, una llamada a funcion, una llave
 * calculada), el chequeo falla en vez de adivinar. Preferimos un falso positivo
 * ruidoso a una paridad "verificada" sobre una lectura incompleta.
 *
 * Salida: codigo 0 si hay paridad total, 1 si hay cualquier asimetria.
 *
 * Uso: node scripts/check-i18n-parity.mjs
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DICT_FILE = path.join(REPO_ROOT, "src/lib/i18n/dictionaries.ts");
/** Relativa, para que la salida sea identica en cualquier maquina. */
const DICT_REL = path.relative(REPO_ROOT, DICT_FILE);

/* --------------------- Lectura del AST --------------------- */

/** Errores de forma del archivo (no de paridad): abortan de inmediato. */
function fatal(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

/**
 * Localiza `export const dictionaries = { ... }` y devuelve su literal de
 * objeto, saltandose el `as const` / `satisfies` que pueda envolverlo.
 */
function findDictionariesLiteral(sourceFile) {
  let literal = null;
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== "dictionaries") continue;
      let init = decl.initializer;
      while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression?.(init))) {
        init = init.expression;
      }
      if (!init || !ts.isObjectLiteralExpression(init)) {
        fatal(`\`dictionaries\` no es un literal de objeto en ${DICT_REL}.`);
      }
      literal = init;
    }
  }
  if (!literal) fatal(`No se encontro \`export const dictionaries\` en ${DICT_REL}.`);
  return literal;
}

/** Nombre de una propiedad, sea identificador o cadena entre comillas. */
function propertyName(prop, sourceFile) {
  const name = prop.name;
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  fatal(
    `Llave no literal (calculada) en ${DICT_REL}:` +
      `${lineOf(sourceFile, name)} — el chequeo solo admite literales planos.`
  );
  return null;
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

/**
 * Clasifica un valor hoja. El tipo forma parte de la firma para que un cambio
 * de `string` a objeto (o a arreglo) cuente como asimetria.
 */
function leafKind(node, sourceFile) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return "string";
  if (ts.isNumericLiteral(node)) return "number";
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
    return "boolean";
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) return "null";
  fatal(
    `Valor no soportado en ${DICT_REL}:${lineOf(sourceFile, node)} ` +
      `(${ts.SyntaxKind[node.kind]}). Los diccionarios deben ser literales planos.`
  );
  return null;
}

/**
 * Recorre un nodo y acumula una firma por hoja.
 *
 * Formato de las firmas:
 *   `nav.method:string`          — hoja primitiva, con su tipo
 *   `method.steps[]=6`           — arreglo, con su longitud
 *   `method.steps[2].title:string` — elemento de arreglo
 *
 * Incluir la longitud del arreglo como su propia firma es lo que hace que una
 * lista mas corta en un idioma sea un fallo y no solo llaves faltantes.
 */
function collectSignatures(node, prefix, sourceFile, out) {
  if (ts.isObjectLiteralExpression(node)) {
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) {
        fatal(
          `Propiedad no soportada en ${DICT_REL}:${lineOf(sourceFile, prop)} ` +
            `(${ts.SyntaxKind[prop.kind]}). Se esperaba \`llave: valor\`.`
        );
      }
      const key = propertyName(prop, sourceFile);
      collectSignatures(prop.initializer, prefix ? `${prefix}.${key}` : key, sourceFile, out);
    }
    return out;
  }

  if (ts.isArrayLiteralExpression(node)) {
    out.push(`${prefix}[]=${node.elements.length}`);
    node.elements.forEach((element, index) => {
      collectSignatures(element, `${prefix}[${index}]`, sourceFile, out);
    });
    return out;
  }

  out.push(`${prefix}:${leafKind(node, sourceFile)}`);
  return out;
}

/* --------------------- Chequeo --------------------- */

function main() {
  let source;
  try {
    source = readFileSync(DICT_FILE, "utf8");
  } catch {
    fatal(`No se pudo leer ${DICT_REL}.`);
  }

  const sourceFile = ts.createSourceFile(
    DICT_FILE,
    source,
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
    ts.ScriptKind.TS
  );

  const literal = findDictionariesLiteral(sourceFile);

  const locales = new Map();
  for (const prop of literal.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      fatal(`\`dictionaries\` contiene una propiedad no soportada en ${DICT_REL}.`);
    }
    locales.set(propertyName(prop, sourceFile), prop.initializer);
  }

  for (const expected of ["es", "en"]) {
    if (!locales.has(expected)) fatal(`\`dictionaries\` no define el idioma \`${expected}\`.`);
  }
  const extra = [...locales.keys()].filter((k) => k !== "es" && k !== "en");
  if (extra.length > 0) {
    // No es un error de paridad, pero este chequeo solo sabe comparar es/en.
    fatal(
      `\`dictionaries\` define idiomas que este chequeo no compara: ${extra.join(", ")}. ` +
        `Actualiza scripts/check-i18n-parity.mjs antes de agregar idiomas.`
    );
  }

  const es = collectSignatures(locales.get("es"), "", sourceFile, []);
  const en = collectSignatures(locales.get("en"), "", sourceFile, []);
  const esSet = new Set(es);
  const enSet = new Set(en);

  const onlyEs = es.filter((sig) => !enSet.has(sig));
  const onlyEn = en.filter((sig) => !esSet.has(sig));

  console.log(`Diccionarios: ${DICT_REL}`);
  console.log(`  firmas es: ${es.length}   firmas en: ${en.length}`);

  if (onlyEs.length === 0 && onlyEn.length === 0) {
    console.log("OK: paridad estructural completa entre `es` y `en`.");
    return 0;
  }

  console.error("");
  console.error("FALLO: los diccionarios `es` y `en` no son simetricos.");
  if (onlyEs.length > 0) {
    console.error(`\n  Solo en ES (faltan o difieren en EN) — ${onlyEs.length}:`);
    for (const sig of onlyEs) console.error(`    - ${sig}`);
  }
  if (onlyEn.length > 0) {
    console.error(`\n  Solo en EN (faltan o difieren en ES) — ${onlyEn.length}:`);
    for (const sig of onlyEn) console.error(`    + ${sig}`);
  }
  console.error(
    "\n  Nota: una firma que aparece en ambas listas con el mismo camino pero " +
      "distinto sufijo\n  (`:string` vs `[]=3`, o `[]=6` vs `[]=5`) indica un cambio de tipo o de\n" +
      "  longitud, no una llave ausente."
  );
  return 1;
}

process.exit(main());
