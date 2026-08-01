/**
 * POST /api/lexicon/save  —  retirada.
 *
 * Escribia un lexico plano `{contaminants, diseases}` heredado del modelo
 * previo a la fase 5, cuando las dos variables estaban fijas en el codigo. El
 * formato que el pipeline ejecuta hoy es la carpeta de protocolo
 * (`variables/variable_a.json`, `variables/variable_b.json`), que escribe
 * /api/protocol/save-folder.
 *
 * Se retira en vez de solo anadirle la guardia de origen: ningun componente la
 * llamaba, y una primitiva de escritura sin llamadores es superficie de ataque
 * pura. Contenia la ruta al proyecto con `assertProjectFile`, pero eso no
 * impedia que una pagina de otro sitio sobrescribiera, desde el navegador del
 * usuario, el `protocol.json` que el pipeline va a ejecutar.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RETIRED_MESSAGE =
  "Esta ruta fue retirada. Los terminos de cada variable se guardan con POST /api/protocol/save-folder, que escribe la carpeta de protocolo completa en config/protocols/{slug} (unico formato que el pipeline puede ejecutar).";

export async function POST() {
  return NextResponse.json({ error: RETIRED_MESSAGE }, { status: 410 });
}
