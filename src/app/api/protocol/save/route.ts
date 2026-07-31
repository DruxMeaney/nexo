/**
 * POST /api/protocol/save  —  retirada (alias: /api/protocols/save).
 *
 * Escribia el protocolo plano previo a la fase 4 como un archivo suelto dentro
 * de `config/protocols/`, donde `load_protocol()` solo sabe leer carpetas: el
 * archivo quedaba invisible en /api/protocol/list y nunca se podia ejecutar.
 * Ademas aceptaba cualquier ruta absoluta, asi que era una primitiva de
 * escritura sin contencion. La ruta soportada es /api/protocol/save-folder.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RETIRED_MESSAGE =
  "Esta ruta fue reemplazada por POST /api/protocol/save-folder, que guarda el protocolo como carpeta en config/protocols/{slug} (unico formato que el pipeline puede ejecutar).";

export async function POST() {
  return NextResponse.json({ error: RETIRED_MESSAGE }, { status: 410 });
}
