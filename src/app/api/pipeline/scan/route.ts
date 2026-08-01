/**
 * POST /api/pipeline/scan  —  retirada.
 *
 * Listaba el contenido de una carpeta arbitraria para la pantalla previa del
 * antiguo /analizador. Hoy la validacion del corpus la hace el propio runner
 * (POST /api/pipeline/run-protocol la reporta como primer paso), asi que la
 * ruta se habia quedado sin llamadores.
 *
 * Se retira en vez de solo anadirle la guardia de origen porque su contrato
 * era, por diseno, enumerar cualquier ruta del disco: `resolveUserPath` no la
 * acotaba y no puede acotarla sin romper el caso de uso legitimo (la carpeta
 * de PDFs del usuario vive donde el usuario quiera). Sin llamadores, la unica
 * forma de que no sea un enumerador de directorios para cualquier pagina
 * abierta en el navegador es no existir.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RETIRED_MESSAGE =
  "Esta ruta fue retirada. La carpeta de entrada se valida al ejecutar: POST /api/pipeline/run-protocol reporta el conteo de archivos legibles como primer paso de la corrida.";

export async function POST() {
  return NextResponse.json({ error: RETIRED_MESSAGE }, { status: 410 });
}
