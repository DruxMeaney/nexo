#!/usr/bin/env node
/**
 * Rutas absolutas de la maquina del autor en el codigo y la documentacion.
 *
 * La auditoria reporto el hallazgo `author-machine-paths-shipped` (severidad
 * alta): rutas del tipo `/Users/<usuario>/...` quedaron escritas en los
 * tutoriales, en los documentos de arquitectura, en un protocolo distribuido y
 * en `scripts/`. Son dos problemas a la vez:
 *
 *   - REPRODUCIBILIDAD. El primer comando del quickstart invocaba un
 *     interprete de Python que vive dentro de la cache privada del autor. Quien
 *     clone el repositorio obtiene "no such file or directory" en el primer
 *     paso. Un revisor de reproducibilidad de una revista no pasa de ahi.
 *   - PRIVACIDAD. Una ruta absoluta publica la estructura del directorio
 *     personal del autor y los nombres de sus archivos privados.
 *
 * Este chequeo impide que vuelvan a entrar.
 *
 * ALCANCE: solo archivos RASTREADOS por git (`git ls-files`). Lo que no esta
 * versionado no se publica, asi que el corpus local, `outputs/`, `.venv/` y
 * cualquier borrador sin agregar quedan fuera por construccion — sin necesidad
 * de replicar `.gitignore` aqui.
 *
 * EXCLUSIONES (deliberadas y explicitas; ver EXCLUDED_PATHS mas abajo):
 *
 *   1. `docs/auditoria/` — el informe de auditoria y sus hallazgos citan las
 *      rutas ofensoras como EVIDENCIA. Borrarlas destruiria el registro de por
 *      que existe este chequeo. Es documentacion sobre el defecto, no el
 *      defecto.
 *   2. Este mismo archivo — contiene los patrones que busca. Sin la exclusion,
 *      el chequeo se reportaria a si mismo y seria imposible de satisfacer.
 *
 * Ademas se admite una unica forma ANONIMIZADA: `/Users/.../algo`,
 * `/home/.../algo`, `C:\\Users\\...\\algo`. El segmento literal `...` no
 * identifica a nadie ni apunta a ninguna maquina; es el marcador de posicion
 * que la interfaz muestra en el campo "carpeta de entrada" para ensenar la
 * FORMA de una ruta. Cualquier otro segmento (`/Users/drux/`, `/Users/lab/`)
 * es una ruta real y falla.
 *
 * Salida: codigo 0 si no hay ninguna ruta, 1 con el listado archivo:linea.
 *
 * Uso: node scripts/check-no-machine-paths.mjs
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SELF_REL = "scripts/check-no-machine-paths.mjs";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Prefijos de ruta (relativos a la raiz del repositorio) que no se revisan.
 * Cada entrada lleva su justificacion; no agregar ninguna sin una.
 */
const EXCLUDED_PATHS = [
  {
    prefix: "docs/auditoria/",
    reason: "el informe de auditoria cita las rutas ofensoras como evidencia"
  },
  {
    prefix: SELF_REL,
    reason: "este archivo contiene los patrones que busca"
  }
];

/**
 * Un hallazgo es `<raiz>/<segmento>/<resto>`, donde la raiz es `/Users`,
 * `/home` o `<letra>:\\Users`. `segment` es SOLO el primer componente —el que
 * seria el nombre de usuario— y se inspecciona despues para dejar pasar el
 * marcador anonimo `...`; `rest` existe unicamente para que el mensaje de error
 * muestre la ruta completa.
 *
 * El lookbehind `(?<![A-Za-z0-9])` evita que una URL como
 * `https://ejemplo.org/home/x` cuente como ruta local: ahi el caracter previo a
 * la diagonal es alfanumerico. El `+` exige un nombre de usuario: `/Users/`
 * suelto en prosa no es una ruta de maquina.
 */
const PATTERNS = [
  {
    id: "posix",
    regex: /(?<![A-Za-z0-9])\/(?:Users|home)\/(?<segment>[^\s"'`,;:)\]}\\/]+)(?<rest>[^\s"'`,;:)\]}\\]*)/g
  },
  {
    id: "windows",
    regex: /(?<![A-Za-z0-9])[A-Za-z]:[\\/]Users[\\/](?<segment>[^\s"'`,;:)\]}\\/]+)(?<rest>[^\s"'`,;:)\]}]*)/g
  }
];

/** Marcador anonimo aceptado en lugar de un nombre de usuario real. */
const ANONYMOUS_SEGMENT = "...";

/* --------------------- Utilidades --------------------- */

function trackedFiles() {
  const stdout = execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  return stdout.split("\0").filter(Boolean);
}

function isExcluded(relPath) {
  return EXCLUDED_PATHS.some(({ prefix }) =>
    prefix.endsWith("/") ? relPath.startsWith(prefix) : relPath === prefix
  );
}

/**
 * Heuristica de binario equivalente a la de git: un byte NUL en el primer
 * bloque. Evita gastar tiempo (y producir ruido) en imagenes o documentos.
 */
function isBinary(buffer) {
  const limit = Math.min(buffer.length, 8000);
  for (let i = 0; i < limit; i += 1) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

/* --------------------- Chequeo --------------------- */

function main() {
  const files = trackedFiles();
  const findings = [];
  let scanned = 0;
  let skippedBinary = 0;
  let skippedMissing = 0;
  let anonymousAllowed = 0;

  for (const relPath of files) {
    if (isExcluded(relPath)) continue;

    let buffer;
    try {
      buffer = readFileSync(path.join(REPO_ROOT, relPath));
    } catch {
      // Rastreado pero ausente del disco (por ejemplo, un checkout parcial).
      skippedMissing += 1;
      continue;
    }
    if (isBinary(buffer)) {
      skippedBinary += 1;
      continue;
    }

    scanned += 1;
    const lines = buffer.toString("utf8").split("\n");
    lines.forEach((line, index) => {
      for (const { regex } of PATTERNS) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(line)) !== null) {
          if (match.groups.segment === ANONYMOUS_SEGMENT) {
            anonymousAllowed += 1;
            continue;
          }
          findings.push({
            file: relPath,
            line: index + 1,
            text: match[0].length > 96 ? `${match[0].slice(0, 96)}...` : match[0]
          });
        }
      }
    });
  }

  console.log(`Archivos rastreados: ${files.length}`);
  console.log(
    `  revisados: ${scanned}   binarios omitidos: ${skippedBinary}` +
      (skippedMissing > 0 ? `   ausentes: ${skippedMissing}` : "")
  );
  console.log(`  exclusiones: ${EXCLUDED_PATHS.map((e) => e.prefix).join(", ")}`);
  if (anonymousAllowed > 0) {
    console.log(`  marcadores anonimos admitidos (\`/Users/.../\`): ${anonymousAllowed}`);
  }

  if (findings.length === 0) {
    console.log("OK: ninguna ruta absoluta de maquina en archivos rastreados.");
    return 0;
  }

  const byFile = new Map();
  for (const finding of findings) {
    if (!byFile.has(finding.file)) byFile.set(finding.file, []);
    byFile.get(finding.file).push(finding);
  }

  console.error("");
  console.error(
    `FALLO: ${findings.length} ruta(s) absoluta(s) de maquina en ` +
      `${byFile.size} archivo(s) rastreado(s).`
  );
  for (const [file, entries] of byFile) {
    console.error(`\n  ${file}`);
    for (const entry of entries) {
      console.error(`    :${entry.line}  ${entry.text}`);
    }
  }
  console.error(
    "\n  Sustituyelas por rutas relativas al repositorio, por una variable de\n" +
      "  entorno, o por el marcador anonimo `/Users/.../` si es texto de la\n" +
      "  interfaz que solo ilustra la forma de una ruta."
  );
  return 1;
}

process.exit(main());
