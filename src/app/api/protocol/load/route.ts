/**
 * POST /api/protocol/load  —  retirada (alias: /api/protocols/load).
 *
 * Leia cualquier ruta absoluta del disco y devolvia su JSON, sin contencion al
 * proyecto, para un formato de protocolo plano que el pipeline ya no ejecuta.
 * La ruta soportada es /api/protocol/load-folder.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RETIRED_MESSAGE =
  "Esta ruta fue reemplazada por POST /api/protocol/load-folder, que carga un protocolo por slug desde config/protocols/.";

export async function POST() {
  return NextResponse.json({ error: RETIRED_MESSAGE }, { status: 410 });
}
