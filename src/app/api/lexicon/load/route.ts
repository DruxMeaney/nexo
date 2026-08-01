/**
 * POST /api/lexicon/load  —  retirada.
 *
 * Leia el lexico plano `{contaminants, diseases}` previo a la fase 5, cuando
 * las dos variables estaban fijas en el codigo; sus presets `contaminants` y
 * `diseases` ya no describen ningun protocolo generico. La carga se hace hoy
 * con POST /api/protocol/load-folder, y cada seccion del asistente tiene
 * ademas su propio boton de importacion.
 *
 * Se retira en vez de solo anadirle la guardia de origen: no tenia llamadores,
 * y sin ella cualquier pagina abierta en el navegador podia leer y exfiltrar el
 * contenido de los archivos JSON del proyecto.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RETIRED_MESSAGE =
  "Esta ruta fue retirada. Un protocolo guardado se carga con POST /api/protocol/load-folder; las piezas sueltas (terminos, cues, secciones) se importan desde el asistente.";

export async function POST() {
  return NextResponse.json({ error: RETIRED_MESSAGE }, { status: 410 });
}
