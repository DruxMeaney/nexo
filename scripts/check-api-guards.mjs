/**
 * Toda ruta de API que MUTA estado debe rechazar peticiones de otro sitio.
 *
 * El backend de NEXO corre en localhost con los privilegios de disco del
 * usuario, asi que cualquier pagina abierta en su navegador puede lanzarle un
 * POST. La defensa es `assertSameOrigin` (src/lib/server/request-origin.ts).
 *
 * Este chequeo existe porque el hueco ya ocurrio una vez: la guardia se anadio
 * a cuatro rutas y tres quedaron fuera —/api/lexicon/save, /api/lexicon/load y
 * /api/pipeline/scan—, sin que nada fallara. Un POST cross-site escribia en el
 * disco y enumeraba /etc. Anadir una ruta nueva sin guardia vuelve a ser
 * invisible a menos que algo lo verifique; esto lo verifica.
 *
 * Una ruta cumple de dos maneras:
 *   - llama a `assertSameOrigin`, o
 *   - esta retirada: responde 410 y no toca el disco.
 *
 * Los GET quedan fuera a proposito: el navegador no deja a un sitio ajeno leer
 * la respuesta de una peticion cross-origin, asi que el vector es la escritura
 * y el arranque de trabajos, no la lectura. La contencion de rutas de lectura
 * la cubren `assertReadablePath` / `assertProjectFile` en los propios handlers.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const API_DIR = join(ROOT, "src/app/api");
const MUTATING = ["POST", "PUT", "PATCH", "DELETE"];

function routeFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...routeFiles(full));
    else if (entry === "route.ts") found.push(full);
  }
  return found;
}

const files = routeFiles(API_DIR).sort();
const offenders = [];
let guarded = 0;
let retired = 0;

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const methods = MUTATING.filter((m) =>
    new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(source)
  );
  if (methods.length === 0) continue;

  const short = relative(ROOT, file);
  if (source.includes("assertSameOrigin")) {
    guarded += 1;
    continue;
  }
  // Retirada: responde 410 y no puede tocar el disco.
  const is410 = /status:\s*410/.test(source);
  const touchesDisk = /node:fs|fs\/promises|writeFile|readFile|mkdir|readdir/.test(source);
  if (is410 && !touchesDisk) {
    retired += 1;
    continue;
  }
  offenders.push({ short, methods, is410, touchesDisk });
}

console.log(`Rutas de API: ${files.length}`);
console.log(`  con handler mutante: ${guarded + retired + offenders.length}`);
console.log(`  protegidas con assertSameOrigin: ${guarded}`);
console.log(`  retiradas (410, sin acceso a disco): ${retired}`);

if (offenders.length > 0) {
  console.error("\nFALLO: rutas mutantes sin guardia de origen:\n");
  for (const o of offenders) {
    const why = o.is410
      ? "responde 410 pero sigue importando acceso a disco"
      : "no llama a assertSameOrigin ni esta retirada";
    console.error(`  ${o.short}  [${o.methods.join(", ")}]  — ${why}`);
  }
  console.error(
    "\nAnade `assertSameOrigin(request)` al principio del handler, o retira la ruta\n" +
      "devolviendo 410 y quitando todo acceso al sistema de archivos.\n"
  );
  process.exit(1);
}

console.log("OK: toda ruta mutante rechaza peticiones de otro sitio.");
